# Agent Engineering

Agent Engineering 关注的不是如何让模型“多说一点”，而是如何把不稳定的模型能力组织成一个可控制、可观察、可恢复、可持续改进的软件系统。

这组笔记按生产 Agent 的完整工程链路组织：从模型接口、执行循环和工具协议出发，经过知识、记忆与上下文管理，最后进入评估、运行时、成本、安全、人机协作和完整案例。

## 学习路线

1. [Agent 基础](./01-agent-basics) — Agent 与普通 LLM 应用的差异，以及工程系统的基本组成。
2. [Prompt Engineering 与结构化输出](./02-prompt-engineering) — 指令分层、Structured Outputs、Schema 校验、注入防护及版本发布。
3. [Agent Loop、Planning 与 Agent Graph](./03-agent-loop-planning-graph) — 执行闭环、计划策略、显式 Graph、状态迁移和终止条件。
4. [Function Call、Tool Engineering 与 MCP](./04-tool-engineering) — 工具契约、Tool Gateway、副作用治理以及 MCP 工具接入。
5. [Agent 协议与互操作：MCP、A2A、Agent Identity](./05-agent-protocols) — 能力发现、任务委托、身份、授权链和跨 Agent 安全。
6. [RAG 工程](./06-rag-engineering) — 文档解析、索引、检索、重排、生成、引用、权限与评估。
7. [Agent Memory](./07-agent-memory) — 记忆的写入、检索、更新、冲突、遗忘、版本和治理。
8. [Context Engineering](./08-context-engineering) — 上下文选择、压缩、排序、Token 预算、缓存与污染防护。
9. [Harness Engineering](./09-harness-engineering) — Model/Tool Gateway、状态、Release Manifest 与多组件协同发布。
10. [Agent Evaluation、Testing 与 Observability](./10-agent-evaluation) — 结果、轨迹和组件评估，测试分层、Trace、指标与 SLO。
11. [Agent Runtime、部署与 Durable Execution](./11-agent-runtime) — 状态机、Checkpoint/Replay、幂等、补偿、队列、隔离与灾备。
12. [模型策略、成本与性能工程](./12-model-strategy) — 模型路由、Cascade/Fallback、Token、缓存、预算与性能测试。
13. [Agent 安全、威胁建模与可靠性](./13-agent-security) — Sandbox、Supply Chain、Threat Modeling、Red Team 和事件响应。
14. [Human-in-the-loop 与 Agent 产品交互](./14-human-in-the-loop) — 审批、澄清、接管、Interrupt/Resume、风险 Gate 与 Agent UX。
15. [生产级 Agent 完整案例：Wenjian](./15-production-case-wenjian) — 基于 GitHub 当前实现拆解简历 Claim、11 节点 Graph、证据评分、实时恢复、已知边界与生产化路径。

## 深入资料与兼容入口

下列既有长篇笔记继续保留，作为新学习路线的深入资料：

- [Agent Loop 深入笔记](./02-agent-loop)
- [Agent Graph 深入笔记](./03-agent-graph)
- [Function Call 深入笔记](./04-function-call)
- [MCP 深入笔记](./05-mcp)
- [Context 与 Harness 原综合笔记](./08-harness-engineering)
- [Agent 安全与可靠性原详篇](./09-agent-security)

## 贯穿各章的工程问题

1. **状态在哪里？** 哪些信息属于当前上下文，哪些需要持久化？
2. **决策权在哪里？** 哪些步骤交给模型，哪些必须由确定性代码控制？
3. **身份和权限在哪里？** 委托是否最小、短期、可撤销且可追踪？
4. **副作用在哪里？** 哪些动作需要策略校验、幂等、Sandbox 或人工确认？
5. **失败后怎么办？** 系统能否超时、重试、降级、补偿和从检查点恢复？
6. **如何证明有效？** 是否有评估集、测试、Trace、指标和发布门禁？
7. **如何安全演进？** Prompt、Model、Tool、Graph、Memory 与策略是否可版本化、灰度和回滚？

> 实用原则：先用确定性 Workflow 解决已知流程，只在确实需要语义判断或动态决策的局部引入 Agent。