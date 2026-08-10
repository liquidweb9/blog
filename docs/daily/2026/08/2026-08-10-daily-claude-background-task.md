---
title: 今日分享：Claude 如何管理后台任务，并在完成后唤醒 Agent
date: 2026-08-10
tags:
  - Agent
  - Claude
  - 工程实践
description: 拆解 Claude Code 的后台任务机制：TaskRegistry 如何登记任务、Notification 如何把事件路由回正确的会话，以及 Synthetic Follow-up Turn 为什么是“唤醒 Agent”的真正核心。
---

# 今日分享：Claude 如何管理后台任务，并在完成后唤醒 Agent

## 一句话结论

Claude Code 的后台任务机制不是某个神秘的 `TaskManager` 类，而是 **Agent Loop + Task Registry + 运行时进程 + Notification Router + Synthetic Follow-up Turn** 五个部分组成的闭环。任务用 `task_id` 登记、输出写入文件、完成时通过 Notification 路由回正确的会话，最后注入一个合成的新 turn 重新调用 Claude，让 Agent“自己醒来”继续工作。

## 问题与场景

如果你对 Agent 说“训练模型，训练完再评估”，它可能需要跑几个小时的训练。最笨的做法是让模型一直挂着等进程结束——占用 API 请求、浪费 token，几小时后还可能超时。

Claude Code 的答案是：**让进程在后台跑，Claude 先结束这一轮对话，等进程完成后再由运行时“唤醒”它。** 这也是后台任务最难的部分：不是“怎么把进程丢到后台”，而是

> 任务完成以后，如何重新进入正确的 conversation，让 Agent 接着干。

下面拆开看它到底是怎么做到的。

## 总体架构

可以把整个机制理解成 4 个相互配合的组件：

```text
┌────────────────────────────────────────────┐
│              Claude / Agent Loop           │
│   决定：执行 Bash、启动 Agent、继续工作      │
└───────────────────┬────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────┐
│          Background Task Registry          │
│ task_id → 类型 / 状态 / output_file / ...  │
└─────────────┬────────────────┬─────────────┘
              │                │
       local_bash         local_agent
              │                │
              ▼                ▼
        OS subprocess      Subagent runtime
              │                │
              └────────┬───────┘
                       │ complete / fail / stop
                       ▼
┌────────────────────────────────────────────┐
│         Notification / Event Router        │
│ task_started / progress / updated / notify │
└───────────────────┬────────────────────────┘
                    │
                    ▼
           synthetic follow-up turn
                    │
                    ▼
                 Claude
```

## 一次 Bash 后台执行的生命周期

### 1. 启动：立即返回 task_id，而不是阻塞等待

假设 Claude 决定执行 `python train.py`，但认为它会跑几个小时。实际调用等价于：

```text
Bash({
    command: "python train.py",
    run_in_background: true
})
```

`run_in_background=true` 是 Claude Code Bash tool 的正式参数，权限系统甚至可以专门为它配置规则。此时不会发生 `spawn → await wait → return`，而是：

```text
spawn()
registerTask()
return task_id
```

返回数据里正式存在 `backgroundTaskId` 字段（后台执行时它就是任务 ID），例如：

```json
{
  "stdout": "",
  "stderr": "",
  "interrupted": false,
  "backgroundTaskId": "b17f30"
}
```

Claude 马上知道“训练已启动，`task_id = b17f30`”，而不是卡 5 小时等训练结束。

### 2. 登记：Task Registry 保存什么状态

从官方公开的事件（`TaskStartedMessage`、`TaskProgressMessage`、`TaskNotificationMessage`）可以反推，一个后台任务的最小逻辑记录大致是：

```ts
interface BackgroundTask {
    taskId: string
    sessionId: string
    toolUseId?: string
    type: "local_bash" | "local_agent" | "remote_agent"
    description: string
    status: "pending" | "running" | "completed" | "failed" | "killed"
    outputFile: string
    usage?: { totalTokens: number; toolUses: number; durationMs: number }
    lastToolName?: string
    runtimeHandle?: unknown
}
```

（这是根据公开 wire protocol 还原出的合理结构，不是 Anthropic 源码里的真实 interface。）其中能被官方接口直接确认的字段有：`task_id / description / session_id / tool_use_id / task_type / status / output_file / usage / last_tool_name`。核心数据结构很可能就是一个 `Map<TaskID, TaskRecord>`。

另外，运行时一定持有某种能“监听进程、停止进程、判断结束”的 handle（Node.js 里可能是 `ChildProcess`，也可能抽象成 `TaskController`）。因为 Claude Code 确实支持 `TaskStop(task_id)`，SDK 也提供 `await client.stop_task(task_id)`，停止后会收到 `status="stopped"` 的 Notification。

### 3. 输出：写文件，而不是塞回上下文

训练产生 500MB 日志时，Claude Code 不会把它变成 conversation message 撑爆上下文，而是把 stdout/stderr 写入 output file：

```text
process
  │
  ├──── stdout/stderr
  │
  ▼
output file        ←  TaskManager 只保存这里的路径
```

官方明确说后台任务的输出写入文件，Claude 之后用 `Read` 工具读取；旧的 `TaskOutput` 已经被弃用，官方推荐直接读 `output_file`。

### 4. 完成：Notification 如何路由回正确的会话

`TaskStarted` 消息里有 `task_id / session_id / tool_use_id` 三个标识，不是只有 task_id。原因是一个机器上可能同时跑着多个会话和多个任务：

```text
Session A ── Task 101
Session B ── Task 201, Task 202
Session C ── Task 301
```

路由逻辑是：

```text
Task finished → task_id=201 → lookup TaskRecord → session_id=B → notification → Session B
```

- `task_id` 定位任务；
- `session_id` 定位 conversation；
- `tool_use_id` 定位是哪一次 Agent/Bash tool call 创建的它。

这是 Notification 能准确“唤醒原来的 Claude”的基础。

### 5. 等待：真正在等的不是 LLM，是 OS event loop

Claude 并不“睡眠等待”：

```text
User → Agent Runtime → Claude → Bash background → spawn train.py → return task_id → end_turn
```

此时 **Claude 模型 = 不运行，API request = 已结束**，活着的只有 Claude Code runtime、`train.py`、Task Registry 和事件监听器。概念代码大致是：

```ts
const child = spawn(command)
const task = taskManager.register({ id, type: "local_bash", status: "running", child, outputFile })

child.on("exit", (code, signal) => {
    taskManager.complete(task.id, { code, signal })
})
```

Node/libuv 可以廉价地监听一个进程几小时，期间既不需要 `while true: ask Claude()`，也不需要每 30 秒轮询。这正是它比“LLM 自己轮询进程”高级的地方。

### 6. 唤醒：Synthetic Follow-up Turn 才是核心

任务完成时，TaskManager 先把状态从 `running` 改为 `completed`（异常则为 `failed`，被 `TaskStop` 则对外通知 `stopped`），然后发出终态 Notification：

```python
TaskNotificationMessage(
    task_id=...,
    status="completed" | "failed" | "stopped",
    output_file=...,
    summary=...,
    session_id=...,
    tool_use_id=...,
    usage=...
)
```

**注意：这个 Notification 不是“桌面通知”，而是 Agent Runtime 内部事件，作用是给 conversation 注入新事件。** 它很小，只包含控制面信息：

```text
CONTROL PLANE: task_id / status / summary / output_file / usage
DATA PLANE:    完整 stdout / stderr / 训练日志    ← 存文件，按需 Read
```

关键一步来了：官方 Agent SDK 文档公开了——**后台任务完成时，SDK 可以注入一个 synthetic follow-up turn**，由此产生的 `SDKResultMessage` 的 origin 会标记为 `origin.kind = "task-notification"`。它直接回答了你最初的疑问“为什么进程结束之后 Claude 又自己醒了”：

```text
train.py exit → TaskManager → TaskNotification → Conversation Event Queue
     → Synthetic follow-up turn → 再次调用 Claude API → Claude 继续 reasoning
```

所以准确地说，**不是“恢复原来的 Claude API 请求”，而是“重新发起一次新的 Claude turn”**——只是 conversation history 还在。五小时后 Claude 看到新的 turn 里写着“Task b17f30 completed, output file 在 xxx”，于是它自然地 `Read(output_file)`、跑 `evaluate.py`、继续实验。从用户视角看就是“Claude 五小时之后自己醒了”。

## Claude 为什么知道下一步要做什么

TaskManager 不需要保存 `next_step = evaluate model`，因为这些上下文本来就在 conversation history 里：用户目标、Claude 之前的推理、Bash tool call 和 task_id 都保存着。任务完成通知进入 context 后，Claude 自己重新推理出“训练刚完成，下一步该看结果、跑 audit、比较指标”。所以 TaskManager 更多是 **Async Job Runtime + Event Router**，而不是 Workflow Engine——真正决定下一步执行什么的仍然是 Claude。

## TaskManager 与 Background Supervisor：两层架构

还有一个容易混淆的点：为什么有时关闭当前终端，后台任务还能继续跑？因为 Claude Code 现在又加了一层 **Background Session Supervisor**。

- **TaskManager** 管理的是“Session 内的 background Bash / Agent / Monitor / 远程 Agent”；
- **Supervisor** 管理的是“Claude Session / Worker Process”本身。

执行 `/background` 或 `claude --bg "run experiment"` 后，整个 Claude session 会转移给一个**每用户独立的 supervisor process** 托管，与 terminal、agent view 分离：

```text
Terminal ── /background ──► Per-user Claude Supervisor ──► Claude Worker
                                    ├── Agent Loop
                                    ├── Task Registry
                                    ├── train.py / test.py
                                    └── background agents
```

此时终端退出，Supervisor、Worker、`train.py` 仍然存在。而且可迁移的 in-flight 工作（background shell commands、background subagents、dynamic workflows、scheduled tasks）会一起交给新的 background session——是“adopt 收养”，不是杀掉重启，说明内部存在成熟的 Task ownership 概念。

## 一个可参考的实现

如果给自己实现的 Agent runtime 加后台任务，把最关键的闭环做出来即可：

```ts
async function onTaskExit(taskId: string, result: ExitResult) {
    const task = tasks.get(taskId)
    const status = result.stopped ? "stopped"
        : result.exitCode === 0 ? "completed" : "failed"

    task.state = status
    task.endedAt = Date.now()

    await notificationRouter.emit({
        type: "task_notification",
        task_id: task.id,
        session_id: task.owner.sessionId,
        tool_use_id: task.owner.toolUseId,
        status,
        output_file: task.output.file,
        summary: summarize(result)
    })
}

async function runSyntheticTaskTurn(notification) {
    const session = await sessionStore.load(notification.session_id)
    session.messages.push({
        role: "user",
        content: buildTaskNotification(notification),
        synthetic: true,
        origin: { kind: "task-notification" }
    })
    await agentLoop.run(session)
}
```

真正“唤醒 Claude”的就是最后一行 `agentLoop.run()`——它会再次调用模型。整个闭环是：

```text
child.onExit() → TaskNotification → session.enqueue() → scheduleSyntheticTurn() → agentLoop.run()
```

前三步是传统软件工程，最后一步 `scheduleSyntheticTurn → agentLoop.run` 才是 Agent runtime 和普通后台任务管理器最大的区别。

## 实践建议

1. **别让任务管理器直接调用模型。** 正确的数据流是 `TaskManager → emit event → SessionManager → schedule continuation → AgentRunner`。Bash、MCP、Subagent、Docker、SSH job、CI 任务以后都能共用同一套通知机制。
2. **输出写文件，通知只带控制面。** Notification 保持很小，完整日志进 `output_file`，Claude 需要时用 `Read` 按需读取，避免上下文爆炸。
3. **用 `session_id + tool_use_id` 做路由键。** 只有 `task_id` 无法回答“完成后通知哪个 Claude”，三键一起才能准确唤醒发起任务的会话。
4. **区分普通后台任务和 background session。** 普通 background task 不是 durable job，Claude Code 退出时会清理，`--resume` 也不会自动恢复后台 Bash；想让任务跨终端存活，要用 `/background` 或 `claude --bg` 交给 supervisor。
5. **让 Conversation History 承载“下一步计划”。** 不要给任务管理器硬编码 workflow，让 Claude 在对话里把计划讲清楚，任务完成通知进入 context 后它自然知道接着做什么。

## 延伸阅读

- [Agent SDK reference - Python - Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/python)
- [Manage multiple agents with agent view - Claude Code Docs](https://code.claude.com/docs/en/agent-view)
- [Interactive mode - Claude Code Docs](https://code.claude.com/docs/en/interactive-mode)
- [每日技术：Agent Harness——一个可复用的 Agent 运行框架](/daily/2026/07/2026-07-30-daily-agent-harness)
