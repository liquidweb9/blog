---
title: LlamaIndex 入门：Document、Node、RAG 和 Memory 是什么？
date: 2026-08-20
tags:
  - LlamaIndex
  - RAG
  - Agent
description: 从 Document、Node 和 Index 的关系出发，用一个完整示例讲清 LlamaIndex 如何构建 RAG，以及 Memory 如何让应用记住对话。
---

# LlamaIndex 入门：Document、Node、RAG 和 Memory 是什么？

## 一句话结论

LlamaIndex 是连接私有数据与大模型的应用框架：它先把原始数据包装成 `Document`，再切成适合检索的 `Node`，通过 `Index`、`Retriever` 和 `Query Engine` 完成 RAG；如果应用还需要记住用户说过什么，则使用 `Memory` 管理对话历史和长期信息。

## 1. 为什么需要 LlamaIndex

大模型知道训练阶段学到的通用知识，却不知道企业内部文档、最新产品手册和用户刚刚说过的话。直接把所有资料塞进 Prompt 也不可行：

- 文档可能超过模型上下文窗口。
- 每次发送全部资料会增加 Token 成本和响应延迟。
- 大量无关内容会干扰模型，降低回答质量。
- 对话越来越长后，模型无法一直保留全部历史。

LlamaIndex 提供了一组围绕“数据接入、切分、索引、检索、生成和记忆”的抽象，让开发者不必从头实现整条链路。

```text
私有数据
   ↓ 读取
Document
   ↓ 解析与切分
Node
   ↓ Embedding 与存储
Index / Vector Store
   ↓ 根据问题召回
Retriever
   ↓ 拼接上下文并调用 LLM
Query Engine / Chat Engine / Agent
   ↕
Memory（保存会话历史和长期信息）
```

需要特别注意：**RAG 和 Memory 解决的不是同一个问题**。

| 能力 | 主要保存什么 | 典型问题 |
| --- | --- | --- |
| RAG | 产品文档、知识库、数据库记录等外部知识 | “退款政策是什么？” |
| Memory | 当前用户的历史消息、偏好和会话事实 | “我刚才说我的订单号是多少？” |

## 2. Document 是什么

`Document` 是 LlamaIndex 对一个原始数据源的统一包装。一个 PDF、一篇 Markdown、一次 API 返回或一条数据库记录，都可以成为一个 `Document`。

它通常包含：

- `text`：文档正文。
- `metadata`：文件名、作者、部门、时间、权限等结构化信息。
- `relationships`：与其他 Document 或 Node 的关系。
- `id_`：用于更新、删除和去重的稳定标识。

```python
from llama_index.core import Document

document = Document(
    text="高级版支持 7 天无理由退款，退款会在 3 个工作日内到账。",
    metadata={
        "source": "refund-policy.md",
        "department": "support",
        "version": "2026-08",
    },
    id_="refund-policy-2026-08",
)
```

可以把 `Document` 理解成“进入 LlamaIndex 的原始资料”，而不是最终参与向量检索的最小单位。

## 3. Node 是什么

`Node` 是从 Document 切出来的内容块，也就是 RAG 中常说的 Chunk。长文档通常不能作为一个整体进行检索，因此需要拆成多个 Node。

```text
Document：一份 30 页的产品手册
   ├─ Node 1：账号注册
   ├─ Node 2：套餐价格
   ├─ Node 3：退款规则
   └─ Node 4：常见错误码
```

Node 不只是一个字符串。它还可以保留：

- 从 Document 继承的 metadata。
- 指向源 Document 的关系。
- 前一个和后一个 Node 的关系。
- 自己的唯一 ID 和 Embedding。

下面显式使用 `SentenceSplitter` 把 Document 转换成 Node：

```python
from llama_index.core.node_parser import SentenceSplitter

splitter = SentenceSplitter(
    chunk_size=512,
    chunk_overlap=80,
)
nodes = splitter.get_nodes_from_documents([document])

for node in nodes:
    print(node.node_id)
    print(node.metadata)
    print(node.get_content())
```

`chunk_size` 决定每个 Node 的目标大小，`chunk_overlap` 让相邻 Node 保留一部分重复上下文，避免一句完整语义恰好被切断。

```text
Document 负责表示“这份资料是什么”
Node     负责表示“检索时最小的内容单元是什么”
```

## 4. Index、Retriever 和 Query Engine 分别做什么

这三个概念经常一起出现，但职责不同。

### 4.1 Index：组织可检索的数据

`VectorStoreIndex` 会为 Node 生成 Embedding，并把向量及其关联信息写入向量存储。

```python
from llama_index.core import VectorStoreIndex

index = VectorStoreIndex(nodes)
```

Index 不是简单的“文档数组”，而是面向某种查询方式组织数据的结构。最常见的是向量索引，也可以根据场景使用摘要、关键词、属性图等索引方式。

### 4.2 Retriever：只负责召回

Retriever 接收用户问题，返回最相关的 Node，不负责生成最终答案。

```python
retriever = index.as_retriever(similarity_top_k=3)
results = retriever.retrieve("退款多久到账？")

for result in results:
    print(result.score, result.node.get_content())
```

调试 RAG 时应该先检查 Retriever。如果召回的 Node 都不正确，换更强的 LLM 通常也无法解决问题。

### 4.3 Query Engine：检索后生成答案

Query Engine 把 Retriever 找到的 Node 作为上下文交给 LLM，再合成最终答案。

```python
query_engine = index.as_query_engine(similarity_top_k=3)
response = query_engine.query("高级版退款多久到账？")

print(response)
```

因此，一次查询大致是：

```text
用户问题
   ↓ Embedding
Retriever 从 Index 中召回 Top K Nodes
   ↓
问题 + Nodes 被填入 Prompt
   ↓
LLM 基于上下文生成答案
```

## 5. 一个完整的 LlamaIndex RAG 示例

下面用 OpenAI 模型构建一个最小但完整的知识库问答程序。

### 5.1 安装依赖

```bash
pip install llama-index llama-index-llms-openai llama-index-embeddings-openai
```

设置环境变量：

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

准备目录：

```text
project/
├─ data/
│  ├─ refund-policy.md
│  └─ product-guide.md
└─ rag.py
```

### 5.2 编写 RAG 程序

```python
from llama_index.core import Settings, SimpleDirectoryReader, VectorStoreIndex
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI

# 1. 配置生成模型和 Embedding 模型
Settings.llm = OpenAI(model="gpt-4o-mini", temperature=0)
Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")

# 2. 从 data 目录读取数据，每个文件会被包装成 Document
documents = SimpleDirectoryReader("data").load_data()

# 3. 把 Document 显式切成 Node，方便控制切分策略
splitter = SentenceSplitter(chunk_size=512, chunk_overlap=80)
nodes = splitter.get_nodes_from_documents(documents)

# 4. 对 Node 做 Embedding 并建立向量索引
index = VectorStoreIndex(nodes)

# 5. 创建查询引擎：先召回 3 个 Node，再让 LLM 生成答案
query_engine = index.as_query_engine(similarity_top_k=3)

response = query_engine.query("高级版退款需要多久到账？")

print(response)
print("\n引用来源：")
for source in response.source_nodes:
    print(
        source.node.metadata.get("file_name"),
        round(source.score or 0, 4),
    )
```

如果不需要观察 Node 的切分过程，也可以使用快捷写法：

```python
documents = SimpleDirectoryReader("data").load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine(similarity_top_k=3)
```

`from_documents()` 会在内部完成 Document 到 Node 的转换。它适合快速验证，但生产环境通常需要显式配置切分、清洗、元数据和向量存储。

## 6. Memory 是什么

一次普通的 `query_engine.query()` 是相对独立的。第二个问题不会天然知道第一个问题说了什么：

```text
用户：退款政策是什么？
助手：高级版支持 7 天无理由退款。
用户：它多久到账？
```

第二句话中的“它”依赖对话历史。Memory 的作用，就是保存并在后续请求中取回相关历史。

LlamaIndex 当前推荐使用 `Memory` 类。旧教程中常见的 `ChatMemoryBuffer` 已被标记为弃用，不建议新项目继续采用。

```python
from llama_index.core.memory import Memory

memory = Memory.from_defaults(
    session_id="user-42",
    token_limit=12000,
)
```

`session_id` 用于区分不同会话，`token_limit` 用于限制注入模型上下文的记忆规模。

### 6.1 在 Agent 中使用 Memory

可以把 RAG 查询封装成 Agent 工具，再把同一个 Memory 传给每次运行：

```python
import asyncio

from llama_index.core import Settings, SimpleDirectoryReader, VectorStoreIndex
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.core.memory import Memory
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI

llm = OpenAI(model="gpt-4o-mini", temperature=0)
Settings.llm = llm
Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")

documents = SimpleDirectoryReader("data").load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine(similarity_top_k=3)


async def search_knowledge_base(question: str) -> str:
    """查询产品手册、套餐和退款政策。"""
    response = await query_engine.aquery(question)
    return str(response)


agent = FunctionAgent(
    llm=llm,
    tools=[search_knowledge_base],
    system_prompt=(
        "你是产品支持助手。遇到产品规则问题时必须查询知识库，"
        "没有依据时明确说明不知道。"
    ),
)

memory = Memory.from_defaults(
    session_id="user-42",
    token_limit=12000,
)


async def main() -> None:
    first = await agent.run("高级版退款政策是什么？", memory=memory)
    print(first)

    second = await agent.run("它多久到账？", memory=memory)
    print(second)


if __name__ == "__main__":
    asyncio.run(main())
```

这里有两种上下文来源：

```text
RAG：从知识库召回“高级版退款会在 3 个工作日内到账”
Memory：记住上一轮谈论的是“高级版退款政策”
```

二者合起来，Agent 才能正确理解“它”并基于知识库回答。

### 6.2 短期记忆和长期记忆

`Memory` 默认维护受 Token 限制的短期对话历史。更复杂的应用还可以配置 Memory Block：

| Memory Block | 作用 |
| --- | --- |
| `StaticMemoryBlock` | 注入固定信息，例如角色、租户或业务规则 |
| `FactExtractionMemoryBlock` | 从历史对话中提取用户偏好、姓名等事实 |
| `VectorMemoryBlock` | 把较早的对话写入向量存储，按当前问题检索相关历史 |

短期记忆适合保留最近几轮对话，长期记忆适合跨越较长时间保存稳定事实。不要把所有聊天记录无限追加到 Prompt，否则成本、延迟和噪声都会持续增加。

## 7. RAG 与 Memory 如何组合

一个带记忆的知识库助手可以按下面的流程运行：

```text
1. Memory 取回当前会话的相关历史
2. Agent 根据“当前问题 + 历史”判断是否调用知识库工具
3. Retriever 从 Index 召回相关 Nodes
4. LLM 根据 Nodes 和对话上下文生成答案
5. 新一轮用户消息、工具调用和回答写回 Memory
```

可以用一句话区分：

```text
RAG 让模型知道“资料里有什么”
Memory 让模型知道“我们刚才聊了什么、这个用户是谁”
```

## 8. 实践建议

### 8.1 先优化检索，再优化生成

调试时打印 `response.source_nodes` 或直接调用 Retriever，检查：

- 正确答案所在的 Node 是否被召回。
- Node 是否太短而缺少上下文，或太长而混入多个主题。
- `similarity_top_k` 是否合理。
- metadata 是否完整，能否按租户、部门、时间和权限过滤。

如果召回错误，应优先调整切分、Embedding、查询改写、混合检索和 Reranker，而不是只修改 Prompt。

### 8.2 不要把内存向量索引直接用于生产

示例中的 `VectorStoreIndex(nodes)` 默认适合本地学习和原型验证。生产环境通常应接入持久化向量数据库，并保存 Document、Node 与索引状态，否则进程重启后需要重新构建。

常见选择包括 Qdrant、Milvus、Elasticsearch、PostgreSQL + pgvector 和各类云向量数据库。

### 8.3 给 Document 设置稳定 ID 和 metadata

稳定 ID 便于文档更新、删除和去重；metadata 可用于权限隔离与过滤。例如多租户系统至少应保存：

```python
metadata = {
    "tenant_id": "company-a",
    "department": "support",
    "visibility": "internal",
    "updated_at": "2026-08-20",
}
```

检索时必须在服务端应用权限过滤，不能只依靠 Prompt 要求模型“不要回答无权内容”。

### 8.4 Memory 必须按用户和会话隔离

不要让所有用户共享一个 Memory。`session_id` 至少应包含用户与会话维度，例如：

```text
tenant_id:user_id:conversation_id
```

同时要考虑过期时间、用户删除数据、敏感信息脱敏和持久化策略。

### 8.5 把离线索引和在线查询拆开

生产系统通常分为两条链路：

```text
离线：加载 → 清洗 → 切分 → Embedding → 写入向量库
在线：接收问题 → 检索 → 重排 → 生成 → 返回引用
```

不要在每次用户提问时重新读取全部文件并构建 Index。

## 9. 常见误区

### 9.1 一个文件就是一个 Node 吗？

不一定。文件通常先成为 Document，再根据内容结构切成多个 Node。短文本也可以只生成一个 Node。

### 9.2 Index 就是向量数据库吗？

不是。Index 是 LlamaIndex 中组织和查询数据的抽象，向量数据库是其中一种底层存储。开发时可以使用内存存储，生产时再接入外部 Vector Store。

### 9.3 有了 RAG 就不需要 Memory 吗？

不是。RAG 提供外部知识，Memory 提供会话连续性。多轮知识库问答通常同时需要二者。

### 9.4 Memory 会让模型永久记住一切吗？

不会。记忆受 Token 限制、存储后端、会话 ID、淘汰策略和长期记忆配置影响。Memory 是应用层的数据管理能力，不是模型参数被重新训练了。

### 9.5 `from_documents()` 做了什么？

它是快捷入口：把 Document 经过默认 Transformations 转成 Node，再建立 Index。需要精细控制时，应显式使用 Node Parser 或 Ingestion Pipeline。

## 10. 总结

```text
Document：原始数据源的统一容器
Node：从 Document 切出的检索单元
Index：组织 Node，支持高效查询
Retriever：根据问题召回相关 Node
Query Engine：检索上下文并调用 LLM 生成答案
Memory：保存和取回对话历史及长期信息
```

学习 LlamaIndex 时，不要只记住 `VectorStoreIndex.from_documents()` 这一行代码。真正决定 RAG 质量的是 Document 如何建模、Node 如何切分、Retriever 如何召回，以及 Memory 是否正确隔离和控制上下文。

## 延伸阅读

- 官方文档：[LlamaIndex Starter Tutorial](https://developers.llamaindex.ai/python/framework/getting_started/starter_example/)
- 官方文档：[Documents / Nodes](https://developers.llamaindex.ai/python/framework/module_guides/loading/documents_and_nodes/)
- 官方文档：[Retriever](https://developers.llamaindex.ai/python/framework/module_guides/querying/retriever/)
- 官方文档：[Memory](https://developers.llamaindex.ai/python/framework/module_guides/deploying/agents/memory/)
- 笔记：[Agent 工程：RAG 工程](/notes/agent-engineering/06-rag-engineering)
- 笔记：[Agent 工程：Agent Memory](/notes/agent-engineering/07-agent-memory)
