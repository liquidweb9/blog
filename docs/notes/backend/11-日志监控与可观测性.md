# 日志、监控与可观测性

## 1. 它是什么

**可观测性（Observability）** 是指通过系统外部输出的数据（日志、指标、链路追踪），推断系统内部状态的能力。它由三大支柱构成：

| 支柱 | 英文 | 作用 |
|------|------|------|
| 日志 | Logs | 记录离散的、带时间戳的事件，描述"发生了什么" |
| 指标 | Metrics | 聚合的、可计算的数值度量，描述"系统状态如何" |
| 链路追踪 | Tracing | 记录一次请求在分布式系统中的完整路径，描述"哪里慢、哪里错" |

**日志、监控与可观测性** 是将代码从"能跑"推向"能生产部署"的关键能力。没有它，系统就是一个黑盒。

---

## 2. 为什么需要它

- **生产环境看不到 debugger**：无法单步调试，必须靠日志和数据来还原现场。
- **分布式系统复杂**：一次请求跨越多个服务、多个节点，需要串联起来才能定位问题。
- **用户感知优先**：先于用户发现问题，而不是等用户投诉。
- **容量规划与成本控制**：基于指标了解系统水位，决定扩容还是缩容。
- **SLA/SLO 保障**：用数据证明系统是否达标，而不是"感觉还行"。

---

## 3. 它解决什么问题

| 问题 | 可观测性方案 |
|------|-------------|
| 系统为什么报错 | 日志 + 错误率指标 |
| 接口为什么慢 | Trace 分析调用链 + P99 延迟指标 |
| 内存泄露 | JVM / 进程内存指标 + GC 日志 |
| 数据库被打满 | 连接池指标 + 慢查询日志 |
| 上游依赖挂了 | 健康检查 + 调用错误率骤升告警 |
| 消息堆积 | 队列积压量指标 |
| 第三方 API 花钱太多 | Token 消耗指标 + 调用次数统计 |

---

## 4. 核心原理

### 4.1 日志等级

| 等级 | 含义 | 生产中默认是否输出 |
|------|------|-------------------|
| TRACE | 最细粒度的调试信息，如参数值 | ❌ |
| DEBUG | 开发调试信息，如逻辑分支 | ❌ |
| INFO | 正常运行的关键事件，如启动完成、请求进入 | ✅ |
| WARN | 值得关注的异常情况，但不影响功能 | ✅ |
| ERROR | 明确的错误，需要人工介入 | ✅ |
| FATAL | 致命错误，进程即将退出 | ✅ |

**原则**：生产环境只开 INFO 及以上；DEBUG/TRACE 通过动态配置临时开启。

### 4.2 结构化日志

非结构化（传统）：
```
2025-07-29 10:00:00 [INFO] User login success: userId=12345
```

结构化（推荐，JSON 格式）：
```json
{
  "timestamp": "2025-07-29T10:00:00.000Z",
  "level": "INFO",
  "logger": "com.example.AuthService",
  "message": "user login success",
  "userId": 12345,
  "ip": "192.168.1.1",
  "durationMs": 23
}
```

结构化日志的好处：
- 可通过 `jq`、Loki 等工具精确筛选
- 字段可被搜索、聚合、可视化
- 天然适合日志收集系统（Filebeat → Logstash → ES）

### 4.3 请求 ID 与 Trace ID

**请求 ID**：单服务内为每个请求生成唯一 ID，贯穿该请求的所有日志。

**Trace ID**：分布式链路追踪中的全局 ID，跨服务传递，将一次请求的所有 Span 串联。

传递方式：通过 HTTP Header（如 `X-Request-Id`、`traceparent`），或 RPC 协议的 metadata。

### 4.4 日志脱敏

敏感信息（手机号、身份证、密码、Token）在落日志前必须脱敏。

常见脱敏策略：

| 字段 | 原始 | 脱敏后 |
|------|------|--------|
| 手机号 | 13812345678 | 138****5678 |
| 邮箱 | test@example.com | t***@example.com |
| 身份证 | 110101199001011234 | 110101********1234 |
| 密码 | mypassword | ****** |
| AccessToken | eyJhbGciOiJ... | ***token*** |

实现方式：
- **AOP 切面**：在序列化日志时拦截敏感字段
- **注解驱动**：`@Sensitive` 注解标记字段
- **正则替换**：对已知模式做 `replace`

### 4.5 指标 Metrics

指标有四种类型：

| 类型 | 说明 | 示例 |
|------|------|------|
| Counter | 只增不减 | 请求总数、错误总数 |
| Gauge | 可增可减 | 当前连接数、内存使用量 |
| Histogram | 分布统计 | 请求延迟分布，可以算 P50/P95/P99 |
| Summary | 类似 Histogram，但客户端计算分位数 | 请求延迟的 Summary |

### 4.6 链路追踪 Tracing

核心概念：

| 概念 | 说明 |
|------|------|
| Trace | 一次请求的全链路追踪，由多个 Span 组成 |
| Span | Trace 中的最小工作单元，描述一个操作（如 HTTP 调用、DB 查询） |
| Span Context | 携带 Trace ID、Span ID 等上下文信息，跨进程传递 |
| Parent-Child | Span 之间的父子关系，构成调用树 |

### 4.7 健康检查

暴露一个端点（如 `/actuator/health` 或 `/healthz`），返回服务状态：

```json
{
  "status": "UP",
  "components": {
    "db": { "status": "UP" },
    "redis": { "status": "UP" },
    "llmApi": { "status": "UP" }
  }
}
```

- **Liveness Probe**：进程是否存活（是否要重启）
- **Readiness Probe**：是否准备好接受流量（依赖是否就绪）

### 4.8 告警

定义规则：当指标超过阈值或持续异常时，通过钉钉、邮件、短信、PagerDuty 通知。

告警三要素：
- **指标**：什么数据
- **条件**：什么阈值、持续多久
- **动作**：通知谁、通知方式

---

## 5. 基本使用方法

### 5.1 日志（SLF4J + Logback / Log4j2）

```java
// 在类中定义 logger
private static final Logger log = LoggerFactory.getLogger(UserService.class);

log.info("user login success, userId={}, ip={}", userId, ip);
log.warn("rate limit exceeded, userId={}", userId);
log.error("failed to process order", exception);
```

**禁止**：
- 字符串拼接 `"userId=" + userId`（性能差）
- `e.printStackTrace()`（写到 stderr，不被日志系统管理）
- 在循环中打印日志

**结构化日志（LogstashEncoder）**：

```xml
<appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
  <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>
</appender>
```

### 5.2 Mapped Diagnostic Context (MDC)

MDC 是 SLF4J 提供的线程级上下文，自动注入到每条日志：

```java
// 在过滤器/拦截器中
MDC.put("traceId", traceId);
MDC.put("userId", userId);
// ... 后续所有日志自动携带 traceId 和 userId 字段
MDC.clear();
```

结合 LogstashEncoder，MDC 中的 key-value 会自动出现在 JSON 中。

### 5.3 请求 ID 生成与传递

```java
// 网关或入口处
String requestId = UUID.randomUUID().toString().replace("-", "");
MDC.put("requestId", requestId);
```

跨服务传递：在 HTTP 请求头 `X-Request-Id` 中传递，下游服务读取并写入 MDC。

### 5.4 日志脱敏实现（Logback 自定义 Layout）

```java
public class DesensitizingLayout extends PatternLayout {
    @Override
    public String doLayout(ILoggingEvent event) {
        String message = super.doLayout(event);
        message = message.replaceAll("1[3-9]\\d{9}", "$1****$2");  // 手机号脱敏
        return message;
    }
}
```

更推荐的方式：在序列化层面（Jackson 的 `@JsonSerialize` 或 LogstashEncoder 的自定义过滤器）做脱敏。

### 5.5 指标（Micrometer + Prometheus）

Spring Boot 集成：

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus
  metrics:
    tags:
      application: ${spring.application.name}
```

埋点示例：

```java
// 记录请求计数
Counter counter = Counter.builder("api.requests.total")
    .tag("method", request.getMethod())
    .tag("uri", request.getRequestURI())
    .register(meterRegistry);
counter.increment();

// 记录请求延迟
Timer.Sample sample = Timer.start(meterRegistry);
// ... 处理请求 ...
sample.stop(Timer.builder("api.requests.duration")
    .tag("method", request.getMethod())
    .publishPercentiles(0.5, 0.95, 0.99)
    .register(meterRegistry));
```

### 5.6 链路追踪（Spring Cloud Sleuth / Micrometer Tracing）

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-sleuth</artifactId>
</dependency>
```

Sleuth 会自动：
- 生成 Trace ID 和 Span ID
- 通过 HTTP Header 跨服务传递
- 将 Trace ID 注入 MDC，自动出现在日志中

### 5.7 健康检查

```java
@Component
public class LlmApiHealthIndicator implements HealthIndicator {
    @Override
    public Health health() {
        boolean ok = checkLlmApi();
        return ok ? Health.up().build() : Health.down().withDetail("error", "LLM API unreachable").build();
    }
}
```

### 5.8 告警（Prometheus AlertManager）

```yaml
# alertmanager.yml 规则示例
groups:
  - name: demo
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 3m
        labels:
          severity: critical
        annotations:
          summary: "Error rate > 5% for 3 minutes"
```

---

## 6. 工程中的典型实现

### 6.1 日志收集体系（ELK Stack）

```
应用日志 (JSON) → Filebeat → Logstash → Elasticsearch → Kibana
```

- **Filebeat**：轻量级日志采集器，读取日志文件，发送给 Logstash。
- **Logstash**：日志处理管道，做过滤、解析、脱敏、格式化。
- **Elasticsearch**：分布式搜索和分析引擎，存储日志。
- **Kibana**：可视化 UI，查询、生成仪表板。

### 6.2 日志收集体系（Loki Stack）

```
应用日志 (JSON) → Promtail → Loki → Grafana
```

- **Promtail**：日志采集器，类似 Filebeat。
- **Loki**：轻量级日志存储系统，只索引 metadata（标签），不索引日志内容。
- **Grafana**：统一可视化面板，同时展示日志和指标。

### 6.3 指标体系

```
应用 (Micrometer) → /actuator/prometheus 暴露 → Prometheus 拉取 → Grafana 展示 + AlertManager 告警
```

- **Prometheus**：时序数据库，按固定间隔拉取指标数据。
- **Grafana**：图表面板，支持 PromQL 查询指标。
- **AlertManager**：管理告警规则、去重、静默、通知。

### 6.4 链路追踪体系

```
应用 (OpenTelemetry SDK) → OTel Collector → Jaeger / Zipkin / SkyWalking
```

三种常见的 Tracing 后端：

| 工具 | 特点 |
|------|------|
| Jaeger | Uber 开源，轻量，支持 OpenTelemetry |
| SkyWalking | 国产，APM 功能全面（含 JVM 监控），无需代码侵入 |
| Zipkin | 较早，功能较基础 |

### 6.5 OpenTelemetry（OTel）

统一可观测性的行业标准，提供一套 SDK / API 来同时产生 Logs、Metrics、Traces。

```java
// OTel Java Agent 方式（零代码侵入）
java -javaagent:opentelemetry-javaagent.jar \
     -Dotel.service.name=my-service \
     -Dotel.traces.exporter=otlp \
     -jar my-app.jar
```

三层结构：
1. **OTel SDK**：嵌入应用中，生成 Logs/Metrics/Traces
2. **OTel Collector**：接收、处理、导出数据到后端
3. **Backend**：存储和展示（Jaeger、Prometheus、Loki 等）

---

## 7. 常见失败场景

### 7.1 日志太多把磁盘打满
- **原因**：DEBUG 日志开到了生产，或死循环打印
- **对策**：日志轮转（`RollingFileAppender`）、日志级别控制、配置磁盘告警

### 7.2 日志同步 I/O 拖垮性能
- **原因**：每条日志都同步刷盘
- **对策**：使用异步 Appender（`AsyncAppender` + 内存队列）

### 7.3 日志脱敏遗漏导致数据泄露
- **原因**：只脱敏了部分路径，新接口参数忘了脱敏
- **对策**：统一拦截器 + 定期审计日志中的敏感数据

### 7.4 Trace ID 丢失导致调用链断裂
- **原因**：异步线程中 MDC 未传递，或 HTTP 头未转发
- **对策**：使用 `HystrixRequestVariable`、`ThreadPoolTaskDecorator` 传递 MDC

```java
// 异步线程传递 Trace ID
public class MdcTaskDecorator implements TaskDecorator {
    @Override
    public Runnable decorate(Runnable task) {
        Map<String, String> contextMap = MDC.getCopyOfContextMap();
        return () -> {
            MDC.setContextMap(contextMap);
            try { task.run(); } finally { MDC.clear(); }
        };
    }
}
```

### 7.5 指标维度爆炸
- **原因**：Tag 的值是无限基数（如用 userId 作为 Tag，或 请求路径带了动态参数）
- **对策**：Tag 的基数必须有限（通常 < 10000），路径参数需要归一化

```
错误：/api/user/12345  /api/user/67890
正确：/api/user/{id}
```

### 7.6 告警风暴
- **原因**：一个根因触发多条告警规则
- **对策**：AlertManager 分组、静默、抑制规则

---

## 8. 如何调试

### 8.1 日志查询技巧

Kibana / Loki 查询语法：

- `level:ERROR AND service:order-service` → 查找某服务的错误日志
- `traceId:"abc123"` → 串联一次请求的所有日志
- `message:"NullPointerException" OR message:"OOM"` → 搜索特定错误

### 8.2 根据 Trace 找慢调用

1. 在 Grafana / Jaeger UI 搜索 Trace ID
2. 查看 Span 列表，按耗时排序
3. 找到耗时最长的 Span（通常是 DB 查询、HTTP 调用、外部 API 请求）
4. 结合该 Span 的日志定位具体原因

### 8.3 用健康检查隔离故障

```bash
# 检查所有服务的健康状态
curl http://gateway/actuator/health | jq '.components | to_entries[] | select(.value.status != "UP")'
```

### 8.4 动态调整日志级别（Spring Boot Actuator）

```bash
curl -X POST "http://localhost:8080/actuator/loggers/com.example.service" \
  -H "Content-Type: application/json" \
  -d '{"configuredLevel": "DEBUG"}'
```

生产紧急排查时临时开 DEBUG，排查完立即恢复。

---

## 9. 如何测试

### 9.1 日志测试

```java
@SpringBootTest
@AutoConfigureMockMvc
class LoggingTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldLogUserIdOnLogin() {
        // 使用日志 Appender 捕获日志输出（如 Logback 的 ListAppender）
        ListAppender<ILoggingEvent> listAppender = new ListAppender<>();
        listAppender.start();
        ((Logger) LoggerFactory.getLogger(UserService.class)).addAppender(listAppender);

        // 执行登录
        userService.login("test@example.com", "password");

        // 验证日志
        assertThat(listAppender.list)
            .anyMatch(event -> event.getMessage().contains("user login success"));
    }
}
```

### 9.2 指标测试

```java
@SpringBootTest
class MetricsTest {

    @Autowired
    private MeterRegistry meterRegistry;

    @Test
    void shouldIncrementRequestCounter() {
        double before = meterRegistry.counter("api.requests.total", "uri", "/test").count();
        // 发送请求
        mockMvc.perform(get("/test")).andExpect(status().isOk());
        double after = meterRegistry.counter("api.requests.total", "uri", "/test").count();
        assertThat(after).isEqualTo(before + 1);
    }
}
```

### 9.3 健康检查测试

```java
@SpringBootTest
class HealthTest {

    @Autowired
    private HealthIndicator llmApiHealthIndicator;

    @Test
    void llmApiHealthShouldBeUp() {
        Health health = llmApiHealthIndicator.health();
        assertThat(health.getStatus()).isEqualTo(Status.UP);
    }
}
```

### 9.4 告警规则测试

- 编写 Prometheus `promtool` 测试规则：

```yaml
# promtool test rules
rule_files:
  - alerts.yml

evaluation_interval: 1m

tests:
  - interval: 1m
    input_series:
      - series: 'http_requests_total{status="500"}'
        values: '0 0 5 10 15'
    alert_rule_test:
      - eval_time: 5m
        alertname: HighErrorRate
        exp_alerts:
          - exp_labels:
              severity: critical
```

---

## 10. 如何监控

### 10.1 QPS 与请求延迟（P50 / P95 / P99）

**QPS（每秒查询数）** 反映系统的吞吐量。

PromQL 示例：

```promql
# QPS（按 1 分钟平均）
rate(http_requests_total{application="order-service"}[1m])

# 各状态码的 QPS
sum by (status) (rate(http_requests_total[1m]))
```

**请求延迟**：

```promql
# P50、P95、P99 延迟
histogram_quantile(0.5, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

| 分位数 | 含义 | 典型目标 |
|--------|------|---------|
| P50 | 一半请求在此时间内完成 | < 200ms |
| P95 | 95% 请求在此时间内完成 | < 500ms |
| P99 | 99% 请求在此时间内完成 | < 1s |

**关注 P99 而不是平均值**：平均值会被少量极快请求拉低，掩盖慢请求问题。

### 10.2 错误率

```promql
# 错误率（5xx / 总请求）
sum(rate(http_requests_total{status=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
* 100
```

**告警阈值**：
- Error Rate > 1% 持续 5 分钟 → Warning
- Error Rate > 5% 持续 3 分钟 → Critical

### 10.3 CPU 与内存

```promql
# CPU 使用率
rate(process_cpu_seconds_total{application="order-service"}[1m]) * 100

# 内存使用
process_resident_memory_bytes{application="order-service"}
```

对于 Java 应用，JVM 指标更关键：

```promql
# JVM 堆内存
jvm_memory_used_bytes{area="heap", application="order-service"}

# JVM 非堆内存
jvm_memory_used_bytes{area="nonheap", application="order-service"}

# GC 暂停时间（每 5 分钟）
rate(jvm_gc_pause_seconds_sum[5m])

# GC 发生次数
rate(jvm_gc_pause_seconds_count[5m])

# 老年代内存使用
jvm_memory_used_bytes{area="heap", id="PS Old Gen"}
```

**内存泄漏判断**：老年代内存持续增长，Full GC 后不回落，最终 OOM。

**GC 问题判断**：YGC 频繁（每秒多次）、 FGC 频繁（几分钟内多次）、每次暂停超过 200ms。

### 10.4 数据库连接池

```promql
# 活跃连接数
hikaricp_connections_active{application="order-service"}

# 等待连接数
hikaricp_connections_pending{application="order-service"}

# 连接池使用率
hikaricp_connections_active{application="order-service"}
/
hikaricp_connections_max{application="order-service"}
* 100
```

**告警**：连接池使用率 > 80% 持续 5 分钟 → 考虑扩容连接池或优化 SQL。

### 10.5 Redis 命中率

```promql
# 命中率（基于节点级别指标）
rate(redis_keyspace_hits_total[5m])
/
(rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))
* 100
```

**告警**：命中率 < 85% → 缓存设计可能有问题，需检查缓存策略。

### 10.6 消息积压量

对于 Kafka：

```promql
# 消费者积压（Lag）
kafka_consumer_lag{application="order-service", topic="order-events"}
```

**告警**：
- Lag > 1000 持续 2 分钟 → Warning（消费能力不足）
- Lag > 10000 持续 1 分钟 → Critical（可能消费者挂了）

### 10.7 外部模型接口延迟与 Token 消耗

AI 应用中调用大模型（LLM）API 的监控：

```promql
# 调用次数
rate(llm_requests_total{model="gpt-4"}[5m])

# 延迟 P99
histogram_quantile(0.99, rate(llm_request_duration_seconds_bucket[5m]))

# Token 消耗（计数）
rate(llm_prompt_tokens_total{model="gpt-4"}[5m])
rate(llm_completion_tokens_total{model="gpt-4"}[5m])

# 每次请求的平均 Token 数
rate(llm_prompt_tokens_total[5m]) / rate(llm_requests_total[5m])
```

**关键**：LLM 接口通常按 Token 计费，无监控可能导致成本失控。建议按用户、按功能维度拆分标签。

### 10.8 监控大盘（Grafana Dashboard）

一个标准的服务监控大盘应包含以下面板：

| 面板 | 数据源 | 作用 |
|------|--------|------|
| QPS（总 + 分状态码） | Prometheus | 吞吐量和可用性 |
| 延迟（P50/P95/P99） | Prometheus | 性能 |
| 错误率（%） | Prometheus | 可用性 |
| CPU 使用率 | Prometheus | 资源 |
| 内存使用量 | Prometheus | 资源 |
| JVM 堆 / GC | Prometheus (Micrometer) | Java 健康 |
| 数据库连接池 | Prometheus (Micrometer) | 数据库健康 |
| Redis 命中率 | Prometheus (Redis Exporter) | 缓存效率 |
| 消息积压 | Prometheus (Kafka Exporter) | 消息队列 |
| 日志面板 | Loki | 错误日志 |
| LLM 延迟与 Token | Prometheus | AI 服务成本 |

---

## 11. 常见面试问题

### 11.1 基础概念

**Q: 什么是可观测性的三大支柱？它们之间的关系？**
A: Logs（日志）、Metrics（指标）、Traces（链路追踪）。三者互补：指标告诉你系统状态异常，日志告诉你具体的错误信息，Trace 告诉你哪个环节慢了。推荐使用 OpenTelemetry 统一三者的数据模型。

**Q: 结构化日志和非结构化日志的区别？**
A: 非结构化日志是纯文本，难以搜索和解析；结构化日志用 JSON 等格式，每个字段有明确的 key，可以被自动解析、搜索、聚合。生产环境必须用结构化日志。

**Q: P50、P95、P99 分别代表什么？**
A: 延迟分布的第 50、95、99 百分位。P50 是中位数，P99 是 99% 请求都能达到的最坏延迟。监控应关注 P99，因为平均值会掩盖慢请求。

### 11.2 实践问题

**Q: 如何保证 Trace ID 在异步线程中不丢失？**
A: 使用 MDC（Mapped Diagnostic Context）结合 `TaskDecorator` 或 `HystrixRequestVariable`，在提交任务时捕获当前 MDC 上下文，在线程执行前恢复。

**Q: 线上出了 OOM 怎么排查？**
A: 1. 看 JVM 指标（堆内存趋势、GC 频率）确认是否真的是 OOM；2. 看日志中的 OutOfMemoryError 和堆转储（Heap Dump）位置；3. 用 MAT 或 JProfiler 分析 Heap Dump，找出大对象或泄漏的引用链；4. 结合最近上线变更定位代码。

**Q: 告警太多怎么办？**
A: 告警疲劳通常是规则粒度不合理导致的。方案：1. 分组聚合（AlertManager group_by）；2. 设置静默期（Silence）；3. 用抑制规则（Inhibition）避免根因告警连带触发一堆衍生告警；4. 区分告警级别，P0（立即处理）与 P3（上班再看）。

**Q: 监控发现数据库连接池满了，怎么排查？**
A: 1. 看活跃连接数和等待连接数，确认是否真的满了；2. 查慢 SQL 日志，看是否有 SQL 耗时过长没释放连接；3. 检查是否有连接泄露（`connection.close()` 未调用）；4. 检查连接池配置（`max-lifetime`、`timeout`）是否合理。

### 11.3 架构问题

**Q: 为什么选择 Loki 而不是 ELK？**
A: ELK 功能更强但资源消耗大（ES 索引全部字段）；Loki 轻量（只索引标签），适合日志量极大的场景；如果团队有 Grafana 生态，Loki 可以无缝对接，指标和日志统一看板。如果需要全文搜索和复杂聚合分析，选 ELK。

**Q: OpenTelemetry 和 SkyWalking 的区别？**
A: OpenTelemetry 是标准/规范，提供 SDK 采集数据，不负责存储和展示。SkyWalking 是完整的 APM 系统（采集 + 存储 + UI + 告警），也可以接收 OTel 数据。生产中常见组合：OTel SDK + Jaeger 存储 + Grafana 展示 或 直接使用 SkyWalking。

---

## 12. 在我的项目中如何使用

### 12.1 日志配置

在 Spring Boot 项目中集成结构化日志：

1. 添加依赖 `logstash-logback-encoder`
2. Appender 输出 JSON 格式日志到控制台
3. 配置日志级别：`com.example:INFO`, `org.springframework:WARN`
4. 统一使用 SLF4J Logger，禁止使用 `System.out`

### 12.2 请求 ID 与 MDC

在 Gateway 或 Filter 中生成请求 ID：

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter implements Filter {

    private static final String REQUEST_ID_HEADER = "X-Request-Id";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String requestId = httpRequest.getHeader(REQUEST_ID_HEADER);
        if (requestId == null || requestId.isEmpty()) {
            requestId = UUID.randomUUID().toString().replace("-", "");
        }

        MDC.put("requestId", requestId);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
```

### 12.3 日志脱敏工具

```java
@Component
public class SensitiveDataConverter extends JsonSerializer<String> {

    private static final Pattern PHONE_PATTERN = Pattern.compile("(1[3-9]\\d)\\d{4}(\\d{4})");

    @Override
    public void serialize(String value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
        if (value == null) {
            gen.writeNull();
            return;
        }
        Matcher matcher = PHONE_PATTERN.matcher(value);
        if (matcher.matches()) {
            gen.writeString(matcher.replaceAll("$1****$2"));
        } else {
            gen.writeString(value);
        }
    }
}
```

### 12.4 指标埋点

在关键路径埋点：

```java
// Controller 层统一拦截（AOP）
@Aspect
@Component
public class MetricsAspect {

    private final MeterRegistry meterRegistry;

    public MetricsAspect(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    @Around("@annotation(org.springframework.web.bind.annotation.RequestMapping)")
    public Object monitorEndpoint(ProceedingJoinPoint pjp) throws Throwable {
        MethodSignature signature = (MethodSignature) pjp.getSignature();
        String uri = signature.getMethod().getAnnotation(RequestMapping.class).path()[0];
        String method = signature.getMethod().getName();

        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            Object result = pjp.proceed();
            sample.stop(Timer.builder("api.duration")
                .tag("uri", uri)
                .tag("method", method)
                .register(meterRegistry));
            meterRegistry.counter("api.requests", "uri", uri, "status", "success").increment();
            return result;
        } catch (Exception e) {
            meterRegistry.counter("api.requests", "uri", uri, "status", "error").increment();
            throw e;
        }
    }
}
```

### 12.5 LLM API 指标埋点

```java
public class LlmClient {

    private final MeterRegistry meterRegistry;

    public LlmResponse call(String model, List<Message> messages) {
        Timer.Sample sample = Timer.start(meterRegistry);
        int promptTokens = countTokens(messages);

        try {
            LlmResponse response = doCall(messages);
            sample.stop(Timer.builder("llm.duration")
                .tag("model", model)
                .register(meterRegistry));
            meterRegistry.counter("llm.tokens", "model", model, "type", "prompt").increment(promptTokens);
            meterRegistry.counter("llm.tokens", "model", model, "type", "completion").increment(response.getCompletionTokens());
            meterRegistry.counter("llm.requests", "model", model).increment();
            return response;
        } catch (Exception e) {
            meterRegistry.counter("llm.errors", "model", model).increment();
            throw e;
        }
    }
}
```

### 12.6 推荐接入方案

| 阶段 | 建议工具 | 原因 |
|------|---------|------|
| 初创项目 | Spring Boot Actuator + 日志文件 + 人工查看 | 快速落地，零成本 |
| 小规模 | Prometheus + Grafana + Loki | 兼容性好，社区活跃 |
| 中大规模 | OpenTelemetry + Jaeger + Prometheus + Grafana + Loki | 标准化、可扩展 |
| 已有团队积累 | SkyWalking | 全链路 APM，开箱即用，中文文档好 |

**最低要求（启动项目时）**：
- [x] 日志：结构化 JSON + 请求 ID + 日志级别配置
- [x] 指标：QPS、延迟、错误率、CPU/内存、连接池
- [x] 健康检查：`/actuator/health`
- [x] 告警：磁盘、CPU、错误率、堆内存

**进阶（根据业务逐步接入）**：
- [ ] 链路追踪（Tracing）
- [ ] LLM API 延迟与 Token 监控
- [ ] 消息队列积压告警
- [ ] 日志脱敏全量覆盖
- [ ] 动态日志级别切换
    
---

> **一句话总结**：可观测性不是"出了问题怎么看"，而是"出了问题之前就知道"。从最简单的健康检查和 QPS 指标开始，逐步完善日志、指标、链路追踪三大支柱，最终建成一个能快速发现、定位、修复问题的监控体系。
