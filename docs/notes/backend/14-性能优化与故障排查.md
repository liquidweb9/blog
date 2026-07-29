# 性能优化与故障排查

## 1. 它是什么

性能优化与故障排查是后端工程中用于保障系统可用性、稳定性和响应效率的综合性技术实践。它覆盖从**客户端 → 网关 → 应用服务 → 缓存 → 数据库 → 消息队列 → 外部服务**的全链路排查与调优。

核心子主题包括：

| 类别 | 子项 |
|------|------|
| 计算资源 | CPU 问题分析、内存泄漏、Full GC |
| 并发控制 | 线程池耗尽、连接池耗尽、死锁 |
| 数据访问 | 慢 SQL、缓存失效、消息积压 |
| 网络通信 | 网络超时、接口雪崩 |
| 工程方法 | 性能分析工具、压测与容量估算 |

## 2. 为什么需要它

- **保障 SLA**：线上故障直接导致用户流失与经济损失，需快速定位恢复
- **容量规划**：业务增长要求系统可水平扩展，需明确瓶颈在哪一层
- **成本控制**：过度资源分配浪费成本，精准优化可降低机器/数据库开销
- **故障预防**：主动发现潜在风险（如内存泄漏趋势、慢 SQL 增长），避免演变成事故
- **技术债治理**：性能问题往往是架构或代码不合理的体现，优化过程也是重构过程

## 3. 它解决什么问题

| 问题 | 表现 | 后果 |
|------|------|------|
| CPU 飙高 | 请求响应变慢，RT 上升 | 接口超时、雪崩 |
| 内存泄漏 | GC 频繁、OOM、进程重启 | 服务中断 |
| 线程池耗尽 | 请求排队或直接被拒 | 功能不可用 |
| 连接池耗尽 | 数据库/Redis 请求失败 | 功能降级 |
| 死锁 | 特定操作永远卡住 | 局部功能瘫痪 |
| Full GC / GC 抖动 | STW 导致接口周期性超时 | 吞吐骤降 |
| 慢 SQL | 单查询耗时长，拖垮连接池 | 数据库连接耗尽 |
| 缓存失效 | 大量请求穿透到 DB | 数据库被打挂 |
| 网络超时 | 依赖的外部服务无响应 | 级联失败 |
| 消息积压 | 消费速度 < 生产速度 | 数据延迟、队列溢出 |
| 接口雪崩 | 单个故障扩散至整个链路 | 大面积不可用 |

## 4. 核心原理

### 4.1 全链路排查模型

```
Client → Gateway → App Server → Cache → DB → MQ → External Service
         ↑           ↑            ↑       ↑     ↑        ↑
      4xx/5xx     CPU/Mem     命中率   慢SQL 积压    超时/熔断
```

每一层都有典型的故障模式和指标。排查时从**故障现象**（如客户端 502）出发，沿链路逐层缩小范围。

### 4.2 CPU 问题原理

CPU 密集度高通常由以下原因引起：
- **无限循环 / 空转**：`while(true)` 无 sleep / yield
- **频繁 GC**：GC 线程占 CPU，尤其是 CMS 或 G1 的并发阶段
- **正则回溯**：复杂正则导致灾难性回溯
- **序列化/反序列化**：大量 JSON/Protobuf 解析
- **上下文切换**：太多活跃线程争抢 CPU

### 4.3 内存泄漏原理

对象无法被 GC 回收，持续占据堆内存，最终导致 OOM。常见引用链：
- 静态集合（`static List`、`static Map`）只增不减
- 未关闭的资源（`InputStream`、`Connection`、`ThreadLocal` 未 remove）
- 注册了回调/监听器但未解注册
- ClassLoader 泄漏（热部署场景）

### 4.4 线程池耗尽原理

任务提交速度 > 任务处理速度，队列填满后触发拒绝策略。原因：
- 业务高峰期请求突增
- 下游（DB、RPC）变慢导致任务执行时间延长
- 线程池参数设置过小

### 4.5 连接池耗尽原理

连接池中所有连接都被占用且无法及时归还。原因：
- 慢 SQL / 长事务持有连接不释放
- 代码中获取连接后未在 finally 中释放
- 池大小配置过小，无法应对峰值

### 4.6 死锁原理

两个或以上线程互相持有对方需要的锁，形成循环等待。Java 中可通过 `jstack` 检测，MySQL 中可通过 `SHOW ENGINE INNODB STATUS` 检测。

### 4.7 Full GC 原理

- **Minor GC**：Eden 区满，回收年轻代，STW 时间短
- **Major GC / Full GC**：老年代满或元空间满，回收所有区域，STW 时间长
- 频繁 Full GC 通常因为：老年代增长过快（内存泄漏）、堆大小配置不合理、GC 策略不适合

### 4.8 慢 SQL 原理

- 全表扫描（未走索引）
- 索引区分度低，走了索引但仍需回大量行
- 排序 / 分组未用索引（`filesort`、`temporary`）
- 锁等待（行锁、间隙锁）
- 数据量过大，单表千万级未分片

### 4.9 缓存失效原理

- **缓存穿透**：查询一个不存在的数据，缓存和 DB 都没有，每次请求都打到 DB
- **缓存击穿**：某个热点 key 过期，大量请求同时打到 DB
- **缓存雪崩**：大量 key 在同一时间过期，导致 DB 负载瞬间飙升

### 4.10 网络超时原理

- **连接超时**：TCP 三次握手未完成
- **读取超时**：建立连接后服务端迟迟不返回数据
- 超时设置不合理（过长导致线程/连接被长时间占用，过短导致正常慢请求被误杀）

### 4.11 消息积压原理

- 消费者数量不足或消费能力跟不上生产速度
- 消费者阻塞（比如下游 DB 慢、死锁）
- 消息体过大导致序列化/网络传输耗时
- 分区/分片不均匀导致部分消费者空转、部分过载

### 4.12 接口雪崩原理

一个服务故障（响应变慢或不可用）导致调用方线程/连接被占满，进而扩散到上游。防护手段：**熔断、降级、限流、隔离**。

### 4.13 性能分析工具原理

| 工具 | 原理 |
|------|------|
| `top` / `htop` | 读取 `/proc/stat`，计算 CPU 使用率 |
| `jstack` | 抓取 JVM 线程快照，分析线程状态与锁 |
| `jmap` / `jcmd` | 导出堆转储，分析对象占用 |
| `jstat` | 读取 JVM 统计信息（GC、类加载、JIT） |
| `Arthas` | 通过 Attach API 动态注入诊断代码 |
| `async-profiler` | 基于 perf_event 或 eBPF 采样，低开销火焰图 |
| `SkyWalking` / `Zipkin` | 分布式 tracing，记录调用链耗时 |
| `Prometheus + Grafana` | 拉取指标并可视化 |

### 4.14 压测与容量估算原理

- **压测模型**：逐步增加并发数，观察吞吐（TPS/QPS）与响应时间（RT/TP99）的拐点
- **Little's Law**：`L = λ × W`（系统中请求数 = 吞吐率 × 平均响应时间）
- **容量估算**：根据历史峰值 × 冗余系数（通常是 1.5~2 倍）确定资源规格

## 5. 基本使用方法

### 5.1 CPU 问题定位

```bash
# 1. 找到 CPU 最高的进程
top -o %CPU

# 2. 找到进程内 CPU 最高的线程
top -H -p <pid>

# 3. 将线程号转为十六进制
printf "%x\n" <tid>

# 4. 抓取线程栈
jstack <pid> > jstack.log

# 5. 在 jstack.log 中搜索 nid=<十六进制线程号>
```

### 5.2 内存泄漏定位

```bash
# 1. 观察 GC 情况
jstat -gcutil <pid> 1000 10

# 2. 导出堆转储
jmap -dump:live,format=b,file=heap.hprof <pid>

# 3. 用 MAT / JProfiler / VisualVM 分析
#   - 查找 retained heap 最大的对象
#   - 查看 GC root 引用链
```

### 5.3 线程池耗尽定位

```bash
# 查看线程池状态（需自定义 Dropwizard Metrics 或通过 JMX）
jstack <pid> | grep -E "pool-|ThreadPoolExecutor"

# Arthas 查看线程池
thread
thread -b  # 查看阻塞线程
```

### 5.4 连接池耗尽定位

```sql
-- MySQL 查看当前连接数
SHOW STATUS LIKE 'Threads_connected';
SHOW PROCESSLIST;

-- 查看等待事件的连接
SELECT * FROM information_schema.INNODB_TRX;
SELECT * FROM sys.session WHERE command = 'Query';
```

### 5.5 死锁定位

```bash
# 自动检测死锁
jstack -l <pid> | grep -A 30 "deadlock"

# MySQL 死锁
SHOW ENGINE INNODB STATUS\G
```

### 5.6 Full GC 定位

```bash
# 添加 GC 日志参数
-XX:+PrintGCDetails -XX:+PrintGCDateStamps -Xloggc:/path/gc.log

# 分析 GC 日志
# GCeasy / GCViewer 可视化分析
# 关注 Full GC 频率、持续时间、回收后堆占用
```

### 5.7 慢 SQL 定位

```sql
-- 开启慢查询日志
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 1;

-- 查看执行计划
EXPLAIN SELECT * FROM t WHERE col = ?;

-- 查看索引使用情况
SHOW INDEX FROM t;
```

### 5.8 缓存失效应对

```java
// 缓存穿透：布隆过滤器
BloomFilter<String> filter = BloomFilter.create(Funnels.stringFunnel(Charset.defaultCharset()), 100000, 0.01);
if (!filter.mightContain(key)) { return null; }

// 缓存击穿：互斥锁
String value = redis.get(key);
if (value == null) {
    String lockKey = "lock:" + key;
    if (redis.setIfAbsent(lockKey, "1", 30, TimeUnit.SECONDS)) {
        value = db.query(key);
        redis.set(key, value, 3600, TimeUnit.SECONDS);
        redis.del(lockKey);
    } else {
        Thread.sleep(50);
        return redis.get(key); // 重试
    }
}

// 缓存雪崩：过期时间加随机偏移
redis.set(key, value, baseExpire + random.nextInt(300), TimeUnit.SECONDS);
```

### 5.9 网络超时设置

```java
// HTTP 客户端超时
HttpClient client = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(3))
    .build();

// 或使用 OkHttp
OkHttpClient client = new OkHttpClient.Builder()
    .connectTimeout(3, TimeUnit.SECONDS)
    .readTimeout(5, TimeUnit.SECONDS)
    .writeTimeout(5, TimeUnit.SECONDS)
    .build();
```

### 5.10 消息积压应对

```bash
# RocketMQ / Kafka 查看积压
# RocketMQ Console 或 CLI
mqadmin consumerProgress -g <group> -n <namesrv>

# 扩容消费者
# 增加分区数 + 增加消费者实例
# 临时跳过堆积消息（需确认可丢弃）
```

### 5.11 接口雪崩防护

```java
// 限流（Guava RateLimiter / Sentinel）
RateLimiter limiter = RateLimiter.create(100);
if (!limiter.tryAcquire()) { throw new TooManyRequestsException(); }

// 熔断（Resilience4j / Sentinel / Hystrix）
@CircuitBreaker(name = "userService", fallbackMethod = "fallback")
public User getUser(String id) { ... }

// 隔离：线程池隔离或信号量隔离
@Bulkhead(name = "userService", type = Bulkhead.Type.THREADPOOL)
```

### 5.12 压测工具

```bash
# Apache Bench
ab -n 10000 -c 100 http://localhost:8080/api

# wrk
wrk -t10 -c100 -d30s http://localhost:8080/api

# JMeter（GUI 配置，CLI 执行）
jmeter -n -t testplan.jmx -l result.jtl -e -o report/
```

## 6. 工程中的典型实现

### 6.1 全链路追踪

基于 **SkyWalking** 或 **Zipkin**，在请求入口注入 TraceId，跨服务传递，收集各阶段耗时。

```
Client → Gateway(span-1) → ServiceA(span-2) → Cache(span-3) → DB(span-4)
                                                              → MQ(span-5)
```

实现方式：**OpenTelemetry** SDK 自动埋点，或手动在关键方法上添加 `@WithSpan`。

### 6.2 线程池监控

```java
public class MonitoredThreadPoolExecutor extends ThreadPoolExecutor {
    private final MeterRegistry registry;
    private final String poolName;

    public MonitoredThreadPoolExecutor(...) {
        super(...);
        registry.gauge(poolName + ".active", this, ThreadPoolExecutor::getActiveCount);
        registry.gauge(poolName + ".queueSize", this, tp -> tp.getQueue().size());
        registry.gauge(poolName + ".poolSize", this, ThreadPoolExecutor::getPoolSize);
    }
}
```

### 6.3 数据库连接池监控（HikariCP + Micrometer）

```yaml
spring:
  datasource:
    hikari:
      pool-name: main-pool
      maximum-pool-size: 50
      minimum-idle: 10
```

Micrometer 自动暴露 `hikaricp_connections_active`、`hikaricp_connections_pending` 等指标。

### 6.4 缓存统计

```java
// Redis 缓存命中率
cacheHits.increment();          // MeterRegistry.counter()
cacheMisses.increment();
// 命中率 = hits / (hits + misses)
```

在 Redis 侧通过 `INFO stats` 查看 `keyspace_hits`、`keyspace_misses`。

### 6.5 自适应限流

**Sentinel** 或 **Alibaba Cloud AHAS** 实现：
- 基于 QPS 或线程数的直接限流
- 基于响应时间的慢调用比例降级
- 系统自适应保护（Load、RT、入口 QPS）

### 6.6 慢查询治理平台

很多公司搭建 **慢查询中心**（基于 MySQL 审计日志或 `performance_schema`）：
- 自动采集慢 SQL
- 推送执行计划
- 给出索引优化建议
- 关联负责人与 Jira 工单

## 7. 常见失败场景

| 场景 | 根因 | 现象 |
|------|------|------|
| 新版本上线 OOM | ThreadLocal 未 remove 导致对象无法释放 | 运行几小时后 GC 持续增长，最终 OOM |
| 大促时接口超时 | 缓存穿透导致 DB 被打死 | TP99 从 10ms 飙升至 10s |
| 定时任务停止 | 死锁导致任务线程永远阻塞 | 凌晨任务未执行 |
| 消费者大量报错 | 连接池耗尽（数据库挂了） | 消息不断重试，积压严重 |
| 网关 502 | 上游线程池耗尽，拒绝连接 | 客户端大量报错 |
| 监控告警延迟 | Prometheus 查询因慢 SQL 超时 | 大盘打不开，告警延迟到达 |

## 8. 如何调试

### 8.1 在线诊断工具箱

```
核心命令集：
  top / htop        → CPU、内存概览
  iostat / dstat    → 磁盘 IO
  sar -n DEV 1      → 网络流量
  ss -s             → socket 统计
  jstack <pid>      → 线程栈
  jstat -gcutil     → GC 统计
  jmap / jcmd       → 堆转储
  btrace / arthas   → 动态 trace
  perf / async-profiler → 火焰图
```

### 8.2 Arthas 使用示例

```bash
# 启动
java -jar arthas-boot.jar <pid>

# 查看最耗时的方法调用
trace com.example.service.UserService getUser

# 查看方法调用参数与返回值
watch com.example.service.UserService getUser "{params,returnObj}" -x 3

# 查看当前线程堆栈，找出最忙的线程
thread -n 5

# 查看当前是否有死锁
thread -b
```

### 8.3 分布式 tracing 调试

```bash
# SkyWalking 中的故障排查步骤：
# 1. 在日志中找到 TraceId
# 2. 在 SkyWalking UI 搜索 TraceId
# 3. 查看 Span 列表，定位耗时最长的 Span
# 4. 查看该 Span 的 Logs（异常堆栈）
# 5. 如果是 DB Span，查看具体 SQL
```

### 8.4 堆分析（MAT）

```
Eclipse MAT 分析步骤：
1. 打开 .hprof 文件
2. "Leak Suspects Report" → 自动推测泄漏点
3. "Dominator Tree" → 按 retained heap 排序
4. 选择大对象 → "Merge Shortest Paths to GC Roots" → 排除弱引用
5. 查看引用链，定位代码位置
```

## 9. 如何测试

### 9.1 单元层测试

```java
// 线程池场景测试（模拟下游慢调用）
@Test
void testThreadPoolExhaustion() {
    ExecutorService executor = Executors.newFixedThreadPool(2);
    CountDownLatch latch = new CountDownLatch(1);
    for (int i = 0; i < 10; i++) {
        executor.submit(() -> {
            latch.await(); // 所有任务阻塞
            return null;
        });
    }
    assertThrows(RejectedExecutionException.class, () -> {
        executor.submit(() -> null);
    });
    latch.countDown();
}
```

### 9.2 集成层测试（慢 SQL / 连接池）

```java
@Test
void testConnectionPoolExhaustion() {
    // 模拟慢查询：pg_sleep 或 MySQL SLEEP()
    jdbcTemplate.queryForList("SELECT SLEEP(10)");
    // 验证后续请求获取连接超时
    assertThrows(DataAccessResourceFailureException.class, () -> {
        CompletableFuture.allOf(
            IntStream.range(0, 20)
                .mapToObj(i -> CompletableFuture.runAsync(
                    () -> jdbcTemplate.queryForList("SELECT 1")))
                .toArray(CompletableFuture[]::new)
        ).join();
    });
}
```

### 9.3 压测

```bash
# 基准测试：确定单接口极限 QPS
wrk -t10 -c50 -d60s http://localhost:8080/api/bench

# 负载测试：验证在预期负载下是否达标
wrk -t10 -c100 -d300s http://localhost:8080/api/load

# 压力测试：持续增加负载，观察拐点和崩溃行为
# 逐步增加 -c 参数: 50 → 100 → 200 → 500 → 1000

# 稳定性测试：长时间运行，观察内存泄漏趋势
wrk -t5 -c50 -d8h http://localhost:8080/api/stability
```

### 9.4 混沌工程

```bash
# 模拟网络延迟（Linux）
tc qdisc add dev eth0 root netem delay 100ms

# 模拟丢包
tc qdisc add dev eth0 root netem loss 10%

# 模拟 CPU 飙高
stress --cpu 4 --timeout 30

# 模拟 OOM
stress --vm 2 --vm-bytes 512M --timeout 30
```

## 10. 如何监控

### 10.1 指标分层

```
基础设施层：CPU / Memory / Disk / Network / Load
JVM 层：    堆内存 / GC / 线程数 / 文件句柄
中间件层：   DB 连接数 / 慢查询 / Redis 命中率 / MQ 积压
应用层：    QPS / RT / 错误率 / 线程池活跃数 / 熔断状态
业务层：    下单量 / 支付转化率 / 订单成功率
```

### 10.2 关键告警规则

| 指标 | 告警阈值 | 严重级别 |
|------|----------|----------|
| CPU 使用率 | > 85% for 5min | P1 |
| 堆内存使用率 | > 85% | P2 |
| Full GC 频率 | > 1 次 / 10min | P1 |
| Full GC 耗时 | > 3s | P1 |
| 线程池活跃度 | > 80% 容量 | P1 |
| 连接池活跃度 | > 80% 容量 | P2 |
| 慢查询（超过 1s） | > 10 次 / min | P2 |
| 缓存命中率 | < 90% | P2 |
| MQ 积压 | > 10000 条 | P1 |
| 接口 5xx 比例 | > 1% | P1 |
| 接口 TP99 | > 500ms | P2 |

### 10.3 推荐技术栈

```
指标收集：     Micrometer + Prometheus
可视化：       Grafana
日志聚合：     ELK (Elasticsearch + Logstash + Kibana) / Loki
链路追踪：     SkyWalking / Jaeger / Zipkin
告警：         AlertManager / 自研告警中心
APM：          Datadog / NewRelic / 开源 Pinpoint
```

### 10.4 指标暴露示例（Spring Boot + Micrometer）

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

```java
@Bean
public MeterRegistryCustomizer<MeterRegistry> metricsCommonTags() {
    return registry -> registry.config().commonTags(
        "application", applicationName,
        "instance", instanceId
    );
}
```

## 11. 常见面试问题

**Q1：线上 CPU 飙到 100%，如何排查？**

A：`top` 找到 CPU 最高的进程 pid → `top -H -p <pid>` 找到 CPU 最高的线程 tid → `printf "%x\n" <tid>` 转为十六进制 → `jstack <pid> | grep -A 30 <nid>` 查看对应线程栈 → 定位代码行。

**Q2：内存泄漏和内存溢出的区别？**

A：内存泄漏是对象无法被回收导致占用持续增加；内存溢出是内存不够用（可能因为泄漏，也可能因为确实需要更大内存）。泄漏是溢出的一个常见原因。

**Q3：频繁 Full GC 怎么排查？**

A：先确认 GC 原因：`jstat -gcutil <pid> 1000` 观察堆各代占用变化。导出堆转储，用 MAT 分析老年代中占比最大的对象。如果是业务对象占多数，检查引用链定位泄漏；如果是 MetaSpace 问题，检查类加载器泄漏或 CGLIB 动态类。

**Q4：如何设计缓存策略避免缓存雪崩？**

A：过期时间加随机偏移量、多级缓存（本地缓存 + 分布式缓存）、缓存永不过期 + 异步更新、限流保护 DB。

**Q5：消息积压了怎么快速处理？**

A：短期：临时扩容消费者（增加分区 + 增加实例），跳过可丢弃的堆积消息。长期：优化消费逻辑（批处理、异步化），增加消费者并行度，排查下游瓶颈。

**Q6：介绍一下你们公司的容量评估流程？**

A：根据历年峰值 QPS × 冗余系数（1.5~2），结合单机压测结果（单机能扛多少 QPS）计算所需机器数。考虑各链路瓶颈（DB、缓存、MQ），对各中间件也做独立压测。压测后留出 buffer，避免超卖。

**Q7：如何设计一个全链路压测平台？**

A：流量识别（压测流量标记，如 HTTP Header `X-Scene: pressure`）、数据隔离（影子库 / 影子表 / 特殊前缀）、链路透传（中间件传递压测标记）、监控大盘（实时 QPS/RT/成功率）、熔断机制（压测导致线上异常时自动停止）。

**Q8：Sentinel 限流的工作原理？**

A：Sentinel 基于滑动窗口统计秒级 QPS，每个资源（resource）关联多个规则。请求到来时统计当前窗口的通过数，若超过阈值则快速失败或排队等待。支持热点限流、系统自适应保护（根据 Load/RT 动态调整阈值）。

## 12. 在我的项目中如何使用

### 12.1 全链路监控体系搭建

```
项目名称：中后台交易系统

接入方案：
┌─────────────────────────────────────────────────────────┐
│  1. 日志：logback + Loki                                │
│  2. 指标：Micrometer + Prometheus + Grafana             │
│  3. 链路：SkyWalking Agent 接入（Java 自动探针）         │
│  4. 告警：AlertManager（企业微信 / 钉钉 Webhook）        │
│  5. APM：Pinpoint（可选，与 SkyWalking 二选一）          │
└─────────────────────────────────────────────────────────┘
```

### 12.2 关键指标大盘

```
Grafana Dashboard 包含的 Panel：
  - 应用维度：QPS / TP50 / TP90 / TP99 / 错误率（折线图）
  - JVM 维度：堆内存 / GC 次数 / GC 耗时 / 线程数（时序图）
  - DB 维度：活跃连接 / 等待连接 / 慢查询次数（时序图）
  - Redis 维度：命中率 / 内存使用 / OPS（时序图）
  - MQ 维度：积压量 / 消费速率 / 延迟时间（时序图）
  - 系统维度：CPU / 内存 / 磁盘 IO / 网络（时序图）
```

### 12.3 压测方案

```
每版本上线前执行：
  1. 单接口基准压测（wrk，持续 5min，取 TP99）
  2. 混合场景压测（JMeter，模拟用户真实操作比例）
  3. 稳定性压测（低负载跑 4h，观察内存增长曲线）

容量评估：
  单机极限 QPS ≈ 2000（参考压测结果）
  线上峰值 QPS ≈ 5000
  冗余系数 2x → 需要 5000 / 2000 × 2 = 5 台实例
```

### 12.4 应急响应流程

```
P0 故障响应步骤：
  1. 确认影响面（是否有降级 / 熔断方案可立即执行）
  2. 登录跳板机执行 diagnostics.sh（封装 top / jstack / jstat 等命令）
  3. 查看 Grafana 定位异常层（CPU / 内存 / DB / MQ）
  4. 根据异常层选择对应工具深入分析
  5. 止血（重启 / 限流 / 降级 / 扩容）
  6. 保留现场（线程栈 / 堆转储 / GC 日志）
  7. 事后复盘（5W1H 分析法）并完善监控告警
```

### 12.5 代码层面的自查清单

```
□ 所有线程池使用有界队列 + 自定义拒绝策略
□ 所有连接池（DB / Redis / HTTP）配置了最大连接数 + 超时时间
□ 所有外部调用配置了连接超时和读取超时
□ 所有 IO 资源在 finally 或 try-with-resources 中关闭
□ ThreadLocal 使用后 remove
□ 热点缓存设置了合理的过期时间 + 随机偏移
□ 慢查询有索引覆盖
□ 接口有限流 / 熔断保护
□ 关键业务打了详细日志（包括入参、出参、耗时）
□ 异步任务使用单独的线程池，不与 Web 请求线程池混用
```
