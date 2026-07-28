# FindJob：AI 求职助手

**角色：全栈开发者** · `2026.06—2026.07`

## 项目简介

面向岗位信息分散、关键词搜索匹配不准和网申信息重复填写等问题，设计并实现覆盖简历解析、用户画像、岗位检索、智能推荐与网申填写的 AI 求职助手。

## 推荐系统

设计“关键词与城市过滤、Milvus 向量召回、BGE Reranker 重排序”的混合检索链路，根据用户技能、项目经历与求职意向进行岗位召回和语义匹配。

## 智能填表 Agent

基于 LLM 构建 Observe–Plan–Execute Agent，使用 Playwright 提取页面字段、生成结构化计划并执行填写，支持常规控件及教育、工作经历等动态重复区块。

通过页面类型识别、字段对齐、动作校验和禁止自动提交降低误操作风险；大模型 API Key 仅保存在本地。

## 技术架构

- 后端：FastAPI、SQLAlchemy、MySQL、Redis、JWT
- 前端：React 19、Vite、Zustand
- 桌面端：pywebview、本地 HTTP 服务、Playwright
- 基础设施：Docker Compose、Milvus、MinIO、ETCD
