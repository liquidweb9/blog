# Agent 协议与互操作：MCP、A2A 与 Agent Identity

> 单个 Agent 可以通过私有接口完成任务；当工具、数据源和其他 Agent 来自不同团队、框架或组织时，系统还需要可发现、可认证、可授权、可追踪的互操作协议。

---

## 1. 为什么 Agent 需要协议

Agent 系统中的互操作问题可以分为三层：

```text
Agent 如何连接工具和上下文
Agent 如何发现并委托其他 Agent
通信双方如何证明“我是谁、能做什么、代表谁”
```

如果每个系统都使用私有接口，工程团队需要反复实现：

- 工具描述与参数适配；
- 能力发现；
- 会话和任务状态同步；
- 流式结果和异步回调；
- 身份认证与权限传递；
- 错误模型、重试和取消；
- 审计、计费与责任归属。

协议的价值不是让模型变得更聪明，而是降低系统之间的集成成本，并为安全边界提供统一的表达方式。

## 2. 三类互操作对象

### 2.1 Agent 与 Tool

这类通信关注：

- 有哪些工具、资源和 Prompt；
- 参数与返回值是什么；
- 如何建立连接并调用；
- 如何报告执行错误；
- 如何控制工具访问权限。

MCP 主要解决这一层问题。

### 2.2 Agent 与 Agent

这类通信关注：

- 对方具备什么能力；
- 如何委托一个目标，而不是调用一个底层函数；
- 长时间任务如何查询、取消和恢复；
- 中间产物、消息和最终结果如何传递；
- 多个参与方如何协商输入、输出和状态。

A2A 主要解决这一层问题。

### 2.3 Principal、Agent 与 Service

Agent 往往不是最终权限主体。它可能代表：

- 一个用户；
- 一个服务账号；
- 一个组织；
- 另一个 Agent；
- 某次受限任务。

因此系统还需要回答：

```text
谁发起了请求？
哪个 Agent 正在执行？
Agent 代表谁行动？
它被授予了哪些权限？
授权是否只适用于当前任务？
```

这属于 Agent Identity、认证、授权与委托链问题。

## 3. MCP：连接模型应用与工具、资源

MCP 可以理解为模型应用与外部能力之间的标准化连接层。

一个典型结构是：

```text
Host
└── MCP Client
    ├── MCP Server：代码仓库
    ├── MCP Server：数据库
    └── MCP Server：企业知识库
```

其中：

- **Host**：承载 Agent 或模型应用，负责用户体验、权限和整体编排；
- **Client**：与一个 Server 建立协议连接；
- **Server**：向 Client 暴露受控的工具、资源或 Prompt。

### 3.1 MCP 的核心能力

#### Tools

可由模型选择调用的操作，例如：

```text
search_code(query)
create_ticket(title, description)
query_database(sql)
```

工具定义应包含：

- 稳定、语义明确的名称；
- 清晰的适用边界；
- 可校验的输入 Schema；
- 可预期的返回结构；
- 副作用和风险说明。

#### Resources

由应用读取并提供给模型的上下文资源，例如：

- 文件；
- 数据库记录；
- 项目文档；
- API Schema；
- 日志片段。

资源通常更接近“可读取的数据”，工具更接近“可执行的动作”。

#### Prompts

由 Server 提供的可复用 Prompt 模板或工作入口。它适合承载某个能力的推荐使用方式，但不能代替 Host 的系统规则和安全策略。

### 3.2 MCP 不负责什么

MCP 本身不自动保证：

- Server 是可信的；
- 工具参数符合业务授权；
- 模型不会选择错误工具；
- 写操作可逆；
- 工具输出没有 Prompt Injection；
- 多 Agent 委托关系正确；
- 任务可以跨服务持续运行。

这些仍需由 Host、身份系统、执行环境和 Harness 共同保证。

### 3.3 MCP 的工程边界

一个常见错误是把 MCP 等同于 Agent Framework。

```text
MCP：定义如何连接和交换能力
Agent Framework：定义如何规划、循环、管理状态和执行任务
Harness：定义完整系统如何安全、可靠地运行
```

MCP 可以被多种 Agent Framework 使用，但不会替代 Agent Loop、状态机、评估和故障恢复。

## 4. A2A：Agent 与 Agent 的任务协作

与工具调用相比，Agent 委托通常具有更高层语义。

工具调用更像：

```text
调用 search_flights(origin, destination, date)
```

Agent 委托更像：

```text
为这次出差制定满足预算、时间和公司政策的行程方案，
在遇到价格变化时给出替代方案。
```

后者可能包含：

- 多步骤执行；
- 多轮澄清；
- 长时间运行；
- 任务状态变化；
- 多种中间产物；
- 局部失败与恢复；
- 由被委托方自主选择工具。

### 4.1 A2A 的核心抽象

不同实现的术语可能不同，但工程上通常需要以下对象。

#### Agent Card 或能力描述

用于声明：

- Agent 名称和服务地址；
- 支持的能力或 Skill；
- 输入输出模态；
- 认证方式；
- 协议版本；
- 可选扩展。

能力描述是发现入口，不应被视为可信授权凭据。调用方仍需验证来源和身份。

#### Task

一次有生命周期的工作单元。典型状态包括：

```text
SUBMITTED
→ WORKING
→ INPUT_REQUIRED
→ COMPLETED

或：

→ FAILED
→ CANCELED
```

任务必须具有稳定 ID，以支持查询、重试、取消、幂等和审计。

#### Message

参与方之间的交互消息，可能包含：

- 文本；
- 结构化数据；
- 文件引用；
- 用户补充；
- 错误与状态说明。

#### Artifact

任务生成的中间或最终产物，例如：

- 报告；
- 代码补丁；
- 表格；
- 图片；
- 结构化 JSON；
- 可下载文件。

将 Artifact 与自然语言 Message 分开，有利于校验、版本管理和下游消费。

### 4.2 同步、流式与异步任务

短任务可以使用同步请求：

```text
Request → Result
```

需要持续反馈的任务可以使用流式交互：

```text
Request → Status → Partial Artifact → Status → Result
```

长时间任务更适合异步模式：

```text
Submit Task
→ 获得 task_id
→ 查询或接收回调
→ 必要时补充输入
→ 获取最终 Artifact
```

无论采用哪种模式，都需要定义：

- 超时；
- 取消；
- 断线重连；
- 事件顺序；
- 重复消息处理；
- 最终状态；
- 结果保留时间。

## 5. MCP 与 A2A 的关系

MCP 和 A2A 不是相互替代的协议。

| 对比维度 | MCP | A2A |
| --- | --- | --- |
| 主要连接对象 | 模型应用与工具、资源 | Agent 与 Agent |
| 交互粒度 | 能力调用或资源读取 | 目标委托与任务协作 |
| 状态特征 | 通常围绕一次调用 | 常有完整任务生命周期 |
| 自主性 | 调用方决定调用什么 | 被委托方可自主规划 |
| 典型产物 | Tool Result、Resource | Message、Task、Artifact |
| 常见用途 | 数据库、搜索、代码、SaaS 接入 | 跨团队 Agent、专业 Agent 协作 |

二者可以组合：

```text
用户
  ↓
Travel Agent
  ├── A2A → Policy Agent
  ├── A2A → Booking Agent
  └── MCP → Calendar / Maps / Expense Tools
```

关键原则是：

> 当调用对象是边界清晰、参数确定的能力时，优先使用 Tool；当调用对象需要自主完成一个有状态目标时，才考虑 Agent 委托。

不要为了“多 Agent”而把简单函数包装成 Agent。多 Agent 会额外引入发现、身份、状态同步、成本和失败传播问题。

## 6. Agent Identity：Agent 到底代表谁

传统服务认证通常只需要确认客户端身份。Agent 系统还存在一条委托链：

```text
Human Principal
→ Host Application
→ Agent
→ Remote Agent
→ Tool or Service
```

每一跳都不应默认继承上一跳的全部权限。

### 6.1 身份相关的四个问题

#### Authentication

确认通信方是谁，以及凭据是否有效。

#### Authorization

确认该身份能否执行某项操作、访问某个资源。

#### Delegation

确认 Agent 是否被允许代表用户执行当前任务，以及授权范围、有效期和目标受众。

#### Accountability

确认发生操作后能否追溯：

- 最终用户；
- 调用 Agent；
- 被委托 Agent；
- 使用的工具；
- 权限决策；
- 实际副作用。

### 6.2 Agent Identity 的最小数据模型

一次受控委托至少应关联：

```json
{
  "principal_id": "user_123",
  "agent_id": "travel_agent",
  "task_id": "task_456",
  "audience": "booking_service",
  "scopes": ["flight.search"],
  "expires_at": "timestamp",
  "delegation_id": "delegation_789"
}
```

真实系统还可能加入：

- 组织和租户；
- 数据区域；
- 风险等级；
- 设备或会话；
- 授权依据；
- 预算上限；
- 是否允许继续转委托。

### 6.3 不要直接转发用户凭据

把用户的长期 Token 或高权限凭据直接交给远程 Agent，会导致：

- 权限范围过大；
- 凭据泄漏半径扩大；
- 无法限制具体受众；
- 难以撤销单次任务授权；
- 审计时无法区分用户与 Agent 行为。

更安全的方式是使用：

```text
短期凭据
+ 最小 Scope
+ 明确 Audience
+ 绑定 Task
+ 可撤销
+ 不允许任意转委托
```

## 7. 能力发现不能等于信任

发现一个 Agent 或 MCP Server，只能说明它声明了某种能力，不能说明：

- 能力真实存在；
- 返回结果正确；
- 服务没有被冒充；
- 数据处理方式合规；
- 它值得获得敏感信息；
- 它可以执行高风险写操作。

因此，生产系统应将流程拆开：

```text
Discovery
→ Identity Verification
→ Policy Evaluation
→ Capability Negotiation
→ Execution
→ Verification
```

对跨组织服务，还需要维护：

- 允许列表；
- 签名或证书验证；
- 数据处理协议；
- 服务版本和兼容范围；
- 风险分级；
- 熔断与撤销机制。

## 8. 协议层的可靠性设计

### 8.1 幂等

写操作应支持幂等键：

```text
同一个 task_id + operation_id
重复提交
→ 不产生重复副作用
```

### 8.2 超时与取消

取消需要区分：

- 客户端不再等待；
- 服务端停止执行；
- 已产生副作用是否回滚；
- 子任务是否继续运行。

### 8.3 错误分类

错误至少应区分：

- 协议格式错误；
- 认证失败；
- 授权拒绝；
- 输入不完整；
- 暂时不可用；
- 业务执行失败；
- 不可恢复失败。

只有暂时性错误适合自动重试。认证、授权和业务冲突不应通过无上限重试解决。

### 8.4 版本协商

协议、能力描述和 Payload Schema 都需要版本。兼容策略应说明：

- 支持的协议版本；
- 必需与可选字段；
- 未知字段如何处理；
- 废弃时间表；
- 是否允许客户端降级；
- 破坏性变更如何发布。

### 8.5 背压与预算

Agent 委托可能递归扩散：

```text
Agent A → Agent B → Agent C → 多个工具
```

系统应限制：

- 最大委托深度；
- 最大并发数；
- Token 和费用预算；
- 总运行时长；
- 最大消息与 Artifact 大小；
- 单任务重试次数。

## 9. 安全威胁

协议打通后，攻击面也会扩大。

### 9.1 恶意能力描述

Agent Card 或工具描述可能诱导调用方发送敏感数据，或声称不存在的安全能力。

### 9.2 Prompt Injection 传播

远程 Agent、资源和工具输出都可能包含恶意指令。外部内容应被标记为不可信数据，不得获得与系统指令相同的优先级。

### 9.3 Confused Deputy

低权限调用方诱导高权限 Agent 代其执行无权操作。防御重点是每次操作都依据原始 Principal、当前 Task 和目标资源重新授权。

### 9.4 权限放大与转委托失控

Agent B 不应因为被 Agent A 调用，就自动获得 Agent A 或最终用户的所有权限。

### 9.5 身份冒充与服务替换

仅依赖可修改的服务地址或名称容易被冒充。应验证服务身份、传输安全和能力元数据来源。

### 9.6 数据外泄

委托前应执行数据最小化：

```text
完整用户档案
→ 只提取完成子任务所需字段
→ 脱敏或令牌化
→ 发送给远程 Agent
```

## 10. 可观测性与审计

跨 Agent Trace 应能串联完整调用链：

```json
{
  "trace_id": "trace_001",
  "task_id": "task_456",
  "parent_task_id": "task_123",
  "principal_id": "user_123",
  "caller_agent": "orchestrator",
  "callee_agent": "booking_agent",
  "capability": "flight_booking",
  "policy_decision": "approval_required",
  "status": "input_required"
}
```

日志还应记录：

- 协议与能力版本；
- 身份验证结果；
- 授权策略版本；
- 输入输出摘要或安全哈希；
- 状态转换；
- 延迟、成本和重试；
- 人工批准；
- Artifact 版本；
- 最终副作用。

敏感参数不应原样写入日志。可观测性不能以泄漏凭据和隐私为代价。

## 11. 设计一个互操作层

一个生产级互操作层可以拆为：

```text
Registry / Discovery
        ↓
Identity & Trust
        ↓
Policy Enforcement
        ↓
Protocol Adapter
        ↓
Task & State Manager
        ↓
Artifact Store
        ↓
Tracing & Audit
```

协议适配层只解决消息交换；身份、策略、状态和审计仍应作为独立组件存在。

## 12. 实践检查清单

### 12.1 MCP

- 工具、资源和 Prompt 的边界是否明确？
- 工具参数是否使用严格 Schema？
- 是否标明副作用、权限和风险？
- Server 返回是否被视为不可信输入？
- 高风险操作是否经过 Host 侧授权？
- 是否限制 Server 可访问的凭据和网络？

### 12.2 A2A

- 是否真的需要委托 Agent，而不是调用 Tool？
- 能力是否可发现、可验证、可版本化？
- Task 是否有稳定 ID 和明确状态机？
- 是否支持超时、取消、幂等和恢复？
- Message 与 Artifact 是否分离？
- 是否限制委托深度、并发和预算？

### 12.3 Identity

- 是否记录原始 Principal？
- Agent 是否拥有独立身份？
- 凭据是否短期、最小权限且绑定 Audience？
- 每一跳是否重新授权？
- 是否限制转委托？
- 是否可以撤销单次任务授权？
- 审计能否还原完整责任链？

## 13. 最终总结

Agent 互操作不是一个单一协议能够解决的问题。

```text
MCP
→ 连接模型应用与工具、资源和 Prompt

A2A
→ 连接能够自主执行任务的 Agent

Agent Identity
→ 证明通信方身份，约束代表关系和权限委托
```

真正可用的跨系统 Agent 架构还需要：

```text
协议标准化
+ 最小权限
+ 任务状态
+ 版本协商
+ 结果验证
+ 全链路审计
```

协议负责让系统能够通信；身份和策略负责决定是否允许通信；Harness 负责让通信产生的任务能够安全、可靠地完成。

## 深入理解：互操作不仅是“能发消息”

协议要同时定义语法、语义、生命周期、身份与失败处理。MCP 解决 Agent Host 如何连接工具和上下文提供方；A2A 解决独立 Agent 如何发现能力、委派长任务、交换状态与 Artifact；Agent Identity 解决“谁代表谁、能做什么、授权是否可委托”。

跨 Agent 任务信封至少包含任务 ID、目标、输入 Artifact、输出契约、截止时间、预算、调用方身份、委托链、Trace Context 和幂等键。接收方应返回明确状态，而不是仅靠自然语言猜测 `submitted | working | input_required | completed | failed | cancelled`。

### 委托链与最小权限

用户授权 Agent A 不意味着 A 可以把全部权限转交给 Agent B。委托令牌应限制 audience、scope、resource、purpose、有效期和最大委托深度。B 调用工具时必须保留最终用户、委托者和执行者三种身份，审计记录才能回答“谁授权、谁决定、谁执行”。

### 语义兼容与版本

Schema 兼容不代表语义兼容。字段 `amount=100` 若没有币种、税前税后和单位就无法安全互操作。能力卡和工具描述应版本化；破坏性变更采用新版本或协商降级。消费者对未知字段应有明确策略，提供方不得静默改变枚举含义。

### 信任边界

远程 Agent 的结论、Artifact 和工具结果都是外部输入。调用方必须验证签名/传输身份、内容类型、大小、恶意指令、证据引用与授权范围。协议标准化降低集成成本，但不会自动带来可信、正确或事务一致性。

MCP 的协议细节继续参考 [MCP 深入](./05-mcp)；工具侧治理参考 [Function Call 深入](./04-function-call)。