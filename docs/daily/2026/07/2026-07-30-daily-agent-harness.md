---
title: 用 Code、Schema、Manifest、Validator 给 AI Agent 套上缰绳
date: 2026-07-30
tags:
  - Agent
  - 工程实践
description: Agent Harness 通过代码、Schema、Manifest 和验证器，把不确定的模型行为变成可控制的软件行为。
---

# 用 Code、Schema、Manifest、Validator 给 AI Agent 套上缰绳

## 一句话结论

在 Agent 工程中，Code、Schema、Manifest、Validator 四者共同把"不确定的模型行为"变成"可控制的软件行为"。模型负责提出方案，Harness 决定什么可以真正发生。

## 问题与场景

企业级 AI Agent 面临的核心矛盾是：语言模型本质上是概率性的，而软件系统要求确定性。关键行为不能只依赖 Prompt 中的自然语言描述——模型可能忽略、误解或被其他上下文干扰。

Prompt 正在变成"可执行合同"。企业 Agent 开始把关键行为从自然语言 Prompt 移入代码、Schema、Manifest 和验证器。一项研究在更换三个模型的 270 次运行中，Harness 所有强制合同均得到保持；单靠 Prompt 则无法稳定阻止违规输出和内部轨迹泄漏。

## 一个具体例子：退款 Agent

以下以一个退款 Agent 为例，展示四个组件如何协作。

### 1. 代码（Code）

代码负责那些不能交给模型自由发挥的行为，例如权限判断、价格计算、数据库读写、超时重试、状态流转、调用哪个模型、何时需要人工审批。

```python
if refund_amount > 1000:
    require_human_approval()

if customer_order.status != "delivered":
    reject_refund("订单尚未完成")
```

不要只在 Prompt 中写"超过 1000 元必须人工审批"。写成代码后，这条规则才能被强制执行。

### 2. Schema

Schema 定义输入、输出或工具参数的结构、类型和限制。

```json
{
  "type": "object",
  "properties": {
    "decision": {
      "type": "string",
      "enum": ["approve", "reject", "manual_review"]
    },
    "amount": { "type": "number", "minimum": 0 },
    "reason": { "type": "string", "minLength": 1 }
  },
  "required": ["decision", "amount", "reason"],
  "additionalProperties": false
}
```

Schema 可以阻止：decision 输出成随意文本、金额为负数、缺少理由、模型偷偷添加未经定义的字段。

Schema 保证的是结构正确，不一定保证业务事实正确。例如 `amount: 500` 格式完全合法，但真实可退款金额可能只有 300 元。

### 3. Manifest

Manifest 是一份声明式配置（JSON 或 YAML），描述 Agent 的身份、能力、资源和限制。

```yaml
name: refund-agent
version: 1.2.0
model: reasoning-model
tools:
  - get_order
  - calculate_refund
  - create_refund_request
permissions:
  database: read_only
  payment_write: approval_required
limits:
  max_steps: 12
  timeout_seconds: 60
  max_cost_usd: 0.20
output_schema: refund_decision.schema.json
```

Manifest 的价值是让以下信息可查看、可版本管理、可审计：

- Agent 可以使用哪些工具
- 能访问哪些数据
- 是否可以产生写操作
- 使用哪个模型
- 最大步骤数、时间和成本
- 输出必须遵循哪个 Schema

Manifest 没有唯一的行业标准格式，关键在于把配置从 Prompt 和业务代码中分离出来。

### 4. 验证器（Validator）

验证器检查模型给出的结果是否真的可以使用，一般分为三层：

```python
def validate_refund(result, order):
    # 结构验证
    validate_against_schema(result)

    # 业务验证
    if result["amount"] > order.refundable_amount:
        raise ValidationError("退款金额超过可退款余额")

    # 安全验证
    if result["decision"] == "approve" and result["amount"] > 1000:
        raise HumanApprovalRequired()

    return result
```

| 验证层 | 检查内容 |
|---|---|
| 结构验证 | 字段、类型、枚举值是否正确 |
| 业务验证 | 金额、库存、订单状态等是否与真实数据一致 |
| 安全验证 | 是否越权、泄露敏感信息或触发高风险操作 |

验证失败后，系统可以拒绝执行、把错误反馈给 Agent 重试、换模型处理，或者升级给人工。

### 四者配合流程

```
Manifest → 定义 Agent 能做什么、有哪些限制
     ↓
代码 → 控制任务流程并调用模型和工具
     ↓
Schema → 约束模型返回的数据结构
     ↓
验证器 → 检查结构、业务事实和安全规则
     ↓
通过后才执行真实操作
```

以退款为例：

1. **Manifest**：Agent 可读取订单，但付款写操作需要审批
2. **代码**：获取订单、调用模型、计算退款并控制状态流转
3. **Schema**：要求模型返回决定、金额和理由
4. **验证器**：确认金额没有超过余额，高额退款转人工
5. 验证通过后才真正提交退款

## 实践建议

1. **优先用代码，其次用 Schema，再次用 Prompt**。代码提供最强保障，Prompt 只作为补充说明。
2. **Manifest 独立管理**。不要将配置硬编码在代码或 Prompt 中，使用独立的 YAML/JSON 文件。
3. **验证器分层设计**。结构验证用 Schema 自动检查，业务验证需要访问真实数据源，安全验证需要结合业务规则。
4. **为每个 Agent 编写 Manifest**。即使初期很简单，后续可以逐步完善。Manifest 让 Agent 的配置可审查、可版本管理。

## 延伸阅读

- [Anthropic - Building effective agents](https://docs.anthropic.com/en/docs/build-with-claude/agents)
- [OpenAI - Prompt engineering best practices](https://platform.openai.com/docs/guides/prompt-engineering)
- [Guardrails 框架](https://docs.guardrailsai.com/)
