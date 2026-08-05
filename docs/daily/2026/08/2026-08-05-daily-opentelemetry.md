---
title: Agent 系统如何用 OpenTelemetry 追踪一次任务
date: 2026-08-05
tags:
  - OpenTelemetry
  - Agent
  - 可观测性
description: 用一次跨服务、跨消息队列的 Agent 任务说明 Trace、Span 与日志的分工，以及 Agent 应记录哪些关键 Span。
---

# Agent 系统如何用 OpenTelemetry 追踪一次任务

## 一句话结论

OpenTelemetry（OTel）是一套采集并关联日志、指标和链路追踪数据的开放标准；它不负责存储或展示，而是让应用以统一语义把数据发送给 Collector，再由后端系统查询和告警。对于 Agent 系统，最有价值的是把一次用户任务、模型调用、工具调用和异步消息串成一条 Trace：Trace 回答“这次任务经历了什么”，Span 回答“其中一个有边界的操作花了多久、结果如何”，日志则保留“操作过程中发生了哪些具体事件”。

## 问题与场景

一个 Agent 请求常常不会在同一进程内完成：API 服务创建任务，编排器调用模型，模型要求检索或执行工具，耗时工作被投递到消息队列，消费者完成处理后再继续生成答案。

```text
用户请求
  -> API 服务创建 run
  -> Agent 编排器调用 LLM
  -> 投递 document.extract 消息
  -> Worker 消费并提取文档
  -> 编排器继续调用 LLM
  -> SSE 返回最终结果
```

没有统一追踪时，排查“为什么这次回答花了 18 秒”通常只能按时间戳翻多个服务的日志。即使每条日志都有 `run_id`，仍很难一眼区分：等待队列、模型首字延迟、工具执行慢，还是某次重试造成了额外耗时。

OTel 的典型数据流如下：

```text
应用 / 自动探针
  -> OTel SDK
  -> OTel Collector
  -> Trace 后端（Jaeger、Tempo、APM 等）
  -> Logs / Metrics 后端
```

应用只负责按规范产生遥测数据；Collector 负责接收、采样、脱敏、批量和转发；具体后端负责索引、查询、可视化和告警。这样可以避免业务代码绑定某一家可观测性产品。

## Trace、Span 和普通日志的区别

三者不是替代关系，而是回答不同粒度的问题。

| 数据 | 核心含义 | 适合回答 | 结构与关联方式 |
| --- | --- | --- | --- |
| Trace | 一次端到端请求或任务的因果路径 | 这次 Agent 任务在哪里慢、在哪一步失败？ | 由共享的 `trace_id` 标识，包含一棵或多棵 Span 树 |
| Span | Trace 中一个有开始和结束边界的操作 | 一次 LLM 调用、SQL 查询或工具执行耗时多少？ | 有 `span_id`、父 Span、时间、状态和属性 |
| 普通日志 | 某个时刻的离散事件或诊断细节 | 模型为何重试、工具返回了什么错误上下文？ | 通常按时间检索；应附带 `trace_id` 和 `span_id` |

例如一次客服 Agent 任务可形成如下结构：

```text
Trace: POST /agent/runs
└─ Span: agent.run
   ├─ Span: gen_ai.chat support-model
   ├─ Span: messaging.publish document.extract
   ├─ Span: messaging.process document.extract
   │  └─ Span: tool.document_extract
   └─ Span: gen_ai.chat support-model
```

在这个例子中，整条 Trace 的持续时间可能是 18 秒。若 `messaging.process` 是 12 秒，就知道主要等待或执行发生在异步处理阶段；进入该 Span 后的日志还可以说明“第三方 OCR 返回 429，已在 800 ms 后重试”。

Span 不应承载所有细节。它适合低到中等基数、可聚合和可筛选的属性，例如 `gen_ai.request.model`、`server.address`、`messaging.destination.name`、`tool.name`、`agent.run_id`。不要将完整 Prompt、模型完整输出、用户邮箱、访问令牌或每次随机生成的长文本直接写入 Span 属性：这些数据既会造成高基数和成本问题，也可能泄露敏感信息。需要受控留存的调试内容应使用脱敏日志、加密审计存储或专门的评测数据集。

## Trace 如何跨过消息队列

HTTP 或 gRPC 会把 Trace 上下文放在请求头中；消息队列没有持续连接，也同样需要在消息属性或 Header 中携带上下文。OTel 通常使用 W3C Trace Context 的 `traceparent` 和可选的 `tracestate`：生产者在发送时注入，消费者在收到后提取。

```text
Agent Orchestrator                         Queue                   Document Worker
------------------                         -----                   ---------------
当前 Span: agent.run
  | 注入 traceparent 到消息 headers
  | -> publish document.extract ---------> message
                                                          -> 提取 traceparent
                                                             -> 建立 process Span
                                                                -> tool.document_extract
```

概念代码如下，实际项目优先使用对应消息客户端的 OTel 自动埋点；手动封装时要保证注入和提取在同一个消息边界发生：

```typescript
import { context, propagation, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("agent-orchestrator");

// 生产者：创建 publish Span，并把当前上下文写入消息 Header。
await tracer.startActiveSpan("messaging.publish document.extract", async (span) => {
  const headers: Record<string, string> = {};
  propagation.inject(context.active(), headers);

  await queue.publish("document.extract", { runId, documentId }, { headers });
  span.end();
});

// 消费者：从 Header 恢复父上下文，再创建 process Span。
async function handleMessage(message: Message) {
  const parentContext = propagation.extract(context.active(), message.headers);

  await context.with(parentContext, async () => {
    await tracer.startActiveSpan("messaging.process document.extract", async (span) => {
      try {
        await extractDocument(message.body.documentId);
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: "document extraction failed" });
        throw error;
      } finally {
        span.end();
      }
    });
  });
}
```

这里有两个容易混淆的点：

1. **传播上下文不等于传播业务身份。** `traceparent` 只用于关联遥测数据，不能把它当作租户、用户或权限凭证；业务身份仍要通过经过认证和授权的消息字段传递。
2. **异步并不总是严格的父子调用。** 发布后很久才消费、一个消息被多个消费者处理、或一次消费批量处理多条消息时，纯父子树会掩盖真实关系。OTel 的消息语义约定会使用 producer、consumer、process 等 Span，并可通过 Span Link 表示“与多个上游消息相关”。不要为了画出单一树而错误地把不相关的任务接成父子关系。

消息重试也应保留可观测性：记录队列名、消息类型、消费次数、延迟和死信原因，但避免将完整消息体写进属性。是否让重试 Span 延续原 Trace 取决于队列模型和保留时间；无论采用何种策略，都应同时记录稳定的 `run_id`、`message_id` 和尝试次数，以便跨采样和跨 Trace 查询。

## Agent 应该记录哪些 Span

原则是：为用户价值、外部依赖、状态边界和显著耗时建立 Span；不要为每个函数、每个 token 或每一次字符串拼接建立 Span。下面是一套适合多数 Agent 的最小集合。

| Span | 何时创建 | 建议属性 | 不应记录的内容 |
| --- | --- | --- | --- |
| `agent.run` | 接受并开始执行一次任务时 | `agent.name`、`agent.run_id`、`tenant.id`（经脱敏或受控） | 完整用户输入、会话全文 |
| `agent.plan` | 生成或修订计划时 | `agent.step`, `plan.version`、步骤数量 | 推理过程、完整计划文本 |
| `gen_ai.chat` | 每次模型请求时 | 模型、供应商、操作名、输入/输出 Token、首字与总耗时、停止原因 | Prompt、输出全文、API Key、隐藏推理内容 |
| `tool.call <name>` | 调用检索、数据库、浏览器或业务工具时 | `tool.name`、`tool.call_id`、`operation.id`、结果摘要、重试次数 | 原始凭证、完整工具参数和私密结果 |
| `messaging.publish` | 任务投递至队列时 | 队列名、消息类型、消息 ID | 完整消息体 |
| `messaging.process` | Worker 接收任务并开始处理时 | 队列名、消息类型、消费次数、等待时间 | 完整消息体 |
| `memory.retrieve` / `memory.write` | 读写向量库、缓存或长期记忆时 | 存储类型、命中数、文档数量、延迟 | 原始记忆内容、用户隐私 |
| `agent.approval` | 等待或处理人工确认时 | 动作类型、审批结果、等待时长 | 敏感操作的完整载荷 |

自动埋点已经能覆盖 HTTP、数据库、Redis 和常见消息客户端。手动 Span 应放在自动埋点看不懂的业务边界，例如 `agent.run`、计划阶段、工具语义和人工审批。对每次模型调用，除总耗时外还应区分连接时间、首 Token 延迟和生成时间；对工具调用，有副作用的操作要同时记录幂等键或 `operation.id`，但不可把它误当作 Trace 上下文。

日志要与当前 Span 关联。结构化日志至少带上 `trace_id`、`span_id`、`run_id`、事件名和错误分类，这样从 Trace 的失败 Span 可以直接跳转到相关日志；反向从告警日志也能打开整条请求路径。

```json
{
  "level": "warn",
  "event": "tool.retry_scheduled",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "run_id": "run_01J...",
  "tool": "document_extract",
  "attempt": 2,
  "error.type": "rate_limit",
  "retry_after_ms": 800
}
```

## 实践建议

1. **先统一资源属性和关联 ID。** 所有服务至少配置 `service.name`、服务版本和部署环境；业务侧统一使用 `run_id`、`message_id`、`tool_call_id` 等字段。Trace ID 用于关联遥测，业务 ID 用于审计、幂等和跨采样查询，两者不可混用。
2. **优先启用自动埋点，再补少量业务 Span。** 自动埋点能快速覆盖入口、HTTP、数据库和消息客户端；手写 Span 只描述 Agent 生命周期、模型调用、工具调用和审批等高价值边界，避免 Span 数量失控。
3. **在队列生产与消费两端测试上下文传播。** 用同一条消息确认消费者 Trace 可关联到生产者；再验证重试、死信、批量消费和跨语言客户端。缺失 Header 时也要能正常处理消息，只是新建 Trace 并在日志中报告传播缺失。
4. **建立隐私与成本边界。** 默认不采集 Prompt、输出和消息体；字段白名单优于黑名单。为 Trace 配置采样策略，对错误、慢请求和高价值租户提高采样率，并评估采集量、保留周期和访问权限。
5. **将错误正确写入 Span。** 捕获异常后调用 `recordException` 并设置错误状态，同时保留错误类型、依赖名称和可安全展示的摘要。不要只打印错误日志后把 Span 标记为成功，否则链路视图会掩盖失败。
6. **用 Trace 驱动性能优化，而非只收集数据。** 为 `agent.run`、模型调用、队列等待和工具调用分别建立延迟与失败率看板；每次优化前后比较 P50、P95、错误率、Token 和工具重试率，才能确认体验是否真的改善。

OpenTelemetry 不是“多打一批日志”，而是为分布式任务建立可查询的因果关系。对于 Agent，先把 `agent.run`、模型、工具和消息队列四类边界连起来，就能把“任务慢或失败”的模糊问题，缩小为可定位、可度量和可改进的具体步骤。

## 延伸阅读

- [OpenTelemetry 官方文档](https://opentelemetry.io/docs/)
- [OpenTelemetry Trace Context 规范](https://opentelemetry.io/docs/specs/otel/context/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [OpenTelemetry Messaging 语义约定](https://opentelemetry.io/docs/specs/semconv/messaging/)
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
