---
aside: false
title: 简历
description: 邓厚锐的教育、实习、项目与学术经历
---

# 邓厚锐

> Backend Engineering · AI Applications

[herry.liquor@gmail.com](mailto:herry.liquor@gmail.com) · `(+86) 132 7265 2805` · 四川·南充

## 个人概述

电子科技大学应用密码学方向硕士研究生，拥有 AI Agent、LLM 应用、计算机视觉、后端服务与全栈开发经验。能够完成从问题建模、架构设计和原型开发到模型服务化、异步任务处理与容器部署的完整工程实现。

## 教育背景

### 电子科技大学

**信息与软件工程学院 · 硕士研究生** `2025.09—至今`

- 研究方向：应用密码学
- IEEE Transactions on Computational Social Systems（SCI 二区，学生第二作者）

### 四川师范大学

**计算机科学学院 · 网络工程** `2021.09—2025.06`

- GPA 4.0/4.0，专业排名第 2，推免至电子科技大学
- ICIC（CCF-C，第一作者）、Scientific Reports（SCI 二区，共同第一作者）
- 蓝桥杯全国总决赛 Python 大学 B 组一等奖、中国大学生程序设计竞赛全国总决赛铜奖、RoboCom CAIP 全国总决赛一等奖，以及多项 ICPC、CCPC 区域赛与邀请赛奖项

## 实习经历

### 联想｜海外电商事业部

**AI 后端开发实习生** `2026.05—至今`

#### 商业定价智能助手 Auto-PDP

- 基于 LangGraph、Azure OpenAI、FastAPI 与 Pydantic 参与建设商业定价 Agent，支持价格模拟、价格根因分析和合同信息查询。
- 设计 Planner、Evaluator、Executor 分层架构，实现意图识别、任务拆解、参数校验、Skill 调度、失败重试与结果汇总。
- 设计基于 `BaseSkill`、目录扫描和 `manifest.yaml` 的插件化 Skill 机制，并通过任务历史支持跨 Skill 数据传递。
- 使用 WorkflowState 与 LangGraph Checkpoint 管理多轮对话状态，实现 Human-in-the-Loop 暂停、补充和恢复执行。
- 构建“LLM 分类、规则映射、LLM 兜底、关键词匹配”多层降级机制，提高异常场景下的系统可用性。

#### FIFA Creative Studio AI 足球赛事视频处理系统

- 参与构建回放检测、足球检测与追踪、智能裁切、语音识别、视频拆条与合成链路，将 16:9 赛事视频转换为 9:16 和 1:1 集锦。
- 使用 TransNetV2、CLIP、RT-DETR v3、U-Net 与单应性变换完成镜头、回放、足球和球场分析。
- 设计带死区的 EMA 平滑、最大移动步长约束与贝塞尔插值，降低智能裁切中的画面抖动和中心突变。
- 使用 faster-whisper、FFmpeg、线程池与任务队列实现语音识别、多比例编码、批量处理、失败重试和状态查询。
- 参与 Docker、Kubernetes、NFS 与 GPU 环境部署，并补充资源监控接口。

## 项目经历

### 强化学习增强大语言模型空间推理能力

**主要负责人** `2024.02—2024.06`

- 将空间关系转换为社交关系网络的统一表示，结合 Q-learning 与逆向课程学习构造难度递增的训练样本。
- 负责问题建模、算法设计、实验实现、对比分析及论文撰写；任务成功率由 23% 提升至 40%。
- 相关成果发表于 ICIC 与 Scientific Reports。

### 基于属性基加密的安全文件共享系统

**全栈开发者** `2024.12—2025.04`

- 基于 Spring Boot 3、MyBatis-Plus、MySQL 与 Redis 设计模块化服务端。
- 实现分片并发上传、断点续传、失败重试、合并校验、Hash 秒传与内容去重，并以分布式锁保障并发一致性。
- 通过独立 Java ABE 组件实现属性策略校验与文件加解密，支持多种分享模式和用户数据隔离。
- 使用 Vue 3、Element Plus 与 Electron 完成 Web 和桌面端业务流程。

### FindJob：AI 求职助手

**全栈开发者** `2026.06—2026.07`

- 构建覆盖简历解析、用户画像、岗位检索、智能推荐和网申填写的 AI 求职助手。
- 使用 FastAPI、SQLAlchemy、MySQL、Redis 完成认证、画像、岗位、限流与缓存能力。
- 设计“条件过滤、Milvus 向量召回、BGE Reranker 重排”的混合检索链路。
- 基于 LLM 与 Playwright 构建 Observe–Plan–Execute 智能填表 Agent，并设置页面识别、动作校验和禁止自动提交等安全机制。
- 使用 React 19、Vite、Zustand、pywebview 与 Docker Compose 完成 Web、桌面端和基础设施交付。

## 技术关键词

`Python` · `Java` · `FastAPI` · `Spring Boot` · `LangGraph` · `Azure OpenAI` · `Pydantic` · `MySQL` · `Redis` · `Milvus` · `React` · `Vue 3` · `Playwright` · `Docker` · `Kubernetes` · `PaddleDetection` · `FFmpeg`
