---
title: Hooks 机制：从 Git 到 Agent 的自动触发
date: 2026-07-30
tags:
  - Git
  - CI/CD
  - 工程实践
description: Hooks 是在特定事件发生时自动触发的脚本，本文对比 Git Hooks 和 Agent Hooks 的使用场景和最佳实践。
---

# Hooks 机制：从 Git 到 Agent 的自动触发

## 一句话结论

Hooks 是"事件驱动的自动化脚本"——在 Git commit 前自动检查代码质量，在 Agent 执行工具前拦截危险操作，用代码替代人工记忆，让规范在关键时刻自动执行。

## 问题与场景

开发流程中有很多"必须做但容易忘"的事情：提交前忘记格式化代码、部署前忘记运行测试、Agent 调用工具前没有检查权限。Hooks 机制解决了这个问题——在特定事件发生时自动触发预设脚本，把"应该做"变成"自动做"。

## 一个具体例子

### Git Hooks：家门口的保安

Git 执行 `commit`、`push` 等特定命令时会触发对应的脚本钩子。最常用的场景是 pre-commit：

在 `git commit` 之前自动运行代码格式化（Prettier）和代码检查（ESLint）。如果检查不通过，提交被拒绝，强行保证代码质量。

```bash
# .husky/pre-commit
npx lint-staged
```

常用工具 [husky](https://typicode.github.io/husky/) 专门用来管理 Git Hooks，避免手动复制脚本到 `.git/hooks` 目录。

### 和 CI/CD 有什么区别

| 特性 | Git Hooks | CI/CD |
|---|---|---|
| 触发时机 | git commit / push 本地操作时 | push 到远程仓库后 |
| 检查范围 | 本地快速检查 | 全量深度检查 |
| 执行速度 | 秒级 | 分钟级 |
| 典型任务 | 格式化、lint、简单测试 | 集成测试、构建、部署 |

Git Hooks 是"家门口的保安"：出门前拦住低级错误。CI/CD 是"中央质检总局+全国物流"：发货后进行全量深度检查并自动分发。

### Agent Hooks：AI 的生命周期回调

Agent Hooks 会在 AI Agent 生命周期的特定事件上触发。以 Claude Code 为例：

- 会话开始时注入环境信息
- 工具执行前检查或拦截
- 文件修改后自动格式化
- 工具失败后记录诊断信息
- 等待确认时发桌面通知
- 上下文压缩前保存关键状态

```bash
# .claude/hooks/pre_tool
#!/bin/bash
# 在执行任何工具前检查是否允许
if [[ "$CLAUDE_TOOL_NAME" == "Write" ]] && [[ "$CLAUDE_TOOL_INPUT" == *"secret"* ]]; then
  echo "ERROR: 禁止写入包含敏感信息的文件"
  exit 1
fi
```

## 实践建议

### Git Hooks
- 使用 husky 管理，提交到仓库后自动安装给团队所有人
- Hook 脚本应快速执行（秒级），不要阻塞正常提交
- 不适合做全量测试或构建——那是 CI/CD 的事

### Agent Hooks
- Hook 自动执行，需比普通 Prompt 更谨慎
- 匹配范围尽量窄，不要什么事件都用 `.*`
- 默认快速执行，重任务不要卡住每次编辑
- 脚本要有明确退出码和错误信息
- **不要在 Hook 里做发布、删除、推送等高风险动作**
- 先手动运行脚本验证，再接入 Hook
- 需要复杂判断时，用 Skill 或独立审查 Agent，不要堆 shell

适合 Hook 的是"发生到这里就必须做"的动作。不适合的是需要阅读大量上下文、权衡多个方案的开放问题。

## 延伸阅读

- [Husky 官方文档](https://typicode.github.io/husky/)
- [Git Hooks 文档](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- [Claude Code Hooks 文档](https://docs.anthropic.com/en/docs/claude-code/overview)
