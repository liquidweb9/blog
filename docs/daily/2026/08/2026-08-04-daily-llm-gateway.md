---
title: 为什么 Agent 应用需要 LLM Gateway
date: 2026-08-04
tags:
  - Agent
  - LLM
  - 工程实践
description: LLM Gateway 将模型路由、凭证管理、限流、观测和故障切换收敛为统一入口，让应用代码不再绑定单一模型供应商。
---

# 为什么 Agent 应用需要 LLM Gateway

## 一句话结论

LLM Gateway 是应用与各类大模型 API 之间的统一服务层。它把模型选择、密钥管理、配额控制、日志观测和故障切换从业务代码中移出；当应用需要使用多个模型、多个供应商，或需要稳定地控制成本与风险时，它比在每个服务中直接调用模型 API 更可靠。

## 问题与场景

一个 Agent 项目起步时，通常只调用一种模型：

```text
Agent Service
    -> provider SDK
    -> LLM API
```

这种方式简单，但模型调用散落在多个服务后，会很快遇到问题：

- 不同服务各自保存 API Key，轮换和权限收回困难；
- 想为简单任务换低价模型、为复杂任务换强模型时，需要修改多处代码；
- 某个供应商限流或超时时，业务服务不知道该重试、降级还是切换模型；
- 无法统一统计每个租户、Agent 或功能消耗的 Token 与费用；
- Prompt、响应和工具调用日志分散，排查一次失败请求需要跨多个系统。

这时直接调用模型的代码不只是“一个 SDK 调用”，而是逐渐承担了路由、鉴权、重试、预算和审计等平台职责。

### LLM Gateway 和 API Gateway 有什么不同

传统 API Gateway 主要位于外部调用方与业务服务之间，关注的是 HTTP 请求如何安全、稳定地进入系统：

```text
客户端
    -> API Gateway
    -> 订单服务 / 用户服务 / Agent 服务
```

它通常负责身份认证、路由、通用限流、TLS 终止、WAF 和服务级监控。它并不了解一次请求会消耗多少 Token，也不需要判断某个模型是否支持工具调用。

LLM Gateway 位于业务服务与模型供应商之间，关注的是一次模型推理如何被选择、执行和治理：

```text
Agent 服务
    -> LLM Gateway
    -> OpenAI / Anthropic / 自部署模型 / 其他供应商
```

两者可以共存，且职责不同：API Gateway 保护进入应用的流量，LLM Gateway 管理离开应用的模型调用。小型项目也可以先将两类能力放在同一个服务中，但应在逻辑上区分“业务 API 路由”和“模型调用治理”。

## 一个具体例子

假设客服 Agent 默认使用模型 `fast-model`，遇到复杂工单时升级到 `reasoning-model`。业务服务只调用自己的 Gateway：

```http
POST /v1/chat/completions
Authorization: Bearer gateway-token
Content-Type: application/json

{
  "model": "support-default",
  "messages": [
    {"role": "user", "content": "我的订单被重复扣款了"}
  ],
  "metadata": {
    "tenant_id": "tenant_001",
    "agent": "support",
    "trace_id": "trace_8f31"
  }
}
```

Gateway 根据别名和策略完成实际调用：

```text
support-default
    -> 判断问题复杂度
    -> fast-model 或 reasoning-model
    -> 对应供应商 API
    -> 统一记录延迟、Token、费用与错误
```

如果默认供应商返回可重试的限流错误，Gateway 可以在明确的预算和重试策略内切换到备用模型：

```text
primary provider: 429 rate limit
    -> wait with backoff
    -> fallback provider
    -> return the normalized response
```

调用方仍只处理一套请求和响应格式，不需要知道密钥、供应商差异或切换细节。这里的“统一”不表示抹平模型能力差异：工具调用、结构化输出、推理强度等特性仍应通过显式能力约束暴露给调用方。

### LLM Gateway 应该管理什么

一个面向生产环境的 LLM Gateway 通常按以下层次提供能力：

```text
LLM Gateway
├── 身份认证
├── API Key 管理
├── 模型注册
├── 模型路由
├── 负载均衡
├── 超时与重试
├── Fallback 降级
├── 并发限制
├── Token 限制
├── 成本统计
├── Prompt 日志
├── 响应缓存
├── 敏感数据脱敏
├── 内容安全
└── 监控告警
```

- **身份认证与 API Key 管理：** 应用使用内部凭证调用 Gateway，供应商密钥仅保存在 Gateway 的密钥系统中。这样可以按租户、团队或 Agent 授权，并在密钥泄露、离职或轮换时集中处理，避免将供应商 Key 分发到每个业务服务。
- **模型注册与模型路由：** 注册模型的上下文长度、价格、区域、工具调用和结构化输出等能力；业务侧请求逻辑别名，Gateway 再按任务类型、预算、延迟目标和能力约束选择实际模型。
- **负载均衡、超时与重试：** 同一模型可能有多个供应商账户、区域或自部署实例。Gateway 应按健康度和容量分配流量，并为连接、首 Token 和总生成时间分别设定超时。重试必须有限且带退避，不能把下游过载扩大成更高流量。
- **Fallback 降级：** 主模型不可用时，可选择能力兼容的备用模型，或者返回缓存结果、排队结果和明确的失败。降级策略必须由场景决定：摘要失败可以换模型，涉及结构化字段、工具调用或严格输出格式的任务必须验证备用模型兼容性。
- **并发限制与 Token 限制：** 限制单个租户、用户、Agent 或模型的并发请求数，防止一个长任务耗尽连接池；同时限制输入长度、最大输出 Token 和单次任务累计 Token，避免超长上下文导致延迟、失败和费用失控。
- **成本统计：** 记录每次调用使用的模型、输入与输出 Token、缓存命中、价格版本和归属维度。报表至少能回答“哪个 Agent、功能或租户花了多少钱”，并支持预算阈值、超额阻断或审批。
- **Prompt 日志与响应缓存：** 为排障保存请求 ID、模型路由、耗时、Token 用量和错误码；Prompt 和输出内容应按权限、脱敏和保留期处理。对于温度较低、结果可复用的读取类任务，可按规范化请求缓存响应；不能把带用户私有数据或实时性要求高的请求直接共享缓存。
- **敏感数据脱敏与内容安全：** 在请求离开可信边界前识别并掩码密码、访问令牌、身份证号等敏感信息，并在输出侧检测违规内容、提示注入结果或不应泄露的数据。脱敏不能替代应用层权限校验，内容安全也不能替代高风险操作的人机确认。
- **监控告警：** 监控模型可用率、首 Token 延迟、总耗时、错误率、429 比例、Fallback 比例、并发队列长度、Token 消耗和费用。当供应商异常、某个 Prompt 造成 Token 激增或成本超过预算时，应能定位到模型、路由规则和调用方。

## 实践建议

1. **先定义内部模型别名，不要在业务代码写供应商模型名。** 例如使用 `support-default`、`coding-strong`，再由 Gateway 映射实际模型。替换模型时先做小流量评估，避免同名别名突然改变输出质量或工具调用行为。
2. **为路由规则写清能力和预算约束。** 不要只根据“模型名称”切换。结构化输出、函数调用、上下文长度、数据驻留区域和每次调用成本，都应成为路由和 Fallback 的前置条件。
3. **只把可安全重试的故障交给 Gateway。** 网络连接失败、短暂 429 或 5xx 可以有限重试；请求超时不代表模型没有执行。对于会触发工具或产生外部副作用的 Agent 流程，要用 `run_id` 或幂等键防止重复执行。
4. **将成本和配额作为一等指标。** 至少按模型、租户、Agent、功能统计输入 Token、输出 Token、延迟、错误率和实际费用；设置请求大小、并发数和单次任务预算上限，而不是只在月底看账单。
5. **日志默认脱敏并支持追踪。** 记录 `trace_id`、模型、路由结果、耗时和 Token 用量；Prompt 与响应可能包含用户隐私或密钥，不应无条件写入普通日志。需要留存内容时，明确访问权限、保留周期和脱敏规则。
6. **不要过早自建复杂网关。** 只有一个服务、一个模型且调用量很小时，在应用内封装一层客户端通常足够。出现多供应商、多团队共用、严格配额或统一审计需求后，再引入独立 Gateway 或成熟托管方案。

LLM Gateway 的价值不在于让所有模型“看起来完全一样”，而在于为变化建立一个可观测、可控制的边界：业务服务关注任务，平台层负责模型调用的可靠性、成本和治理。

## 延伸阅读

- [OpenAI API 文档：Production best practices](https://platform.openai.com/docs/guides/production-best-practices)
- [Anthropic API 文档：Rate limits](https://docs.anthropic.com/en/api/rate-limits)
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
