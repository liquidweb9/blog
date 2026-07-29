# Agent Loop、Planning 与 Agent Graph

> Agent Loop 提供“观察—决策—行动—反馈”的闭环，Planning 决定如何分解与调整任务，Agent Graph 则把控制流、状态和恢复边界显式化。

## 1. 三者的关系

```text
Agent Loop：一次次推进任务
Planning：决定推进路径和中间目标
Agent Graph：约束可走的节点、分支、循环与终止
```

开放式探索可以使用动态 Loop，稳定业务步骤使用确定性 Workflow，生产系统通常用 Graph 把两者组合。

## 2. 最小执行循环

```text
读取目标与状态
→ 构造当前上下文
→ 提议下一动作
→ 策略与参数校验
→ 执行工具
→ 标准化观察
→ 更新状态
→ 检查完成、预算或等待条件
```

终止条件必须同时包含语义完成判断和步骤数、时间、费用、连续错误、用户取消等硬限制。

## 3. Planning 策略

- **Plan-and-Execute**：先生成步骤，再逐步执行；适合依赖清晰的任务；
- **Rolling Plan**：只规划近期步骤，获得新证据后更新；
- **ReAct**：决策和工具观察紧密交替，适合探索；
- **Hierarchical Planning**：上层分解目标，下层 Agent/Workflow 执行；
- **DAG Planning**：显式依赖，可并行执行独立只读步骤。

计划不是承诺。每个步骤应包含目标、依赖、允许工具、完成条件、风险和预计预算。

## 4. 何时重新规划

仅在出现新信息、假设被证伪、依赖失败、预算变化或用户修改目标时重新规划。避免每一步都重写整份计划，否则会产生抖动、成本增加和进度丢失。

## 5. Graph 设计

节点应单一职责、输入输出结构化，并明确：

- 可读取和修改的状态字段；
- 允许调用的工具；
- 超时与重试策略；
- 是否有副作用；
- 检查点与恢复方式；
- 下一跳和终止条件。

并行分支必须有确定的聚合、冲突和取消策略。

## 6. 持久化与 Durable 边界

在模型调用、高风险工具、人工等待和长耗时步骤前后保存检查点。恢复时不能简单重跑可能已经提交的副作用，应先查询外部真实状态并使用幂等键。

## 7. 计划与 Graph 的版本

Graph 版本需要进入 Trace。持久化任务记录启动时的 Graph 版本；新版本若改变状态 Schema、节点语义或路由，需要显式迁移，或让旧任务继续在旧版本完成。

## 8. 评估

- 任务完成率与平均步骤数；
- 无效/重复工具调用率；
- 计划遵循率和重规划率；
- 错误路由与错误终止率；
- 并行带来的延迟收益和额外成本；
- 检查点恢复成功率；
- 高风险节点策略拒绝率。

## 9. 延伸阅读

- [Agent Loop 深入笔记](./02-agent-loop)
- [Agent Graph 深入笔记](./03-agent-graph)
- [Agent Runtime、部署与 Durable Execution](./11-agent-runtime)

## 10. 小结

Loop 带来适应性，Planning 带来方向，Graph 带来边界。三者结合的目标不是最大化自主性，而是在不确定任务中保持可控、可测和可恢复。

## 11. 深入理解：从循环到可恢复状态机

Agent Loop 描述“观察—决策—行动—再观察”的动态行为；Planning 决定如何把目标转成当前可执行步骤；Graph 把允许的状态转换、分支和失败路径显式化。生产系统通常是外层 Graph 管生命周期，局部节点内运行受预算约束的 Loop，Planner 在新证据、失败或目标变化时增量重规划。

```text
while not terminal(state):
    assert_budget(state)
    observation = observe(state)
    proposal = policy(observation, state)
    decision = validate_and_authorize(proposal)
    result = execute_idempotently(decision)
    state = reduce(state, result)
    checkpoint(state)
```

### 11.1 Plan 不是事实源

计划是可废弃的意图，不是已经完成的事实。每个步骤至少要有 `step_id`、依赖、预期产物、验证条件、风险等级和状态。工具结果或用户输入让前提失效时，只重规划未完成部分；已经发生的副作用进入补偿流程，不能靠改写计划抹除。

### 11.2 Graph State 与并发

Graph State 使用版本号或事件序列号做乐观并发控制。并行节点只能写独立字段，或通过具有结合律、交换律的 Reducer 合并；两个节点同时覆盖同一摘要会产生丢失更新。Fan-out 之前记录任务集合，Fan-in 明确全成功、法定数量成功或允许部分结果的策略。

### 11.3 失败与终止

错误先分类为瞬时、可修正、业务拒绝、权限失败和永久失败，再决定退避重试、参数修复、重新规划、人工介入或终止。无进展检测可综合“状态哈希不变、重复动作、相同错误、信息增益过低”。终止结果应是结构化的 `success | partial | rejected | budget_exhausted | unsafe | failed`。

### 11.4 深入专题

更深入的描述可以查看：[Agent Loop 深入](./02-agent-loop) 与 [Agent Graph 深入](./03-agent-graph)。它们分别展开循环模式、预算、副作用、节点、Reducer、并发与子图设计。