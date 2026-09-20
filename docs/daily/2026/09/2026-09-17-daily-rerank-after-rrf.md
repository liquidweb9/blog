---
title: RRF 之后为什么还需要 Rerank？
date: 2026-09-17
tags:
  - RAG
  - 混合检索
  - 信息检索
description: 区分 RRF 融合与 Rerank 精排的职责，通过 Cross-Encoder 示例理解候选集、重排分数、上下文预算和效果评估。
---

# RRF 之后为什么还需要 Rerank？

## 一句话结论

**RRF 根据多路检索的排名筛选候选，Rerank 则重新阅读问题和候选内容，判断谁真正能回答问题。** 两者是粗排与精排的分工：先用低成本方法保住召回，再把昂贵的相关性计算用在少量候选上，最终将最有用的证据送给 LLM。

## 1. 已经融合了排名，为什么还要排一次？

在[上一篇 RRF 文章](/daily/2026/09/2026-09-16-daily-rrf)中，BM25 和向量检索通过倒数排名融合得到一份统一列表。但 RRF 只知道文档在各路排第几，不知道文档具体写了什么。

假设用户问：

> 退款审核通过后，为什么银行卡三天了还没到账？

候选内容可能是：

| 候选 | 内容 | 可能出现的排序问题 |
| --- | --- | --- |
| A | 退款申请流程：提交申请、等待审核、查看进度 | 关键词多、语义接近，但主要回答审核前的问题 |
| B | 银行卡退款到账说明：审核通过后按银行工作日计算，节假日顺延 | 直接回答当前问题，但可能只在一路靠前 |
| C | 余额退款：审核后即时退回账户余额 | 都在讲退款，却使用了不同的支付渠道 |

RRF 可能把被两路同时召回的 A 放到前面。Reranker 则有机会识别“**审核通过后 + 银行卡 + 到账时效**”这组条件，把 B 提上来。

这不是说重排模型一定正确，而是它使用了 RRF 没有使用的信号：**问题与内容之间更细粒度的匹配关系**。

## 2. 三个阶段分别解决什么问题？

```text
问题
  ├─ BM25 Top-N ────┐
  └─ 向量检索 Top-N ─┤
                    ↓
             RRF 融合 → Top-M 候选
                    ↓
          Reranker(query, chunk)
                    ↓
             重排后的 Top-K
                    ↓
         去重、证据补全、Token 预算
                    ↓
                  LLM
```

| 阶段 | 关注点 | 主要输入 | 成本特征 |
| --- | --- | --- | --- |
| 召回 | 尽量找全可能相关的内容 | Query、索引 | 利用倒排索引或向量索引搜索大语料 |
| RRF 融合 | 合并异构结果，收窄候选 | 多路排名、稳定 Chunk ID | 按名次累加，不调用模型 |
| Rerank 精排 | 把能回答问题的内容排到前面 | Query、候选正文 | 对候选进行模型推理，受数量和长度影响 |

例如，每路召回 `N=100`，融合后取 `M=50`，重排后选择 `K=5`，可以作为实验起点；它们不是通用最优值。`N` 是每路数量，`M` 是送入重排的候选数量，`K` 是最终保留数量，也都不同于 RRF 公式中的平滑常数 `k`。

**Reranker 无法找回候选集之外的证据。** 如果正确文档在 RRF 阶段被截掉，换更强的重排模型也无济于事。因此应先检查进入重排前的 Recall@M，再优化前几名的排序质量。

## 3. Cross-Encoder 为什么适合精排？

向量召回通常使用 Bi-Encoder：Query 和文档分别编码，再计算向量相似度。

```text
query    → encoder → query vector ─┐
                                  ├─ similarity
document → encoder → doc vector ───┘
```

文档向量可以提前计算并建立索引，所以适合大规模召回。但 Query 与文档之间的具体交互，被压缩进了两个向量。

Cross-Encoder 则把一对文本一起送入模型：

```text
[query, document] → joint encoder → relevance score
```

模型可以直接比较问题条件和正文细节，例如支付渠道是否一致、是否已经通过审核、时效是否按工作日计算。代价是文档无法预先得到一个适用于所有 Query 的最终分数，需要在请求时对候选逐对推理，通常以 Batch 方式执行。

Rerank 是一个阶段，并不等于某一种模型。也可以使用专用重排 API、Late Interaction 模型或 LLM 排序。Cross-Encoder 是常见选择；LLM 排序还需要处理输入顺序偏差、输出 ID 校验，以及更高的延迟和 Token 成本。

## 4. 一个最小重排示例

下面用 Sentence Transformers 的多语言重排模型演示。先安装依赖：

```bash
pip install sentence-transformers
```

`candidates` 代表已经按 RRF 得分排序、且按稳定 Chunk ID 去重的结果：

```python
from sentence_transformers import CrossEncoder

# 服务启动时加载一次；正式部署应固定依赖和模型 revision。
# 首次运行需要下载模型，设备和 Batch 大小按资源调整。
reranker = CrossEncoder("BAAI/bge-reranker-v2-m3", max_length=512)


def rerank(query, candidates, candidate_limit=50, top_k=5):
    if candidate_limit < 1 or top_k < 1:
        raise ValueError("candidate_limit and top_k must be positive")

    selected = candidates[:candidate_limit]
    if not selected:
        return []

    pairs = [(query, item["text"]) for item in selected]
    scores = reranker.predict(pairs, batch_size=8)
    ranked = [
        {**item, "rerank_score": float(score)}
        for item, score in zip(selected, scores)
    ]
    return sorted(
        ranked, key=lambda item: item["rerank_score"], reverse=True
    )[:top_k]


candidates = [
    {"id": "refund-apply:1", "text": "退款申请流程：提交申请后等待审核。"},
    {"id": "refund-bank:2", "text": "银行卡退款审核通过后按银行工作日计算，节假日顺延。"},
    {"id": "refund-balance:1", "text": "余额退款审核后即时退回账户余额。"},
]

for hit in rerank("退款审核通过后，为什么银行卡三天了还没到账？", candidates):
    print(hit["id"], hit["rerank_score"])
```

示例只展示数据流，不预设模型实际输出的分数和名次。`max_length=512` 限制的是模型编码后的文本对长度；超长正文会被截断，因此不能只调大候选数量，却忽略关键证据是否仍在输入中。

还要注意：

- **重排分数不天然等于概率。** 即使映射到了 0～1，也不能直接解释为“有 90% 的概率正确”；阈值需要在自己的评估集上校准。
- **默认按重排分数重新排序。** RRF 分数与模型分数尺度不同，不能随意相加。确实需要融合时，应单独验证归一化和权重。
- **始终保留原始 ID、来源与元数据。** 重排只改变顺序，不能丢失引用、文档版本和访问控制信息。

## 5. 重排之后还不是最终上下文

如果 Top-5 全是同一段话的不同切片，LLM 获得的信息仍然有限。实际组装上下文时，还要考虑：

1. **权限过滤前置。** 在召回阶段限制用户可访问的语料，并在调用重排服务前确认候选权限，不能指望模型帮忙过滤越权内容。
2. **控制重复。** 对重叠 Chunk 做合并，或限制同一文档占用的名额；不同问题需要在相关性和来源覆盖之间取舍。
3. **补全证据。** 命中表格行、代码片段或条款时，按需补上标题、表头和相邻段落，并记录出处。
4. **按 Token 预算装配。** Top-K 是数量约束，不能代替长度约束。预留系统指令、问题、历史与生成空间，再决定证据容量。

其中去重、多样性控制和相邻片段扩展都会改变最终证据集合，应纳入端到端评估，而不是默认它们一定提升效果。

## 6. 怎样判断多这一层是否值得？

固定同一份查询集、语料快照和召回配置，对比“RRF 直接取 Top-K”与“RRF Top-M 后重排”：

| 指标 | 回答的问题 |
| --- | --- |
| 重排前 Recall@M | 正确证据有没有进入候选集？ |
| 重排后 nDCG@K / MRR | 相关内容是否更靠前，首个相关结果是否更容易找到？ |
| 答案正确率、引用支持率 | LLM 是否真正利用了正确证据？ |
| P50 / P95 延迟、吞吐、单次成本 | 收益是否覆盖额外推理和排队开销？ |

评估样本应覆盖精确编号、同义表达、否定条件、时间限制以及“语料中没有答案”等情况。重排总会排出第一名，但**第一名不代表足够相关**。

线上还应记录候选数量、输入 Token、模型版本和超时比例。重排服务超时时，可以在业务允许的情况下退回原有 RRF 排名，并标记降级；如果证据不足就不能回答，则应走无答案路径。增加 Rerank 应由效果与延迟收益决定，简单且已足够准确的场景可以直接使用融合结果。

## 实践建议

- 先确认召回与 RRF Top-M 没有漏掉关键证据，再调重排模型。
- 用适合语言和领域的模型，分别评估候选数量、Chunk 长度与 Batch 大小。
- 将重排作为独立的可观测阶段，设置超时、并发上限和明确的降级行为。
- 将“相关性排序”和“上下文装配”一起评估，最终看回答质量，而不是只看模型分数。

## 延伸阅读

- [每日技术：RRF：如何把多路检索结果融合成一个排名？](/daily/2026/09/2026-09-16-daily-rrf)
- [Sentence Transformers：Retrieve & Re-Rank](https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html)
- [BAAI/bge-reranker-v2-m3 模型说明](https://huggingface.co/BAAI/bge-reranker-v2-m3)
- [Agent 工程：RAG 工程](/notes/agent-engineering/06-rag-engineering)
