---
title: Unsloth：用更少显存把大模型微调跑起来
date: 2026-09-23
tags:
  - Unsloth
  - 大模型
  - 微调
  - 工程实践
description: 以 LoRA/QLoRA 为主线理解 Unsloth 的作用，从数据集、量化加载到训练、评估和部署，搭建一条可复现的大模型微调流程。
---

# Unsloth：用更少显存把大模型微调跑起来

## 一句话结论

**Unsloth 是面向大模型训练与推理的优化工具，重点通过显存优化和高效实现降低 LoRA/QLoRA 微调的门槛；它不是“自动让模型变聪明”的按钮，最终效果仍主要取决于数据、任务定义、评估和部署配置。**

如果目标是在有限 GPU 上让一个通用模型学会企业客服话术、代码规范或结构化输出，Unsloth 很适合作为训练层，但应把它放进一条完整的实验链路，而不是只运行一次 Notebook 就宣布微调成功。

## 1. Unsloth 解决的是什么问题？

全参数微调需要为模型参数、梯度和优化器状态保留大量显存。模型越大，训练越容易受到显存、训练时间和成本限制。LoRA 的思路是冻结基础模型，只训练插入模型各层的低秩适配器；QLoRA 再把基础模型以 4-bit 形式加载，进一步降低训练时的显存占用。

```text
基础模型权重（冻结） + LoRA Adapter（可训练）
             │
             ├── LoRA：基础模型通常以较高精度加载
             └── QLoRA：基础模型以 4-bit 量化形式加载
                         ↓
                 训练少量适配器参数
                         ↓
              评估：基础模型 vs 微调模型
```

Unsloth 在这条路径上提供了经过优化的模型加载、训练和推理实现，并与 Hugging Face Transformers、TRL、PEFT、Datasets 等生态配合使用。它主要减少的是工程和硬件成本，**不会替代数据清洗、实验设计与质量评估**。

还要区分两个经常被混淆的目标：

| 目标 | 更适合的方案 | 说明 |
| --- | --- | --- |
| 让模型回答最新的私有文档 | RAG | 知识放在检索库，更新时不必重新训练模型 |
| 让模型稳定遵循格式、语气或任务流程 | LoRA/QLoRA 微调 | 通过样本改变模型的行为倾向 |
| 训练模型掌握全新的复杂能力 | 微调、持续预训练或 RL | 需要更大规模数据和更严格的评估 |
| 线上低延迟服务 | vLLM、llama.cpp、Ollama 等 | 这是推理部署层，不等于训练方案 |

RAG 和微调可以组合：微调模型学习回答风格和工具调用格式，RAG 在运行时提供不断变化的事实证据。

## 2. LoRA 与 QLoRA 的关键取舍

LoRA 可以把权重更新近似写成低秩矩阵的乘积：

$$
W' = W + \frac{\alpha}{r}BA
$$

其中，$W$ 是被冻结的基础权重，$A$ 与 $B$ 是训练中的低秩矩阵，$r$ 是 rank，$\alpha$ 控制更新强度。训练结束后，适配器通常只有基础模型的一小部分大小，便于保存、切换和发布。

QLoRA 的额外步骤是将基础模型以 4-bit 权重加载，训练时仍然更新 LoRA 参数。它适合显存紧张的实验环境，但要注意：

- 4-bit 主要描述基础模型的加载与存储精度，不代表所有计算都以 INT4 完成；
- QLoRA 的显存更省，但速度、精度和算子支持仍取决于模型、GPU、Torch、CUDA 与量化后端；
- 训练和服务最好尽量使用相同的精度路径，最终仍应以目标部署环境的评测结果为准；
- 量化降低显存需求，不会解决上下文过长、数据重复或训练集泄漏问题。

通常可以先从 QLoRA 开始：先证明数据和任务有效，再根据质量和资源决定是否切换到 16-bit LoRA 或更大模型。

## 3. 一条最小可理解的训练流程

安装时应先隔离 Python 环境，并按照本机的 Torch、CUDA 和 GPU 组合选择依赖。官方当前提供的通用安装方式之一是：

```bash
uv venv unsloth_env --python 3.13
source unsloth_env/bin/activate
uv pip install unsloth --torch-backend=auto
```

Windows PowerShell 的激活命令不同，CUDA 兼容性也应以官方安装说明和本机环境为准。不要把一条适用于 CUDA 12.1、某个 Torch 版本的命令直接复制到所有机器；安装成功只是第一步，还要验证能否加载目标模型并完成一次短训练。

下面是一个展示主要步骤的代码骨架。数据集假设已经包含格式化后的 `text` 字段；实际项目应根据模型的聊天模板构造文本，不能把不同模型的特殊 Token 直接混用。

```python
from datasets import load_dataset
from transformers import TrainingArguments
from trl import SFTTrainer
from unsloth import FastLanguageModel

max_seq_length = 2048

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Qwen3-1.7B-unsloth-bnb-4bit",
    max_seq_length=max_seq_length,
    load_in_4bit=True,
    dtype=None,
)

model = FastLanguageModel.get_peft_model(
    model,
    r=16,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_alpha=16,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=3407,
)

dataset = load_dataset("json", data_files="train.jsonl", split="train")

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    dataset_text_field="text",
    max_seq_length=max_seq_length,
    args=TrainingArguments(
        output_dir="outputs",
        per_device_train_batch_size=2,
        gradient_accumulation_steps=8,
        learning_rate=2e-4,
        num_train_epochs=1,
        logging_steps=1,
        save_strategy="steps",
        save_steps=100,
        optim="adamw_8bit",
        report_to="none",
        seed=3407,
    ),
)

trainer.train()
model.save_pretrained("outputs/adapter")
tokenizer.save_pretrained("outputs/adapter")
```

Unsloth 和 TRL 的参数会随版本演进，例如 `tokenizer`、`max_seq_length` 在部分新版本中可能对应 `processing_class`、`max_length` 或放入 `SFTConfig`。因此代码的关键是理解流程，并以当前版本的官方 Notebook 和 API 为最终依据，而不是把版本相关参数当成永久不变的接口。

训练前，`train.jsonl` 可以先设计成如下的对话样本，再统一应用目标模型的 chat template：

```json
{"messages": [
  {"role": "user", "content": "把工单摘要成 JSON。"},
  {"role": "assistant", "content": "{\"summary\":\"...\",\"priority\":\"P2\"}"}
]}
```

重点不是样本看起来像不像聊天，而是每条样本是否明确表达了输入、期望输出、边界条件和失败处理方式。若任务要求结构化输出，应在数据中同时覆盖合法、缺字段、冲突和无法判断的情况。

## 4. 参数怎样开始设置？

不要一开始就同时搜索十几个超参数。可以先固定模型、数据集版本和评估集，再按顺序调整：

1. **先确认 `max_seq_length`。** 它影响显存和截断行为。统计 Token 长度，确认关键答案没有在末尾被截断。
2. **用较小 rank 做基线。** `r=8` 或 `r=16` 是常见起点；任务复杂或明显欠拟合时，再考虑增大 rank。
3. **控制有效批大小。** `per_device_train_batch_size × gradient_accumulation_steps` 决定一次参数更新看到的样本规模。显存不足时，优先减小单卡 batch，再增加梯度累积。
4. **从短实验开始。** 先跑固定步数检查 loss、显存、吞吐和样本输出，再决定是否完整训练 1～3 个 epoch。
5. **固定随机种子并保存配置。** 记录基础模型、数据集摘要、Unsloth/Torch/CUDA 版本、量化设置、LoRA 参数和训练命令。

`learning_rate=2e-4` 可以作为 LoRA/QLoRA 的起始尝试，但不是普适答案。训练损失下降不等于任务质量提升：损失快速接近零可能是记忆训练集，也可能是数据过于简单或存在泄漏。

对于多轮对话，常见做法是只对 assistant response 计算损失，让模型学习“应该怎样回答”，而不是把用户问题也当成需要生成的目标。不同模型的 user/assistant 分隔符不同，必须从 tokenizer 的 chat template 或官方示例中确认 `instruction_part` 与 `response_part`，不能凭字符串猜测。

## 5. 评估：先证明它学会了，再讨论它变快了

至少保留三组结果：

| 对比对象 | 用途 |
| --- | --- |
| 基础模型在训练集上的输出 | 观察微调前的能力 |
| 微调模型在未见过的验证集上的输出 | 检查泛化能力 |
| 微调模型在真实失败样本上的输出 | 检查是否解决了实际问题 |

针对结构化任务，除了 loss，还应检查 JSON 解析成功率、字段完整率、业务规则通过率和事实准确性。针对客服或 Agent 任务，还要检查拒答边界、工具参数、引用证据和是否声称执行了不存在的操作。

建议把数据分成训练集、验证集和回归集：

```text
原始数据
  → 去重、脱敏、质量检查
  → 按用户 / 文档 / 会话分组切分
  → train：用于更新参数
  → validation：用于选择配置
  → regression：固定的历史失败案例
```

如果同一文档、同一用户会话或同一模板的近似副本同时出现在训练集和验证集，指标会被高估。微调前后的对比还应使用同一套评估数据、提示词和评分规则，否则无法判断提升来自模型，还是来自评价口径变化。

## 6. 训练结束后怎样部署？

最初可以只保存 LoRA adapter：基础模型保持不变，多个任务可以挂载不同 adapter，体积也更小。部署时有三种常见路径：

- 在 Transformers/Unsloth 中加载基础模型与 adapter，适合快速验证；
- 将 adapter 合并到基础模型后导出，再交给 vLLM 等服务框架；
- 转换为 GGUF，交给 llama.cpp、Ollama 或桌面工具运行。

推理前可以调用 Unsloth 的推理优化入口：

```python
from unsloth import FastLanguageModel

model, tokenizer = FastLanguageModel.from_pretrained(
    "outputs/adapter",
    max_seq_length=2048,
    load_in_4bit=True,
)
FastLanguageModel.for_inference(model)
```

具体的 adapter 加载、合并、GGUF 导出和 vLLM 参数应按目标模型与官方部署指南验证。发布记录至少应包含基础模型版本、adapter 版本、合并或量化方式、聊天模板、推理参数和评估报告。**训练产物能加载，不代表线上输出契约已经验证。**

## 实践建议

- 先用一个小模型和一小批高质量样本跑通加载、训练、保存、推理全链路，再扩大模型和数据规模。
- 将 RAG 解决的“知识更新”问题与微调解决的“行为和能力”问题分开，必要时组合使用。
- 把 chat template、Token 长度、训练/验证切分和 response-only masking 当成训练配置的一部分保存。
- 先用 QLoRA 建立质量基线，再根据准确率、吞吐和显存结果决定是否切换到 16-bit LoRA 或全参数微调。
- 不要只看训练 loss；用固定回归集比较基础模型、候选模型和最终部署格式的实际输出。
- 记录完整环境和产物摘要，避免“同一份代码，换一台 GPU 就无法复现”的情况。

Unsloth 的价值，是让大模型微调的第一次实验更容易发生，并让有限硬件能承载更长的上下文或更大的模型。真正可交付的微调系统，仍然需要高质量数据、可比评估、可追溯产物和经过验证的推理链路。

## 延伸阅读

- [Unsloth：Fine-tuning LLMs Guide](https://unsloth.ai/docs/get-started/fine-tuning-llms-guide.md)
- [Unsloth：Install via pip and uv](https://unsloth.ai/docs/get-started/install/pip-install.md)
- [Unsloth：LoRA Hyperparameters Guide](https://unsloth.ai/docs/get-started/fine-tuning-llms-guide/lora-hyperparameters-guide.md)
- [Unsloth：Inference & Deployment](https://unsloth.ai/docs/basics/inference-and-deployment.md)
- [Agent 工程：Evaluation、Testing 与 Observability](/notes/agent-engineering/10-agent-evaluation)
- [Agent 工程：RAG 工程](/notes/agent-engineering/06-rag-engineering)
