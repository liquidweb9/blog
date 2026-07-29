# Function Call、Tool Engineering 与 MCP

> Function Call 解决模型如何提出结构化动作，Tool Engineering 解决动作如何安全可靠地执行，MCP 解决能力如何以统一协议被发现和连接。

## 1. 三层边界

```text
模型输出 Tool Call
→ Tool Gateway 校验、授权和执行
→ MCP / HTTP / SDK / Queue 连接真实能力
```

Function Call 不是函数执行；模型只生成工具名和参数。真正的副作用必须经过运行时。

## 2. 工具契约

一个工具定义至少包含：

- 稳定名称和单一职责；
- 清晰描述与适用/不适用场景；
- 严格输入输出 Schema；
- 身份、租户与权限要求；
- read / write_low / write_high 风险等级；
- 超时、幂等和重试语义；
- 错误码与 `retryable` 标记；
- 契约版本与弃用计划。

避免暴露“万能 execute”工具，也不要让一个布尔参数把只读查询变成删除操作。

## 3. 参数与语义校验

Schema 校验之后仍需业务校验，例如资源归属、订单状态、额度、时间范围和审批记录。所有资源标识应由服务端解析并重新授权，不能信任模型生成的身份声明。

## 4. 结果标准化

```json
{
  "status": "SUCCESS",
  "data": {},
  "error": null,
  "retryable": false,
  "side_effect_committed": false,
  "external_request_id": "req_123"
}
```

返回给模型前执行裁剪、脱敏和不可信内容隔离。大结果存入 Artifact Store，只把引用和摘要放进上下文。

## 5. 副作用治理

写工具需要稳定幂等键、预览、参数绑定确认、审计和补偿策略。网络超时后先查询真实状态，再决定是否重试。删除、支付、发送和发布等动作不能由模型自行扩大作用范围。

## 6. MCP 的位置

MCP 可以统一工具、资源和 Prompt 等能力的连接方式，但不会自动解决：

- 业务授权和租户隔离；
- 第三方 Server 的可信度；
- Prompt Injection；
- 幂等、事务和补偿；
- 数据最小化；
- 工具质量和版本兼容。

MCP Client/Host 仍需在本地 Tool Gateway 执行 allowlist、权限映射、风险分级和审计。

## 7. 工具版本与发布

兼容变更可以增加可选字段；删除字段、改变语义或扩大副作用应发布新工具版本。Trace 记录 Tool Catalog 与每个契约版本，Canary 阶段比较选择正确率、参数错误率、失败率、延迟和副作用异常。

## 8. 测试

- Schema 合法、非法和边界参数；
- 错误租户、过期身份和最小权限；
- 超时但真实成功、重复幂等键和部分成功；
- 429、5xx、熔断与降级；
- 恶意工具输出和超大返回；
- 契约兼容与旧 Graph 回放；
- 高风险调用是否绕过确认。

## 9. 延伸阅读

- [Function Call 深入笔记](./04-function-call)
- [MCP 深入笔记](./05-mcp)
- [Agent 协议与互操作](./05-agent-protocols)

## 10. 小结

可靠工具系统的关键，是把“模型想做什么”和“系统允许做什么、实际发生了什么”分开。协议负责连接，网关负责治理，业务服务负责最终授权与一致性。

## 深入理解：工具是受治理的能力边界

Function Call 是模型生成结构化调用意图的机制；Tool Engineering 负责能力拆分、Schema、执行、错误、权限、幂等和可观测性；MCP 负责主机与外部能力提供方之间的标准化发现与调用。三者处于不同层级，不能相互替代。

工具应按业务原子性设计，而不是简单映射底层 API。一个好工具有清晰前置条件、最小参数、稳定返回、有限副作用和可操作错误码。把 `execute_sql`、`http_request` 之类通用能力直接交给模型，会扩大权限和注入面；优先提供 `search_orders`、`create_refund_draft` 这类领域能力。

执行管线应固定为：工具发现与裁剪 → 模型提出调用 → Schema 与语义校验 → 身份/租户/范围授权 → 风险策略与审批 → 幂等执行 → 结果标准化与截断 → 状态更新与审计。模型输出永远不能绕过执行器。

### 错误契约

```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMITED",
    "retryable": true,
    "safe_to_retry": true,
    "retry_after_ms": 1200,
    "message_for_model": "服务繁忙，请稍后重试",
    "internal_ref": "err_7f31"
  }
}
```

`retryable` 不等于 `safe_to_retry`：读取可以重试，创建付款若无幂等键则可能重复副作用。工具结果同样是不可信输入，需防止其中的间接 Prompt Injection。

### 深入专题

更深入的描述详见 [Function Call 深入](./04-function-call) 与 [MCP 深入](./05-mcp)。前者覆盖完整调用循环、Schema、路由、调试、权限和评估；后者覆盖 MCP 生命周期、传输、能力协商与 Server/Client/Host 边界。