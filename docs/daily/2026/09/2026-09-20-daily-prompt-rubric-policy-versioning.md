---
title: Prompt / Rubric / Policy 版本化：让 Agent 行为可追溯、可评估、可回滚
date: 2026-09-20
tags:
  - Agent
  - 工程实践
  - 工程治理
description: 将 Prompt、评价标准 Rubric 与行为规则 Policy 作为独立版本化工件，通过发布清单、固定评估基线和运行追踪管理 Agent 行为变更。
---

# Prompt / Rubric / Policy 版本化：让 Agent 行为可追溯、可评估、可回滚

## 一句话结论

**Prompt 决定怎么做，Rubric 定义什么算做好，Policy 约束哪些行为被允许；三者都应该独立版本化，并通过一个不可变的发布清单绑定。** 这样才能回答：某次 Agent 运行用了什么规则，效果变化来自哪里，以及如何回到上一组已验证的配置。

## 1. 为什么只记录代码版本不够？

假设一个客服 Agent 的代码没有变化，但团队做了三件事：

- 将 Prompt 从“简洁回答”改成“解释原因并给出处理建议”；
- 将评分规则从“回答完整”改成“必须引用退款政策”；
- 将工具策略从“可查询订单”改成“可查询订单并创建客服工单”。

最终答案更长、评估得分变化、工具调用增多。如果日志只记录应用 Commit，就很难说明这是能力变强、评分尺度改变，还是行为边界扩大。

因此，Agent 的实际行为配置至少可以表示为：

```text
应用代码 + 模型与参数 + Prompt + Policy + 工具契约 + 检索配置
```

而评估结论还依赖另一组配置：

```text
被评估的运行结果 + 数据集 + Rubric + Judge 模型 / 代码
```

**运行配置和评价配置都需要快照。** 只给 Prompt 文件加一个版本号，仍然无法完整解释一次结果。

## 2. 三类工件的职责边界

| 工件 | 回答的问题 | 示例 | 主要使用方 |
| --- | --- | --- | --- |
| Prompt | 这项任务应该怎么完成？ | 角色、步骤、证据使用方式、输出结构 | 生成模型、Agent 编排层 |
| Rubric | 怎么判断完成得好不好？ | 事实性、证据支持、完整性、评分锚点 | 人工评审、Eval、LLM Judge |
| Policy | 哪些行为允许，哪些必须受限？ | 工具白名单、租户隔离、操作条件 | 运行时、工具网关、权限系统 |

Rubric 通常用于离线评估，也可以进入在线自检，但不应默认把所有评估规则都塞入生成 Prompt。Policy 可以有供模型理解的自然语言说明，涉及实际权限的部分则必须由运行时执行。

例如，Prompt 可以写“只查询当前用户的订单”，但订单 API 仍要根据服务端认证身份检查资源归属。**版本化让规则可追溯，不会把自然语言自动变成权限边界。**

## 3. 从一组可读文件开始

小型项目不一定需要专门的 Prompt 平台，可以先用 Git 管理：

```text
agent-config/
├── prompts/
│   └── support-answer.md
├── rubrics/
│   └── support-answer.yaml
├── policies/
│   └── support-tools.yaml
├── releases/
│   └── support-2026-09-20.1.yaml
└── evals/
    └── refund-cases.jsonl
```

下面是简化的工件示例，不对应某个框架的内置格式，需要由应用和评估器解析。

### Prompt：任务方法与输出契约

```markdown
根据提供的退款证据回答用户问题。

要求：
- 区分审核状态、支付渠道和到账时效。
- 结论引用 evidence 中的 source_id。
- 缺少关键条件时先澄清，不推断实际订单状态。
- 输出 JSON，字段为 answer、citations、needs_clarification。
```

版本化时不只保存这段文本，还要保存变量定义、渲染模板、系统消息组合方式和输出 Schema。否则同一个模板版本，也可能因为拼接逻辑不同而得到完全不同的输入。

### Rubric：把“好答案”变成可操作标准

```yaml
id: support-answer
version: 2.0.0
dimensions:
  factuality:
    weight: 0.6
    anchors:
      0: 编造订单状态，或与证据矛盾
      1: 主要结论正确，但遗漏适用条件
      2: 结论准确，覆盖渠道、状态与时效条件
  evidence:
    weight: 0.4
    anchors:
      0: 没有引用，或引用不支持结论
      1: 部分结论有支持证据
      2: 所有关键结论均有有效引用
hard_fail:
  - 泄露其他用户的订单信息
  - 声称已执行实际未发生的退款操作
```

评分器可以先将各维度的 0～2 分归一化，再加权；触发 `hard_fail` 时，无论均分多少都判定失败。归一化公式、通过阈值、Judge 指令和结构化输出解析逻辑也属于评估版本的一部分。

对于“是否调用越权工具”等问题，应优先检查工具 Trace 和权限结果；不能只凭最终答案，让 Judge 猜测实际执行过什么。

### Policy：声明规则，并由运行时执行

```yaml
id: support-tools
version: 1.3.0
default_effect: deny
tools:
  order.read:
    effect: allow
    require:
      - authenticated
      - same_tenant
      - owns_order
  refund.execute:
    effect: deny
```

这些条件需要映射到服务端可信检查：身份来自认证上下文，租户与订单归属来自授权和业务数据，不能直接相信模型传入的 `user_id`。规则解析失败、遇到未知条件时，运行时应拒绝相应操作，并输出可追踪的错误。

## 4. 用发布清单绑定一组确定的版本

三个工件可以分别演进，但一次发布必须选定一组兼容组合：

```yaml
release_id: support-2026-09-20.1
application:
  git_commit: "<完整应用 Commit SHA>"
artifacts:
  repository_commit: "<工件仓库完整 Commit SHA>"
  prompt:
    path: prompts/support-answer.md
    version: 1.4.0
    sha256: "<Prompt 文件实际内容摘要>"
  rubric:
    path: rubrics/support-answer.yaml
    version: 2.0.0
    sha256: "<Rubric 文件实际内容摘要>"
  policy:
    path: policies/support-tools.yaml
    version: 1.3.0
    sha256: "<Policy 文件实际内容摘要>"
runtime:
  model_snapshot: "<供应商返回或支持的具体模型版本>"
  temperature: 0
  output_schema_version: 2
  tool_schema_version: 3
  retrieval_config_version: 4
evaluation:
  dataset_snapshot: "refund-cases-v3"
  judge_snapshot: "<评估模型具体版本>"
  evaluator_commit: "<评分器完整 Commit SHA>"
```

尖括号中的值是占位符，发布时由流水线填入实际值并校验。版本号便于人理解兼容性，Commit 和内容 Hash 用于精确定位及校验工件。只有 Hash 而没有归档内容，也无法恢复旧版本。

可以约定：输出 Schema 或调用契约不兼容时升主版本，兼容的新能力升次版本，措辞修正升补丁版本。但 Prompt 即使只改一句话也可能引发回归，**语义版本号不能替代 Eval**。

`production`、`candidate` 等名称应只是指向不可变 Release 的可变别名。请求开始时解析并固定 `release_id`，后续步骤沿用同一份快照，避免长任务前半段用旧 Prompt、后半段突然用新 Policy。

紧急撤权等强制限制则应由独立的实时授权层立即执行，并记录当时生效的策略版本；不能为了运行重现而继续允许已经撤销的权限。

## 5. 版本变化后，怎样做可信的评估？

最容易产生误判的情况，是同时修改 Prompt 和 Rubric，然后直接比较两次报告中的总分。一个 85 分来自旧标准，另一个 90 分来自新标准，不能据此认定能力提升。

### Prompt 变化：先固定尺子

固定数据集、Rubric、Judge、模型和其他运行配置，对比旧 Prompt 与新 Prompt。检查任务成功率、硬失败、Token 和延迟，并针对真实失败案例保留回归样本。

模型存在随机性时，可以多次运行观察分布；设置 `temperature=0` 也不能保证跨设备、后端或模型更新后的逐字一致。

### Rubric 变化：重新建立可比基线

保留同一批输入、证据、工具 Trace 和模型输出，用新旧 Rubric 分别评分：

| 被评估输出 | 旧 Rubric | 新 Rubric |
| --- | --- | --- |
| 旧 Prompt 的输出 | 原有基线 | 新标准下的基线 |
| 新 Prompt 的输出 | 旧标准下的候选效果 | 新标准下的候选效果 |

比较同一列，才能在一致标准下讨论输出质量变化；比较同一行，可以分析标准变化如何影响评分。新的标准需要人工抽查和评分锚点校准，历史总分也应标注 Rubric 版本。

### Policy 变化：检查允许与拒绝是否都正确

不仅验证“被禁止的操作不能执行”，还要验证“合法操作仍能完成”。例如跨租户读取必须拒绝，本人订单查询应允许，未知工具应拒绝。测试应覆盖运行时的实际决策，而不是只检查模型是否复述规则。

## 6. 从发布到运行追踪形成闭环

```text
修改工件并记录原因
  → 校验模板变量、Schema、引用与内容 Hash
  → 固定基线运行 Eval 和策略测试
  → 生成不可变 Release 与报告
  → 小流量验证质量、成本和延迟
  → 切换 production 别名
  → 按 Release 观测，必要时回滚
```

每次运行至少记录：

- `trace_id`、`run_id`、`release_id`、应用 Commit；
- Prompt 和 Policy 的版本与 Hash、实际模型标识及推理参数；
- 输入或渲染后 Prompt 的受控快照引用、检索证据 ID 与版本；
- 工具参数与执行结果的受控引用、权限决策、耗时和 Token。

评估记录另外关联 `rubric_version`、数据集快照、Judge 配置和评分器版本。含用户数据的正文按需要脱敏并受控保存，普通日志只保留必要的关联信息；只保存输入 Hash 能校验一致性，却不能代替重放需要的输入内容。

回滚是将后续运行切换回上一份兼容 Release，并验证运行时是否加载成功。它不会撤销已经发送的消息、已创建的工单或其他外部副作用，这些需要业务幂等与补偿机制处理。若旧 Policy 已不满足当前权限要求，也不能随着 Prompt 回滚一并恢复。

即使记录了完整版本，外部工具状态和托管模型后端仍可能变化。因此版本化首先保证的是**可追溯、可诊断和尽可能可复现**，而不是承诺每次重放生成完全相同的文本。

## 实践建议

1. 从 Git 中的三个工件和一个发布清单开始，明确每份规则的维护位置。
2. 发布时冻结具体内容，请求执行时固定 Release，并把版本写进 Trace。
3. 修改 Prompt 时固定评价标准；修改 Rubric 时重评基线；修改 Policy 时验证实际权限边界。
4. 将真实失败转成回归样本，再按质量、成本和延迟决定是否推广新版本。

Prompt / Rubric / Policy 版本化的价值，是把“改几句文本试试看”变成一项有输入、有标准、有运行证据、也有恢复路径的工程变更。

## 延伸阅读

- [每日技术：AI-Native SDLC：当写代码不再是研发的瓶颈](/daily/2026/09/2026-09-15-daily-ai-native-sdlc-playbook)
- [Agent 工程：Prompt 与结构化输出](/notes/agent-engineering/02-prompt-engineering)
- [Agent 工程：Evaluation、Testing 与 Observability](/notes/agent-engineering/10-agent-evaluation)
- [后端工程：幂等性与可靠副作用控制](/notes/backend/15-idempotency)
