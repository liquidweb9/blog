# 分布式系统与可靠性

## 1. 它是什么

分布式系统是由多个独立计算机节点组成，通过网络通信与协作，对外表现为一个统一整体系统的系统。可靠性指系统在面临部分故障、高负载或异常输入时，仍能持续提供正确服务的能力。

核心设计目标：
- **可用性**：服务始终可被访问
- **一致性**：数据在多节点间保持一致
- **容错性**：部分节点失败不影响整体
- **可扩展性**：通过增加节点提升容量

## 2. 为什么需要它

单体架构在规模扩大后暴露出以下瓶颈：

| 问题 | 描述 |
|------|------|
| 单点故障 | 一个进程宕机导致全站不可用 |
| 资源竞争 | 所有功能共享同一进程资源，互相影响 |
| 扩展困难 | 无法针对热点模块单独扩容 |
| 发布风险 | 一处修改需全量部署，风险高 |

分布式架构将系统拆分为独立服务，每个服务可以独立部署、独立扩缩容、独立治理，从而在规模、可用性和迭代效率上满足业务需求。

## 3. 它解决什么问题

| 问题域 | 说明 |
|--------|------|
| **单点故障** | 通过冗余部署消除单点，部分节点失效时流量自动切换 |
| **过载崩溃** | 通过限流、熔断保护系统不被突发流量冲垮 |
| **调用雪崩** | 通过超时控制、熔断、舱壁隔离防止故障扩散 |
| **数据不一致** | 通过分布式事务、补偿、对账机制保证最终一致 |
| **重复请求** | 通过幂等设计确保同一请求多次执行结果一致 |
| **服务发现** | 动态感知可用节点，避免将请求发往故障节点 |
| **调用延迟** | 通过超时控制、重试+退避避免长时间阻塞 |

## 4. 核心原理

### 4.1 调用治理

#### 超时控制

每个远程调用必须设置超时时间，防止请求长时间挂起占用资源。

```text
client.connectTimeout = 500ms
client.readTimeout = 1000ms
client.writeTimeout = 1000ms
```

原则：**超时应分层设置，且上层超时 > 下层超时总和**，避免无用重试。

#### 重试与指数退避

- **重试条件**：仅临时性故障（如网络超时、503）且操作具有**幂等性**时，才适合自动重试
- **指数退避**：每次重试等待时间指数增长，避免重试风暴
- **随机抖动（Jitter）**：在退避时间上增加随机偏移，防止多个客户端同时重试

```text
// 指数退避 + Jitter 示例
delay = min(cap, base * 2^attempt)
delay = random(delay / 2, delay)  // 全等抖动
```

#### 熔断

熔断器有三种状态：**Closed → Open → Half-Open → Closed**

| 状态 | 行为 |
|------|------|
| Closed（关闭） | 正常调用，统计失败率 |
| Open（开启） | 快速失败，不发起实际调用 |
| Half-Open（半开） | 放行少量请求探测是否恢复 |

```java
// 熔断配置示意
CircuitBreakerConfig config = CircuitBreakerConfig.custom()
    .failureRateThreshold(50)           // 50% 失败率触发熔断
    .waitDurationInOpenState(Duration.ofSeconds(10))
    .slidingWindowSize(100)
    .build();
```

#### 降级

当依赖服务不可用时，执行备用逻辑（返回缓存、默认值或空结果），保证主流程可用。

```java
// 降级逻辑示例
@Degrade
public Result getUserInfo(Long userId) {
    return userService.getUser(userId);
}

public Result getUserInfoFallback(Long userId, Throwable t) {
    return Result.of(new User(userId, "未知用户"));
}
```

#### 限流

控制单位时间内允许通过的请求数量，防止系统过载。

常用算法：

| 算法 | 原理 | 特点 |
|------|------|------|
| 固定窗口 | 单位时间计数器到达阈值后拒绝 | 有临界突发问题 |
| 滑动窗口 | 细分时间窗口，粒度更细 | 比固定窗口平滑 |
| 令牌桶 | 匀速放入令牌，消费令牌通过 | 允许一定突发 |
| 漏桶 | 固定速率出水，超量溢出 | 强制平滑 |

```java
// 令牌桶限流示例
RateLimiter limiter = RateLimiter.create(100); // 每秒 100 个令牌
if (limiter.tryAcquire()) {
    // 执行业务逻辑
} else {
    // 限流处理
}
```

#### 服务隔离与舱壁模式

**舱壁模式**：将系统分为独立的资源池，一个舱壁的故障不会扩散到其他舱壁。

实现方式：
- **线程池隔离**：每个服务使用独立的线程池，一个服务阻塞不会耗尽所有线程
- **信号量隔离**：控制并发访问数，开销更小
- **进程/容器隔离**：将服务部署在不同进程或容器中

```java
// 线程池隔离示例
ThreadPoolBulkheadConfig config = ThreadPoolBulkheadConfig.custom()
    .maxThreadPoolSize(10)
    .coreThreadPoolSize(5)
    .queueCapacity(20)
    .build();
```

#### 负载均衡

将请求均匀分发到多个后端节点。

常见策略：

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| 轮询 | 依次分发 | 各节点配置相同 |
| 加权轮询 | 按权重分发 | 节点性能不均 |
| 最小连接数 | 分发到活跃连接最少的节点 | 长请求场景 |
| 一致性哈希 | 按请求特征分配到固定节点 | 缓存类场景 |

#### 服务发现与健康检查

**服务发现**：服务启动时注册到注册中心，调用方从注册中心获取可用节点列表。

**健康检查**：定期探测节点是否存活，剔除故障节点。

```text
1. Provider 启动，向注册中心注册
2. Consumer 从注册中心获取 Provider 列表
3. 注册中心推送变更（增/删节点）
4. Consumer 按负载均衡策略选择节点发起调用
5. 注册中心定期健康检查，剔除不可用节点
```

### 4.2 数据一致性

#### CAP 理论

| 属性 | 含义 |
|------|------|
| **C**onsistency（一致性） | 所有节点同一时刻看到相同数据 |
| **A**vailability（可用性） | 每次请求都能获得非错误的响应 |
| **P**artition Tolerance（分区容错性） | 网络分区时系统仍能正常运作 |

**CAP 定理**：分布式系统最多同时满足两项。在分布式网络中 P 是必选的，所以在 CP 和 AP 之间选择。

#### BASE 理论

| 元素 | 含义 |
|------|------|
| **B**asically **A**vailable（基本可用） | 允许部分功能降级，核心可用 |
| **S**oft State（软状态） | 中间状态允许存在，不要求强一致 |
| **E**ventually Consistent（最终一致） | 经过一段时间后数据达到一致 |

BASE 是 CAP 中 AP 方案的实践指导。

#### 分布式事务

**两阶段提交（2PC）**

| 阶段 | 动作 |
|------|------|
| Prepare | 协调者问各参与者"是否能提交"，参与者执行但不提交 |
| Commit/Rollback | 所有参与者 Prepare 成功则 Commit，否则 Rollback |

缺点：同步阻塞、协调者单点、数据不一致风险。

**TCC（Try-Confirm-Cancel）**

| 阶段 | 动作 |
|------|------|
| Try | 预留资源（如冻结库存） |
| Confirm | 确认执行业务（如扣减库存） |
| Cancel | 回滚预留资源 |

```java
// TCC 接口示例
public interface InventoryService {
    @TwoPhaseBusinessAction(name = "deduct", commitMethod = "confirm", rollbackMethod = "cancel")
    boolean tryDeduct(BusinessActionContext ctx, long productId, int quantity);

    boolean confirm(BusinessActionContext ctx);

    boolean cancel(BusinessActionContext ctx);
}
```

**Saga 模式**

将一个长事务拆分为多个本地事务，每个本地事务都有对应的补偿操作。

- **编排模式（Choreography）**：各服务通过事件驱动，互相协调
- **协调模式（Orchestration）**：由一个协调者统一调度

```text
Order Service: Create Order -> Payment Service: Pay -> Inventory Service: Deduct
                    |                              |
             补偿：Cancel Order              补偿：Refund
```

#### 本地消息表

将分布式事务拆解为本地事务 + 消息异步通知。

```text
1. 开启本地事务，执行业务操作 + 写消息表（同库同事务）
2. 后台任务轮询消息表，发送到 MQ
3. 消费者处理成功后确认消费
4. 若发送失败或消费失败，重试机制确保最终成功
```

#### 事务消息（RocketMQ）

MQ 原生支持分布式事务语义：

```text
1. 发送半消息（Half Message），Broker 暂不投递
2. 执行本地事务
3. 根据本地事务结果 Commit 或 Rollback 消息
4. Broker 投递 Commit 的消息给消费者
5. 若 Broker 长时间未收到确认，回查本地事务状态
```

#### 补偿与对账

- **补偿机制**：分布式事务失败的兜底方案，通过定时任务或事件驱动执行反向操作
- **对账机制**：定期对比上下游数据，发现不一致后自动或人工修复

```sql
-- 对账 SQL 示例
SELECT order_id, status, amount
FROM orders
WHERE create_time BETWEEN ? AND ?
  AND status = 'PAID'
  AND NOT EXISTS (
      SELECT 1 FROM settlements WHERE order_id = orders.id
  );
```

### 4.3 幂等设计

#### 什么是幂等

同一个请求被执行多次，其效果与执行一次相同。

#### 常见实现方案

| 方案 | 原理 | 适用场景 |
|------|------|----------|
| 唯一请求 ID | 每次请求携带全局唯一 ID，服务端去重 | API 幂等 |
| 数据库唯一索引 | 利用数据库约束防止重复插入 | 订单号、流水号 |
| 状态机 | 业务状态严格流转，状态单向移动 | 订单状态变更 |
| Redis 去重 | 用 SET NX 或布隆过滤器判断请求是否处理过 | 高并发去重 |
| Token 机制 | 先获取 Token，执行业务时校验并删除 Token | 防止表单重复提交 |
| 乐观锁 | 更新时校验 version 或状态，条件更新 | 数据更新幂等 |

```sql
-- 唯一索引防止重复
INSERT INTO payment_order(id, order_no, amount, status)
VALUES (?, ?, ?, 'PROCESSING')
ON DUPLICATE KEY UPDATE id = id; -- 重复则忽略

-- 乐观锁更新
UPDATE inventory
SET quantity = quantity - ?, version = version + 1
WHERE product_id = ? AND version = ? AND quantity >= ?;
```

#### 消息消费幂等

```java
// 消费端去重
public void onMessage(Message msg) {
    String msgId = msg.getMsgId();
    // 使用 Redis SET NX 保证唯一消费
    Boolean success = redisTemplate.opsForValue()
        .setIfAbsent("msg:" + msgId, "done", 1, TimeUnit.DAYS);
    if (Boolean.TRUE.equals(success)) {
        processMessage(msg);
    }
}
```

### 4.4 微服务相关

#### API Gateway

网关层负责统一的请求路由、认证鉴权、限流熔断、协议转换、日志记录。

```text
Client → API Gateway → 认证 → 限流 → 路由 → 后端服务
                          ↓
                      熔断/降级
```

#### 配置中心

集中管理各服务的配置，支持动态刷新，避免配置变更后重启服务。

| 功能 | 说明 |
|------|------|
| 配置统一管理 | 所有环境的配置集中存储 |
| 动态刷新 | 修改配置实时生效，无需重启 |
| 灰度发布 | 部分实例先应用新配置验证 |
| 配置审计 | 变更历史可追溯 |

#### 链路追踪

记录一次请求在多个服务间的完整调用链路，用于性能分析和故障定位。

```text
Trace ID: a1b2c3d4
┌─────────┐     ┌─────────┐     ┌─────────┐
│ ServiceA│────▶│ ServiceB│────▶│ ServiceC│
│  Span-1 │     │  Span-2 │     │  Span-3 │
└─────────┘     └─────────┘     └─────────┘
```

核心概念：**Trace**（完整请求链路）、**Span**（单一服务调用单元）、**SpanContext**（传递 Trace 上下文）。

#### Spring Cloud 基本组件

| 组件 | 角色 |
|------|------|
| Nacos | 注册中心 + 配置中心 |
| OpenFeign | 声明式服务间 HTTP 调用 |
| Spring Cloud Gateway | API 网关，路由、过滤、限流 |
| Sentinel | 流量控制、熔断降级、系统保护 |
| Seata | 分布式事务解决方案 |
| Sleuth + Zipkin | 链路追踪 |
| LoadBalancer | 客户端负载均衡 |

> **注意**：先理解分布式系统的核心问题和原理，再学习具体中间件的使用方法。工具会变，思想不变。

## 5. 基本使用方法

### 超时与重试配置

```yaml
# application.yml
feign:
  client:
    config:
      default:
        connectTimeout: 500
        readTimeout: 3000

resilience4j:
  retry:
    configs:
      default:
        maxAttempts: 3
        waitDuration: 200ms
        exponentialBackoffMultiplier: 2
        retryExceptions:
          - java.io.IOException
          - org.springframework.web.client.HttpServerErrorException
```

### Sentinel 限流规则

```java
@Configuration
public class SentinelConfig {

    @PostConstruct
    public void initRules() {
        List<FlowRule> rules = new ArrayList<>();
        FlowRule rule = new FlowRule();
        rule.setResource("getUser");
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        rule.setCount(100);
        rules.add(rule);
        FlowRuleManager.loadRules(rules);
    }
}

// 使用注解
@SentinelResource(value = "getUser", blockHandler = "blockHandler")
public User getUser(Long id) {
    return userRepository.findById(id).orElse(null);
}

public User blockHandler(Long id, BlockException e) {
    return new User(id, "系统繁忙，请稍后再试");
}
```

### Nacos 配置动态刷新

```java
@Component
@RefreshScope
public class DynamicConfig {

    @Value("${business.timeout:3000}")
    private int timeout;

    public int getTimeout() {
        return timeout;
    }
}
```

## 6. 工程中的典型实现

### 6.1 服务调用链路

```text
LoadBalancer (Nginx/LVS)
    ↓
API Gateway (Spring Cloud Gateway / Kong / APISIX)
    ↓
Service A ──feign──→ Service B ──feign──→ Service C
    ↑                      ↑
    └── Nacos ──────────────┘
```

### 6.2 分布式事务场景（下单流程）

```text
Order Service              Payment Service          Inventory Service
     │                          │                        │
     │── Try(Create Order) ────→│                        │
     │                          │── Try(Freeze Amount) ─→│
     │                          │                        │── Try(Lock Stock)
     │                          │◀───── OK ─────────────│
     │◀───── OK ───────────────│                        │
     │                          │                        │
     │── Confirm ──────────────→│── Confirm ────────────→│── Confirm
     │                          │                        │
     │◀───── Done ─────────────│◀───── Done ────────────│
```

### 6.3 幂等保障（支付回调）

```text
支付回调请求
    │
    ├── 提取幂等键：orderId + paymentType
    │
    ├── Redis SET NX lock:payment:{orderId} (TTL 10min)
    │       │
    │       ├── 成功：执行业务逻辑 → 发货 → 删除锁
    │       └── 失败：说明已处理过，返回成功
    │
    └── 返回 200 OK 给支付网关
```

## 7. 常见失败场景

| 场景 | 原因 | 后果 |
|------|------|------|
| **重试风暴** | 大量客户端同时重试，压垮后端 | 服务雪崩 |
| **超时穿透** | 上游超时设置 > 下游超时总和 | 请求层层堆积 |
| **缓存雪崩** | 大量缓存同时到期，请求穿透到 DB | DB 被打挂 |
| **重复支付** | 支付回调未做幂等 | 多扣款或少发货 |
| **消息重复消费** | MQ 重复投递，未做去重 | 数据重复 |
| **分布式事务悬挂** | TCC Try 成功但 Confirm/Cancel 未到达 | 资源长期被锁定 |
| **配置不一致** | 不同实例配置不同 | 行为表现不一致 |
| **注册中心脑裂** | 网络分区导致注册中心节点分裂 | 服务调用路由异常 |
| **全链路超时** | 层叠超时导致请求整体失败 | 用户体验差 |

## 8. 如何调试

### 8.1 使用链路追踪定位慢调用

```text
Zipkin UI 中查看 Trace：
  ServiceA: 50ms
    ServiceB: 200ms    ← 耗时异常
      ServiceC: 180ms  ← 瓶颈在 ServiceC
```

### 8.2 分布式事务问题排查

```sql
-- 查询事务消息状态
SELECT msg_id, status, create_time, retry_times
FROM transaction_log
WHERE business_key = 'ORDER_123456'
ORDER BY create_time DESC;
```

### 8.3 熔断状态检查

```text
Actuator 端点：/actuator/circuitbreakers
返回熔断器名称、状态、失败率、调用次数等指标。
```

### 8.4 限流日志分析

```text
Sentinel 日志位置：~/logs/csp/sentinel-record.log
记录被限流的请求、资源名称、时间戳。
```

### 8.5 工具推荐

| 工具 | 用途 |
|------|------|
| Zipkin / Jaeger | 链路追踪可视化 |
| Arthas | 在线诊断，查看调用耗时、线程栈 |
| Wireshark / tcpdump | 网络包分析，排查超时重传 |
| Chaos Engineering（混沌工程） | 主动注入故障，验证系统韧性 |

## 9. 如何测试

### 9.1 单元测试

```java
// 测试熔断逻辑
@Test
void testCircuitBreakerOpensWhenFailureRateExceedsThreshold() {
    CircuitBreaker circuitBreaker = CircuitBreaker.ofDefaults("test");
    for (int i = 0; i < 10; i++) {
        try {
            circuitBreaker.executeSupplier(() -> { throw new RuntimeException(); });
        } catch (Exception ignored) {}
    }
    assertThat(circuitBreaker.getState()).isEqualTo(CircuitBreaker.State.OPEN);
}
```

### 9.2 集成测试

```java
// 测试 Feign 调用超时重试
@SpringBootTest
class UserServiceClientTest {

    @Autowired
    private UserServiceClient userServiceClient;

    @Test
    void testRetryOnTimeout() {
        // 使用 WireMock 模拟超时
        stubFor(get(urlEqualTo("/users/1"))
            .willReturn(aResponse().withFixedDelay(2000)));

        assertThatThrownBy(() -> userServiceClient.getUser(1L))
            .isInstanceOf(RetryableException.class);

        // 验证重试次数
        verify(3, getRequestedFor(urlEqualTo("/users/1")));
    }
}
```

### 9.3 混沌工程测试

```text
1. 随机杀死服务实例 → 验证服务发现剔除、重试切换
2. 注入网络延迟 → 验证超时熔断行为
3. 注入 CPU 压力 → 验证限流降级
4. 网络分区 → 验证 CAP 选择是否正确
```

### 9.4 幂等测试

```java
@Test
void testIdempotentPayment() {
    // 同一请求重复发送三次
    String requestBody = "{\"orderId\":\"123\",\"amount\":100}";
    for (int i = 0; i < 3; i++) {
        mockMvc.perform(post("/payment")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Idempotent-Key", "key-123")
                .content(requestBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUCCESS"));
    }
    // 验证业务表中只有一条记录
    assertThat(paymentRepository.countByOrderId("123")).isEqualTo(1);
}
```

### 9.5 故障注入测试工具

| 工具 | 用途 |
|------|------|
| ChaosBlade | 阿里开源的混沌工程工具 |
| Toxiproxy | 模拟网络故障（延迟、丢包、断连） |
| WireMock | 模拟 HTTP 服务，配置返回延迟/错误 |

## 10. 如何监控

### 10.1 关键指标

| 指标 | 意义 | 告警阈值 |
|------|------|----------|
| 请求成功率 | 服务整体健康度 | < 99.9% |
| 熔断器状态 | 熔断开启次数 | > 0 需关注 |
| 限流触发次数 | 系统是否过载 | 趋势上升告警 |
| P99/P999 延迟 | 尾延迟表现 | > 1000ms |
| 重试次数 | 下游稳定性 | 突增告警 |
| 线程池活跃线程数 | 资源耗尽风险 | > 80% |
| 注册中心节点数 | 服务可用节点 | 节点数下降告警 |
| 分布式事务失败率 | 数据一致性风险 | > 0 |

### 10.2 监控架构

```text
Metrics (Micrometer / Prometheus)
    ↓
Prometheus 采集指标
    ↓
Grafana 可视化 + AlertManager 告警
```

### 10.3 日志规范

```text
# 分布式相关日志必须包含以下信息：
traceId=xxx spanId=xxx      ← 链路追踪 ID
service=xxx method=xxx       ← 服务名与方法
cost=xxms                    ← 调用耗时
status=SUCCESS|FAILED        ← 调用结果
errorType=TIMEOUT|BIZ_EX     ← 错误分类
retryTimes=2                 ← 重试次数
```

### 10.4 健康检查端点

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,info,circuitbreakers,metrics,prometheus
  health:
    circuitbreakers:
      enabled: true
```

## 11. 常见面试问题

| 问题 | 核心考察点 |
|------|------------|
| 分布式系统为什么不能同时满足 CAP？ | 理解 CAP 定理，P 不可舍弃的原因 |
| 熔断和限流的区别是什么？ | 熔断是被动保护，限流是主动保护 |
| 你如何设计一个幂等的支付接口？ | 幂等键 + 唯一索引 + 状态机 |
| TCC 的 Try 阶段如果失败怎么办？ | TCC 异常处理：空回滚、悬挂处理 |
| 什么情况下适合用重试？ | 临时故障 + 幂等操作 |
| Nacos 作为注册中心和配置中心的原理？ | CP 还是 AP 模式选择，健康检查机制 |
| 如何保证消息不被重复消费？ | 消费端幂等设计 |
| 分布式事务最终一致性的实现方式？ | 本地消息表、事务消息、Saga |

## 12. 在我的项目中如何使用

### 12.1 项目现状分析

- **服务框架**：Spring Boot / Spring Cloud
- **注册配置**：Nacos
- **服务调用**：OpenFeign
- **流量治理**：Sentinel
- **链路追踪**：Sleuth + Zipkin
- **分布式事务**：Seata（如有需要）

### 12.2 接入步骤

**1. 基础配置**

```yaml
spring:
  cloud:
    nacos:
      discovery:
        server-addr: ${NACOS_ADDR:127.0.0.1:8848}
      config:
        server-addr: ${NACOS_ADDR:127.0.0.1:8848}
        file-extension: yaml
    sentinel:
      transport:
        dashboard: ${SENTINEL_DASHBOARD:127.0.0.1:8080}
```

**2. 调用治理**

- 所有 Feign 调用配置超时（connectTimeout=500ms, readTimeout=3s）
- OpenFeign 集成 Sentinel，开启熔断降级
- 关键接口配置 Sentinel 限流规则（QPS 阈值根据压测结果设定）
- 实现统一降级处理（FallbackFactory）

**3. 幂等设计**

- 写接口要求调用方传入 `Idempotent-Key` 请求头
- 服务端使用 Redis SET NX + TTL 实现幂等拦截
- 数据库层配合唯一索引兜底

**4. 消息消费**

- 消费者使用消息 ID + Redis SET NX 做幂等
- 消费失败重试 3 次后进入死信队列，人工处理

**5. 监控告警**

- 配置 Prometheus + Grafana 监控面板
- 核心告警：熔断开启、限流触发、P99 延迟 > 1s
- 日志统一输出 traceId，通过 Elk 或 Loki 检索

### 12.3 接入顺序建议

```text
第 1 步：Nacos 注册发现 + 配置中心
第 2 步：OpenFeign 调用 + 超时配置
第 3 步：Sentinel 限流熔断
第 4 步：Sleuth + Zipkin 链路追踪
第 5 步：幂等方案落地
第 6 步：消息事务（如需）
第 7 步：Seata 分布式事务（按需引入）
```

> **原则**：能不用分布式事务就不用，优先通过业务设计规避强一致性需求。工具是手段，理解原理才是根本。
