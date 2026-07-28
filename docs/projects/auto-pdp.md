# 商业定价智能助手 Auto-PDP

## 项目背景

面向产品价格、合同信息与促销规则分散在多个业务系统、人工查询链路复杂的问题，参与建设基于 LangGraph 与 Azure OpenAI 的商业定价智能助手，支持价格模拟、价格根因分析与合同信息查询。

## Agent 架构

- 使用 FastAPI、LangGraph 和 Pydantic 设计 Planner、Evaluator、Executor 分层架构
- 覆盖意图识别、任务拆解、参数校验、Skill 调度、失败重试与结果汇总
- 使用 WorkflowState 与 LangGraph Checkpoint 管理上下文和多轮会话状态
- 在参数缺失时支持 Human-in-the-Loop 暂停、补充与恢复执行

## 插件化 Skill

设计基于 `BaseSkill`、目录扫描和 `manifest.yaml` 的插件化机制，统一价格模拟、价格分析和合同查询能力的注册、配置与执行，并通过任务历史支持跨 Skill 数据传递。

## 可靠性设计

构建“LLM 分类、规则映射、LLM 兜底、关键词匹配”多层降级机制，提高低置信度和意图识别失败场景下的可用性，并降低新业务能力的接入与维护成本。
