# 消息队列

---

## 1. 它是什么

消息队列（Message Queue，MQ）是一种**异步通信**的中间件组件。它采用生产者-消费者模式，生产者将消息发送到队列（或主题），消费者从队列中拉取消息并处理。生产者和消费者之间不直接通信，而是通过消息队列这个中间层进行解耦。

常见的消息队列产品：

| 产品 | 语言 | 特点 | 适用场景 |
|------|------|------|----------|
| RabbitMQ | Erlang | 功能丰富、支持多种协议（AMQP、MQTT、STOMP）、路由灵活 | 企业级应用、复杂路由、低延迟场景 |
| Apache Kafka | Scala/Java | 高吞吐、持久化、分区、分布式、支持流处理 | 日志收集、大数据管道、事件溯源、流处理 |
| RocketMQ | Java | 阿里出品，功能全面、支持事务消息 | 电商、金融等可靠性要求高的场景 |
| Pulsar | Java | 云原生、计算存储分离、多租户 | 大规模消息和流场景 |

## 2. 为什么需要它

在单体架构中，模块之间通过方法调用通信，同步阻塞、耦合紧密。当系统规模增大、模块增多时，直接调用会引发一系列问题：

| 问题 | 说明 |
|------|------|
| 响应变慢 | 同步调用链路长，一个慢节点拖慢整体 |
| 耦合紧密 | 上游依赖下游可用，任何一方变更都影响对方 |
| 流量毛刺 | 突发流量直接打到后端服务，易引发雪崩 |
| 扩展困难 | 上下游扩展节奏不一致，难以独立扩缩 |

消息队列通过**异步化**来解决这些问题：生产者发送消息后立即返回，消费者在后台异步处理，二者在时间和空间上都解耦。

## 3. 它解决什么问题

### 3.1 异步处理

耗时操作（如发送邮件、生成报表、模型推理）放在消息队列中异步执行，主流程快速返回。

```
用户请求 → Web服务 → 投递消息到MQ → 立即返回响应
                          ↓
                    后台Worker → 处理任务
```

### 3.2 系统解耦

模块之间不直接依赖，只依赖消息队列。一个模块的下线、升级、流量变化不影响其他模块。

```
订单服务 → MQ → 库存服务
             → 积分服务
             → 推送服务
```

新增一个下游服务只需订阅对应的 Topic，无需修改上游代码。

### 3.3 削峰填谷

秒杀、大促等场景会产生瞬时洪峰流量。消息队列作为缓冲区，将洪峰削平，让下游消费者按照自身处理能力逐步消费。

```
突发流量 10k QPS → MQ（缓冲） → 后端服务（处理能力 1k QPS）
```

如果没有 MQ，后端服务可能直接被冲垮。有了 MQ，即使积压了消息，也能慢慢处理完。

### 3.4 日志收集与流处理（Kafka 典型场景）

Kafka 最初由 LinkedIn 为日志收集场景设计。各种服务产生的日志统一发送到 Kafka，下游的日志分析、监控告警、数据仓库等系统从 Kafka 消费。

## 4. 核心原理

### 4.1 基本架构

```
Producer →  Broker（MQ Server） → Consumer
                ├── Exchange（RabbitMQ）
                ├── Topic（Kafka）
                ├── Queue / Partition
                └── Message
```

- **Producer（生产者）**：发送消息的一方
- **Consumer（消费者）**：接收并处理消息的一方
- **Broker**：消息队列服务器，负责存储和转发消息
- **Exchange（RabbitMQ）**：交换机，负责根据路由规则将消息分发到不同的 Queue
- **Topic（Kafka）**：主题，消息的逻辑分类
- **Queue（RabbitMQ）**：队列，消息的存储容器
- **Partition（Kafka）**：分区，Topic 的物理分片，用于水平扩展

### 4.2 RabbitMQ 核心模型

```
Producer → Exchange → Binding → Queue → Consumer
              ├── Direct      （精确匹配 routing key）
              ├── Topic       （模式匹配 routing key）
              ├── Fanout      （广播到所有绑定的 Queue）
              └── Headers     （根据消息头匹配）
```

RabbitMQ 的 Exchange 提供了灵活的路由能力，适合复杂路由场景。

### 4.3 Kafka 核心模型

```
Producer → Topic（Partition 0） → Consumer Group
              ├── Partition 1       ├── Consumer 1
              └── Partition 2       └── Consumer 2
```

- Kafka 的 Topic 由多个 Partition 组成，每个 Partition 是有序的消息日志
- Partition 内的消息通过 **offset** 标识位置
- 同一 Consumer Group 中的消费者共同消费一个 Topic，每个 Partition 只能被组内的一个消费者消费
- 不同 Consumer Group 之间独立消费，互不影响（发布订阅模式的关键）

```
Topic "orders"：  Partition 0： [msg1, msg2, msg3, ...]
                  Partition 1： [msg4, msg5, msg6, ...]
                  Partition 2： [msg7, msg8, msg9, ...]

Consumer Group "A"： Consumer A0 → Partition 0
                      Consumer A1 → Partition 1
                      Consumer A2 → Partition 2

Consumer Group "B"： Consumer B0 → Partition 0
                      Consumer B1 → Partition 1
                      Consumer B2 → Partition 2
```

### 4.4 消息确认机制

#### RabbitMQ 的确认机制

**生产端确认（Publisher Confirm）**：生产者发送消息后，Broker 返回 ack/nack，确保消息到达。

```python
# RabbitMQ Publisher Confirm 示例
channel.confirm_delivery()
if channel.wait_for_confirms():
    print("消息已确认")
else:
    print("消息未被确认")  # 需要重发
```

**消费端确认（Consumer Ack）**：

| 模式 | 说明 | 风险 |
|------|------|------|
| 自动确认 | Broker 发送消息后立即认为已消费 | 消费者崩溃时消息丢失 |
| 手动确认 | 消费者处理完手动发送 ack | 需要合理配置 prefetch |

```python
# RabbitMQ 手动确认示例
def callback(ch, method, properties, body):
    try:
        process(body)
        ch.basic_ack(delivery_tag=method.delivery_tag)  # 处理成功，确认
    except Exception:
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)  # 处理失败，重新入队

channel.basic_consume(queue='task_queue', on_message_callback=callback, auto_ack=False)
channel.basic_qos(prefetch_count=1)  # 每次只取一条，处理完再取下一条
```

**prefetch_count**：控制消费者预取消息的数量。设置为 1 可实现公平分发，避免某些消费者积压大量未处理消息。

#### Kafka 的确认机制

**acks 参数**（生产端）：

| acks | 行为 | 可靠性 | 性能 |
|------|------|--------|------|
| 0 | 发送即算成功，不等待确认 | 最低 | 最高 |
| 1 | Leader 写入后立即确认 | 中等 | 高 |
| all（-1） | Leader + 所有 ISR 写入后确认 | 最高 | 较低 |

**enable.auto.commit**（消费端）：
- `true`：自动提交 offset，可能重复消费（上次提交后崩溃，重启后从上次提交的 offset 消费）
- `false`：手动提交 offset，精确控制消费位置

```java
// Kafka 生产端 acks=all 示例
Properties props = new Properties();
props.put("acks", "all");
props.put("retries", 3);
props.put("enable.idempotence", true);  // 启用幂等生产者，配合 acks=all 实现精确一次

// Kafka 消费端手动提交
while (true) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
    for (ConsumerRecord<String, String> record : records) {
        process(record);
    }
    consumer.commitSync();  // 处理完一批后手动提交
}
```

### 4.5 至多一次、至少一次、Exactly-once

这是消息队列的三种投递语义：

| 语义 | 含义 | 实现方式 | 适用场景 |
|------|------|----------|----------|
| **至多一次 (At-most-once)** | 消息最多被消费一次，可能丢失 | 发送后不确认；消费端自动确认 | 日志采集（允许少量丢失） |
| **至少一次 (At-least-once)** | 消息至少被消费一次，可能重复 | 生产端确认 + 消费端手动确认 + 重试 | 大多数业务场景（配合幂等） |
| **精确一次 (Exactly-once)** | 消息恰好被消费一次，不丢不重 | 幂等生产者 + 事务 + 幂等消费者; Kafka 的 EOS（Exactly-once Semantics） | 金融、支付等对一致性要求严格的场景 |

**实现边界**：

- **At-most-once**：最简单，丢消息不处理
- **At-least-once**：最常见，下游做幂等
- **Exactly-once**：
  - 对消息队列本身：Kafka 通过事务 API + idempotent producer + 事务性消费实现端到端的 Exactly-once
  - 对业务系统：消息队列只能保证存储层面的不重不丢，业务层的 Exactly-once 需要依赖幂等设计 + 事务性输出（如写数据库时使用唯一约束）

```java
// Kafka EOS 示例：事务性写入
producer.initTransactions();
try {
    producer.beginTransaction();
    producer.send(new ProducerRecord<>("topic", "key", "value"));
    producer.sendOffsetsToTransaction(offsets, consumerGroup);
    producer.commitTransaction();
} catch (Exception e) {
    producer.abortTransaction();
}
```

**实际工程建议**：大多数业务场景使用 **At-least-once + 幂等消费** 即可，性能远好于 Exactly-once。只有当支付、对账等场景才考虑端到端 Exactly-once。

### 4.6 事务消息

事务消息用于解决**分布式事务**问题，确保本地数据库操作与消息发送的一致性。

#### RocketMQ 事务消息流程

```
1. 生产者发送 Half（半）消息 → Broker
2. Broker 存储 Half 消息，返回 OK
3. 生产者执行本地事务（如扣库存）
4. 生产者向 Broker 提交 Commit 或 Rollback
   - Commit：Broker 将消息投递给消费者
   - Rollback：Broker 删除 Half 消息
5. 若生产者宕机，Broker 回查（Callback Check）生产者的本地事务状态
```

```java
// RocketMQ 事务消息示例
TransactionMQProducer producer = new TransactionMQProducer("group");
producer.setTransactionListener(new TransactionListener() {
    @Override
    public LocalTransactionState executeLocalTransaction(Message msg, Object arg) {
        // 执行本地事务（如扣库存）
        try {
            deductInventory();
            return LocalTransactionState.COMMIT_MESSAGE;
        } catch (Exception e) {
            return LocalTransactionState.ROLLBACK_MESSAGE;
        }
    }

    @Override
    public LocalTransactionState checkLocalTransaction(MessageExt msg) {
        // Broker 回查本地事务状态
        return checkInventoryDeduction() ? COMMIT_MESSAGE : ROLLBACK_MESSAGE;
    }
});
```

#### RabbitMQ 的解决方案

RabbitMQ 原生不支持事务消息，但可以通过**事务信道**实现（性能较差），或结合本地消息表实现。

```python
# RabbitMQ 事务信道（性能差，不推荐）
channel.tx_select()
try:
    channel.basic_publish(exchange='', routing_key='queue', body=message)
    do_local_business()
    channel.tx_commit()
except Exception:
    channel.tx_rollback()
```

**工程实践**：更推荐使用**本地消息表**或 **Outbox 模式**。

### 4.7 本地消息表

**思路**：将消息存储在业务数据库的本地消息表中，与业务操作在同一个本地事务中提交。然后通过一个后台任务轮询本地消息表，将未发送的消息发送到 MQ。

```
业务操作 → 写业务表 + 写本地消息表（同一事务）
                    ↓
             后台定时任务 → 拉取未发送消息 → 发送到 MQ → 标记已发送
```

```sql
-- 本地消息表结构
CREATE TABLE local_message (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    business_id VARCHAR(64) NOT NULL COMMENT '业务ID',
    topic       VARCHAR(64) NOT NULL COMMENT '目标Topic',
    payload     TEXT NOT NULL COMMENT '消息体 JSON',
    status      TINYINT DEFAULT 0 COMMENT '0-待发送 1-已发送 2-已完成',
    retry_count INT DEFAULT 0 COMMENT '重试次数',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    next_retry  DATETIME COMMENT '下次重试时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

```python
# 本地消息表发送任务伪代码
def send_local_messages():
    messages = db.query(
        "SELECT * FROM local_message WHERE status=0 AND next_retry <= NOW() LIMIT 100"
    )
    for msg in messages:
        try:
            mq.send(msg.topic, msg.payload)
            db.execute("UPDATE local_message SET status=1 WHERE id=?", msg.id)
        except Exception as e:
            db.execute(
                "UPDATE local_message SET retry_count=retry_count+1, next_retry=DATE_ADD(NOW(), INTERVAL retry_count*10 SECOND) WHERE id=?",
                msg.id
            )
            if msg.retry_count > MAX_RETRY:
                alert(f"消息发送失败已达最大重试次数: {msg.id}")
```

**优点**：不依赖 MQ 的事务特性，可靠性高
**缺点**：需要额外维护本地消息表，消息可能重复投递（需要下游做幂等）

### 4.8 Outbox 模式

Outbox 模式是本地消息表的变体，常与 **CDC（Change Data Capture）** 结合使用。

```
业务操作 → 写业务表 + 写 Outbox 表（同一事务）
                    ↓
            CDC 组件（如 Debezium） → 监听从库 Binlog → 推送到 MQ
```

**CDC 方式**：通过 Debezium 等工具监听数据库的 Binlog（或 WAL），将 Outbox 表的变更实时推送到 Kafka。

```json
// Outbox 表记录示例
{
  "id": "uuid",
  "aggregate_id": "order-123",
  "aggregate_type": "Order",
  "event_type": "OrderCreated",
  "payload": { "order_id": 123, "amount": 99.00 }
}
```

**优点**：
- 业务代码零侵入（只写业务表和 Outbox 表）
- 通过 Binlog 保证不丢消息
- 天然解耦

**缺点**：
- 引入 CDC 组件增加运维复杂度
- Binlog 延迟可能带来消息可见性延迟

### 4.9 消息顺序

**问题**：在分布式场景下，消息可能被并发消费，导致处理顺序与发送顺序不一致。

**解决方案**：

| 方案 | 说明 | 适用 |
|------|------|------|
| 单分区/单队列 | 一个 Topic 只用一个 Partition 或 Queue，天然有序 | 吞吐量要求不高时 |
| 分区内有序 | 相同 key 的消息路由到同一个 Partition，Partition 内有序 | Kafka 常用 |
| 严格全局有序 | 全局单线程消费 | 性能极差，一般不采用 |

**Kafka 实现顺序消费**：

```java
// 保证同一订单的消息进入同一 Partition
ProducerRecord<String, String> record = new ProducerRecord<>(
    "order-topic",
    orderId,  // 使用 orderId 作为 key，相同 key 进入同一 Partition
    messageBody
);
producer.send(record);
```

**RabbitMQ 实现顺序消费**：
- 同一 routing key 的消息投递到同一个 Queue
- 单个 Queue 中的消息是有序的
- 但多个消费者并发消费同一 Queue 时，顺序无法保证
- **解决方案**：一个 Queue 只对应一个消费者，或使用一致性哈希交换器

```python
# RabbitMQ 保证顺序：使用 direct exchange，相同 routing key 到同一 Queue
channel.exchange_declare(exchange='order.direct', exchange_type='direct')
channel.queue_declare(queue='queue.order.123')
channel.queue_bind(exchange='order.direct', queue='queue.order.123', routing_key='order.123')

# 同一订单的消息使用相同 routing key，只能投递到该队列
channel.basic_publish(exchange='order.direct', routing_key='order.123', body=message)
```

### 4.10 延迟消息

**延迟消息**：消息发送后不立即投递，而是等待指定时间后才投递给消费者。

**RabbitMQ 延迟消息**：

RabbitMQ 通过 **DLX（死信交换机） + TTL** 或 **延迟消息插件（rabbitmq_delayed_message_exchange）** 实现。

```python
# 方式一：TTL + DLX 实现延迟
# 1. 创建队列，设置 TTL 和死信交换机
channel.queue_declare(
    queue='delay_30s',
    arguments={
        'x-message-ttl': 30000,          # 消息存活 30 秒
        'x-dead-letter-exchange': 'dlx',  # 到期后转发到死信交换机
        'x-dead-letter-routing-key': 'actual_queue'
    }
)

# 方式二：使用延迟消息插件（推荐）
channel.basic_publish(
    exchange='delayed_exchange',
    routing_key='queue',
    body=message,
    properties=pika.BasicProperties(
        headers={'x-delay': 30000}  # 延迟 30 秒
    )
)
```

**Kafka 延迟消息**：

Kafka 原生不支持延迟消息。可以基于 **时间轮**（Timing Wheel）在应用层实现，或使用 **Kafka Streams** 的 `suppress` 操作。

**工程实践建议**：如果大量使用延迟消息，优先选择 RabbitMQ 或 RocketMQ（原生支持延迟消息级别）。

### 4.11 死信队列

**死信（Dead Letter）**：无法被正常消费的消息。

**来源**：
1. 消息被拒绝（`basic.reject` / `basic.nack`）且 `requeue=false`
2. 消息 TTL 到期
3. 队列达到最大长度

**RabbitMQ 死信队列配置**：

```python
# 声明死信交换机
channel.exchange_declare(exchange='dlx', exchange_type='direct')

# 声明死信队列
channel.queue_declare(queue='dlx_queue')

# 绑定
channel.queue_bind(exchange='dlx', queue='dlx_queue', routing_key='#')

# 业务队列：设置死信交换机
channel.queue_declare(
    queue='business_queue',
    arguments={
        'x-dead-letter-exchange': 'dlx',
        'x-dead-letter-routing-key': '#'
    }
)
```

**死信处理方式**：
- 人工排查：登录管理后台查看死信队列的消息体、headers
- 自动重试：死信队列的消费者捕获特定异常后重新投递到业务队列（重试队列）
- 告警：死信队列堆积时触发告警通知

### 4.12 消费重试

**消费重试策略**：

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| 立即重试 | 捕获异常后立即重试几次 | 网络抖动等瞬时故障 |
| 间隔重试 | 每次重试间隔递增（退避策略） | 下游短暂不可用 |
| 延迟队列重试 | 失败消息发到延迟队列，延迟后重新投递 | 数据库死锁等待释放 |
| 死信转移 | 超过重试次数后转入死信队列 | 需要人工介入的异常 |

```python
# RabbitMQ 指数退避重试示例
max_retries = 3
wait_times = [5, 30, 120]  # 秒

def process_with_retry(ch, method, properties, body):
    retry_count = int(properties.headers.get('x-retry-count', 0)) if properties.headers else 0
    try:
        business_logic(body)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        if retry_count < max_retries:
            # 投递到延迟队列
            wait = wait_times[retry_count]
            headers = {'x-retry-count': retry_count + 1}
            ch.basic_publish(
                exchange='',
                routing_key=f'delay_queue_{wait}s',
                body=body,
                properties=pika.BasicProperties(headers=headers)
            )
            ch.basic_ack(delivery_tag=method.delivery_tag)
        else:
            # 超过重试次数，发送到死信队列
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
```

```java
// Spring Kafka 消费者重试配置
@Bean
public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory() {
    ConcurrentKafkaListenerContainerFactory<String, String> factory = new ConcurrentKafkaListenerContainerFactory<>();
    factory.setConsumerFactory(consumerFactory());

    // 重试策略
    ExponentialBackOff backOff = new ExponentialBackOff(1000L, 2.0);  // 初始1s，倍数2
    backOff.setMaxInterval(60_000L);  // 最大间隔60s

    factory.setRetryTemplate(new RetryTemplate(
        new SimpleRetryPolicy(3),  // 最多重试3次
        backOff
    ));
    factory.setErrorHandler((exception, data) -> {
        // 超过重试次数，写入死信主题或记录日志
        log.error("消费失败，写入死信: {}", data.value(), exception);
        sendToDlq(data);
    });
    return factory;
}
```

### 4.13 消费幂等

**幂等性**：无论消息被消费多少次，最终结果与消费一次相同。

**为什么需要幂等**：在 At-least-once 语义下，消息可能重复投递。消费者必须通过幂等设计来保证业务正确。

**实现方式**：

| 方式 | 说明 | 示例 |
|------|------|------|
| 数据库唯一约束 | 利用主键或唯一索引防止重复插入 | `INSERT INTO orders(id, ...) VALUES(?, ...) ON DUPLICATE KEY UPDATE ...` |
| 分布式锁 | 处理前先加锁 | Redis SETNX、ZooKeeper 锁 |
| 去重表 | 独立去重表记录已处理的 message_id | `SELECT 1 FROM dedup WHERE msg_id=?`，不存在则插入并处理 |
| 业务状态机 | 判断业务状态是否已处理 | 订单已支付则直接返回成功 |
| 版本号 | 利用乐观锁版本号 | `UPDATE SET version=version+1 WHERE id=? AND version=?` |

```python
# 幂等消费：利用数据库唯一约束
def consume_order_message(message):
    order = json.loads(message)
    try:
        # 利用订单ID作为主键，重复插入会报错但业务无影响
        db.execute(
            "INSERT INTO orders (id, user_id, amount, status) VALUES (?, ?, ?, 'pending')",
            [order['id'], order['user_id'], order['amount']]
        )
    except IntegrityError:
        # 已处理过
        log.info("订单已存在，跳过: %s", order['id'])
```

```python
# 幂等消费：去重表方式
def consume_message(message):
    msg_id = message.headers.get('message_id')
    # 检查是否已处理
    if redis.exists(f"dedup:{msg_id}"):
        return  # 已处理过

    try:
        business_logic(message)
        # 标记为已处理（设置 TTL 防止无限膨胀）
        redis.setex(f"dedup:{msg_id}", 3600 * 24, "1")
    except Exception:
        # 处理失败，不标记，后续重试
        raise
```

## 5. 基本使用方法

### 5.1 RabbitMQ 快速入门

**安装**（Docker）：

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

**生产者**（Python + pika）：

```python
import pika

connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

channel.queue_declare(queue='hello')

channel.basic_publish(
    exchange='',
    routing_key='hello',
    body='Hello World!',
    properties=pika.BasicProperties(
        delivery_mode=2,  # 持久化消息
    )
)
print(" [x] Sent 'Hello World!'")
connection.close()
```

**消费者**（Python + pika）：

```python
import pika

connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

channel.queue_declare(queue='hello')

def callback(ch, method, properties, body):
    print(f" [x] Received {body}")
    ch.basic_ack(delivery_tag=method.delivery_tag)

channel.basic_consume(queue='hello', on_message_callback=callback, auto_ack=False)
channel.basic_qos(prefetch_count=1)

print(' [*] Waiting for messages. To exit press CTRL+C')
channel.start_consuming()
```

### 5.2 Kafka 快速入门

**安装**（Docker）：

```bash
docker run -d --name kafka -p 9092:9092 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 \
  confluentinc/cp-kafka:latest
```

**生产者**（Java）：

```java
Properties props = new Properties();
props.put("bootstrap.servers", "localhost:9092");
props.put("key.serializer", "org.apache.kafka.common.serialization.StringSerializer");
props.put("value.serializer", "org.apache.kafka.common.serialization.StringSerializer");

KafkaProducer<String, String> producer = new KafkaProducer<>(props);
producer.send(new ProducerRecord<>("my-topic", "key", "value"), (metadata, exception) -> {
    if (exception == null) {
        System.out.println("Sent: " + metadata.topic() + "-" + metadata.partition() + "@" + metadata.offset());
    } else {
        exception.printStackTrace();
    }
});
producer.close();
```

**消费者**（Java）：

```java
Properties props = new Properties();
props.put("bootstrap.servers", "localhost:9092");
props.put("group.id", "my-group");
props.put("key.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
props.put("value.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
props.put("enable.auto.commit", "false");

KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props);
consumer.subscribe(Arrays.asList("my-topic"));

while (true) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
    for (ConsumerRecord<String, String> record : records) {
        System.out.printf("offset=%d, key=%s, value=%s%n", record.offset(), record.key(), record.value());
    }
    consumer.commitSync();
}
```

## 6. 工程中的典型实现

### 6.1 工作队列（Task Queue）

**场景**：耗时任务异步处理，如发送邮件、生成图片。

**架构**：

```
Web Server → MQ（持久化队列） → Worker Pool
```

**RabbitMQ 实现关键点**：
- 消息持久化（`delivery_mode=2`）
- 队列持久化（`durable=True`）
- `prefetch_count=1`（一次只消费一条）
- 手动确认

### 6.2 发布订阅（Pub/Sub）

**场景**：一个事件通知多个订阅方（如订单创建 → 通知库存、积分、推荐）。

**RabbitMQ Fanout 实现**：

```python
channel.exchange_declare(exchange='order.created', exchange_type='fanout')

# 库存服务
channel.queue_declare(queue='inventory.queue')
channel.queue_bind(exchange='order.created', queue='inventory.queue')

# 积分服务
channel.queue_declare(queue='points.queue')
channel.queue_bind(exchange='order.created', queue='points.queue')

# 发布消息
channel.basic_publish(exchange='order.created', routing_key='', body=order_json)
```

**Kafka 实现**（天然通过 Consumer Group 支持）：

```java
// 不同服务使用不同的 group.id，即可独立消费同一 Topic
// 库存服务
props.put("group.id", "inventory-service");
// 积分服务
props.put("group.id", "points-service");
```

### 6.3 RPC 模式（Request-Reply）

**场景**：服务间远程调用，但希望解耦。

**RabbitMQ RPC 实现**：

```python
# 客户端
result = channel.queue_declare(queue='', exclusive=True)
callback_queue = result.method.queue

channel.basic_publish(
    exchange='',
    routing_key='rpc_queue',
    body=request,
    properties=pika.BasicProperties(
        reply_to=callback_queue,
        correlation_id=str(uuid.uuid4())
    )
)
# 等待响应...
```

### 6.4 事务性消息（RocketMQ）

**场景**：分布式事务，确保本地操作与消息发送的一致。

```
分布式事务场景示例：
  订单服务（扣库存 + 发送消息） → 积分服务（加积分）
  两者必须原子成功或失败
```

## 7. 常见失败场景

### 7.1 消息丢失

| 阶段 | 丢失原因 | 解决方案 |
|------|----------|----------|
| 生产端 | 网络闪断、Broker 宕机 | 开启 Publisher Confirm；设置 acks=all |
| Broker | 消息未持久化；PageCache 未刷盘 | 持久化队列/消息；Kafka 设置 min.insync.replicas |
| 消费端 | 自动确认模式下消费者崩溃 | 手动确认；处理完再 ack |

### 7.2 消息重复

**原因**：
- 生产端重试导致的重复发送（网络超时但 Broker 已写入）
- 消费端处理完成但 ack 未到达 Broker，重试后再次投递

**解决方案**：消费幂等（见 4.13）

### 7.3 消息积压

**原因**：
- 消费者处理能力不足
- 消费者宕机
- 生产者突增流量

**排查与处理**：

```
1. 确认消费者是否正常运行
2. 检查消费者是否在抛出异常（nack + requeue 导致死循环）
3. 检查下游依赖是否变慢（数据库慢查询、外部 API 超时）
4. 临时扩容消费者
5. 紧急情况下：新建队列，直接重置消费者消费最新消息（跳过积压）
```

**Kafka 积压排查**：

```bash
# 查看消费组 lag
kafka-consumer-groups --bootstrap-server localhost:9092 --group my-group --describe

# 输出：
# TOPIC     PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
# my-topic  0          1000            5000            4000    <-- 积压 4000 条
# my-topic  1          800             3000            2200
```

### 7.4 消息顺序错乱

**原因**：
- 重试机制导致后发送的消息先消费
- 同一个 Queue 被多个消费者并发消费
- Kafka 分区重平衡导致暂停消费

**解决方案**：
- 关键业务使用单分区/单队列
- 失败消息不立即重试，而是发到延迟队列留待后续处理
- 使用 Sequence ID 在后端重新排序

### 7.5 死信队列爆炸

**原因**：大量消息被 reject 且 requeue=false，涌入死信队列。

**处理**：
- 检查消费者为何频繁 reject（代码 bug、下游故障）
- 给死信队列设置最大长度，或设置 TTL 自动过期
- 对死信进行告警，人工介入分析

### 7.6 消费者阻塞/假死

**现象**：消费者进程在运行但不消费消息。

**原因**：
- 消费端遇到死锁
- 代码中无限循环/阻塞 I/O
- GC 停顿

**排查**：
- 查看消费者线程堆栈
- 检查消费者 idle 超时时间
- 设置消费者心跳超时，超时自动剔除

## 8. 如何调试

### 8.1 RabbitMQ 调试

**管理界面**：

访问 `http://localhost:15672`，查看：
- Connections：连接状态
- Channels：信道状态
- Queues：队列消息数、消费者数、消息速率
- Admin：用户、权限管理

**CLI 工具**：

```bash
# 列出所有队列及消息数
rabbitmqctl list_queues name messages consumers

# 列出连接
rabbitmqctl list_connections

# 查看消息（不建议操作生产环境）
rabbitmqadmin get queue=my.queue count=10
```

**日志**：

```bash
# 查看 RabbitMQ 日志
tail -f /var/log/rabbitmq/rabbit@host.log
```

### 8.2 Kafka 调试

**CLI 工具**：

```bash
# 查看 Topic 列表
kafka-topics --bootstrap-server localhost:9092 --list

# 描述 Topic 详情（分区、副本等）
kafka-topics --bootstrap-server localhost:9092 --describe --topic my-topic

# 消费消息（从最新开始）
kafka-console-consumer --bootstrap-server localhost:9092 --topic my-topic --from-beginning

# 查看消费组偏移
kafka-consumer-groups --bootstrap-server localhost:9092 --group my-group --describe

# 重置消费偏移
kafka-consumer-groups --bootstrap-server localhost:9092 --group my-group --topic my-topic --reset-offsets --to-earliest --execute
```

**常用诊断技巧**：

```bash
# 1. 查看消息是否确实在 Topic 中（生产环境慎用）
kafka-console-consumer --bootstrap-server localhost:9092 --topic my-topic --from-beginning --max-messages 10

# 2. 检查 Broker 日志
tail -f /var/log/kafka/server.log

# 3. 查看消费者线程状态
jstack <consumer_pid> | grep -A 10 "kafka-consumer"
```

### 8.3 通用调试技巧

1. **开启链路追踪**：在消息中注入 Trace ID，串联生产-消费全链路
2. **消息埋点**：在发送前、消费前、消费后分别打日志，记录耗时和结果
3. **Mock 外部依赖**：测试时 Mock 数据库、外部 API，确保测试可重复
4. **延迟调试**：使用延迟队列将失败消息延迟重试，避免频繁影响日志
5. **死信观察**：建立死信监控看板，及时发现问题消息

## 9. 如何测试

### 9.1 单元测试

**Mock MQ 客户端**：

```python
# Python 使用 unittest.mock
from unittest.mock import Mock, patch

def test_order_service():
    mock_channel = Mock()
    order_service = OrderService(mock_channel)

    order_service.create_order({"id": "123", "amount": 99})

    # 验证消息是否发送
    mock_channel.basic_publish.assert_called_once()
    args, kwargs = mock_channel.basic_publish.call_args
    assert "order.created" in kwargs["exchange"]
```

```java
// Java 使用 Mockito
@Test
void testOrderCreatedPublishesMessage() {
    KafkaTemplate<String, String> kafkaTemplate = mock(KafkaTemplate.class);
    OrderService service = new OrderService(kafkaTemplate);

    service.createOrder(new Order("123", 99.00));

    verify(kafkaTemplate).send(eq("order.created"), any(ProducerRecord.class));
}
```

### 9.2 集成测试

**使用 Testcontainer**（Docker 容器自动化管理）：

```java
// Java + Testcontainers + Kafka
@Testcontainers
class KafkaIntegrationTest {

    @Container
    static KafkaContainer kafka = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:latest"));

    @Test
    void testProduceAndConsume() {
        String topic = "test-topic";
        String bootstrapServers = kafka.getBootstrapServers();

        // 生产者
        KafkaProducer<String, String> producer = createProducer(bootstrapServers);
        producer.send(new ProducerRecord<>(topic, "key", "value"));

        // 消费者
        KafkaConsumer<String, String> consumer = createConsumer(bootstrapServers);
        consumer.subscribe(Arrays.asList(topic));
        ConsumerRecords<String, String> records = consumer.poll(Duration.ofSeconds(5));

        assertEquals(1, records.count());
        assertEquals("value", records.iterator().next().value());
    }
}
```

### 9.3 消息重放测试

**场景**：验证消费端处理历史消息的正确性。

```bash
# Kafka 指定时间戳重放消费
kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic my-topic \
  --partition 0 \
  --offset 1000

# 或重置消费组
kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group my-group \
  --topic my-topic:0 \
  --reset-offsets --to-offset 1000 --execute
```

### 9.4 异常场景测试

```python
def test_consumer_retry_on_failure():
    """测试消费失败后重试逻辑"""
    consumer = MessageConsumer()

    with patch.object(consumer, 'business_logic', side_effect=[Exception("DB Error"), None]):
        with patch.object(consumer.channel, 'basic_publish') as mock_publish:
            consumer.handle_message(fake_message)

            # 第一次失败：应该发送到延迟队列
            assert mock_publish.call_count == 1
            routing_key = mock_publish.call_args[1]['routing_key']
            assert 'delay' in routing_key

            # 应该手动 ack 原消息
            consumer.channel.basic_ack.assert_called_once()
```

### 9.5 压力测试

**工具**：
- `kafka-producer-perf-test`：Kafka 自带压测工具
- `rabbitmq-perf-test`：RabbitMQ 压测工具
- JMeter、Locust 等通用压测工具

```bash
# Kafka 生产者压测
kafka-producer-perf-test \
  --topic test \
  --num-records 1000000 \
  --record-size 1024 \
  --throughput -1 \
  --producer-props bootstrap.servers=localhost:9092 acks=all

# Kafka 消费者压测
kafka-consumer-perf-test \
  --bootstrap-server localhost:9092 \
  --topic test \
  --messages 100000
```

## 10. 如何监控

### 10.1 关键监控指标

| 维度 | 指标 | 说明 | 告警阈值 |
|------|------|------|----------|
| 生产端 | 发送速率 | 每秒发送消息数 | 接近上限时告警 |
| 生产端 | 发送延迟 | 发送到确认的耗时 | >1s 告警 |
| 生产端 | 发送失败率 | 发送失败数/总数 | >0.1% 告警 |
| Broker | 磁盘使用率 | MQ 数据目录磁盘 | >80% 告警 |
| Broker | CPU/内存 | Broker 自身资源 | >80% 告警 |
| 消费端 | 消费速率 | 每秒消费消息数 | 低于预期时告警 |
| 消费端 | 消费延迟（Lag） | 积压消息数 | >1000 告警 |
| 消费端 | 消费失败率 | 处理失败的比率 | >1% 告警 |
| 死信 | 死信队列深度 | 死信消息数量 | >0 告警 |

### 10.2 RabbitMQ 监控

```bash
# RabbitMQ API 获取队列指标（用于 Prometheus 采集）
curl -u guest:guest http://localhost:15672/api/queues

# Prometheus 集成
docker run -d --name rabbitmq-exporter \
  -e RABBIT_URL=http://localhost:15672 \
  -e RABBIT_USER=guest \
  -e RABBIT_PASSWORD=guest \
  prometheuscommunity/rabbitmq-exporter
```

**Grafana 看板关键面板**：
- 队列消息数（ready / unacked / total）
- 消费者连接数
- 消息入队/出队速率
- 确认/未确认消息

### 10.3 Kafka 监控

**Kafka Exporter + Prometheus + Grafana**：

```bash
# Kafka Exporter
kafka-exporter --kafka.server=localhost:9092 --web.listen-address=:9308
```

**关键指标**：

```bash
# 查看消费组 Lag（最核心的监控指标）
kafka-consumer-groups --bootstrap-server localhost:9092 --group my-group --describe
```

**告警规则示例**：

```yaml
# Prometheus 告警规则
groups:
  - name: kafka-alerts
    rules:
      - alert: ConsumerLagHigh
        expr: kafka_consumergroup_lag > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "消费者组 {{ $labels.consumergroup }} 积压超过 1000"

      - alert: KafkaDiskUsage
        expr: kafka_disk_usage > 0.8
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Kafka Broker 磁盘使用率超过 80%"
```

### 10.4 全链路监控

**在消息中注入 Trace ID**，串联生产者和消费者调用链：

```python
# 生产者
def send_message(topic, body):
    trace_id = get_current_trace_id()  # 从请求上下文获取
    headers = {'trace_id': trace_id}
    message = Message(body, headers=headers)
    producer.send(topic, message)

# 消费者
def handle_message(message):
    trace_id = message.headers.get('trace_id')
    with tracer.start_span('consume', parent=SpanContext(trace_id=trace_id)):
        process(message.body)
```

通过 Jaeger / Zipkin 等工具追踪完整的异步链路。

## 11. 常见面试问题

### 11.1 基础概念

1. **消息队列解决了什么问题？**
   - 异步处理、系统解耦、削峰填谷

2. **RabbitMQ 和 Kafka 有什么区别？**
   - RabbitMQ：功能丰富、路由灵活、适合企业应用
   - Kafka：高吞吐、持久化、分区、适合日志和流处理

3. **什么是 Exchange？有哪些类型？**
   - RabbitMQ 的 Exchange 负责路由消息。类型：Direct、Topic、Fanout、Headers

4. **Kafka 的 Partition 和 Consumer Group 有什么关系？**
   - 一个 Partition 只能被同一 Consumer Group 中的一个消费者消费
   - 不同 Consumer Group 可以独立消费同一 Partition

### 11.2 可靠性

5. **如何保证消息不丢失？**
   - 生产端：Publisher Confirm / acks=all
   - Broker：持久化、副本
   - 消费端：手动确认

6. **消息重复消费怎么办？**
   - 消费端幂等：唯一约束、去重表、业务状态判断

7. **如何实现 Exactly-once？**
   - Kafka：幂等生产者 + 事务 API + 事务性消费
   - 业务层：至少一次 + 消费幂等

### 11.3 事务与一致性

8. **什么是事务消息？RocketMQ 如何实现？**
   - 通过 Half 消息 + 本地事务执行 + Broker 回查机制，确保本地操作与消息发送的原子性

9. **本地消息表的工作原理是什么？**
   - 业务操作与消息写入在同一个本地事务中；后台任务轮询发送；结合 CDC 可升级为 Outbox 模式

10. **Outbox 模式是什么？与本地消息表有什么区别？**
    - Outbox 模式是本地消息表的变体，强调通过 CDC（如 Debezium）监听 Binlog 来推送消息，业务代码零侵入

### 11.4 性能与优化

11. **如何解决消息积压？**
    - 确认消费者健康；检查下游依赖；临时扩容；紧急跳过多余消息

12. **如何保证消息的有序性？**
    - 单分区/单队列；相同 key 路由到同一分区；分区内有序

13. **Kafka 为什么吞吐量高？**
    - 顺序写磁盘（相比随机写快 6000 倍）
    - 零拷贝（sendfile）
    - 页缓存（PageCache）
    - 批量压缩、批量发送

### 11.5 场景设计

14. **设计一个秒杀系统的消息队列方案**
    - 订单请求先入 MQ，后端按处理能力消费
    - 库存扣减使用 Redis + 异步消息同步到 DB
    - 使用事务消息保证订单与库存的一致性

15. **设计一个分布式事务方案（订单+积分）**
    - RocketMQ 事务消息：订单服务发 Half 消息 → 扣库存 → Commit → 积分服务消费
    - 或本地消息表：订单表 + 本地消息表同一事务 → 定时任务发送 → 积分服务消费 + 幂等

### 11.6 其他

16. **延迟消息怎么实现？**
    - RabbitMQ：TTL + DLX 或延迟消息插件
    - Kafka：应用层时间轮
    - RocketMQ：原生支持 18 个延迟级别

17. **死信队列有什么用？**
    - 处理消费失败的消息；延迟消息实现；消息 TTL 过期处理

18. **Kafka 的 ISR（In-Sync Replica）是什么？**
    - ISR 是与 Leader 保持同步的副本集合。当 acks=all 时，消息需写入所有 ISR 才算成功。如果 ISR 缩小到只有 Leader，可靠性降低。

19. **RabbitMQ 的 Prefetch 是什么？**
    - 控制消费者未确认消息的最大数量。`prefetch=1` 实现公平分发，避免某些消费者积压大量消息。

20. **Kafka 的 rebalance 是什么？影响？**
    - 消费者组内成员变化或分区变化时触发的重新分配。Rebalance 期间所有消费者暂停消费，导致一段时间的消费停滞。应合理配置 `session.timeout.ms` 和 `max.poll.interval.ms` 避免频繁 rebalance。

## 12. 在我的项目中如何使用

### 12.1 适用场景分析

**Agent 系统中，以下场景非常适合使用消息队列：**

| 场景 | 说明 | 建议 MQ |
|------|------|----------|
| 文档解析 | 用户上传文档后，异步解析文本内容 | RabbitMQ / Kafka |
| 模型调用 | LLM 推理请求投递到队列，Worker 批量调用 | Kafka（高吞吐） |
| 报告生成 | 耗时报告任务异步执行，完成后通知 | RabbitMQ |
| 任务分发 | 多个 Agent 协作任务的分发与结果收集 | RabbitMQ |
| 日志收集 | 各 Agent 节点的运行日志统一收集 | Kafka |
| 事件通知 | Agent 状态变更、任务完成等事件推送 | RabbitMQ |

### 12.2 推荐架构

```
API Gateway → RabbitMQ（任务分发 + 事件通知）
     ↓
   Agent Worker Pool（文档解析、模型调用、报告生成）
     ↓
   Kafka（日志收集 + 流处理）
```

**技术选型建议**：

- **RabbitMQ**：用于业务核心的消息通信（任务分发、状态通知、事件驱动），因为其路由灵活、功能完善
- **Kafka**：用于高吞吐的场景（日志收集、模型调用的请求/响应流水线、事件溯源）

### 12.3 代码结构示例

```
agent-system/
├── common/
│   └── mq/
│       ├── rabbitmq/
│       │   ├── producer.py      # RabbitMQ 生产者封装
│       │   ├── consumer.py      # RabbitMQ 消费者基类
│       │   └── config.py        # 连接配置
│       └── kafka/
│           ├── producer.py      # Kafka 生产者封装
│           ├── consumer.py      # Kafka 消费者基类
│           └── config.py
├── workers/
│   ├── document_parser/        # 文档解析 Worker
│   ├── llm_invoker/           # 模型调用 Worker
│   └── report_generator/      # 报告生成 Worker
└── monitoring/
    ├── lag_monitor.py          # 积压监控
    └── dead_letter_handler.py  # 死信处理
```

### 12.4 核心实现要点

```python
# 消息体设计（统一格式）
{
    "message_id": "uuid",          # 全局唯一 ID，用于幂等
    "message_type": "document.parse",
    "timestamp": 1700000000,
    "source": "api-gateway",
    "payload": {
        "doc_id": "doc-123",
        "user_id": "user-456",
        "file_url": "https://..."
    }
}

# 生产者封装（RabbitMQ）
class MQProducer:
    def __init__(self, config):
        self.connection = pika.BlockingConnection(config)
        self.channel = self.connection.channel()
        self.channel.confirm_delivery()  # 开启发布者确认

    def publish(self, exchange, routing_key, message):
        message["message_id"] = str(uuid.uuid4())
        self.channel.basic_publish(
            exchange=exchange,
            routing_key=routing_key,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # 持久化
                headers={"message_id": message["message_id"]}
            ),
            mandatory=True  # 无人消费时返回
        )

# 消费者基类（带幂等和重试）
class BaseConsumer:
    def handle(self, ch, method, properties, body):
        message = json.loads(body)
        msg_id = properties.headers.get("message_id")

        # 幂等检查
        if self.is_duplicate(msg_id):
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        try:
            self.process(message)
            self.mark_processed(msg_id)
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except RetryableException:
            # 可重试异常，nack 并重新入队
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
        except NonRetryableException:
            # 不可重试异常，发送到死信队列
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
```

### 12.5 部署与运维

```yaml
# docker-compose.yml
version: '3.8'
services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: secure_password

  kafka:
    image: confluentinc/cp-kafka:latest
    ports:
      - "9092:9092"
    volumes:
      - kafka_data:/var/lib/kafka/data
    environment:
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

volumes:
  rabbitmq_data:
  kafka_data:
```

### 12.6 注意事项

1. **幂等设计是核心**：无论使用哪种 MQ，消费端必须实现幂等
2. **监控先行**：上线前必须建立 Lag 监控、死信监控
3. **预留缓冲容量**：MQ 是削峰填谷的利器，但要确保有足够的磁盘空间应对洪峰
4. **消息体不宜过大**：建议单条消息不超过 1MB，过大的消息考虑拆分为多个或使用对象存储引用
5. **定期清理**：设置消息 TTL 避免队列无限膨胀
6. **测试覆盖异常**：测试网络断开、Broker 宕机、消费者崩溃等异常场景下的行为
7. **版本兼容**：客户端版本与 Broker 版本保持兼容（尤其是 Kafka 的协议版本）
