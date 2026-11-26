---
title: 为什么 Agent 恢复后会重复创建工单？
date: 2026-11-24
tags:
  - Agent
  - LangGraph
  - 工程实践
description: 用 LangGraph 和 SQLite 模拟工单已写入但节点未完成的故障，理解 Checkpointer、业务幂等键和 Transactional Outbox 的职责。
---

# 为什么 Agent 恢复后会重复创建工单？

## 一句话结论

**Checkpointer 决定工作流从哪里继续，幂等键决定同一项业务操作是否已经生效。** 如果工单已经写入数据库，节点却没来得及返回结果，LangGraph 恢复时可以重新执行这个节点；用同一个业务操作键写入并返回已有工单，才能避免重复创建。

## 1. 问题场景：数据库提交了，节点还没完成

沿用 [LangChain 和 LangGraph 的客服示例](./2026-11-19-daily-langchain-vs-langgraph)：客服草稿通过审核后，工作流调用 `create_ticket` 创建工单。假设审核结果已经保存，接下来发生了这些事：

| 时刻 | 工作流看到什么 | 工单库发生了什么 |
| --- | --- | --- |
| 审核通过 | 下一步是 `create_ticket` | 还没有工单 |
| 创建请求执行 | 节点尚未返回 | 工单 `#1` 已提交 |
| 节点报错，或服务在此时退出 | 没收到 `ticket_id`，这个节点还没完成 | 工单 `#1` 仍然存在 |
| 恢复同一工作流 | 再次进入 `create_ticket` | 如果直接插入，就会生成工单 `#2` |

这和 [之前的人工审批示例](../08/2026-08-31-daily-langgraph-interrupt-resume) 相关，但触发方式不同：`interrupt()` 等待外部审批数据时，用 `Command(resume=...)` 继续；这里是节点抛异常后重试，用同一个 `thread_id` 传入 `None` 继续。两种情况下，**把有副作用的代码挪到独立节点，可以缩小重放范围，但这个节点本身还是可能被重放**。

## 2. 一个可运行的故障注入实验

安装 `langgraph` 后即可运行，不需要大模型或 API Key。实验从审核完成之后开始，用 `InMemorySaver` 保留两次调用之间的工作流状态，用 SQLite 模拟工单系统。首次执行在数据库提交后主动抛错，再恢复同一个工作流。

```python
import sqlite3
from contextlib import closing
from typing import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    request_id: str
    ticket_id: int


class CommitThenFail(RuntimeError):
    pass


def demo(use_idempotency: bool) -> None:
    with closing(sqlite3.connect(":memory:")) as db:
        db.execute("""CREATE TABLE tickets (
            id INTEGER PRIMARY KEY,
            operation_key TEXT UNIQUE,
            request_id TEXT NOT NULL
        )""")
        fail_once = True

        def create_ticket(state: State) -> dict:
            nonlocal fail_once
            request_id = state["request_id"]
            with db:
                if use_idempotency:
                    key = f"create-ticket:{request_id}"
                    db.execute(
                        "INSERT INTO tickets(operation_key, request_id) VALUES (?, ?) "
                        "ON CONFLICT(operation_key) DO NOTHING",
                        (key, request_id),
                    )
                    ticket_id = db.execute(
                        "SELECT id FROM tickets WHERE operation_key = ?", (key,)
                    ).fetchone()[0]
                else:
                    ticket_id = db.execute(
                        "INSERT INTO tickets(request_id) VALUES (?)", (request_id,)
                    ).lastrowid
            # 数据库事务已提交；故障发生在节点返回之前。
            if fail_once:
                fail_once = False
                raise CommitThenFail(f"工单 #{ticket_id} 已提交")
            return {"ticket_id": ticket_id}

        builder = StateGraph(State)
        builder.add_node("create_ticket", create_ticket)
        builder.add_edge(START, "create_ticket")
        builder.add_edge("create_ticket", END)
        graph = builder.compile(checkpointer=InMemorySaver())
        config = {"configurable": {"thread_id": "approved-42"}}

        try:
            graph.invoke({"request_id": "return-42"}, config)
        except CommitThenFail as exc:
            print(f"首次执行：{exc}")

        result = graph.invoke(None, config)
        count = db.execute("SELECT COUNT(*) FROM tickets").fetchone()[0]
        print(f"幂等={use_idempotency}：恢复得到 #{result['ticket_id']}，库中 {count} 张")


demo(False)
demo(True)
```

```text
首次执行：工单 #1 已提交
幂等=False：恢复得到 #2，库中 2 张
首次执行：工单 #1 已提交
幂等=True：恢复得到 #1，库中 1 张
```

这里真正防住重复的是 `UNIQUE(operation_key)`。如果改成「先查询是否存在，再直接插入」，两个并发请求可能同时查到不存在。冲突时还要**返回第一次创建的工单 ID**，这样恢复后的工作流才能拿到和第一次成功执行相同的业务结果。

## 3. 实践建议：把幂等放在写入的一侧

1. **用业务意图生成稳定的键。** `thread_id` 标识工作流，一条工作流却可能合法地创建多张工单。示例假定每个退货请求只创建一张工单；如果有多个合法操作，应使用各自的操作 ID。重试沿用原键，不在节点里重新生成。同一键携带不同业务参数时，应拒绝或明确处理冲突。
2. **数据库写入靠唯一约束，远程调用靠接收方协议。** 自有业务库可以把去重和写入放进同一事务；调用第三方接口时，要确认对方是否支持幂等键、有效期多长、重试能否返回原结果。仅在 Agent 这边记「已调用」，无法判断一次超时请求是否已经在对方生效。
3. **创建工单后还要发通知时，再引入 Outbox。** 在同一个数据库事务里写入工单与待发送事件，就不会出现工单提交了但通知事件没有落库。后台发送仍可能重试，消费者还需要按事件 ID 去重。
4. **把跨进程恢复单独测一遍。** 示例只在同一进程内验证节点重放。生产环境应使用持久化 Checkpointer 和业务存储，再做一次「数据库提交后强制退出、重启后恢复」的测试。

## 延伸阅读

- [LangGraph 的 interrupt 与 resume](../08/2026-08-31-daily-langgraph-interrupt-resume)：审批状态与工作流恢复。
- [Transactional Outbox](../08/2026-08-06-daily-transactional-outbox)：业务写入和事件发布如何衔接。
- [LangGraph：Durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution)：恢复点、重放与副作用的运行语义。
