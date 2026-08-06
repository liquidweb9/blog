---
title: Transactional Outbox：如何保证数据库和消息队列的一致
date: 2026-08-06
tags:
  - 分布式系统
  - 消息队列
  - 工程实践
description: 用一次下单场景说明 Dual Write Problem 和 Outbox 如何解决它，并覆盖 Worker 并发拉取、事件顺序、重试与死信处理等落地细节。
---

# Transactional Outbox：如何保证数据库和消息队列的一致

## 一句话结论

Transactional Outbox（事务发件箱）是一种跨进程一致性模式：业务数据与待发送事件写入**同一个本地数据库事务**，再由一个独立的投递进程读取发件箱表并发布到消息队列。它把“数据库已提交”和“消息已发出”两个原本无法原子完成的操作，统一到一次本地事务里，从而解决“先写库还是先发消息”的双写难题。

## 问题与场景

微服务里最常见的需求是：业务成功提交后，还要通知其他服务。比如用户下单成功后，需要发消息让库存服务扣减库存、让通知服务发送邮件。于是出现了一个经典问题：

```text
方案 A：先写订单，再发消息
  -> 写库成功，发消息失败 -> 消息丢失，下游永远不知道

方案 B：先发消息，再写订单
  -> 消息发出，写库失败 -> 下游处理了不存在的订单（幽灵消息）

方案 C：先写库，发消息失败后补偿
  -> 补偿逻辑复杂，且“发送”和“回滚”仍无法原子完成
```

更隐蔽的情况是超时：发消息的请求超时了，但 Broker 其实已经收到并转发了消息，补偿重发又会导致重复。任何一个网络调用都不能保证“恰好一次”，失败、超时、重复是分布式系统的常态。

## 什么是 Dual Write Problem

Dual Write Problem（双写问题）指：一次业务操作需要同时更新两个**相互独立**的存储系统，而这两个系统之间不存在一个能覆盖双方的原子事务。数据库事务只能保证“业务库自己的写入”原子；Broker 对“消息已持久化”的承诺发生在另一个进程里，两者无法对齐到同一个提交点。

无论采用哪种顺序，都会留下失败窗口：

- 先写业务库、后发消息：库提交后、消息发出前崩溃，事件丢失；
- 先发消息、后写业务库：消息送达后、库提交前崩溃，下游处理了不存在的订单；
- 只写一次、失败重发：超时无法区分“没发出去”和“发出去了但响应丢了”，重发会重复。

理论上可以用分布式事务解决，但代价很高：两阶段提交（2PC）依赖协调者，参与方在准备阶段会阻塞，协调者本身是单点，且 MySQL、Redis、Kafka 等系统对 XA 的支持参差不齐；Saga 把跨系统操作拆成可补偿的子步骤，但业务要能接受中间状态，还要维护每步的补偿逻辑。

Transactional Outbox 的思路是绕开“同时成功”的执念：不追求让数据库和 Broker 原子提交，而是先保证业务库侧的事务原子，再把“发消息”降级成一个可从发件箱表重放的异步动作。既然发件箱表与业务表同库同事务，失败窗口就从“写库 vs 发消息”缩小为“发件箱有没有被正确投递”，而后者是可以用重试收敛的。

## 一个具体例子

以下单场景为例。创建订单时，把**订单记录**和**订单已创建事件**放进同一个事务：

```typescript
type OutboxEvent = {
  id: string;          // 幂等键，通常是消息 ID
  aggregateType: string;
  aggregateId: string;
  eventType: string;   // 如 ORDER_CREATED
  payload: string;     // 事件 JSON 内容
  status: "pending" | "sent";
};

async function createOrder(userId: string, items: Item[]) {
  await db.transaction(async (tx) => {
    const order = await tx.order.create({ userId, items });
    await tx.outbox.insert({
      id: randomUUID(),
      aggregateType: "order",
      aggregateId: order.id,
      eventType: "ORDER_CREATED",
      payload: JSON.stringify({ orderId: order.id, userId, items }),
      status: "pending",
    });
  });
}
```

这两条语句要么一起提交，要么一起回滚。只要订单可见，事件就一定在发件箱里；事务回滚时事件也会消失，不会出现“有订单没事件”或“有事件没订单”。

随后一个独立的投递进程（Outbox Relay）扫描发件箱表，把 `pending` 的事件发布到消息队列：

```text
                ┌──────────────────────────────────────┐
                │          数据库（同一次事务）           │
  下单请求  ->   │  orders        outbox                 │
                │  1 条订单   +   1 条事件（pending）      │
                └──────────────────────────────────────┘
                          │  Outbox Relay 轮询/CDC
                          ▼
                    ┌──────────┐
                    │  消息队列  │ -> 库存服务 / 通知服务
                    └──────────┘
```

发布成功后再把 `status` 更新为 `sent`（或直接删除该行）。这样一来，**写入数据库**由本地事务保证，**发布到队列**由 Relay 重试保证，而两者之间的衔接点在发件箱表中是持久的、可查询的。

## 投递方式：轮询与事务日志追踪

Outbox Relay 如何发现新事件，有两种常见做法。

### 1. 轮询发件箱表

最简单的方式：定时查询 `status = 'pending'` 的记录并发布。

```typescript
setInterval(async () => {
  const events = await db.outbox.findMany({
    where: { status: "pending" },
    orderBy: { id: "asc" },
    take: 100,
  });
  for (const event of events) {
    await broker.publish("orders", { id: event.id, type: event.eventType, payload: JSON.parse(event.payload) });
    await db.outbox.update({ where: { id: event.id }, data: { status: "sent" } });
  }
}, 1000);
```

优点是实现简单、不依赖特定数据库能力；缺点是轮询间隔带来毫秒到秒级的延迟，且批量处理时还需要控制并发和锁，避免多个 Relay 实例重复处理同一批事件。

### 2. 事务日志追踪（Transactional Outbox + CDC）

利用数据库的事务日志或 WAL 实现接近实时的投递。Debezium 这类工具可以订阅 MySQL binlog 或 PostgreSQL WAL，把 `INSERT` 到 outbox 表的变更转成事件流。

```text
DB 事务日志 (binlog / WAL)
  -> Debezium / CDC 连接器
  -> Kafka 等消息队列
  -> 下游消费者
```

优点是延迟低、不轮询数据库、不易遗漏；缺点是引入了额外基础设施，且事件顺序、Schema 演进（比如 outbox 表结构变更）都需要额外治理。只有在延迟或吞吐成为瓶颈时，才值得从轮询迁移到 CDC。

## Outbox Worker 如何并发拉取事件

单线程轮询吞吐有限，生产环境会同时运行多个 Worker 实例。核心约束是：多个 Worker 不能把同一行重复发给 Broker。只靠 `WHERE status = 'pending'` 查询不够——两次扫描之间，两个 Worker 可能读到同一批行。

做法是“先占位、后发布、再标记”，用数据库锁保证同一行只被一个 Worker 领取。推荐用条件更新做原子占位，发布发生在事务之外，避免网络调用长期持有数据库锁：

```typescript
// 1. 原子占位：把一批事件标记为 in_flight，独立小事务立即提交并释放锁
async function claim(limit = 100): Promise<OutboxEvent[]> {
  return db.$queryRaw`
    UPDATE outbox
    SET status = 'in_flight', attempt = attempt + 1, claimed_at = NOW()
    WHERE id IN (
      SELECT id FROM outbox
      WHERE status = 'pending'
      ORDER BY id
      LIMIT ${limit}
    )
    RETURNING *`;
}

// 2. 发布到 Broker（网络调用，不应持有数据库锁）
async function publish(events: OutboxEvent[]) {
  for (const event of events) {
    await broker.publish("orders", parse(event));
  }
}

// 3. 发布成功后标记完成
async function markSent(ids: string[]) {
  await db.outbox.updateMany({ where: { id: { in: ids } }, data: { status: "sent" } });
}
```

PostgreSQL 和 MySQL 8 也支持在事务里用 `SELECT ... FOR UPDATE SKIP LOCKED` 领取：它只锁定当前能拿到的行，拿不到的立刻跳过，其他 Worker 下一轮继续处理，而不是互相阻塞。区别在于 `SKIP LOCKED` 需要把发布放在同一个事务里（锁会一直持有到提交），而 `UPDATE ... RETURNING` 占位是独立的小事务，锁在标记 `in_flight` 后立即释放，更适合把网络调用移出锁区间。

崩溃恢复：占位后进程崩溃，事件会停留在 `in_flight`。Worker 启动或定时扫描时，把 `claimed_at` 超过阈值（如 5 分钟）的行重置为 `pending`，重新领取，避免这些行被永久卡住。

顺序问题：并发 Worker 可能让同一 `aggregate_id` 的事件乱序。需要严格顺序时，按 `aggregate_id` 分片、让同一聚合始终由同一个 Worker 串行处理，或给事件携带自增版本号，由下游校验和丢弃乱序事件。

## 事件顺序、重试与死信处理

### 事件顺序

Outbox 能保证“同一聚合的写入顺序”，但要传导到下游还需要三个前提同时成立：

1. 发件箱表用自增 `id`（或时间戳）排序，Worker 扫描时 `ORDER BY id`，保证“先写入的先取出”；
2. 发布到 Broker 时按 `aggregate_id` 作为分区键，Kafka 等系统保证同一分区内有序；
3. 消费端按 `aggregate_id` 串行处理，或校验事件里的版本号，丢弃乱序、过期的事件。

任何一环放松，都可能让下游先收到“更新”、后收到“创建”。顺序语义是否必要，取决于业务：库存流水必须严格有序，而“推送通知”通常只要最终一致即可，不值得为此牺牲并发度。

### 重试

发布失败不应丢失事件。Broker 短暂不可用、网络抖动、消息过大都可能导致失败，处理方式是：

- 失败后不标记 `sent`，保留为 `pending`（或把 `in_flight` 重置为 `pending`），让 Worker 下一轮重试；
- 记录 `attempt` 计数和 `next_retry_at`，采用指数退避（如 `2^n` 秒）避免失败风暴；
- 扫描时只取 `status = 'pending' AND next_retry_at <= NOW()` 的行，退避到期的自然进入下一轮。

```typescript
async function markFailed(id: string, attempt: number) {
  const maxRetry = 5;
  await db.outbox.update({
    where: { id },
    data: {
      status: attempt >= maxRetry ? "dead" : "pending",
      attempt: attempt + 1,
      next_retry_at: new Date(Date.now() + 2 ** attempt * 1000),
      last_error: errorMessage,
    },
  });
}
```

### 死信（Dead Letter）

超过重试上限的事件进入死信，而不是无限重试拖垮队列：

- 单表方案：`status = 'dead'`，或在 outbox 表旁建 `outbox_dead_letter` 表，保留完整 payload 和失败原因；
- 队列方案：使用 Broker 自带的 DLQ（Dead Letter Queue）主题，如 Kafka 的 Retry Topic + DLQ Topic；
- 无论哪种，死信都必须有监控告警（数量、滞留时长），并预留重放入口：修复根因后，把死信重新标记为 `pending` 重新投递，或从死信表重新入队。

```text
pending ──领取──> in_flight ──发布成功──> sent / 删除
    │
    ├──失败──> 指数退避后回到 pending（attempt + 1）
    └──超过 N 次──> dead letter ──告警──> 修复后人工/自动重放
```

注意重放只是再次引入“至少一次”投递，消费端幂等仍然必须保留，否则重放会造成重复副作用。

## 实践建议

1. **把业务表和 outbox 表放在同一个数据库实例。** 模式的核心是“同库同事务”，跨数据库或跨实例就无法获得本地原子性。也可以选择专门的消息表数据库，但必须接受额外开销。
2. **发布用“至少一次”，消费端必须幂等。** Relay 重试、进程重启都会导致同一事件被重复发布，消费者要能用 `event.id` 或业务键去重。绝大多数情况接受“至少一次”而非追求“恰好一次”。
3. **先标记再删除，保证可重试。** 发布失败的事件保持 `pending`，由下一次扫描继续重试；发布成功先更新为 `sent` 或定期清理，避免表无限增长。不要在单次事务里同时做“发布消息”和“更新状态”，否则又会回到双写问题。
4. **事件里写结果，不要写过程。** payload 应包含下游判断所需的完整业务数据（如订单号、金额、用户），而不是“去查一下订单”。否则下游处理时数据库可能已变化，查询结果不可靠。
5. **控制扫描并发与顺序。** 多个 Relay 实例要使用 `SELECT ... FOR UPDATE SKIP LOCKED` 或带版本的乐观锁，防止同一事件被重复投递；需要严格顺序的场景，把聚合的版本号放进事件并按版本消费。
6. **做好监控与告警。** 监控发件箱表积压数量、单条事件滞留时间（Age）和发布失败率。积压一直增长通常意味着下游慢或投递进程故障，这是该模式最容易漏掉的故障面。
7. **只对真正需要跨服务一致性的操作使用。** 若下游只是缓存、日志或非关键通知，允许稍后一致、允许丢弃，那么引入 Outbox 反而是过度设计。

## 延伸阅读

- [Microservices.io：Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- [Message Delivery Semantics（消息投递语义）](https://kafka.apache.org/documentation/#semantics)
- [Debezium：基于 CDC 的事件流](https://debezium.io/documentation/reference/stable/tutorial.html)
- [每日技术：Alembic——如何让 SQLAlchemy 的表结构变更安全上线](/daily/2026/07/2026-07-31-alembic-database-migrations)
