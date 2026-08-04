# 后端与 Agent 系统中的幂等性专题笔记

## 1. 什么是幂等性

幂等性，英文为 **Idempotency**。

在计算机系统中，幂等性通常指：

> 对同一个操作执行一次和执行多次，最终产生的业务结果保持一致。

可以简单理解为：

```text
执行一次的结果 = 重复执行多次的最终结果
```

例如，将订单状态修改为“已取消”：

```text
第一次执行：订单状态由“待支付”变成“已取消”
第二次执行：订单状态仍然是“已取消”
第三次执行：订单状态仍然是“已取消”
```

这个操作是幂等的。

但如果是对账户余额进行扣款：

```text
第一次执行：余额 -100
第二次执行：余额再次 -100
第三次执行：余额再次 -100
```

这个操作默认不是幂等的。

需要注意：

> 幂等并不要求每次请求返回的内容完全相同，而是要求最终业务状态和副作用保持一致。

例如第一次取消订单返回：

```json
{
  "success": true,
  "message": "订单取消成功"
}
```

第二次取消订单返回：

```json
{
  "success": true,
  "message": "订单已经取消"
}
```

两次响应内容不同，但订单最终都处于“已取消”状态，因此仍然可以认为业务操作是幂等的。

---

# 2. 为什么需要保证幂等性

分布式系统中，调用方通常无法百分之百确定一次请求是否成功。

例如调用支付服务：

```text
订单服务发送扣款请求
        ↓
支付服务扣款成功
        ↓
支付服务返回响应
        ↓
网络超时，订单服务没有收到响应
```

订单服务只知道：

```text
请求超时了
```

但它无法判断：

```text
1. 支付服务根本没有收到请求
2. 支付服务收到了请求，但还没有处理
3. 支付服务已经处理成功，只是响应丢失
```

如果订单服务直接重试：

```text
第一次扣款成功
第二次重试再次扣款
```

用户就会被重复扣款。

因此，只要系统中存在以下情况，就需要考虑幂等性：

- 网络超时；
- 请求重试；
- 消息重复投递；
- 服务重启；
- 客户端重复点击；
- 定时任务重复执行；
- 消费者异常重启；
- 网关自动重试；
- Agent 重复调用工具；
- 工作流断点恢复；
- 人工重复提交；
- 第三方平台重复回调。

---

# 3. 幂等性解决的核心问题

幂等性主要解决的不是“请求是否重复”，而是：

> 当同一个业务意图被重复执行时，如何避免重复产生副作用。

常见副作用包括：

```text
重复创建数据
重复扣款
重复退款
重复发货
重复发送短信
重复发送邮件
重复创建工单
重复执行任务
重复写入记忆
重复调用外部接口
重复生成文件
重复消耗 Token
重复触发 Agent 工具
```

幂等性的核心问题可以概括为：

```text
如何识别“这是同一个业务操作”？
如何判断“这个操作之前是否执行过”？
如何保存“上一次执行结果”？
如何避免“多个请求同时执行”？
失败后应该“重试、恢复还是补偿”？
```

---

# 4. 哪些场景需要保证幂等性

## 4.1 前端重复提交

用户可能因为页面卡顿连续点击按钮：

```text
提交订单
提交订单
提交订单
```

如果后端没有幂等控制，可能创建三张订单。

常见场景：

- 创建订单；
- 提交表单；
- 发布文章；
- 创建任务；
- 上传文件；
- 发起支付；
- 申请退款；
- 保存配置。

---

## 4.2 网络超时后的自动重试

调用方没有收到响应，不代表服务端没有执行成功。

```text
客户端调用服务端
        ↓
服务端处理成功
        ↓
返回结果时网络超时
        ↓
客户端重试
```

对于查询操作，重试一般没有问题。

对于写操作，重试可能产生重复副作用。

---

## 4.3 消息队列重复消费

大多数消息队列采用的是：

```text
至少投递一次
At Least Once
```

也就是说，一条消息可能会被消费者收到多次。

例如：

```text
消费者处理消息成功
        ↓
数据库写入成功
        ↓
消费者还没有提交 ACK
        ↓
进程宕机
        ↓
消息队列重新投递
```

消费者重启后会再次收到相同消息。

因此消息消费者通常必须具备幂等能力。

---

## 4.4 第三方平台回调

支付平台、物流平台、云服务平台等通常会重复发送回调。

例如支付回调：

```text
支付成功回调第一次到达
支付成功回调第二次到达
支付成功回调第三次到达
```

后端必须保证：

```text
订单只能完成一次
库存只能扣减一次
积分只能增加一次
通知可以根据需要去重
```

---

## 4.5 定时任务重复执行

定时任务可能因为以下原因重复运行：

- 多实例同时执行；
- 服务重启补偿；
- 调度中心重试；
- 上一次任务执行超时；
- 分布式锁失效；
- 人工重复触发。

例如每日账单任务重复执行，可能导致：

```text
同一天生成两份账单
同一笔费用结算两次
同一封通知发送两次
```

---

## 4.6 分布式事务补偿

Saga、TCC、事务消息等分布式事务方案中，以下操作都可能重复执行：

```text
Try
Confirm
Cancel
补偿任务
```

因此 Confirm 和 Cancel 通常必须是幂等的。

例如：

```text
Cancel 第一次执行：释放库存
Cancel 第二次执行：不能再次增加库存
```

---

## 4.7 Agent 工具调用

Agent 的执行过程通常不是完全确定的。

Agent 可能因为以下原因重复执行工具：

- 模型重新规划；
- 请求超时重试；
- 工作流恢复；
- 上下文丢失；
- Agent 判断工具没有成功；
- 多 Agent 重复领取任务；
- 消息重复投递；
- 人工点击重新执行；
- 流程节点重新运行。

例如 Agent 调用支付工具：

```text
Agent 第一次调用 payment()
支付成功，但工具响应超时

Agent 认为失败，再次调用 payment()
发生重复扣款
```

因此 Agent 中的工具调用，尤其是有外部副作用的工具，必须具备幂等能力。

---

# 5. HTTP 方法与幂等性

从 HTTP 语义上看：

| HTTP 方法 | 是否安全 | 是否通常幂等 | 说明 |
|---|---:|---:|---|
| GET | 是 | 是 | 查询资源，不应产生业务副作用 |
| HEAD | 是 | 是 | 只获取响应头 |
| OPTIONS | 是 | 是 | 获取服务支持能力 |
| PUT | 否 | 是 | 使用完整数据替换指定资源 |
| DELETE | 否 | 是 | 删除同一资源多次，最终状态相同 |
| PATCH | 否 | 不一定 | 部分更新，是否幂等取决于实现 |
| POST | 否 | 通常不是 | 常用于创建资源或执行动作 |

需要注意：

> HTTP 方法在协议语义上幂等，不代表具体业务实现一定幂等。

例如下面的 PUT 操作就不是幂等的：

```http
PUT /users/100/score
```

请求内容：

```json
{
  "increment": 10
}
```

每调用一次，积分都会增加 10。

虽然使用了 PUT，但业务操作本质仍然是累加，所以不是幂等的。

同样，POST 也可以通过幂等键实现幂等：

```http
POST /orders
Idempotency-Key: order-request-20260804-0001
```

---

# 6. 不保证幂等会出现什么问题

## 6.1 数据库层面的问题

### 重复插入数据

例如创建订单请求被执行两次：

```text
ORDER202608040001
ORDER202608040002
```

虽然用户只购买了一次，但系统创建了两张订单。

---

### 重复扣减库存

```sql
UPDATE product_stock
SET stock = stock - 1
WHERE product_id = 100;
```

如果重复执行两次：

```text
原库存：10
第一次执行：9
第二次执行：8
```

用户只购买一件商品，却扣除了两件库存。

---

### 重复扣款或退款

```sql
UPDATE account
SET balance = balance - 100
WHERE user_id = 1;
```

重复执行会直接造成资金损失。

---

### 计数器漂移

例如：

```sql
UPDATE article
SET view_count = view_count + 1
WHERE id = 100;
```

如果请求因为网络问题重复提交，会导致浏览量、下载量、积分等数据不准确。

---

### 状态机紊乱

例如订单状态：

```text
待支付 → 已支付 → 已发货 → 已完成
```

重复消息或乱序消息可能导致：

```text
已发货 → 已支付
已完成 → 已取消
已退款 → 再次退款
```

如果只执行简单的状态覆盖：

```sql
UPDATE orders
SET status = 'PAID'
WHERE id = 100;
```

就可能破坏业务状态机。

---

### 唯一约束冲突

多个重复请求同时插入相同业务数据：

```sql
INSERT INTO payment_record(payment_no, amount)
VALUES ('PAY001', 100);
```

如果数据库存在唯一索引，后续请求会报：

```text
Duplicate entry
```

唯一约束可以防止重复数据，但应用层需要正确处理这个异常，而不是直接返回系统错误。

---

### 锁竞争与死锁

大量重复请求会对同一行数据进行操作：

```text
请求 A 更新订单
请求 B 更新订单
请求 C 更新订单
请求 D 更新订单
```

可能带来：

- 行锁竞争；
- 事务等待；
- 数据库连接耗尽；
- 死锁；
- RT 上升；
- 吞吐量下降。

---

## 6.2 Redis 层面的问题

### INCR 被重复执行

```text
INCR user:1:points
```

请求重复会导致积分被多次增加。

---

### List 或 Stream 重复写入

```text
LPUSH task:list task-001
```

如果重复执行，会产生多个相同任务。

---

### 分布式锁误用

常见错误：

```text
SETNX lock:order:100 request-a
业务执行时间过长
锁提前过期
请求-b获得锁
请求-a和请求-b同时执行
```

这会导致所谓的“锁失效并发执行”。

另一个常见错误是直接删除锁：

```text
请求 A 的锁过期
请求 B 获得新锁
请求 A 执行 DEL
请求 A 把请求 B 的锁删除了
```

因此释放锁时必须校验锁值。

---

### TTL 设置不合理

如果幂等记录只保存 10 秒：

```text
第一次请求执行成功
10 秒后幂等记录过期
客户端再次重试
业务再次执行
```

幂等记录的有效期必须覆盖业务可能发生重试的最大时间窗口。

---

### Redis 与数据库不一致

例如：

```text
Redis 写入“已处理”
数据库事务执行失败
```

后续请求看到 Redis 中已经处理，直接返回成功，但数据库中其实没有数据。

相反：

```text
数据库事务提交成功
Redis 幂等记录写入失败
```

后续请求可能再次执行业务。

因此 Redis 幂等记录不能随意替代数据库业务事实。

---

## 6.3 服务层面的问题

### 重复调用下游服务

一次业务请求可能调用多个服务：

```text
订单服务
  ├─ 库存服务
  ├─ 支付服务
  ├─ 优惠券服务
  ├─ 积分服务
  └─ 通知服务
```

如果订单服务整体重试，可能导致所有下游服务重复执行。

---

### 重试风暴

当下游服务超时时，上游服务不断重试：

```text
1000 个请求
每个请求重试 3 次
最终变成 4000 次调用
```

如果多个服务层层重试：

```text
网关重试 × 服务 A 重试 × 服务 B 重试
```

请求量可能呈倍数增长。

这就是重试放大或重试风暴。

---

### 数据不一致

例如创建订单流程：

```text
订单创建成功
库存扣减成功
支付调用成功
积分增加失败
```

如果整体重试，又可能发生：

```text
库存重复扣减
支付重复执行
积分最终成功
```

系统最终会进入部分成功、部分重复的状态。

---

### 重复通知

虽然重复通知通常不破坏核心数据，但会影响用户体验：

```text
重复短信
重复邮件
重复 App 推送
重复企业微信通知
```

某些通知本身也可能有业务副作用，例如：

```text
发送一次性兑换码
发送邀请链接
触发营销优惠
```

---

## 6.4 Agent 层面的问题

### 工具重复调用

```text
create_ticket()
send_email()
execute_sql()
pay_order()
refund_order()
deploy_service()
```

这些工具都可能产生真实世界副作用。

Agent 重复调用可能导致：

- 重复创建工单；
- 重复发邮件；
- 重复修改数据库；
- 重复支付或退款；
- 重复部署；
- 重复删除资源。

---

### 记忆重复写入

Agent 可能多次向长期记忆写入同一内容：

```text
用户喜欢 Java
用户喜欢 Java
用户喜欢 Java
```

会导致：

- 记忆膨胀；
- 检索结果重复；
- 上下文污染；
- Token 消耗增加；
- 模型判断出现偏差。

---

### 任务重复领取

多 Agent 系统中，两个 Agent 可能同时领取同一个任务：

```text
Agent A 领取任务 T1
Agent B 也领取任务 T1
```

两个 Agent 都开始执行，造成重复输出或重复副作用。

---

### 工作流恢复后重复执行

例如 Agent 工作流：

```text
步骤 1：查询用户
步骤 2：创建订单
步骤 3：发送通知
```

执行到步骤 3 时服务崩溃。

系统恢复后从步骤 1 重新执行：

```text
再次创建订单
再次发送通知
```

因此 Agent 工作流必须记录每个步骤的执行状态和结果。

---

# 7. 幂等设计的核心思路

幂等方案通常围绕以下几个问题设计。

## 7.1 唯一标识一次业务操作

需要为一次业务意图分配唯一标识，例如：

```text
Idempotency-Key
RequestId
BusinessNo
OrderNo
PaymentNo
MessageId
TaskId
RunId
StepId
OperationId
ToolCallId
```

关键点是：

> 标识的应该是业务操作，而不是单纯的一次 HTTP 请求。

例如用户创建订单时，客户端因为超时重新发起请求。

两次 HTTP 请求的 RequestId 可以不同，但它们属于同一个“创建订单”业务意图，因此应该使用相同的 Idempotency-Key。

---

## 7.2 保存执行状态

常见状态包括：

```text
INIT
PROCESSING
SUCCESS
FAILED
CANCELLED
```

例如：

| 幂等键 | 业务类型 | 状态 | 结果 |
|---|---|---|---|
| req-001 | CREATE_ORDER | SUCCESS | order_id=1001 |
| req-002 | PAYMENT | PROCESSING | null |
| req-003 | REFUND | FAILED | timeout |

重复请求到达时，根据状态决定：

```text
SUCCESS：
直接返回上一次结果

PROCESSING：
提示处理中，或者等待当前请求完成

FAILED：
根据失败类型决定是否允许重试

不存在：
创建记录并开始执行
```

---

## 7.3 限制业务状态转换

不要允许任意状态覆盖。

错误示例：

```sql
UPDATE orders
SET status = 'PAID'
WHERE id = 100;
```

更安全的写法：

```sql
UPDATE orders
SET status = 'PAID'
WHERE id = 100
  AND status = 'PENDING_PAYMENT';
```

然后检查受影响行数：

```text
影响 1 行：
状态转换成功

影响 0 行：
订单不存在，或者订单已经不是待支付状态
```

这种方式把状态转换条件放在数据库中，可以避免并发请求同时修改状态。

---

## 7.4 数据库兜底

幂等性不能只依赖前端按钮禁用，也不能只依赖应用内存。

因为：

```text
前端可以绕过
请求可能来自第三方
服务可能多实例部署
应用可能重启
网络可能重放请求
```

数据库通常需要提供最终兜底：

- 唯一索引；
- 条件更新；
- 事务；
- 乐观锁；
- 幂等记录表；
- 业务状态机。

---

# 8. 常见幂等解决方案

## 8.1 前端按钮防重复点击

提交后立即禁用按钮：

```javascript
let submitting = false;

async function submitOrder() {
  if (submitting) {
    return;
  }

  submitting = true;

  try {
    await createOrder();
  } finally {
    submitting = false;
  }
}
```

优点：

- 实现简单；
- 可以减少普通用户误操作；
- 能降低重复请求数量。

缺点：

- 不能防止接口直接调用；
- 刷新页面后状态丢失；
- 多设备提交无法控制；
- 无法解决网络重试；
- 不能作为最终幂等方案。

因此前端防重复只能作为用户体验优化。

---

## 8.2 数据库唯一索引

例如订单表中，业务订单号必须唯一：

```sql
CREATE UNIQUE INDEX uk_order_no
ON orders(order_no);
```

插入订单：

```sql
INSERT INTO orders(order_no, user_id, amount)
VALUES ('ORDER202608040001', 100, 299.00);
```

重复插入时数据库会拒绝。

应用层需要捕获唯一键异常，然后查询原记录：

```text
插入成功：
返回新订单

唯一键冲突：
查询已有订单并返回
```

优点：

- 简单可靠；
- 数据库最终兜底；
- 适合防止重复创建资源；
- 多实例环境下仍然有效。

缺点：

- 只能处理可以建立唯一约束的业务；
- 唯一键设计不合理会误伤正常请求；
- 需要正确处理唯一键冲突；
- 不能单独解决复杂工作流重复执行。

适用场景：

- 创建订单；
- 创建支付单；
- 发放优惠券；
- 创建用户；
- 消费消息；
- 第三方回调记录。

---

## 8.3 INSERT IGNORE

MySQL 示例：

```sql
INSERT IGNORE INTO message_consume_record(
    consumer_group,
    message_id,
    created_at
)
VALUES (
    'order-consumer',
    'message-001',
    NOW()
);
```

然后检查受影响行数。

```text
影响 1 行：
第一次消费，可以继续处理

影响 0 行：
记录已经存在，是重复消息
```

需要注意：

`INSERT IGNORE` 可能忽略除唯一键冲突以外的其他错误，复杂业务中应谨慎使用。

---

## 8.4 UPSERT

MySQL 示例：

```sql
INSERT INTO idempotency_record(
    idempotency_key,
    status,
    created_at
)
VALUES (
    'req-001',
    'PROCESSING',
    NOW()
)
ON DUPLICATE KEY UPDATE
    idempotency_key = VALUES(idempotency_key);
```

PostgreSQL 示例：

```sql
INSERT INTO idempotency_record(
    idempotency_key,
    status,
    created_at
)
VALUES (
    'req-001',
    'PROCESSING',
    NOW()
)
ON CONFLICT (idempotency_key)
DO NOTHING;
```

UPSERT 适合用于：

- 幂等记录；
- 消息去重；
- 任务领取；
- 外部事件落库；
- Agent 步骤执行记录。

---

## 8.5 条件更新

例如扣减库存：

```sql
UPDATE product_stock
SET stock = stock - 1
WHERE product_id = 100
  AND stock >= 1;
```

但这只能防止库存扣成负数，并不能识别同一个订单是否重复扣减。

更完整的方案通常是：

```text
订单号 + 商品 ID 建立唯一扣减记录
```

例如：

```sql
CREATE TABLE stock_deduction_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_no VARCHAR(64) NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uk_order_product(order_no, product_id)
);
```

处理逻辑：

```text
先插入扣减记录
插入成功 → 扣减库存
唯一键冲突 → 说明该订单已经扣减过
```

---

## 8.6 乐观锁

表中增加版本号：

```sql
ALTER TABLE orders
ADD COLUMN version INT NOT NULL DEFAULT 0;
```

更新时带上旧版本：

```sql
UPDATE orders
SET status = 'PAID',
    version = version + 1
WHERE id = 100
  AND status = 'PENDING_PAYMENT'
  AND version = 3;
```

如果受影响行数为 0，说明：

- 数据已经被其他请求修改；
- 当前请求使用的是旧版本；
- 状态已经发生变化。

优点：

- 不需要长期持有数据库锁；
- 适合读多写少；
- 可以防止并发覆盖。

缺点：

- 冲突时需要重试或返回失败；
- 高并发写入下重试成本较高；
- 乐观锁本身不等于完整幂等；
- 仍然需要业务唯一标识。

---

## 8.7 悲观锁

```sql
SELECT *
FROM orders
WHERE id = 100
FOR UPDATE;
```

在事务中锁住数据后再判断和修改。

优点：

- 逻辑直观；
- 可以串行化同一资源的修改。

缺点：

- 锁等待；
- 吞吐量下降；
- 可能死锁；
- 长事务影响较大；
- 不适合高并发长流程。

悲观锁更适合：

- 单条核心数据；
- 临界区很短；
- 冲突概率很高；
- 数据库压力可控。

---

## 8.8 幂等记录表

通用表结构示例：

```sql
CREATE TABLE idempotency_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    idempotency_key VARCHAR(128) NOT NULL,
    business_type VARCHAR(64) NOT NULL,
    request_hash VARCHAR(128) DEFAULT NULL,
    status VARCHAR(32) NOT NULL,
    response_data TEXT DEFAULT NULL,
    error_message VARCHAR(1000) DEFAULT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_business_key(
        business_type,
        idempotency_key
    )
);
```

字段说明：

```text
idempotency_key：
一次业务操作的唯一标识

business_type：
业务类型，例如 CREATE_ORDER、PAYMENT、REFUND

request_hash：
请求参数摘要，防止同一个幂等键被用于不同参数

status：
PROCESSING、SUCCESS、FAILED

response_data：
保存上一次成功响应

error_message：
失败信息
```

处理流程：

```text
1. 根据 business_type + idempotency_key 插入 PROCESSING 记录
2. 插入成功，说明是第一次请求
3. 执行业务逻辑
4. 成功后更新为 SUCCESS，并保存结果
5. 失败后更新为 FAILED
6. 如果插入时发生唯一键冲突，则查询已有记录
7. SUCCESS 直接返回历史结果
8. PROCESSING 返回处理中
9. FAILED 根据失败类型决定是否重试
```

---

## 8.9 Redis SET NX

基本写法：

```text
SET idempotent:create-order:req-001 PROCESSING NX EX 300
```

含义：

```text
NX：只有 Key 不存在时才能写入
EX 300：300 秒后过期
```

返回成功：

```text
第一次请求，可以执行业务
```

返回失败：

```text
Key 已存在，可能是重复请求
```

优点：

- 性能高；
- 实现简单；
- 适合短时间内防重复；
- 可以减轻数据库压力。

缺点：

- Redis 故障可能导致幂等失效；
- TTL 过短可能重复执行；
- TTL 过长可能阻止正常重试；
- 无法天然保存完整业务结果；
- Redis 与数据库可能不一致；
- 不能替代数据库唯一约束。

---

## 8.10 Redis 保存执行结果

可以将状态和结果保存到 Redis：

```text
idempotent:payment:req-001
```

值：

```json
{
  "status": "SUCCESS",
  "paymentId": "PAY10001",
  "amount": 100
}
```

重复请求到达时直接返回历史结果。

推荐状态：

```text
PROCESSING
SUCCESS
FAILED_RETRYABLE
FAILED_FINAL
```

但仍然需要考虑：

```text
Redis 数据丢失后怎么办？
Redis 更新成功、数据库失败怎么办？
数据库成功、Redis 更新失败怎么办？
```

对于资金、订单、库存等核心业务，数据库应当是最终事实来源。

---

## 8.11 Redis Lua 脚本

多个 Redis 命令需要原子执行时，应使用 Lua。

例如只有不存在时才设置处理中状态：

```lua
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local value = ARGV[2]

if redis.call('EXISTS', key) == 1 then
    return redis.call('GET', key)
end

redis.call('SET', key, value, 'EX', ttl)
return nil
```

Lua 脚本可以避免：

```text
先 EXISTS
再 SET
```

之间出现并发竞争。

但 Lua 只能保证 Redis 内部操作原子性，不能自动保证 Redis 和数据库之间的事务一致性。

---

## 8.12 分布式锁

常见加锁方式：

```text
SET lock:order:100 random-token NX PX 30000
```

其中锁值必须使用随机 Token：

```text
lock value = 550e8400-e29b-41d4-a716-446655440000
```

释放锁时必须比较 Token。

Lua 解锁脚本：

```lua
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end

return 0
```

分布式锁主要解决：

```text
同一时刻只允许一个请求执行
```

而幂等性解决：

```text
同一个业务操作重复执行时，只产生一次效果
```

二者不是同一个概念。

即使使用了分布式锁，也可能发生：

```text
第一次请求执行完成
释放锁
第二次重复请求再次获得锁
再次执行业务
```

因此：

> 分布式锁不能单独保证幂等性。

更可靠的方案通常是：

```text
分布式锁
+
业务唯一键
+
数据库状态判断
```

---

## 8.13 Token 机制

适合表单提交。

流程：

```text
1. 前端请求获取一次性 Token
2. 服务端将 Token 保存到 Redis
3. 前端提交表单时携带 Token
4. 服务端原子删除 Token
5. 删除成功才允许执行业务
6. 删除失败说明 Token 已经使用
```

Redis Lua：

```lua
local key = KEYS[1]
local token = ARGV[1]

if redis.call('GET', key) == token then
    redis.call('DEL', key)
    return 1
end

return 0
```

优点：

- 可以防止表单重复提交；
- 实现比较直观。

缺点：

- 页面刷新可能需要重新获取；
- 不适合服务间长期重试；
- Token 丢失后恢复困难；
- 仍然建议数据库提供最终兜底。

---

# 9. 消息队列中的幂等性

## 9.1 为什么消息会重复

常见场景：

```text
消息处理成功
数据库提交成功
ACK 发送前消费者宕机
消息被重新投递
```

因此消费者不能假设：

```text
每条消息只会收到一次
```

更现实的设计是：

```text
消息可能重复
消费者必须幂等
```

---

## 9.2 使用 MessageId 去重

消息结构：

```json
{
  "messageId": "msg-20260804-001",
  "eventType": "ORDER_PAID",
  "orderNo": "ORDER001",
  "payload": {}
}
```

消费记录表：

```sql
CREATE TABLE message_consume_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    consumer_group VARCHAR(64) NOT NULL,
    message_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_consumer_message(
        consumer_group,
        message_id
    )
);
```

处理流程：

```text
1. 插入消费记录
2. 插入成功，开始消费
3. 插入失败，说明已经消费过
4. 业务成功后提交事务
5. 再提交 ACK
```

---

## 9.3 消费记录和业务操作放在同一事务

推荐：

```text
数据库事务开始
    插入消费记录
    执行业务更新
数据库事务提交
提交消息 ACK
```

伪代码：

```java
@Transactional
public void consume(OrderPaidEvent event) {
    boolean inserted = consumeRecordRepository.tryInsert(
        "order-consumer",
        event.getMessageId()
    );

    if (!inserted) {
        return;
    }

    orderService.markAsPaid(event.getOrderNo());
}
```

这样可以保证：

```text
消费记录成功
和
业务处理成功
```

要么一起提交，要么一起回滚。

---

## 9.4 不要轻易相信“Exactly Once”

分布式系统中，真正端到端的 Exactly Once 很难实现。

很多系统所谓的 Exactly Once，实际是：

```text
消息可能重复投递
+
消费者幂等处理
+
事务性状态管理
```

更实用的目标是：

> At Least Once 投递，加上幂等消费，最终实现业务效果只发生一次。

---

# 10. 数据库事务与幂等性的关系

事务解决的是：

```text
一组数据库操作要么全部成功，要么全部失败
```

幂等解决的是：

```text
同一个业务操作重复执行时，最终结果保持一致
```

二者不能互相替代。

例如：

```java
@Transactional
public void pay(Long userId, BigDecimal amount) {
    accountRepository.deduct(userId, amount);
    paymentRepository.insert(userId, amount);
}
```

事务可以保证：

```text
扣款和支付记录同时成功或同时失败
```

但如果整个方法被调用两次：

```text
第一次事务成功
第二次事务也成功
```

仍然会重复扣款。

因此：

```text
事务 != 幂等
锁 != 幂等
唯一索引 != 完整幂等流程
重试 != 幂等
```

通常需要组合使用。

---

# 11. 典型业务方案

## 11.1 创建订单

推荐方案：

```text
客户端生成 Idempotency-Key
+
订单表业务单号唯一索引
+
幂等记录表
+
成功结果缓存
```

请求：

```http
POST /api/orders
Idempotency-Key: 5f24fb36-1907-4db9-82d4-f85e9f76c123
```

处理：

```text
1. 检查幂等键
2. 不存在则创建 PROCESSING 记录
3. 创建订单
4. 保存订单 ID 和响应
5. 更新幂等记录为 SUCCESS
6. 重复请求直接返回原订单
```

---

## 11.2 支付

支付业务推荐使用独立支付单号：

```text
OrderNo：业务订单号
PaymentNo：支付单号
RequestNo：本次支付请求号
```

数据库约束：

```sql
CREATE UNIQUE INDEX uk_payment_no
ON payment_order(payment_no);
```

扣款时还需要条件更新：

```sql
UPDATE payment_order
SET status = 'SUCCESS',
    paid_at = NOW()
WHERE payment_no = 'PAY001'
  AND status = 'PROCESSING';
```

检查影响行数。

对于外部支付渠道，也需要将相同的幂等键传递给渠道。

---

## 11.3 退款

退款通常不能简单使用订单号作为唯一键，因为一个订单可能允许多次部分退款。

可以使用：

```text
退款请求号 RefundRequestNo
```

例如：

```text
ORDER001-REFUND-001
ORDER001-REFUND-002
```

同一个退款请求号只能执行一次。

---

## 11.4 库存扣减

推荐使用：

```text
orderNo + productId + skuId + operationType
```

作为业务唯一键。

例如：

```text
ORDER001 + SKU100 + DEDUCT
```

回滚时使用不同操作类型：

```text
ORDER001 + SKU100 + RELEASE
```

必须避免：

```text
重复扣减
重复释放
```

---

## 11.5 短信和邮件

通知不一定需要和订单、支付一样强的一致性，但应该避免大量重复发送。

可以使用：

```text
businessType + businessId + templateCode + receiver
```

作为去重键。

例如：

```text
ORDER_PAID:ORDER001:SMS001:13800000000
```

需要根据业务决定去重窗口：

```text
验证码：短时间内允许重新发送
支付通知：一般只发一次
任务提醒：可能每天允许发送一次
```

---

## 11.6 文件上传

可以使用文件摘要去重：

```text
SHA-256(fileContent)
```

或者使用：

```text
uploadSessionId + partNumber
```

分片上传时，同一个分片重复上传应覆盖或直接返回已上传结果，而不是重复追加。

---

# 12. Spring Boot 幂等接口示例

## 12.1 Controller

```java
@RestController
@RequestMapping("/orders")
public class OrderController {

    private final OrderApplicationService orderApplicationService;

    public OrderController(
            OrderApplicationService orderApplicationService) {
        this.orderApplicationService = orderApplicationService;
    }

    @PostMapping
    public CreateOrderResponse createOrder(
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody CreateOrderRequest request) {

        return orderApplicationService.createOrder(
                idempotencyKey,
                request
        );
    }
}
```

---

## 12.2 Application Service

```java
@Service
public class OrderApplicationService {

    private final IdempotencyService idempotencyService;
    private final OrderService orderService;

    public OrderApplicationService(
            IdempotencyService idempotencyService,
            OrderService orderService) {
        this.idempotencyService = idempotencyService;
        this.orderService = orderService;
    }

    public CreateOrderResponse createOrder(
            String idempotencyKey,
            CreateOrderRequest request) {

        String businessType = "CREATE_ORDER";
        String requestHash = RequestHashUtils.sha256(request);

        IdempotencyResult<CreateOrderResponse> result =
                idempotencyService.execute(
                        businessType,
                        idempotencyKey,
                        requestHash,
                        CreateOrderResponse.class,
                        () -> orderService.createOrder(request)
                );

        return result.getData();
    }
}
```

---

## 12.3 幂等服务伪代码

```java
public <T> IdempotencyResult<T> execute(
        String businessType,
        String idempotencyKey,
        String requestHash,
        Class<T> responseType,
        Supplier<T> action) {

    IdempotencyRecord record = repository.find(
            businessType,
            idempotencyKey
    );

    if (record != null) {
        if (!Objects.equals(
                record.getRequestHash(),
                requestHash)) {
            throw new IllegalArgumentException(
                    "同一个幂等键不能用于不同请求参数"
            );
        }

        if (record.isSuccess()) {
            return deserialize(
                    record.getResponseData(),
                    responseType
            );
        }

        if (record.isProcessing()) {
            throw new BusinessException(
                    "请求正在处理中"
            );
        }
    }

    boolean created = repository.tryCreateProcessing(
            businessType,
            idempotencyKey,
            requestHash
    );

    if (!created) {
        return execute(
                businessType,
                idempotencyKey,
                requestHash,
                responseType,
                action
        );
    }

    try {
        T response = action.get();

        repository.markSuccess(
                businessType,
                idempotencyKey,
                serialize(response)
        );

        return IdempotencyResult.success(response);
    } catch (Exception ex) {
        repository.markFailed(
                businessType,
                idempotencyKey,
                ex.getMessage()
        );

        throw ex;
    }
}
```

实际生产代码需要避免无限递归，可以改为有限重试或重新查询。

---

# 13. Agent 系统中的幂等性

Agent 和普通后端服务相比，更需要关注幂等性。

原因是 Agent 具有以下特点：

- 模型输出具有不确定性；
- 可能自动重试；
- 可能重新规划；
- 可能调用多个外部工具；
- 可能长时间运行；
- 可能断点恢复；
- 可能被人工重新触发；
- 可能由多个 Agent 协作；
- 可能重复读取和写入记忆；
- 可能无法准确判断工具是否已经执行成功。

---

## 13.1 Agent 中的标识体系

建议至少设计以下标识：

```text
ConversationId：
一次用户会话

RunId：
一次 Agent 执行流程

TaskId：
一个业务任务

StepId：
工作流中的一个步骤

ToolCallId：
一次工具调用

OperationId：
一次有副作用的业务操作

MessageId：
事件或消息标识
```

示例：

```text
conversation_id = conv-001
run_id = run-20260804-001
task_id = create-order-001
step_id = step-03
tool_call_id = tool-call-08
operation_id = payment-order001-001
```

其中真正用于业务幂等的，通常是：

```text
OperationId
```

而不是模型每次生成的 ToolCallId。

因为模型重新规划后，ToolCallId 可能变化，但业务意图仍然是同一个。

---

## 13.2 Agent 工具分类

### 只读工具

例如：

```text
搜索知识库
查询订单
查询天气
读取文件
查询数据库
```

通常天然比较接近幂等。

但仍需注意：

- 查询接口是否会记录访问次数；
- 是否会产生计费；
- 是否会刷新缓存；
- 是否会记录审计日志；
- 是否会调用昂贵的外部模型。

---

### 可重复覆盖工具

例如：

```text
设置用户昵称
修改任务状态
更新配置
将订单状态改为已取消
```

如果目标值固定，通常比较容易实现幂等。

例如：

```text
set_status(task_id, "COMPLETED")
```

重复执行后状态仍然是 `COMPLETED`。

---

### 累加型工具

例如：

```text
余额增加 100
积分增加 10
库存减少 1
计数器加 1
```

这类工具默认不幂等。

应改造成带业务操作号的接口：

```python
add_points(
    user_id=100,
    points=10,
    operation_id="reward-order-001"
)
```

后端根据 `operation_id` 去重。

---

### 高风险外部副作用工具

例如：

```text
支付
退款
发邮件
发短信
删除云资源
发布内容
部署服务
执行 SQL
创建工单
提交审批
```

这些工具必须满足至少一项：

```text
工具本身支持 Idempotency-Key
业务系统提供操作流水
执行前需要人工确认
执行结果可以查询
操作可以补偿
```

---

## 13.3 Agent 工具调用流水表

```sql
CREATE TABLE agent_tool_execution (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    run_id VARCHAR(128) NOT NULL,
    task_id VARCHAR(128) NOT NULL,
    step_id VARCHAR(128) NOT NULL,
    operation_id VARCHAR(128) NOT NULL,
    tool_name VARCHAR(128) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    request_data TEXT DEFAULT NULL,
    response_data TEXT DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_operation_id(operation_id)
);
```

处理逻辑：

```text
1. Agent 生成业务 OperationId
2. 调用工具前插入 PROCESSING 记录
3. 如果 OperationId 已存在：
   - SUCCESS：返回历史结果
   - PROCESSING：等待或返回处理中
   - FAILED_RETRYABLE：允许重试
   - FAILED_FINAL：不再执行
4. 调用真实工具
5. 保存工具结果
6. 工作流恢复时读取历史结果
```

---

## 13.4 Agent 工具幂等包装器

Python 示例：

```python
from collections.abc import Callable
from typing import Any


class ToolExecutionRepository:
    def get(self, operation_id: str) -> dict[str, Any] | None:
        raise NotImplementedError

    def try_create(
        self,
        operation_id: str,
        tool_name: str,
        request_hash: str,
    ) -> bool:
        raise NotImplementedError

    def mark_success(
        self,
        operation_id: str,
        response: Any,
    ) -> None:
        raise NotImplementedError

    def mark_failed(
        self,
        operation_id: str,
        error: str,
    ) -> None:
        raise NotImplementedError


class IdempotentToolExecutor:
    def __init__(
        self,
        repository: ToolExecutionRepository,
    ) -> None:
        self.repository = repository

    def execute(
        self,
        operation_id: str,
        tool_name: str,
        request_hash: str,
        action: Callable[[], Any],
    ) -> Any:
        existing = self.repository.get(operation_id)

        if existing is not None:
            if existing["request_hash"] != request_hash:
                raise ValueError(
                    "同一个 operation_id 不能用于不同参数"
                )

            if existing["status"] == "SUCCESS":
                return existing["response"]

            if existing["status"] == "PROCESSING":
                raise RuntimeError("工具正在执行中")

            if existing["status"] == "FAILED_FINAL":
                raise RuntimeError("工具执行已永久失败")

        created = self.repository.try_create(
            operation_id=operation_id,
            tool_name=tool_name,
            request_hash=request_hash,
        )

        if not created:
            existing = self.repository.get(operation_id)

            if (
                existing is not None
                and existing["status"] == "SUCCESS"
            ):
                return existing["response"]

            raise RuntimeError("工具调用存在并发冲突")

        try:
            response = action()

            self.repository.mark_success(
                operation_id,
                response,
            )

            return response
        except Exception as exc:
            self.repository.mark_failed(
                operation_id,
                str(exc),
            )
            raise
```

调用方式：

```python
result = executor.execute(
    operation_id="payment-order001-001",
    tool_name="pay_order",
    request_hash="sha256:xxxx",
    action=lambda: payment_client.pay(
        order_no="ORDER001",
        amount=100,
        idempotency_key="payment-order001-001",
    ),
)
```

---

## 13.5 Plan 与 Action 分离

Agent 不应该在生成计划时直接执行高风险操作。

推荐流程：

```text
理解用户意图
        ↓
生成执行计划
        ↓
识别有副作用的动作
        ↓
生成 OperationId
        ↓
必要时人工确认
        ↓
执行工具
        ↓
保存结果
        ↓
根据保存结果继续推理
```

例如：

```text
用户：帮我给客户退款 100 元

Agent 计划：
1. 查询订单
2. 检查可退款金额
3. 生成退款请求号
4. 等待用户确认
5. 调用退款工具
6. 保存退款结果
```

不要让模型仅凭自然语言直接连续调用多次退款工具。

---

## 13.6 Agent 断点恢复

工作流节点状态：

```text
PENDING
RUNNING
SUCCEEDED
FAILED_RETRYABLE
FAILED_FINAL
SKIPPED
```

恢复时不能简单从头执行，而应该：

```text
1. 加载 RunId
2. 查询每个 StepId 的状态
3. 已成功节点直接读取历史结果
4. 处理中节点检查租约是否过期
5. 可重试失败节点重新执行
6. 永久失败节点停止流程
```

伪代码：

```python
for step in workflow.steps:
    state = repository.get_step_state(
        run_id=run_id,
        step_id=step.id,
    )

    if state.status == "SUCCEEDED":
        context[step.id] = state.output
        continue

    if state.status == "FAILED_FINAL":
        raise WorkflowFailed(step.id)

    execute_step(step)
```

---

## 13.7 Agent 任务领取

多 Agent 消费任务时，可以使用数据库条件更新：

```sql
UPDATE agent_task
SET status = 'RUNNING',
    worker_id = 'agent-001',
    lease_expire_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
WHERE id = 100
  AND status = 'PENDING';
```

检查影响行数：

```text
影响 1 行：
领取成功

影响 0 行：
任务已经被其他 Agent 领取
```

也可以支持租约过期后重新领取：

```sql
UPDATE agent_task
SET status = 'RUNNING',
    worker_id = 'agent-002',
    lease_expire_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
WHERE id = 100
  AND (
      status = 'PENDING'
      OR (
          status = 'RUNNING'
          AND lease_expire_at < NOW()
      )
  );
```

即使任务重新领取，内部的每个副作用操作仍然需要使用固定 OperationId。

---

## 13.8 Agent 记忆写入去重

可以为记忆内容生成：

```text
memory_key
content_hash
source_event_id
```

例如：

```sql
CREATE UNIQUE INDEX uk_memory_source
ON agent_memory(
    user_id,
    memory_type,
    source_event_id
);
```

或者对归一化后的内容计算 Hash：

```python
import hashlib


def memory_hash(content: str) -> str:
    normalized = " ".join(
        content.strip().lower().split()
    )

    return hashlib.sha256(
        normalized.encode("utf-8")
    ).hexdigest()
```

但只使用文本 Hash 可能误伤语义相似但业务不同的记忆。

更推荐：

```text
用户 ID
+
记忆类型
+
来源事件
+
业务实体
```

作为去重依据。

---

# 14. 幂等键应该如何设计

一个好的幂等键应该满足：

- 全局或业务范围内唯一；
- 同一个业务意图重复请求时保持不变；
- 不同业务意图不能共用；
- 可以追踪来源；
- 不包含敏感信息；
- 长度可控；
- 生命周期明确。

常见格式：

```text
业务类型:业务实体:操作序号
```

例如：

```text
PAYMENT:ORDER001:1
REFUND:ORDER001:1
STOCK_DEDUCT:ORDER001:SKU001
AGENT_TOOL:RUN001:STEP003:PAYMENT
```

也可以直接使用 UUID：

```text
550e8400-e29b-41d4-a716-446655440000
```

但仅有 UUID 不便于排查问题，因此可以同时保存业务字段。

---

# 15. 请求参数 Hash

同一个幂等键不能对应不同的请求参数。

错误示例：

```text
第一次：
Idempotency-Key: req-001
amount: 100

第二次：
Idempotency-Key: req-001
amount: 1000
```

如果后端直接返回第一次的成功结果，会产生严重的业务歧义。

因此可以保存请求参数摘要：

```text
request_hash = SHA-256(
    canonical_json(request_body)
)
```

Python 示例：

```python
import hashlib
import json
from typing import Any


def calculate_request_hash(
    data: dict[str, Any],
) -> str:
    canonical_json = json.dumps(
        data,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )

    return hashlib.sha256(
        canonical_json.encode("utf-8")
    ).hexdigest()
```

注意：

```text
字段排序必须固定
时间格式必须统一
空值处理必须统一
金额精度必须统一
动态字段应排除
```

例如请求时间、链路追踪 ID 通常不应该参与业务参数 Hash。

---

# 16. 失败状态如何处理

不能简单地认为：

```text
FAILED 就一定可以重试
```

建议区分：

```text
FAILED_RETRYABLE
FAILED_FINAL
UNKNOWN
```

## FAILED_RETRYABLE

适合：

- 网络超时；
- 服务临时不可用；
- 限流；
- 数据库连接异常；
- 第三方 503。

可以在保持相同幂等键的情况下重试。

---

## FAILED_FINAL

适合：

- 参数错误；
- 权限不足；
- 余额不足；
- 订单状态不允许；
- 业务规则校验失败。

不应该自动重试。

---

## UNKNOWN

最危险的状态。

例如：

```text
调用支付平台超时
无法确定支付是否成功
```

这时不能立即发起一笔新的支付，而应该：

```text
1. 使用原支付请求号查询支付结果
2. 如果成功，更新本地状态
3. 如果明确失败，再决定重试
4. 如果仍然未知，进入人工或延迟查询流程
```

---

# 17. 重试与幂等

重试机制应该建立在幂等基础上。

推荐使用：

```text
指数退避
+
随机抖动
+
最大重试次数
+
超时控制
+
熔断
+
统一幂等键
```

指数退避示例：

```text
第 1 次重试：1 秒后
第 2 次重试：2 秒后
第 3 次重试：4 秒后
第 4 次重试：8 秒后
```

加入随机抖动：

```text
实际等待时间 = 基础等待时间 + 随机时间
```

避免大量客户端同时重试。

需要注意：

> 重试时必须复用原来的幂等键，不能每次重试都生成新的幂等键。

错误：

```text
第一次：req-001
第二次：req-002
第三次：req-003
```

正确：

```text
第一次：req-001
第二次：req-001
第三次：req-001
```

---

# 18. 幂等性和一致性

幂等只能保证重复操作不会产生额外副作用，但不一定能保证整个分布式业务完全一致。

例如：

```text
订单创建成功
库存扣减成功
支付失败
```

即使每个操作都是幂等的，系统仍然可能处于部分完成状态。

因此复杂系统还需要结合：

- 本地事务；
- 事务消息；
- Outbox Pattern；
- Inbox Pattern；
- Saga；
- TCC；
- 状态机；
- 补偿任务；
- 最终一致性；
- 对账机制。

---

# 19. Outbox 与 Inbox 模式

## 19.1 Outbox

业务数据和待发送事件写入同一个数据库事务：

```text
数据库事务开始
    创建订单
    写入 outbox_event
数据库事务提交
```

后台任务再将 Outbox 事件发送到消息队列。

这样可以避免：

```text
订单创建成功，但消息发送失败
```

---

## 19.2 Inbox

消费者收到消息后，先将消息写入 Inbox 或消费记录表。

```text
数据库事务开始
    写入 inbox_event
    执行业务操作
数据库事务提交
```

重复消息因为唯一索引无法再次插入。

Outbox 和 Inbox 结合后：

```text
生产端保证事件不会丢
消费端保证重复事件不会重复产生业务效果
```

---

# 20. 常见错误设计

## 20.1 只在前端禁用按钮

前端防重复不能代替后端幂等。

---

## 20.2 只使用 Redis 锁

锁只能控制并发，不能阻止锁释放后的重复请求。

---

## 20.3 每次重试生成新的幂等键

这样后端会把每次重试当成新的业务操作。

---

## 20.4 幂等键只保存几秒

重试可能发生在几分钟、几小时甚至几天之后。

例如支付平台回调可能持续重试数小时。

---

## 20.5 成功后立即删除幂等记录

删除后，后续重复请求会再次执行业务。

正确做法通常是：

```text
成功记录保留一段合理时间
或长期保留核心业务流水
```

---

## 20.6 用用户 ID 作为幂等键

同一个用户可能连续发起多个合法业务操作。

例如：

```text
用户 100 创建订单 A
用户 100 创建订单 B
```

如果只用 userId 去重，第二个正常订单会被误判为重复。

---

## 20.7 同一个幂等键允许不同参数

必须保存并校验 request_hash。

---

## 20.8 将所有失败都允许自动重试

业务失败和系统失败必须区分。

余额不足、权限不足、参数错误不应该自动重试。

---

## 20.9 先标记成功，再执行业务

错误顺序：

```text
Redis 标记 SUCCESS
数据库执行业务
数据库失败
```

会产生假成功。

---

## 20.10 忽略“处理中”状态

如果第一个请求还没有完成，第二个请求不能直接认为已经成功。

常见处理方式：

```text
返回 202 Accepted
返回处理中状态
短时间轮询
等待原请求完成
使用事件通知结果
```

---

# 21. 不同方案对比

| 方案 | 主要作用 | 优点 | 缺点 | 适用场景 |
|---|---|---|---|---|
| 前端按钮禁用 | 减少重复提交 | 简单 | 可绕过 | 表单、按钮 |
| 数据库唯一索引 | 防止重复数据 | 最终可靠 | 需要合理唯一键 | 订单、支付、消息 |
| 条件更新 | 限制状态转换 | 原子、简单 | 只解决局部问题 | 订单状态、库存 |
| 乐观锁 | 防止并发覆盖 | 性能较好 | 冲突需重试 | 读多写少 |
| 悲观锁 | 串行处理 | 逻辑直观 | 性能较差 | 高冲突短事务 |
| Redis SET NX | 短时间防重复 | 高性能 | 可能丢数据 | 高频接口 |
| Redis 分布式锁 | 控制并发执行 | 跨实例 | 不等于幂等 | 临界区保护 |
| 幂等记录表 | 保存状态和结果 | 通用、可追踪 | 实现复杂 | 核心写接口 |
| 消息消费表 | 消息去重 | 可靠 | 增加存储 | MQ 消费者 |
| Token 机制 | 表单一次提交 | 直观 | 生命周期有限 | 页面表单 |
| 状态机 | 控制合法状态转换 | 业务清晰 | 设计成本较高 | 订单、工作流 |
| Agent 操作流水 | 工具调用去重 | 可恢复、可审计 | 需要平台支持 | Agent、工作流 |

---

# 22. 推荐的组合方案

## 普通后台管理接口

```text
前端按钮禁用
+
数据库条件更新
+
必要时唯一索引
```

---

## 创建订单、创建任务

```text
Idempotency-Key
+
数据库唯一索引
+
幂等记录表
+
保存历史响应
```

---

## 支付、退款、资金操作

```text
业务请求号
+
数据库唯一约束
+
严格状态机
+
请求参数 Hash
+
调用第三方时透传幂等键
+
查询确认未知状态
+
对账机制
```

---

## 消息队列消费者

```text
MessageId
+
消费记录唯一索引
+
消费记录与业务操作同事务
+
成功后 ACK
```

---

## Redis 高频接口

```text
Redis SET NX 作为快速拦截
+
数据库唯一索引作为最终兜底
```

---

## Agent 工具调用

```text
RunId
+
StepId
+
OperationId
+
工具执行流水
+
请求参数 Hash
+
历史结果复用
+
工作流断点恢复
+
高风险操作人工确认
+
业务系统自身幂等
```

---

# 23. Agent 幂等架构示例

```text
用户请求
   ↓
Agent Orchestrator
   ↓
生成 RunId / TaskId
   ↓
规划执行步骤
   ↓
为副作用操作生成 OperationId
   ↓
查询 Tool Execution Ledger
   ├─ SUCCESS → 返回历史结果
   ├─ PROCESSING → 等待或返回处理中
   ├─ FAILED_FINAL → 停止
   └─ 不存在 → 创建 PROCESSING
   ↓
调用 Tool Gateway
   ↓
Tool Gateway 将 OperationId 传给业务服务
   ↓
业务服务执行自身幂等校验
   ↓
数据库唯一约束和状态机兜底
   ↓
保存工具调用结果
   ↓
Agent 继续后续推理
```

这里至少存在三层幂等保护：

```text
第一层：Agent 执行流水去重
第二层：Tool Gateway 幂等控制
第三层：实际业务服务和数据库兜底
```

不要只依赖 Agent 自己记住“这个工具已经调用过”。

---

# 24. 幂等设计检查清单

## 接口层

- [ ] 是否存在客户端重复点击？
- [ ] 网关是否可能自动重试？
- [ ] 调用方是否会超时重试？
- [ ] 是否要求调用方传递 Idempotency-Key？
- [ ] 重试时是否复用原幂等键？
- [ ] 是否校验请求参数 Hash？
- [ ] 重复请求是否返回原始结果？

## 数据库层

- [ ] 是否存在合适的业务唯一索引？
- [ ] 是否使用条件更新限制状态转换？
- [ ] 是否检查 SQL 影响行数？
- [ ] 是否需要乐观锁或悲观锁？
- [ ] 幂等记录和业务操作能否放在同一事务？
- [ ] 是否存在重复扣款、重复库存、重复积分风险？

## Redis 层

- [ ] SET NX 是否设置合理 TTL？
- [ ] Redis 数据丢失后是否有数据库兜底？
- [ ] 多步骤 Redis 操作是否使用 Lua？
- [ ] 分布式锁是否使用唯一随机值？
- [ ] 解锁时是否比较锁值？
- [ ] 是否错误地把分布式锁当作完整幂等方案？

## 消息队列

- [ ] 每条消息是否有 MessageId？
- [ ] 消费者是否可能收到重复消息？
- [ ] 是否存在消费记录唯一索引？
- [ ] 消费记录和业务操作是否在同一事务？
- [ ] 是否在业务提交后再 ACK？
- [ ] 消费失败是否区分可重试和不可重试？

## Agent

- [ ] 是否有 RunId、TaskId、StepId？
- [ ] 副作用工具是否有稳定的 OperationId？
- [ ] Agent 重规划时是否复用 OperationId？
- [ ] 工具执行结果是否持久化？
- [ ] 工作流恢复时是否跳过已成功步骤？
- [ ] 多 Agent 是否可能重复领取任务？
- [ ] Agent 记忆写入是否去重？
- [ ] 支付、退款、删除、部署等操作是否需要人工确认？
- [ ] 工具背后的真实业务服务是否也支持幂等？
- [ ] 未知状态是否通过查询确认，而不是直接重试？

---

# 25. 总结

幂等性的本质不是简单地阻止重复请求，而是：

> 为每一次业务意图建立唯一身份，并确保它的副作用最多只产生一次。

后端系统中，最常见的幂等组合是：

```text
业务唯一标识
+
数据库唯一约束
+
状态机
+
条件更新
+
幂等记录
+
历史结果复用
```

消息队列中，推荐：

```text
至少投递一次
+
MessageId
+
消费记录
+
业务幂等
```

Agent 系统中，推荐：

```text
RunId 管理流程
StepId 管理节点
OperationId 管理副作用
工具执行流水管理结果
业务服务负责最终幂等
```

最终需要记住：

```text
事务保证一组操作的一致提交
锁控制同一时刻的并发执行
重试提高临时故障下的成功率
幂等保证重复执行不会重复产生业务副作用
```

这四者解决的是不同问题，通常需要组合使用。
