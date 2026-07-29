# Harness Engineering

> Harness 是包围模型的工程外壳：它把 Prompt、上下文、工具、状态、策略、Graph、Memory、评估和运行时组合成一个可重复交付的 Agent 系统。

## 1. Harness 的职责

一个生产级 Harness 通常负责：

- 构造模型请求和最小充分上下文；
- 暴露当前步骤允许使用的工具；
- 校验结构化输出与工具参数；
- 管理状态、预算、取消和终止条件；
- 执行权限、风险和副作用策略；
- 记录 Trace、指标和审计事件；
- 支持组件版本、灰度发布和回滚。

Harness 不等同于某个 Agent 框架。框架提供抽象，Harness 是团队围绕业务约束形成的完整运行约定。

## 2. 推荐的分层

```text
Product / API
  → Task & Session
  → Graph / Orchestrator
  → Context Builder
  → Model Gateway
  → Tool Gateway
  → State / Memory / Artifact Store
  → Policy / Observability / Evaluation
```

模型只能提出动作，Tool Gateway 决定动作是否允许执行。Graph 负责控制流，State Store 保存事实，Context Builder 决定模型本轮看到什么。

## 3. Model Gateway

统一封装模型供应商差异，提供：

- 模型路由、超时、重试和降级；
- 结构化输出适配；
- Token、费用和限流统计；
- Prompt 模板与模型版本绑定；
- 敏感字段处理；
- 缓存与幂等请求；
- 统一错误分类。

业务节点不应散落供应商特有的参数和错误处理。

## 4. Tool Gateway

Tool Gateway 是副作用边界，应实现 Schema 校验、身份与租户校验、最小权限、风险分级、幂等、超时、结果标准化和审计。对删除、发送、支付、发布等动作加入预览和审批。

工具输出同样是不可信输入：进入模型前需要裁剪、脱敏、Schema 校验和注入隔离。

## 5. 状态、产物与记忆

- **State**：任务当前事实，可序列化、可恢复；
- **Artifact**：文件、报告、代码等大对象，用引用进入上下文；
- **Memory**：跨会话可复用的信息，有写入、更新和遗忘策略；
- **Trace**：一次执行的因果记录，不作为业务真相来源。

四者使用不同存储与保留策略，避免把对话日志当成唯一数据库。

## 6. 配置即发布单元

生产行为由多个可变组件共同决定：

```text
Release Manifest =
  Prompt Version
  + Model Route Version
  + Tool Contract Version
  + Graph Version
  + Memory Policy Version
  + Context Builder Version
  + Safety Policy Version
```

每次运行都记录完整 Manifest。不要只记录“用了哪个模型”，否则无法复现同一次决策。

## 7. 版本兼容

- Prompt 与输出 Schema 成对发布；
- Tool Schema 采用兼容性规则，破坏性变更使用新工具版本；
- Graph 中的持久化状态必须有迁移器；
- Memory 记录携带 schema、embedding 和写入策略版本；
- 模型切换前重跑质量、安全、成本和延迟基线；
- 旧任务恢复时使用原版本，或执行显式状态迁移。

## 8. 发布流程

```text
本地与单元测试
→ 固定评估集
→ 安全与对抗测试
→ 历史 Trace 回放
→ Shadow
→ Canary
→ 分租户/分场景灰度
→ 全量
```

每一阶段都设置质量、错误率、p95 延迟、单任务成本和安全事件阈值。回滚必须恢复整份 Release Manifest，而不只是模型名称。

## 9. 开发体验

优秀 Harness 应让开发者可以：

- 用固定输入重放单个节点；
- 替换工具为 Mock；
- 查看上下文为何被选中；
- 对比两个版本的 Trace；
- 在不执行真实副作用的情况下回放；
- 导出失败样本进入评估集；
- 本地模拟超时、429、部分成功和审批等待。

## 10. 最小检查清单

- [ ] 模型、工具、状态与策略边界是否清晰？
- [ ] 每次运行是否有完整 Release Manifest？
- [ ] 持久化状态是否能跨版本恢复？
- [ ] 高风险工具是否统一经过网关？
- [ ] 是否支持无副作用回放和组件 Mock？
- [ ] 灰度是否同时观察质量、成本、延迟与安全？
- [ ] 是否能一键回滚到经过验证的整套配置？

## 11. 小结

Harness Engineering 的核心是把模型能力变成可运营的软件能力。它决定一个 Agent 是否能被复现、测试、治理、发布和长期维护。

## 12. 深入理解：Harness 是模型外部的控制平面

Harness 把模型封装在可治理运行环境中。它通常包含 Model Gateway、Prompt/Context Compiler、Tool Gateway、Policy Engine、State Store、Checkpoint、Artifact Store、Eval Hooks、Trace 和 Human Gate。框架提供组件，Harness 则是团队对这些组件的具体约束、默认值与运维能力。

### 12.1 一次调用的控制路径

```text
request
 -> authenticate / authorize
 -> load immutable run configuration
 -> assemble and label context
 -> invoke routed model
 -> validate structured proposal
 -> policy and approval gate
 -> execute tool with idempotency
 -> reduce state and checkpoint
 -> emit trace and evaluation event
 -> respond / suspend / continue
```

任何环节失败都要产生标准错误与恢复决策。Harness 统一处理超时、退避、熔断、并发、Token/成本预算和敏感日志，避免每个 Agent 各写一套脆弱逻辑。

### 12.2 配置冻结与兼容矩阵

Run 创建时冻结模型策略、Prompt、Graph、Tool Schema、Memory Schema 和 Policy 版本。长任务恢复时不能直接套用最新代码；需要旧 Worker、状态迁移或显式重新开始。发布前维护生产者/消费者兼容矩阵，并对 Schema 做契约测试。

### 12.3 Local-first 调试与确定性回放

开发环境应能用录制的模型/工具响应回放轨迹，使 Graph、Reducer、权限和 UI 测试不依赖随机模型。回放不是重新调用模型，而是按事件序列重建状态；外部副作用在模拟模式中必须被阻止或替换为 Fake。

### 12.4 Build 与 Buy 的边界

优先自建与业务强相关的 State、Policy、Evaluation 和 Tool Contract；模型 SDK、队列、Trace 存储等基础设施可采用成熟组件。不要让框架对象成为唯一持久化格式，否则升级框架会变成数据迁移和恢复风险。

完整的模块、长任务、验证、故障恢复和演进案例参见 [Harness Engineering 深入](./08-harness-engineering)。