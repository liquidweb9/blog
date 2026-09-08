---
title: 后端压测与 JMeter：从压测方案到结果分析
date: 2026-09-08
tags:
  - 后端工程
  - 性能测试
  - JMeter
  - 可观测性
description: 用可复现的压测场景验证后端接口容量，掌握 JMeter 的线程组、HTTP 请求、参数化、断言、命令行执行与核心指标分析。
---

# 后端压测与 JMeter：从压测方案到结果分析

## 一句话结论

压测不是把并发数调大然后看接口有没有报错，而是在明确业务目标、数据规模和环境边界后，用真实请求模型持续施压，并结合应用、数据库和基础设施指标定位系统瓶颈。JMeter 负责稳定地产生请求和记录结果，监控系统负责解释结果为什么会这样。

## 1. 压测前先回答四个问题

开始配置工具前，应先写清楚压测方案。否则即使得到一个“500 QPS”的结果，也无法判断它是否可信、是否满足业务需求。

| 问题 | 示例 | 作用 |
| --- | --- | --- |
| 测什么业务 | 商品搜索、创建订单、支付回调 | 决定接口链路与数据准备 |
| 压到什么目标 | 峰值 300 QPS，P95 小于 200 ms，错误率低于 0.1% | 定义通过标准 |
| 用什么流量模型 | 10 分钟逐步升到 300 QPS，维持 30 分钟 | 避免瞬时流量掩盖问题 |
| 在什么环境测 | 与生产同版本、独立压测环境、脱敏数据 | 界定结果可外推的范围 |

常见的压测类型如下：

- **基准测试**：低负载下获取正常响应时间和资源水位。
- **负载测试**：验证预期业务流量下是否满足 SLA。
- **压力测试**：逐步超过预期负载，观察系统的极限和降级行为。
- **稳定性测试**：以稳定负载持续数小时，发现内存泄漏、连接泄漏或队列堆积。
- **突刺测试**：模拟秒杀、推送等流量陡增，验证限流和弹性扩容。

压测必须获得环境和数据写入权限的确认。避免直接对生产发起写请求；即使是只读流量，也可能耗尽连接池、缓存或第三方配额。

## 2. 把业务流程变成可执行场景

用户不会只调用一个接口。以“登录后创建订单”为例，压测脚本应保留请求间的依赖：

```text
登录 -> 提取 access_token -> 查询商品 -> 提取 sku_id -> 创建订单 -> 查询订单
```

请求比例也应接近真实情况。例如总流量中搜索占 70%，商品详情占 25%，创建订单占 5%，不能用 100% 的创建订单请求推导整个系统容量。

数据准备同样重要：

- 为每个虚拟用户准备独立账号，避免同一账号触发业务锁或幂等冲突。
- 使用可循环的商品、收货地址等测试数据，并标记压测产生的订单以便清理。
- 让数据库数据量、索引和缓存预热状态尽可能接近目标环境。
- 对有副作用的操作使用专用沙箱、Mock 支付渠道或测试开关。

## 3. JMeter 最小脚本结构

安装 JMeter 后执行 `bin/jmeter.bat`（Windows）或 `bin/jmeter`（macOS/Linux）打开图形界面。新建测试计划后，按以下层级组织：

```text
Test Plan
  -> HTTP Request Defaults
  -> HTTP Header Manager
  -> Thread Group
       -> CSV Data Set Config
       -> HTTP Request: 登录
       -> JSON Extractor: access_token
       -> HTTP Request: 创建订单
       -> Response Assertion
       -> Summary Report（仅调试时使用）
```

### 3.1 公共配置

在 **HTTP Request Defaults** 中填写协议、域名和端口，例如：

```text
Protocol: https
Server Name: api.staging.example.com
```

每个请求只填写路径，如 `/api/v1/orders`，这样切换环境时无需逐个修改。

在 **HTTP Header Manager** 中设置公共请求头：

```text
Content-Type: application/json
Authorization: Bearer ${access_token}
X-Request-Source: jmeter-load-test
```

若令牌来自前一步登录请求，`Authorization` 可以写在登录之后的控制器中，避免给登录接口带上无效令牌。

### 3.2 线程组与并发模型

在线程组中，关键参数含义如下：

| 参数 | 含义 | 示例 |
| --- | --- | --- |
| Number of Threads | 虚拟用户数 | 100 |
| Ramp-up Period | 从 0 增加到目标线程数的秒数 | 60 |
| Loop Count / Duration | 每个用户执行次数或总执行时长 | Duration 1800 秒 |

`100` 个线程不等于 `100 QPS`。实际吞吐量同时受响应时间、Think Time、连接复用和后端限速影响。若目标是固定到达速率，应使用 JMeter Plugins 的 **Throughput Shaping Timer**，或在脚本中用计时器控制发送频率；线程组只负责提供足够的并发执行者。

每个业务步骤之间可加入 **Uniform Random Timer** 模拟用户思考时间，例如 200 至 800 ms。不要为了追求高 QPS 删除所有等待时间，除非测试目标就是机器对机器的突发调用。

### 3.3 请求参数化与关联

使用 **CSV Data Set Config** 读取账号或请求数据：

```text
Filename: data/users.csv
Variable Names: username,password
Recycle on EOF: true
Sharing Mode: Current thread group
```

CSV 文件内容：

```csv
username,password
load_user_001,example-password
load_user_002,example-password
```

登录请求的 Body 可以引用变量：

```json
{
  "username": "${username}",
  "password": "${password}"
}
```

登录响应若为 `{"data":{"accessToken":"..."}}`，在该 HTTP Request 下添加 **JSON Extractor**：

```text
Names of created variables: access_token
JSON Path expressions: $.data.accessToken
Match No.: 1
Default Values: NOT_FOUND
```

后续请求便可使用 `${access_token}`。这种“提取前一步返回值，再传给下一步”的过程称为关联；缺少关联时，脚本通常只能压单接口，无法覆盖完整业务链路。

### 3.4 用断言判断业务成功

HTTP 200 不代表业务成功。为关键请求添加 **Response Assertion** 或 **JSON JMESPath Assertion**，例如断言响应包含 `"code":0`，并验证订单 ID 不为空。

断言失败应计入错误率。只统计网络错误会漏掉库存不足、鉴权失败、限流返回错误码等重要问题。

## 4. 不要在 GUI 中跑正式压测

图形界面适合调试一个或几个用户。正式压测应保存脚本为 `order-load-test.jmx`，在压测机上用非 GUI 模式执行：

```bash
jmeter -n \
  -t order-load-test.jmx \
  -l results/order-load-test.jtl \
  -e -o results/html-report \
  -Jhost=api.staging.example.com \
  -Jduration=1800
```

其中：

- `-n`：非 GUI 模式，减少 JMeter 自身资源消耗。
- `-t`：测试计划文件。
- `-l`：原始结果文件，供后续分析。
- `-e -o`：执行结束后生成 HTML 报告；输出目录必须不存在或为空。
- `-Jkey=value`：向脚本传递属性，可在请求中用 `${__P(host)}`、`${__P(duration)}` 引用。

正式压测时移除或禁用 **View Results Tree**、聚合报告等重量级监听器。它们会在压测机内存中保存大量响应，导致 JMeter 先成为瓶颈。保留结果文件和服务端监控即可。

当单台压测机的 CPU、网络或端口成为限制时，可以采用 JMeter 分布式执行，或拆分多个独立压测机并汇总结果。压测机本身也需要监控 CPU、内存、网络带宽和文件句柄。

## 5. 如何读懂压测结果

优先看端到端结果，而非平均响应时间：

| 指标 | 含义 | 关注点 |
| --- | --- | --- |
| Throughput | 每秒完成的请求数 | 是否达到目标 QPS/RPS |
| Error Rate | 失败请求比例 | HTTP、业务断言、超时分别统计 |
| P50 / P95 / P99 | 50%、95%、99% 请求的响应时间上界 | P95/P99 是否满足 SLA |
| Active Threads | 实际并发用户数 | 是否按预期爬升与稳定 |
| Connect / Latency | 建连与首字节等待时间 | 区分网络、排队和服务端处理 |

平均值容易掩盖长尾。比如平均响应为 80 ms，但 P99 是 3 s，意味着每 100 个请求中大约有一个请求体验很差。

结果必须结合同时段的服务端指标分析：

```text
P99 上升
  -> 应用 CPU 是否饱和？GC 是否频繁？
  -> 数据库连接池是否耗尽？慢查询是否增加？
  -> Redis 命中率是否下降？网络带宽是否打满？
  -> 下游服务是否超时、限流或发生重试？
```

如果吞吐量不再上升、延迟急剧上升且错误率开始增加，通常已经越过系统稳定工作点。此时应记录最后一个同时满足延迟和错误率目标的负载，而不是把“压到崩溃时的瞬时 QPS”当作系统容量。

## 6. 一个可复用的执行流程

```text
1. 定义 SLA、流量模型和通过标准
2. 准备隔离环境、账号、业务数据和监控面板
3. 用 1 到 2 个线程调通 JMeter 脚本与断言
4. 低负载预热缓存，获取基线
5. 分阶段升压，每阶段保持足够时间
6. 记录 QPS、P95/P99、错误率及各层资源指标
7. 定位瓶颈，优化后使用同一方案回归验证
```

压测报告至少应包含脚本版本、代码版本、环境规格、数据规模、场景比例、负载曲线、通过标准和结论。这样下一次发布或扩容后，结果才具有可比较性。

## 7. 总结

JMeter 的核心用法可以概括为：线程组定义并发，HTTP Sampler 发送请求，CSV 和提取器实现参数化与关联，断言验证业务结果，非 GUI 命令行负责正式执行。

但工具只解决“如何发流量”。可靠的后端压测还需要真实场景、明确 SLA、隔离数据，以及覆盖应用、数据库、缓存和下游依赖的可观测性。用这些约束得到的容量结论，才能真正指导上线和扩容决策。

## 延伸阅读

- [Apache JMeter 用户手册](https://jmeter.apache.org/usermanual/index.html)
- [Apache JMeter 最佳实践](https://jmeter.apache.org/usermanual/best-practices.html)
- [笔记：性能优化与故障排查](/notes/backend/14-performance-optimization-and-troubleshooting)
