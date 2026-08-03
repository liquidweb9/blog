# Agent Runtime、部署与 Durable Execution

> Agent Runtime 不只是托管一次模型调用，而是负责调度步骤、持久化状态、执行工具，并让长任务在超时、崩溃和重启后继续运行。

---

## 1. Agent Runtime 负责什么

一个生产级 Runtime 通常包含：

- API 与身份认证；
- Agent Loop 或 Graph 执行器；
- 模型网关；
- Tool Runtime 与沙箱；
- 状态、记忆和 Artifact 存储；
- 队列、调度器与 Worker；
- 超时、重试、取消和恢复；
- Trace、指标、成本与审计；
- 人工审批和通知。

它管理的是任务生命周期，而不仅是 HTTP 请求生命周期。

## 2. 在线请求与后台任务

短任务可以同步执行：

```text
Request → Agent → Response
```

长任务更适合异步模型：

```text
Request → 创建 Run → Queue → Worker
                         ↓
Client ← 查询/订阅状态 ← State Store
```

API 应快速返回 `run_id`，客户端通过轮询、SSE、WebSocket 或 Webhook 获取进度。不要让长时间 Agent 完全依赖一个易断开的 HTTP 连接。

## 3. Run 状态机

状态必须由 Runtime 明确定义，而不是只保存在对话文本中：

```text
QUEUED → RUNNING → WAITING_TOOL
                   → WAITING_HUMAN
                   → RETRYING
                   → SUCCEEDED
                   → FAILED
                   → CANCELLED
```

状态转换应具备：

- 合法转换约束；
- 乐观锁或版本号；
- 时间戳和操作者；
- 错误分类；
- 可查询的当前进度；
- 最终结果或失败原因。

## 4. Durable Execution

Durable Execution 的目标是：

> 进程可以消失，但任务进度不能随之消失。

核心方法是将执行历史和关键状态持久化，使 Worker 重启后能够从最近安全点恢复。

### 4.1 Checkpoint

在以下边界保存 Checkpoint：

- 模型调用完成后；
- 工具调用前后；
- Graph 节点完成后；
- 人工审批前；
- 外部写操作完成后；
- 上下文压缩前后。

Checkpoint 应记录：

```json
{
  "run_id": "run_1024",
  "graph_version": "graph-v8",
  "current_node": "verify_order",
  "state_version": 17,
  "completed_steps": ["classify", "lookup_order"],
  "pending_action": "request_approval",
  "artifact_refs": ["blob://result/abc"]
}
```

### 4.2 Replay 与非确定性

工作流恢复可能需要重放历史。模型响应、当前时间、随机数和外部 API 都是非确定性的，不能在 Replay 时无条件重新执行。

应将非确定性操作包装为 Activity，并持久化结果：

```text
Workflow：确定性状态转换
Activity：模型调用、工具调用、外部 I/O
```

恢复时复用已完成 Activity 的结果，只执行尚未完成的步骤。

### 4.3 幂等性

分布式系统通常只能可靠实现“至少一次”投递，因此副作用必须支持幂等：

- 每个写操作携带 idempotency_key；
- 数据库使用唯一约束；
- 发送邮件前记录业务操作；
- 支付和退款使用外部幂等键；
- Worker 获取 Lease，超时后才能被其他 Worker 接管。

不要把“消息只会处理一次”作为设计前提。

### 4.4 补偿而不是虚假回滚

跨服务写操作通常无法使用单一数据库事务。应采用 Saga：

```text
创建资源 → 扣减额度 → 发送通知
     失败时：释放资源 ← 恢复额度
```

补偿动作也必须幂等，并记录哪些步骤已成功或已补偿。

## 5. 超时、重试和错误分类

错误应至少分为：

- **Transient**：网络抖动、限流、临时不可用，可重试；
- **Correctable**：参数或格式错误，可反馈给模型修正；
- **Permanent**：权限不足、资源不存在，不应盲目重试；
- **Policy**：安全策略拒绝，应终止或等待人工；
- **Unknown**：保存现场并进入人工处理或有限重试。

重试策略包括：

```text
指数退避 + Jitter + 最大次数 + 总时间预算
```

模型调用、只读查询和写操作应使用不同策略。写操作只有在幂等得到保证时才可自动重试。

## 6. Queue、Worker 与背压

队列设计需要考虑：

- 按租户或优先级分区；
- Worker 并发上限；
- 模型供应商 Rate Limit；
- Tool 的独立并发预算；
- 消息可见性超时与死信队列；
- Poison Task 隔离；
- 公平调度和租户配额。

背压策略可以是：

- 拒绝低优先级新任务；
- 降低每个 Run 的并行度；
- 切换较快模型；
- 延迟非紧急任务；
- 关闭可选步骤；
- 向用户显示真实等待时间。

## 7. 数据与 Artifact

不同数据应分开存储：

| 数据 | 适合的存储 |
| --- | --- |
| Run 状态、索引、版本 | 关系数据库 |
| 队列消息 | Message Broker |
| 大型 Tool Result、文件 | Object Storage |
| Trace 和日志 | Observability Backend |
| 语义记忆 | Vector / Search Store |
| 密钥 | Secret Manager |

状态中保存 Artifact 引用和校验值，避免把大文件、完整网页和超长日志直接塞进数据库或队列。

## 8. 部署拓扑

常见组件划分：

```text
API Gateway
    ↓
Agent Control Plane ── State Store
    ↓
Queue
    ↓
Workers ── Model Gateway
   ├── Read-only Tools
   ├── Write Tools
   └── Sandbox Workers
```

- **Control Plane**：创建、取消、查询 Run，管理策略和版本。
- **Data Plane**：执行模型调用与工具任务。
- **Model Gateway**：统一鉴权、路由、限流、缓存和计费。
- **Tool Gateway**：执行参数校验、授权、审计和网络策略。

高风险工具与普通推理 Worker 应隔离部署，避免共享过多凭据和网络权限。

## 9. Sandbox 与执行隔离

代码执行、浏览器和文件操作应运行在受限环境：

- 每个任务独立身份和临时文件系统；
- CPU、内存、磁盘、进程和时间限制；
- 网络出口白名单；
- 只挂载必要目录；
- 凭据按需、短期注入；
- 基础镜像和依赖固定版本；
- 任务完成后清理环境；
- 记录可审计的执行事件。

Sandbox 是风险边界，不等于绝对安全。宿主机、容器运行时、镜像供应链和网络出口仍需持续加固。

## 10. 多租户与容量规划

多租户系统需要：

- 租户级数据隔离；
- 每租户 QPS、Token 和成本配额；
- 公平队列；
- 租户级模型和工具权限；
- 防止一个长任务耗尽共享 Worker；
- 资源使用归因与账单。

容量规划应同时考虑：

```text
到达率 × 平均步骤数 × 每步耗时 × 并行工具数
```

Agent 的资源消耗通常比单轮 Chat 更长尾，因此必须关注分位数，而不是只看平均值。

## 11. 版本与发布管理

一个可恢复的 Run 必须绑定不可变版本：

- Model 与参数；
- System Prompt；
- Tool Schema 和实现；
- Agent Graph；
- Memory Schema；
- Guardrail；
- Runtime 镜像。

正在运行的任务不应静默切换到新 Graph。常见策略是：

- 老 Run 继续使用旧版本；
- 新 Run 逐步进入新版本；
- 通过迁移函数升级持久状态；
- 无法兼容时停止在人工检查点；
- 保留快速回滚路径。

发布可以采用：

```text
Offline Eval → Shadow → Canary → 分阶段放量 → 全量
```

数据库和状态 Schema 变更优先使用向前、向后兼容的 Expand–Migrate–Contract。

## 12. 灾难恢复与运维

需要明确：

- RPO：最多允许丢失多少状态；
- RTO：服务多久内恢复；
- 状态库与 Artifact 的备份；
- 跨可用区部署；
- 队列积压和死信处理；
- 模型供应商故障降级；
- Run 重新驱动与人工接管工具；
- Runbook 和定期演练。

恢复后应验证外部副作用，不能仅根据本地状态假设操作成功或失败。

## 13. 常见误区

### 13.1 把数据库中的聊天记录当作 Durable State

聊天记录无法可靠表示已完成副作用、状态版本、Lease 和补偿结果。

### 13.2 崩溃后从头运行

长任务成本高且可能重复外部写操作，应从 Checkpoint 恢复。

### 13.3 所有错误都重试

权限拒绝和永久错误重试只会增加成本，写操作重试还可能造成重复副作用。

### 13.4 部署新代码后让旧任务直接继续

持久状态与 Graph 版本可能不兼容，必须固定版本或显式迁移。

## 14. 实践检查清单

- Run 是否拥有明确状态机和持久化状态？
- 每个外部副作用是否有幂等键？
- Checkpoint 是否覆盖关键步骤边界？
- Replay 是否会重复模型调用或写操作？
- 重试是否按错误类型和操作风险区分？
- 是否支持取消、人工暂停和恢复？
- Queue 是否有背压、配额和死信处理？
- 高风险工具是否独立授权和隔离？
- Run 是否绑定完整版本？
- 发布是否支持 Canary、迁移和回滚？
- 是否有 RPO、RTO、Runbook 和恢复演练？

## 15. 总结

Agent Runtime 的核心原则是：

```text
任务状态外置
+ 副作用幂等
+ 非确定性结果持久化
+ 执行可暂停、可恢复、可取消
+ 版本可追踪、可迁移、可回滚
```

真正的 Durable Execution 不是“进程永不失败”，而是进程失败之后任务仍能安全继续。
