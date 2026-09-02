---
title: KV Cache 是什么？它为什么能加速大模型推理？
date: 2026-09-01
tags:
  - KV Cache
  - LLM
  - Transformer
  - 推理优化
description: 从自回归生成的重复计算出发，介绍 KV Cache 如何复用历史 Token 的 Key 和 Value，以及它带来的速度收益、显存代价和常见优化方法。
---

# KV Cache 是什么？它为什么能加速大模型推理？

## 一句话结论

KV Cache 会保存 Transformer 在历史 Token 上已经计算出的 Key 和 Value。生成下一个 Token 时，模型只需计算新 Token 的 Query、Key 和 Value，再让新 Query 与缓存中的全部 Key、Value 做注意力计算，而不必反复计算整段历史，因此能显著降低大模型自回归生成的重复计算。它用更多显存换取更低延迟和更高吞吐量。

## 1. 重复计算从哪里来？

大语言模型通常采用自回归方式生成文本：每次预测一个 Token，再把它追加到输入中继续预测。

```text
输入：今天天气
第 1 步：今天天气       -> 很
第 2 步：今天天气很     -> 好
第 3 步：今天天气很好   -> 。
```

在因果注意力中，每个新 Token 可以关注自己及之前的所有 Token。若每一步都把完整序列重新送进模型，历史 Token 的注意力投影会被反复计算：

```text
第 1 步：计算「今 天 天 气」
第 2 步：再次计算「今 天 天 气」，再计算「很」
第 3 步：再次计算「今 天 天 气 很」，再计算「好」
```

序列越长，这部分重复计算越明显。KV Cache 的核心思路就是：历史信息已经算过，就把后续仍需使用的中间结果保存下来。

## 2. 为什么缓存的是 K 和 V？

对某一层自注意力，输入隐藏状态会经过三个线性投影：

$$
Q = XW_Q, \quad K = XW_K, \quad V = XW_V
$$

注意力计算可以简化表示为：

$$
\operatorname{Attention}(Q, K, V)
= \operatorname{softmax}\left(\frac{QK^T}{\sqrt{d}}\right)V
$$

生成新 Token 时，只需要得到这个 Token 的输出，所以只需要它的新 Query；但新 Query 必须与所有历史 Token 的 Key 比较，并根据注意力权重汇总它们的 Value。因此，历史 Token 的 K 和 V 在之后每一步都会继续使用，适合被缓存。

```text
历史 Token：t1, t2, t3
缓存内容：  K1 K2 K3
           V1 V2 V3

生成 t4：只计算 Q4、K4、V4
注意力： Q4 与 [K1, K2, K3, K4] 比较
输出：   对 [V1, V2, V3, V4] 加权求和
缓存更新：追加 K4、V4
```

每一层 Transformer 都有自己的 K、V，因此 KV Cache 并不是一份简单的文本缓存，而是一组按层保存的张量。

## 3. Prefill 和 Decode 两个阶段

理解 KV Cache 时，需要区分推理中的两个阶段。

| 阶段 | 输入特征 | 主要工作 | 常见瓶颈 |
| --- | --- | --- | --- |
| Prefill | 一次处理完整 Prompt | 并行计算所有 Prompt Token，并建立 KV Cache | 计算量、首 Token 延迟 |
| Decode | 每次处理一个新 Token | 读取历史 KV，计算并追加新的 KV | 显存带宽、缓存容量 |

假设 Prompt 有 2,000 个 Token，模型需要生成 200 个 Token：

1. Prefill 阶段一次处理 2,000 个 Prompt Token，并为每层建立缓存。
2. 第一次 Decode 读取这 2,000 个 Token 的 KV，生成第一个新 Token。
3. 后续每一步只计算一个新 Token，同时让缓存长度依次变成 2,001、2,002，直到生成结束。

KV Cache 避免的是历史 Token 的 K、V 投影和中间层重复计算，但注意力仍需读取越来越长的历史缓存。它不会让长上下文推理变成常数开销。

## 4. KV Cache 能节省多少计算？

不使用缓存时，为生成第 $t$ 个 Token，模型需要重新处理前面的整个序列。随着生成长度增加，大量历史计算被重复执行。

使用缓存后，每层只为当前 Token 计算新的 Q、K、V，再复用历史 K、V。Decode 阶段每步参与线性投影和前馈网络计算的 Token 数从“当前完整序列长度”降为 1，因此通常可以显著改善 Token 间延迟。

不过，注意力部分仍要让新 Query 与全部历史 Key 计算分数，并读取全部历史 Value。序列长度增长时：

- 每步需要读取的 KV Cache 持续增加；
- 单请求生成速度可能逐渐下降；
- 可同时服务的请求数受到显存容量限制；
- 长上下文下 Decode 往往更受显存带宽影响，而不是纯算力影响。

因此，“开启 KV Cache”不等于“上下文再长也没有成本”，而是用缓存消除了最昂贵的一类重复计算。

## 5. 显存代价如何估算？

标准多头注意力中，单个请求的 KV Cache 大小可粗略估算为：

$$
2 \times L \times T \times H_{kv} \times D \times B
$$

其中：

- $2$ 表示 Key 和 Value 两份缓存；
- $L$ 是 Transformer 层数；
- $T$ 是已缓存的 Token 数；
- $H_{kv}$ 是 Key/Value 头数；
- $D$ 是每个头的维度；
- $B$ 是每个元素的字节数，例如 FP16/BF16 通常为 2 字节。

例如，一个 32 层模型使用 32 个 KV 头、每个头维度为 128，以 FP16 缓存 4,096 个 Token：

$$
2 \times 32 \times 4096 \times 32 \times 128 \times 2
= 2\ \text{GiB}
$$

这还只是一个请求。当服务同时处理 20 个类似请求时，理论缓存需求可达到约 40 GiB。实际系统还需为模型权重、激活、临时计算和内存碎片预留空间。

若模型使用 Multi-Query Attention（MQA）或 Grouped-Query Attention（GQA），$H_{kv}$ 会小于 Query 头数，因此可以大幅减少缓存。例如 Query 有 32 个头、KV 只有 8 个头时，KV Cache 约为标准多头注意力的四分之一。

## 6. 常见优化方法

### 6.1 Paged Attention

不同请求的上下文长度和生成长度并不一致。若为每个请求预留一块连续的最大长度缓存，会造成内部浪费和外部碎片。

Paged Attention 将 KV Cache 划分为固定大小的逻辑块，再通过映射表关联到物理显存块，思路类似操作系统的分页：

```text
请求 A 的逻辑块：A0 A1 A2
物理显存位置：  P7 P2 P9
```

这样可以按需分配、回收缓存，也便于多个序列共享部分缓存。vLLM 等推理引擎使用这类方法提高显存利用率和批处理吞吐量。

### 6.2 Prefix Caching

多个请求可能共享同一段系统提示词、Few-shot 示例或长文档前缀。Prefix Caching 复用相同前缀已经生成的 KV Cache，减少重复 Prefill。

它适合固定系统提示词、多轮对话和同一文档上的批量问答，但通常要求前缀 Token 完全一致。提示词中的时间戳、随机 ID 或字段顺序变化，都可能降低缓存命中率。

### 6.3 KV Cache 量化

将 KV 从 FP16/BF16 压缩为 FP8、INT8 或更低精度，可以减少显存占用和读取带宽。但量化会引入额外的量化、反量化开销，也可能影响模型质量，需要在目标模型和真实请求分布上评估。

### 6.4 滑动窗口与缓存淘汰

部分模型只关注最近固定窗口内的 Token，可以丢弃窗口之外的 KV。对不支持滑动窗口的模型，直接删除旧缓存会改变注意力语义，不能把它当作通用优化。

## 7. KV Cache 与普通缓存有什么不同？

KV Cache 容易和应用层的响应缓存混淆，二者解决的问题不同：

| 缓存类型 | 缓存内容 | 命中条件 | 主要收益 |
| --- | --- | --- | --- |
| 响应缓存 | 最终生成结果 | 请求或语义足够相同 | 完全跳过模型推理 |
| Prefix Cache | 公共前缀对应的 KV | Token 前缀一致 | 跳过重复 Prefill |
| 单次请求 KV Cache | 当前序列各层的 K、V | 同一生成序列继续解码 | 避免每步重算历史 Token |

普通 Key-Value 数据库中的 KV 表示“键和值”；Transformer 的 KV Cache 中，KV 特指注意力机制里的 **Key 和 Value**，两者只是名称相同。

## 8. 实践建议

1. **分别观察 Prefill 和 Decode。** 使用首 Token 延迟（TTFT）衡量 Prefill，使用 Token 间延迟（ITL）或每秒输出 Token 数衡量 Decode，不要只看总耗时。
2. **按真实并发估算显存。** KV Cache 与层数、上下文长度、KV 头数、精度、批大小近似线性相关，不能只根据模型权重判断显卡是否够用。
3. **确认模型的注意力结构。** MHA、MQA、GQA 和滑动窗口注意力对应不同缓存规模，估算时应读取模型配置中的层数、KV 头数和 Head Dimension。
4. **提高共享前缀稳定性。** 将稳定的系统提示词放在前面，把用户 ID、时间戳等动态内容后移，有助于提高 Prefix Cache 命中率。
5. **限制无价值的上下文。** KV Cache 能减少重算，但不能消除长上下文的显存和带宽成本。应先清理无关历史、控制最大上下文，再考虑量化或缓存换出。
6. **用推理引擎管理缓存。** 生产环境优先使用支持连续批处理、Paged Attention 和 Prefix Caching 的成熟推理引擎，不要自行维护大量请求的 KV 张量生命周期。
7. **在质量基准上验证压缩。** KV 量化、淘汰和滑动窗口都可能改变输出，应同时评估吞吐、延迟、显存占用和任务质量。

## 9. 总结

```text
没有 KV Cache：每生成一个 Token，都重新计算整段历史。
使用 KV Cache：只计算新 Token，并复用历史 Token 的 Key 和 Value。
```

KV Cache 是大模型高效自回归推理的基础设施。它大幅减少重复计算，但也让显存容量和带宽成为 Decode 阶段的重要瓶颈。理解 Prefill、Decode、缓存大小公式以及 Paged Attention、Prefix Caching、GQA 和量化等手段，才能在延迟、吞吐量、上下文长度和成本之间做出合理取舍。

## 延伸阅读

- [Hugging Face：Caching](https://huggingface.co/docs/transformers/main/en/cache_explanation)
- [vLLM：Paged Attention](https://docs.vllm.ai/en/latest/design/paged_attention/)
- [论文：Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180)
- [论文：Fast Transformer Decoding: One Write-Head is All You Need](https://arxiv.org/abs/1911.02150)
