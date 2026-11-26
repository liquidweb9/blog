---
title: 为什么 Agent 恢复后会重复创建工单？
date: 2026-11-24
tags:
  - Agent
  - LangGraph
  - 工程实践
description: 用 LangGraph 和 SQLite 复现提交后故障、并发重试与事务回滚，拆解工作流恢复、业务幂等和 Outbox 的一致性边界。
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

判断重试后果的关键是**最后一个实际完成的提交**，而不是调用方收到了什么：

| 故障点 | 工单库 | Checkpoint | 恢复动作 |
| --- | --- | --- | --- |
| 工单事务提交前 | 没有工单；未完成事务回滚 | 节点未完成 | 执行原操作，首次创建 |
| 工单提交后、节点完成状态持久化前 | 已有工单 | 节点可能重放 | 用原操作键取回已有工单 |
| 节点完成状态持久化后、响应丢失 | 已有工单 | 记录了 `ticket_id` | 读取已有状态或业务结果，不重新发起操作 |

把顺序反过来也不行：如果先把工作流标记为「工单已建」，再写业务库，进程就可能在两者之间退出，留下一条宣称成功、实际没有工单的记录。即便两个存储都用 PostgreSQL，只要各自提交各自的事务，也还是两个提交点。事件发生后，单靠 Checkpoint 无法区分「没写过」和「写成功但结果丢了」；业务写入方必须能按同一个标识回答这个问题。

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

`InMemorySaver` 在这里的作用，是让我们不引入额外基础设施就能观察一次实际的节点重放。示例里的 `fail_once` 只用于注入故障，不是生产状态。**节点可以运行两次，但同一操作只能产生一份工单**，这才是该实验检验的语义。

## 3. 一个可重试的业务接口应该承诺什么？

把工单服务的契约写出来，比加一个 `if exists` 更有用：

| 请求 | 结果 |
| --- | --- |
| 新操作键、新建工单 | 返回新工单 ID |
| 原操作键、相同业务内容 | 返回原工单 ID |
| 原操作键、不同业务内容 | 返回冲突，不覆盖原工单 |
| 新操作键、业务内容恰好相同 | 按业务规则判断；如果确实是新的审批意图，可以建另一张工单 |

在客服场景里，可以在**审批记录落库时**分配 `intent_id`，由工作流携带到写入节点。`thread_id` 标识一次工作流会话，`intent_id` 标识一次批准的业务动作，两者不是同一个东西：重建后的工作流可能换了 `thread_id`，但不能因此重复创建已批准的工单；一条工作流也可能分别创建退货和补寄工单，不能拿同一个 `thread_id` 把它们去重掉。

键的作用域至少区分租户和操作类型；本例进一步把操作类型固定为创建工单。要比较的是**执行语义**，例如订单、事项和审批版本，不是 JSON 的键顺序，也不是每次都会变化的请求时间戳。工单内容若允许后续编辑，应另存不可变的原始请求摘要和结果，不能拿变更后的工单内容判断重试是否冲突。去重记录也必须覆盖可能的重试与补偿周期，否则同一操作在记录清理后会变成「从未执行」。

## 4. 进阶实验：两个 Worker 并发，以及工单写了一半就失败

这个实验独立于 LangGraph，只依赖 Python 标准库，检查业务接口自身的保证。两个 Worker 各用一条连接提交同一操作；随后重放不同内容，最后在写入新工单后、写入 Outbox 前注入故障。SQLite 会序列化写事务；换成其他数据库时仍需要唯一约束，并按该数据库的隔离级别处理事务失败与重试。

```python
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Barrier


class IntentConflict(ValueError):
    pass


class BeforeOutbox(RuntimeError):
    pass


def create_ticket(db_path, tenant_id, intent_id, body, *, fail=False):
    with closing(sqlite3.connect(db_path, timeout=5)) as db, db:
        db.execute("BEGIN IMMEDIATE")
        ticket_id = db.execute(
            "INSERT INTO tickets(tenant_id, intent_id, request_body) VALUES (?, ?, ?) "
            "ON CONFLICT(tenant_id, intent_id) DO NOTHING RETURNING id",
            (tenant_id, intent_id, body),
        ).fetchone()
        if ticket_id is None:
            old_id, old_body = db.execute(
                "SELECT id, request_body FROM tickets WHERE tenant_id=? AND intent_id=?",
                (tenant_id, intent_id),
            ).fetchone()
            if body != old_body:
                raise IntentConflict(intent_id)
            return old_id

        if fail:
            raise BeforeOutbox(intent_id)
        (new_id,) = ticket_id
        db.execute("INSERT INTO outbox VALUES (?, ?)", (f"ticket-created:{new_id}", new_id))
        return new_id


with TemporaryDirectory() as tmp:
    path = Path(tmp) / "tickets.db"
    with closing(sqlite3.connect(path)) as db:
        db.executescript("""
            CREATE TABLE tickets (
                id INTEGER PRIMARY KEY, tenant_id TEXT NOT NULL,
                intent_id TEXT NOT NULL, request_body TEXT NOT NULL,
                UNIQUE(tenant_id, intent_id)
            );
            CREATE TABLE outbox (event_id TEXT NOT NULL PRIMARY KEY, ticket_id INTEGER NOT NULL);
        """)

    gate = Barrier(2)

    def worker(_):
        gate.wait(timeout=5)
        return create_ticket(path, "store-1", "approval-42", "退货：订单 42")

    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = list(pool.map(worker, range(2)))
    assert ids == [1, 1]

    try:
        create_ticket(path, "store-1", "approval-42", "补寄：订单 42")
    except IntentConflict:
        print("同键不同内容：冲突")
    else:
        raise AssertionError("应拒绝复用操作键")

    try:
        create_ticket(path, "store-1", "approval-43", "退货：订单 43", fail=True)
    except BeforeOutbox:
        pass
    with closing(sqlite3.connect(path)) as db:
        assert db.execute("SELECT intent_id FROM tickets").fetchall() == [("approval-42",)]
        assert db.execute("SELECT event_id, ticket_id FROM outbox").fetchall() == [("ticket-created:1", 1)]
    print(f"并发返回 {ids}；故障回滚后仍然只有 1 张工单、1 条待发事件")
```

代码中的 `RETURNING` 需要 SQLite 3.35+。插入和发送意图在一个事务里，所以不会出现工单存在而 Outbox 缺失。只有插入获胜的分支创建事件，重放分支只读取原 ID。这里的 `request_body` 是不变的示例业务参数；生产中可以换成一组定义清楚的参数或其规范化摘要。

## 5. 扩展到真实系统：Outbox 和重试各管到哪里？

沿 `工作流 → 工单服务 → Outbox Worker → 消费者` 走一遍，至少会碰到三种「同一件事」：工作流重试用业务操作键；Outbox 发布重试用事件 ID；消费者根据事件 ID 记录消费，或把它作为下游接口支持的幂等键。**工作流可以重放、消息可以重投、业务仍然只生效一次**，前提是每段写入都落实自己的去重契约。

例如 Worker 已经把事件发布到 Broker，还没来得及把 Outbox 标为已发送就退出，下一轮还会重发。若消费者要更新自有业务库，可以在同一事务里写入已消费记录和对应结果；若消费者要调用邮件提供方，只有邮件方兑现幂等契约或提供可信的结果查询，才能进一步解决「邮件已发但响应丢了」。如果第三方既不能幂等，也不能查询，就把超时标记成**结果未知**，转入对账，而不是当作明确失败直接重试。

上线验证可以围绕几个断言，而不是只看接口是不是返回 200：

1. **跨进程恢复**：换成持久化 Checkpointer 和业务库，在数据库提交后强制结束工作流进程；另起进程使用原 `thread_id` 恢复，断言返回原工单 ID。
2. **事件重投**：发布成功后、更新 Outbox 状态前结束 Worker；断言同一事件可能收到两次，但消费者只记录一份业务效果。
3. **可追踪性**：在 Trace 或结构化日志里关联 `thread_id`、`intent_id`、`ticket_id`、`event_id` 和重试次数。命中幂等、参数冲突、远程结果未知应分别记录，否则「没有重复工单」也可能掩盖大量超时或卡住的事件。

## 延伸阅读

- [LangGraph 的 interrupt 与 resume](../08/2026-08-31-daily-langgraph-interrupt-resume)：审批状态与工作流恢复。
- [Transactional Outbox](../08/2026-08-06-daily-transactional-outbox)：业务写入和事件发布如何衔接。
- [LangGraph：Durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution)：恢复点、重放与副作用的运行语义。
