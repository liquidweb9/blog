# 联邦学习、密码系统安全与AI应用

## 第1章 联邦学习基础

### 1.1 FL基本流程

联邦学习（Federated Learning, FL）的核心思想是"数据不动模型动"——客户端在本地保存数据，仅上传模型更新。标准流程如下：

1. **服务器分发全局模型**：中央服务器将当前全局模型参数 $\mathbf{w}^{(t)}$ 分发给选中的 $K$ 个客户端
2. **客户端本地训练**：每个客户端 $k$ 在本地数据集 $\mathcal{D}_k$ 上训练，最小化局部损失：
   $$
   \mathcal{L}_k(\mathbf{w}) = \frac{1}{|\mathcal{D}_k|} \sum_{(\mathbf{x}, y) \in \mathcal{D}_k} \ell(\mathbf{w}; \mathbf{x}, y)
   $$
   更新 $\mathbf{w}_k^{(t+1)} \leftarrow \mathbf{w}^{(t)} - \eta \nabla \mathcal{L}_k(\mathbf{w}^{(t)})$
3. **上传更新**：客户端将 $\mathbf{w}_k^{(t+1)}$（或梯度 $\Delta \mathbf{w}_k$）加密上传
4. **服务器聚合**：服务器执行 FedAvg：
   $$
   \mathbf{w}^{(t+1)} = \sum_{k=1}^{K} \frac{n_k}{n} \mathbf{w}_k^{(t+1)}
   $$
   其中 $n_k = |\mathcal{D}_k|$，$n = \sum n_k$
5. **更新全局模型**：将聚合结果作为新一轮全局模型下发

**FedAvg 的数学细节**：
- 每轮通信中，每个客户端执行 $E$ 个 epoch 的本地 SGD（而非单步梯度下降）
- 设客户端 $k$ 的本地迭代次数为 $E \cdot \lceil |\mathcal{D}_k| / B \rceil$（$B$ 为 batch size）
- 本地更新可写为 $\mathbf{w}_k^{(t+1)} = \mathbf{w}^{(t)} - \eta \sum_{i=1}^{\tau_k} \tilde{\nabla} \mathcal{L}_k(\mathbf{w}^{(t,i)})$，其中 $\tau_k$ 为本地步数
- 聚合时权重按样本量 $n_k$ 加权，样本量越大的客户端对全局模型影响越大

### 1.2 FL分类

**横向联邦学习（Horizontal FL）**：各客户端数据拥有相同的特征空间但样本不同（如不同银行的用户数据，特征都是"年龄/收入/交易记录"）。适用于特征重叠大、样本不重叠的场景。聚合方式为 FedAvg。

**纵向联邦学习（Vertical FL）**：各客户端数据拥有相同的样本空间但特征不同（如同一城市的银行+电商+医院数据，用户ID重叠但特征互补）。需要实体对齐（Private Set Intersection），且因特征分布在不同方，需要更复杂的加密协议保护中间结果。

**联邦迁移学习（Federated Transfer Learning, FTL）**：客户端间样本和特征都不同，通过迁移学习在不同域之间传递知识。通常需要辅助对齐或公共表示空间。

**Cross-device FL**：海量移动设备（手机/IoT），每轮参与客户端数量大（数百到数千），设备异构性强，网络不稳定，通信代价高。每个设备通常只参与少量轮次。

**Cross-silo FL**：少量机构（医院/银行），每轮参与方数量少（2-100），设备算力和网络条件好，每个参与方反复参与。通信带宽不是主要瓶颈，安全性要求更高。

**去中心化FL（Decentralized FL）**：无中央服务器，客户端通过 P2P 网络交换模型更新。采用 Gossip 协议传播模型，每个节点聚合邻居更新。避免了单点故障和服务器作恶，但收敛分析更复杂，网络拓扑影响巨大。

### 1.3 典型聚合算法

**FedAvg**：加权平均，简单高效，对 IID 数据收敛好。聚合法为：
$$
\mathbf{w}^{(t+1)} = \sum_{k=1}^{K} \frac{n_k}{n} \mathbf{w}_k^{(t+1)}
$$

**FedProx**：解决 Non-IID 的客户端漂移问题。在本地损失中加入近端项（Proximal Term）：
$$
\min_{\mathbf{w}_k} \mathcal{L}_k(\mathbf{w}_k) + \frac{\mu}{2} \|\mathbf{w}_k - \mathbf{w}^{(t)}\|^2
$$
$\mu$ 控制本地模型偏离全局模型的程度，$\mu$ 越大本地更新越接近全局模型。允许不同客户端执行不同本地步数（不等量本地计算）。

**Scaffold**：使用方差校正（Variance Reduction）解决 Client Drift。服务器维护全局控制变量 $\mathbf{c}$，每个客户端维护本地控制变量 $\mathbf{c}_k$。客户端本地更新时进行校正：
$$
\mathbf{w}_k \leftarrow \mathbf{w}_k - \eta \left( \nabla \mathcal{L}_k(\mathbf{w}_k) - \mathbf{c}_k + \mathbf{c} \right)
$$
服务端更新 $\mathbf{c} \leftarrow \mathbf{c} + \frac{1}{K} \sum_k (\mathbf{c} - \mathbf{c}_k)$。Scaffold 在高度 Non-IID 下仍能快速收敛。

**个性化FL（Personalized FL）**：各客户端在共享基础层之上保留个性化层。常见方法：
- 全局模型做特征提取器，客户端在本地微调分类头
- 相似客户端聚类后再聚簇内模型
- 通过 Moreau 正则化学习个性化模型

**异步FL（Asynchronous FL）**：服务器不等待所有客户端完成，收到一个更新就聚合一次。容忍掉线和延迟，但会导致 staleness 问题（旧梯度影响当前模型）。常用权重衰减 $s(t - t_k)$ 削弱陈旧更新的影响。

### 1.4 Non-IID问题

**Label Skew（标签分布不同）**：各客户端数据中标签分布不同。例如各医院病人中健康/患病比例不同。FedAvg 在严重 Label Skew 下全局模型可能偏向多数标签。

**Feature Skew（特征分布不同）**：相同标签在不同客户端上的特征分布不同。如不同地区的手写数字书写风格不同。FedAvg 仍可收敛但速度下降。

**Quantity Skew（数据量差异）**：不同客户端持有不同数量的样本。大量零散的客户端（数据量极小）引入的噪声可能大于其贡献。

**Concept Drift（概念漂移）**：相同特征在不同客户端上对应不同标签。这是最具挑战性的 Non-IID 类型，例如同一症状在不同地区对应不同诊断。FedAvg 几乎必然失败，需要个性化或聚类方案。

**Client Drift（客户端漂移）**：各客户端从相同的全局模型出发，在本地数据上多步 SGD 后产生不同的局部最优方向。聚合后的全局模型可能陷入"矛盾方向"的折中。FedProx 和 Scaffold 专门针对此问题设计。

## 第2章 联邦学习安全威胁

### 2.1 隐私攻击

**梯度反演（Gradient Inversion）**：从梯度重建原始训练数据。给定模型参数 $\mathbf{w}$ 和梯度 $\mathbf{g} = \nabla \mathcal{L}(\mathbf{w}; \mathbf{x}, y)$，攻击者寻找：
$$
\mathbf{x}^*, y^* = \arg\min_{\mathbf{x}', y'} \| \nabla \mathcal{L}(\mathbf{w}; \mathbf{x}', y') - \mathbf{g} \|^2 + \mathcal{R}(\mathbf{x}')
$$
其中 $\mathcal{R}$ 是正则项（如 TV norm、自然图像先验）。Deep Leakage from Gradients (DLG) 首次证明从单个 batch 的梯度可以精确重建图像。

**数据重构（Data Reconstruction）**：在 batch size > 1 时仍可能重建，但难度指数级上升。改进方法包括利用 Batch Normalization 统计量、利用生成模型先验、利用标签信息。

**Membership Inference（成员推断）**：判断某个样本 $(\mathbf{x}, y)$ 是否在训练集中。攻击者利用模型对训练集和测试集的输出差异（如损失值较小或置信度较高说明可能是训练样本）。在 FL 中，攻击者可以观察到多次迭代的模型更新，增强推断能力。

**Property Inference（属性推断）**：推断训练集的全局统计量（如"该客户端数据中女性比例是否超过 50%"）。攻击者训练二元分类器判断某个属性是否存在。

**Model Inversion（模型反演）**：从模型参数恢复训练数据的代表性样本。例如从人脸分类模型恢复出训练集中某人的典型面部图像。对于生成模型（GAN/Diffusion）尤其严重——模型可能直接记住了训练样本。

### 2.2 完整性攻击

**Data Poisoning（数据投毒）**：攻击者控制部分训练数据，在其中注入恶意样本。例如标签翻转（Label Flipping）：将猫的图片标注为狗，使分类器对猫的分类能力下降。后门攻击中，攻击者在数据中添加特定触发器（如黄色方块）并将标签改为目标标签。

**Model Poisoning（模型投毒）**：攻击者直接修改上传的模型更新而非训练数据。在 Byzantine 攻击场景下，恶意客户端上传随机或精心构造的更新使全局模型发散或植入后门。

**Backdoor Attack（后门攻击）**：植入后门触发器，使模型在正常输入上表现正常，但遇到带触发器的输入时产生攻击者指定的输出。在 FL 中尤为隐蔽——后门任务与主任务相似，不影响主任务准确率，难以检测。后门可以是"语义后门"（如所有带绿色背景的图片都分类为"鹿"）或"数字后门"（特定像素模式）。

**Byzantine Client（拜占庭客户端）**：恶意客户端可以任意行为——发送错误更新、拒绝响应、发送伪造身份等。Byzantine 容错机制要求聚合算法在最多 $f$ 个恶意客户端存在时仍能保证收敛。

**Sybil Attack（女巫攻击）**：攻击者伪造大量身份（虚假客户端 ID），使恶意更新的权重通过数量优势压倒诚实更新。防御方案包括身份认证、计算信誉度、限制每轮参与方数量等。

**Free-rider Attack（搭便车攻击）**：不贡献真实更新却享受模型改进。攻击者上传随机噪声、复制其他客户端的更新或混合历史更新。检测方案包括检查更新与预期分布的偏离程度。

### 2.3 防御技术

**Secure Aggregation（安全聚合）**：服务器只能看到聚合后的结果 $\sum \Delta \mathbf{w}_k$，无法看到单个 $\Delta \mathbf{w}_k$。基于秘密共享（Shamir/TSS）或 DH 密钥协商+掩码。Bonawitz et al. 方案：每对客户端协商相同种子生成掩码，客户端 $i$ 上传 $\Delta \mathbf{w}_i + \sum_{j>i} \text{PRG}(s_{i,j}) - \sum_{j<i} \text{PRG}(s_{j,i})$，服务器求和后掩码抵消。

**差分隐私（Differential Privacy, DP）**：在更新中加入随机噪声，使任何单条数据对输出的影响有界。$(\epsilon, \delta)$-DP 定义：对任意相邻数据集 $\mathcal{D}, \mathcal{D}'$ 和任意输出集 $S$：
$$
\Pr[\mathcal{M}(\mathcal{D}) \in S] \leq e^\epsilon \cdot \Pr[\mathcal{M}(\mathcal{D}') \in S] + \delta
$$
在 FL 中，DP 可以在客户端级（保护整个客户端的所有数据）或样本级（保护每个样本）实施。

**安全多方计算（MPC）**：多个参与方联合计算一个函数，每方输入保密。在 FL 中，可以用 MPC 实现安全聚合，参与方通过秘密共享或混淆电路（Garbled Circuit）计算聚合结果。

**同态加密（Homomorphic Encryption, HE）**：允许在密文上进行计算，结果解密后等于明文计算的结果。在 FL 中，客户端将更新用服务器公钥加密上传，服务器聚合密文（Paillier 支持加法同态；BGV/BFV 支持加法和乘法；CKKS 支持浮点近似运算）。

**鲁棒聚合（Robust Aggregation）**：
- **Median**：逐坐标取中位数，抗 Byzantine 能力强但不敏感于数据分布
- **Trimmed Mean**：去掉最大和最小的 $k$ 个值后取平均
- **Krum**：选择与其他更新距离之和最小的更新作为全局更新
- **Bulyan**：Krum + Trimmed Mean 组合
- **Centered Clipping**：对每个更新做截断后聚合

**异常检测（Anomaly Detection）**：基于更新统计特征（norm、方向、cos 相似度）检测离群更新。可用 PCA 或 Autoencoder 学习正常更新的分布，将偏离分布的更新标记为异常。

**可验证训练（Verifiable Training）**：使用零知识证明（ZKP）或承诺机制让客户端证明训练过程的正确执行。但完整验证深度网络训练的计算代价极高。

**可信执行环境（TEE）**：在 CPU 的 Enclave 中执行训练或聚合，内存和寄存器对主机 OS 透明，硬件保证代码和数据不被篡改。Intel SGX/TDX、AMD SEV-SNP、ARM TrustZone。TEE 的问题是侧信道攻击和远程认证复杂性。

## 第3章 FedLLM

### 3.1 基本模式

**联邦预训练（Federated Pre-training）**：在分布各客户端的大规模无监督语料上预训练 LLM。每个客户端在本地文本上执行语言建模任务（NTP/MLM），上传梯度或更新。面临巨大的通信开销——GPT-3 参数量 175B，全量更新一次约 700GB（FP32）。

**联邦微调（Federated Fine-tuning）**：在预训练模型基础上，使用客户端本地标注数据进行下游任务微调。客户端通常没有能力或权限全量微调，需要参数高效微调。

**联邦指令微调（Federated Instruction Tuning）**：各客户端持有不同的指令-回答对，联邦训练使模型对齐人类指令。例如多家机构分别标注的医疗问答数据，在保护数据隐私的前提下联合训练。

**联邦对齐（Federated RLHF）**：将 RLHF 扩展到联邦场景。客户端本地训练 Reward Model 或提供人类反馈，服务器聚合偏好模型参数。挑战是奖励模型的异构性和偏好数据的隐私敏感性。

**联邦推理（Federated Inference）**：模型分布在多个客户端/服务器上，每层在不同设备上执行。可以保护模型权重（客户端看不到完整模型）或保护输入数据（服务器看不到用户输入）。Split Learning 是典型形式。

**联邦检索与知识更新（Federated RAG）**：在 RAG 场景下，知识库分布在不同客户端，需要隐私保护的检索（加密向量检索、PSI）。模型更新包括知识库更新和检索器微调。

### 3.2 主要挑战

**模型参数量巨大**：LLM 参数量从数十亿到数千亿，全量梯度上传的通信量不可承受。以 LLaMA-7B 为例，FP32 梯度约 28GB，即使每轮只有 100 个客户端也需 2.8TB 带宽。

**客户端算力差异**：手机端无法运行 7B+ 模型，服务器端可以运行 70B+ 模型。异构性需要弹性方案：大型客户端训练全部层/小型客户端只训练适配层。

**Tokenizer 与词表差异**：不同语言的 Tokenizer 不同，多语言场景下客户端间的词嵌入矩阵无法直接对齐聚合。解决方案包括共享 Tokenizer、在嵌入层做投影对齐。

**客户端掉线**：LLM 训练时间长（数小时到数天），客户端掉线概率高。异步 FL 和容错聚合是必要能力。掉线客户端的半成品更新如何处理（丢弃 vs 存储等待重连）。

**隐私泄露**：LLM 对训练数据的记忆能力更强，从模型更新或模型本身提取训练文本攻击更有效。文献证明 GPT-2 的训练文本可以被提取。FL 场景下攻击者可以通过梯度恢复用户输入的 prompt。

**模型版权与参数保护**：客户端参与联邦训练可获得模型更新，恶意客户端可以通过参数窃取重建核心模型。需要模型水印、参数加密、TEE 等措施。

### 3.3 参数高效微调（PEFT）

**Full Fine-tuning**：更新所有参数，通信量 = 模型大小 × 参数量。对于 LLM 几乎不可行。

**Adapter**：在 Transformer 每层插入小型瓶颈结构。每个 Adapter 包含 Down-Projection $\mathbf{W}_{\text{down}} \in \mathbb{R}^{d \times r}$ 和 Up-Projection $\mathbf{W}_{\text{up}} \in \mathbb{R}^{r \times d}$，中间是非线性激活：
$$
\mathbf{h} \leftarrow \mathbf{h} + f(\mathbf{h} \mathbf{W}_{\text{down}}) \mathbf{W}_{\text{up}}
$$
$r \ll d$，参数量约为 $2dr$，仅更新 Adapter 参数。

**Prefix Tuning**：在每层 Transformer 的 Key 和 Value 前拼接 $l$ 个可学习前缀向量 $\mathbf{P}_k, \mathbf{P}_v \in \mathbb{R}^{l \times d}$。前向时 Attention 的 Key/Value 变为 $[\mathbf{P}_k; \mathbf{K}], [\mathbf{P}_v; \mathbf{V}]$。Prefix 参数仅占模型参数的 0.1%~1%。

**Prompt Tuning**：仅在输入层前拼接 soft prompt $P \in \mathbb{R}^{l \times d}$，冻结所有预训练参数。更简单，但效果需要更长的 prompt 长度。在大模型上（>10B）效果与 full fine-tuning 相当。

**LoRA（Low-Rank Adaptation）**：对预训练权重矩阵 $\mathbf{W}_0 \in \mathbb{R}^{d \times k}$，用低秩分解表示更新：
$$
\mathbf{W} = \mathbf{W}_0 + \Delta \mathbf{W} = \mathbf{W}_0 + \mathbf{B} \mathbf{A}
$$
其中 $\mathbf{B} \in \mathbb{R}^{d \times r}$，$\mathbf{A} \in \mathbb{R}^{r \times k}$，$r \ll \min(d, k)$。训练时 $\mathbf{W}_0$ 冻结，仅 $\mathbf{A}, \mathbf{B}$ 可训练。前向计算：
$$
\mathbf{h} = \mathbf{W}_0 \mathbf{x} + \mathbf{B} \mathbf{A} \mathbf{x}
$$
通常对 Attention 的 $\mathbf{W}_q, \mathbf{W}_k, \mathbf{W}_v, \mathbf{W}_o$ 应用 LoRA。

**QLoRA**：将预训练权重量化到 4-bit（NF4 格式），LoRA 参数保持 FP16/BF16。通过分页优化器处理 GPU 显存不足。使 65B 模型微调可用单张 48GB GPU 完成。

**Low-rank Update Aggregation in FL**：在联邦 LoRA 中，客户端只上传 LoRA 矩阵 $\mathbf{A}_k, \mathbf{B}_k$（而非全量梯度），通信量从 $d \times k$ 降至 $r \times (d + k)$。使用 $r = 8$ 时通信量降低 100-1000x。服务器聚合：
$$
\overline{\mathbf{A}} = \sum_k \frac{n_k}{n} \mathbf{A}_k, \quad \overline{\mathbf{B}} = \sum_k \frac{n_k}{n} \mathbf{B}_k
$$
注意 $\overline{\mathbf{B}} \cdot \overline{\mathbf{A}} \neq \overline{\mathbf{B} \mathbf{A}}$（乘积的平均不等于平均的乘积），会引入非线性误差。各向异性聚合或数据加权聚合可缓解此问题。

## 第4章 LoRA与密码学的关系

### 4.1 LoRA的作用

LoRA 在密码学与联邦学习的交叉中扮演关键角色：

**通信压缩**：$\Delta \mathbf{W} = \mathbf{B} \mathbf{A}$ 将 $d \times k$ 的更新矩阵压缩为 $r(d+k)$ 个参数，$d=k=4096, r=8$ 时压缩比约 256×。这是 FL 中隐私保护协议（Secure Aggregation、HE、MPC）的关键使能技术——只有在通信量可接受时，这些加密协议的计算开销才变得可行。

**减少加密操作**：HE 的密文大小是明文的数十到数千倍，密文运算比明文慢 $10^5$-$10^6$ 倍。LoRA 大幅减少需要加密的参数数量，使 HE 聚合从理论上可行变为工程上可接受。

**结构不变性**：LoRA 保持了矩阵乘法的线性结构，与 Secure Aggregation（加法同态）、HE（加法同态）、MPC（加法秘密共享）天然兼容。加性秘密共享对 LoRA 矩阵可直接应用——客户端秘密共享 $\mathbf{A}_k$ 和 $\mathbf{B}_k$，服务器在密态下聚合。

### 4.2 LoRA不直接提供的能力

**不自动隐藏训练数据**：LoRA 只改变了训练参数量，梯度依然包含训练数据的信息。攻击者仍可以从 LoRA 梯度中重建训练样本。

**不自动保护梯度**：上传的 LoRA 梯度 $\nabla \mathbf{A}_k, \nabla \mathbf{B}_k$ 是明文，服务器可直接读取并实施梯度反演攻击。

**不自动抵抗成员推断**：LoRA 训练后的模型对训练样本的过拟合程度与传统微调类似，成员推断攻击照样有效。

**不自动防止恶意更新**：LoRA 更新同样可以被恶意客户端构造后门。恶意客户端可以在 LoRA 矩阵中植入后门，服务器若不检查，后门嵌入全局模型。

**不等同于差分隐私**：LoRA 不引入任何噪声，不提供任何可证明的隐私保证。

**不等同于安全聚合**：LoRA 不隐藏单个客户端的更新，服务器能看到每个 $\mathbf{A}_k, \mathbf{B}_k$。

### 4.3 隐私保护LoRA

**LoRA + Secure Aggregation**：客户端协商掩码，对 LoRA 矩阵 $\mathbf{A}_k, \mathbf{B}_k$ 加掩后上传。服务器聚合时掩码抵消，只能看到 $\sum \mathbf{A}_k$ 和 $\sum \mathbf{B}_k$，无法获取单个客户端的 LoRA 更新。

**LoRA + DP-SGD**：对 LoRA 梯度 $\nabla \mathbf{B} \mathbf{A}$（或 $\nabla \mathbf{A}, \nabla \mathbf{B}$ 分别）进行裁剪和加噪。注意裁剪的范数边界需要适应 LoRA 的结构——$\|\nabla \mathbf{A}\|_F$ 和 $\|\nabla \mathbf{B}\|_F$ 的尺度差异。

**LoRA + MPC**：客户端将 $\mathbf{A}_k, \mathbf{B}_k$ 做加法秘密共享分发给多个服务器（或做 Beaver Triple 辅助乘法聚合）。多服务器执行安全聚合，单个服务器无法恢复任何客户端的 LoRA 更新。

**LoRA + HE**：客户端用服务器公钥加密 $\mathbf{A}_k, \mathbf{B}_k$ 上传，服务器在密文上执行加法聚合后下发密文结果，客户端解密得到 $\sum \mathbf{A}_k, \sum \mathbf{B}_k$。需要支持向量加法的 HE 方案（Paillier/BFV/CKKS）。

**加密LoRA参数聚合问题**：$\overline{\mathbf{B} \mathbf{A}} \neq \overline{\mathbf{B}} \cdot \overline{\mathbf{A}}$ 是核心矛盾。聚合 LoRA 矩阵后，全局模型的更新是 $\overline{\mathbf{B}} \cdot \overline{\mathbf{A}}$，而理想聚合应该是所有客户端 $\mathbf{B}_k \mathbf{A}_k$ 的加权平均。这个"乘积 vs 聚合"的顺序问题会导致模型精度下降。解决方案包括：
- 聚合完整梯度而非 LoRA 参数（但失去通信优势）
- 在服务端用加权平均近似
- 使用各向异性聚合（不同客户端 LoRA 矩阵先对齐再聚合）

**LoRA更新的梯度泄露分析**：即使 LoRA 大大减少了参数量，对 $\nabla \mathbf{A}, \nabla \mathbf{B}$ 的梯度反演攻击仍然可能。$r$ 越小压缩越多但信息越少（反演更困难），$r$ 越大信息越多但反演更容易。$r$ 的选取需要在通信压缩和隐私泄露之间权衡。

## 第5章 FedLLM的完整安全架构

一个完整的 FedLLM 安全架构需要覆盖训练全流程的各个环节：

**客户端身份认证**：在 FL 中，确保参与方身份真实是安全的基础。使用 mTLS（双向 TLS）或基于证书的签名，防止 Sybil Attack。每个客户端持有唯一证书，服务器验证客户端身份并分配唯一 ID。

**通信加密（TLS/mTLS）**：所有客户端-服务器通信在 TLS 1.3 加密通道上进行。mTLS 在 TLS 基础上要求客户端也提供证书，实现双向认证。防止中间人攻击窃取或篡改模型更新。

**安全聚合（SecAgg/SecAgg+）**：服务器不能看到单个客户端更新。使用掩码协议或秘密共享实现安全聚合。SecAgg+ 支持容错（客户端掉线不影响聚合），使用 PRG 生成掩码并支持 dropout 客户端恢复。

**用户级差分隐私（User-level DP）**：保护整个客户端数据。对聚合后的全局更新添加高斯噪声：
$$
\tilde{\Delta} \mathbf{w} = \frac{1}{K} \sum_k \Delta \mathbf{w}_k + \mathcal{N}(0, \sigma^2 C^2 \mathbf{I})
$$
其中 $C$ 为裁剪阈值，$\sigma$ 由 $(\epsilon, \delta)$ 和客户端数量确定。使用 Rényi DP 或 Moments Accountant 跟踪隐私预算消耗。每轮消耗 $\epsilon$，总预算 $\epsilon_{\text{total}}$ 耗尽后停止训练。

**恶意更新检测**：在聚合前检查每个客户端的 LoRA 更新。检测方法包括：
- 更新范数异常检测（更新 norm 超出 3$\sigma$ 的标记为可疑）
- 更新方向一致性检查（使用余弦相似度，与多数方向偏差过大的标记）
- 使用历史更新的分布建模，检测离群值

**模型更新签名**：每个客户端对上传的更新进行数字签名（ECDSA/EdDSA）。服务器验证签名确保更新未被篡改、来自合法的客户端。签名绑定轮次 $t$ 和客户端 ID，防止重放攻击。

**可信执行环境（TEE）**：在 Enclave 中执行聚合，主机的操作系统也看不到聚合过程中的明文更新。Intel SGX 的 Enclave 内存加密保护聚合过程中的中间值。客户端可以通过远程认证（Remote Attestation）确认聚合运行在正确的 Enclave 代码中。

**聚合结果零知识证明（ZKP）**：服务器可以向客户端证明聚合结果 $\sum \Delta \mathbf{w}_k$ 的计算正确性，而不泄露原始更新。这对于公共验证和审计很重要。使用 bulletproofs 或 GKR 协议证明聚合计算正确执行。

**模型水印**：在全局模型中嵌入水印（Backdoor Watermark 或 Trigger Watermark），当水印输入产生指定输出时证明模型所有权。水印应该是鲁棒的（模型压缩、微调后仍可检测）且不可移除的。

**审计日志与隐私预算管理**：记录所有参与者行为日志（可以证明某方在某轮参与了训练）。维护隐私预算账本，每轮扣减 $\epsilon$，训练结束生成完整的隐私消耗报告。使用持久的分布式账本（如区块链）记录审计日志。

## 第6章 PKI与数字证书

### 6.1 证书体系

PKI（Public Key Infrastructure）是网络世界中可信身份管理的基础设施。核心组件是数字证书，将公钥绑定到持有者身份。

**Certificate Authority（CA，证书签发机构）**：受信任的第三方，负责验证申请者身份并签发证书。CA 签署证书时使用自己的私钥，证书绑定公钥、身份信息、有效期等。

**Root CA（根证书）**：自签名证书——CA 用自己的私钥签署自己的公钥。根证书是信任链的锚点，所有下级证书的信任最终追溯到根证书。操作系统和浏览器内置了约 100-200 个受信任的根证书。

**Intermediate CA（中间CA）**：根 CA 签署中间 CA 的证书，中间 CA 再签发终端实体证书。这样根 CA 的私钥可以离线存储（高安全性），日常签发用中间 CA。如果一个中间 CA 被攻破，根 CA 可以撤销它的证书而不影响其他中间 CA。

**X.509证书格式**：X.509 v3 证书包含：
- 版本号、序列号、签名算法标识
- 颁发者（Issuer）和主体（Subject）的 Distinguished Name
- 公钥信息（算法、公钥值）
- 有效期（notBefore, notAfter）
- 扩展项（密钥用途、基本约束、Subject Alternative Name 等）
- 颁发者的数字签名

**Certificate Chain（证书链验证）**：验证终端实体证书时，验证者需要：
1. 验证证书的签名（用颁发者的公钥）
2. 验证颁发者证书的签名（用上一级 CA 的公钥）
3. ...直到自签名的根证书
4. 检查证书有效期、撤销状态、密钥用途等扩展
5. 验证域名/IP 与证书中的 SAN（Subject Alternative Name）匹配

### 6.2 证书状态管理

**CRL（Certificate Revocation List，证书撤销列表）**：CA 定期发布的已撤销证书序列号列表。客户端下载 CRL 并检查要验证的证书是否在其中。问题：CRL 大小随撤销数量增长；下载 CRL 有延迟；CRL 发布间隔内撤销不实时。

**OCSP（Online Certificate Status Protocol，在线证书状态协议）**：客户端实时查询 CA 的 OCSP Responder，询问某个证书是否被撤销。响应是 signed 的，提供"good/revoked/unknown"状态。OCSP Stapling 将 OCSP 响应嵌入 TLS 握手，减少客户端的查询开销和隐私泄露（客户端不必暴露访问的网站）。

**Certificate Transparency（CT，证书透明度）**：CA 签发的每个证书必须提交到公共日志服务器。日志服务器发布 Merkle Tree 的 Signed Tree Head（STH），任何人都可以验证日志的 append-only 属性。浏览器要求公开可信的 SSL 证书必须出现在 CT 日志中，防止 CA 签发恶意证书不被发现。CT 通过 SCT（Signed Certificate Timestamp）嵌入证书或 TLS 握手。

**自签名证书（Self-signed Certificate）**：自己签发给自己，不经过 CA。用于内部网络、开发环境、设备身份等场景。问题是没有第三方担保，信任基需要通过其他方式建立（如首次使用时指纹验证、预先部署信任锚）。在 FL 场景中，自签名证书可用于小规模内部部署的客户端身份。

## 第7章 密钥管理

### 7.1 密钥生命周期

密钥管理的核心挑战是如何确保密钥在整个生命周期中的安全。生命周期包括以下阶段：

**密钥生成（Key Generation）**：安全性从根本上取决于密钥的随机性。CSPRNG（Cryptographically Secure Pseudo Random Number Generator）从熵源获取种子，产生不可预测的密钥序列。熵源质量是关键——硬件随机数发生器（HRNG）使用物理过程（热噪声、量子效应）；操作系统熵池收集硬件中断时间等随机事件。低熵导致的悲剧性后果包括 Android Java SecureRandom 初始化不当导致的比特币钱包被破解。

**密钥分发（Key Distribution）**：将密钥传递给授权方，确保不被窃听或篡改。带外分发（面对面交付、信任的快递员）安全但低效；协议内分发（通过密钥协商协议如 Diffie-Hellman）灵活且可扩展。在 FL 中，客户端公钥可以通过证书分发。

**密钥存储（Key Storage）**：密钥在存储时必须以密文形式保护。存储方式分级：
- HSM（Hardware Security Module）：密钥永不离开硬件，通过 API 调用执行密码操作。FIPS 140-2 Level 3/4。适用于高安全需求场景（CA、KMS 后端）
- 加密文件：密钥文件用主密钥加密（Master Key 来自用户口令或 HSM）。例如 OpenSSL 的 PEM 文件带密码保护
- 内存短期存储：密钥临时驻留在进程内存中，需防止 core dump 和 side-channel 泄露

**密钥轮换（Key Rotation）**：定期更换密钥限制泄露损失。每次轮换生成新密钥，旧密钥继续用于解密已有数据（但不再用于加密新数据）。轮换周期由业务风险决定。

**密钥撤销（Key Revocation）**：密钥泄露或人员变动时需要撤销。在 PKI 中通过 CRL/OCSP 实现；在对称密码中需要通知所有持有方。撤销后需要安全销毁密钥并重新分发。

**密钥销毁（Key Destruction）**：确保密钥不可恢复。软件销毁：覆写内存和磁盘（多次覆写或安全擦除命令）。硬件销毁：HSM 有自毁机制（检测到篡改时擦除密钥）。在 FL 中，训练结束后需要安全销毁客户端和服务器上的临时密钥材料。

### 7.2 关键基础设施

**KDF（Key Derivation Function，密钥派生函数）**：从一个主密钥（或口令）派生出多个子密钥，不同子密钥用于不同用途。HKDF（HMAC-based Key Derivation Function）是标准化的 KDF，分两步：
1. **Extract**：从非均匀的输入密钥材料（IKM）中提取伪随机密钥（PRK）：
   $$
   \text{PRK} = \text{HMAC-Hash}(\text{salt}, \text{IKM})
   $$
1. **Expand**：从 PRK 派生出所需长度的子密钥：
   $$
   T(1) = \text{HMAC-Hash}(\text{PRK}, \text{info} || 0x01)
   $$
   $$
   T(i) = \text{HMAC-Hash}(\text{PRK}, T(i-1) || \text{info} || 0x0i)
   $$
   $$
   \text{OKM} = T(1) || T(2) || \dots || T(\lceil L/\text{HashLen} \rceil)
   $$
   info 参数用于 Domain Separation——"TLS 1.3 handshake traffic secret"和"TLS 1.3 application traffic secret"是不同的 info。

**Envelope Encryption（信封加密）**：用 KEK（Key Encryption Key）加密 DEK（Data Encryption Key），DEK 加密实际数据。用户持有 KEK，加密后的 DEK（称为 Wrapped DEK）随密文数据一起存储。解密时先用 KEK 解出 DEK，再用 DEK 解密数据。这样 KEK 使用频率很低（仅数据加密/解密时才需要），DEK 可以频繁轮换而不影响 KEK。KMS 的核心架构就是 Envelope Encryption。

**KMS（Key Management Service，密钥管理服务）**：集中管理密钥的创建、存储、轮换、撤销和审计。提供 API 生成密钥、加密 DEK、解密 DEK（但不暴露明文 KEK）。AWS KMS / Azure Key Vault / HashiCorp Vault 是典型实现。在 FL 中，KMS 可用于管理客户端身份密钥和 HE 密钥。

**HSM（Hardware Security Module，硬件安全模块）**：专用硬件设备，密钥在安全芯片内生成和存储，外部无法读取。提供加密/解密/签名/认证等操作的硬件加速。FIPS 140-2 / Common Criteria EAL 认证。在 PKI 中，CA 的私钥存储在 HSM 中；在支付系统中，PIN 加密密钥存储在 HSM 中。在 FL 中，HSM 可以保护服务器聚合密钥和 CA 签名密钥。

## 第8章 安全通信协议

### 8.1 TLS握手

TLS 1.3 相比 1.2 最大的改进是握手延迟从 2-RTT 降为 1-RTT（初次）或 0-RTT（重连），并移除了不安全算法。

**TLS 1.3 握手流程（完整握手）**：

```
ClientHello
  - 支持的密码套件（TLS_AES_128_GCM_SHA256 等）
  - key_share：客户端 DH 公钥
  - supported_versions: 1.3
  - signature_algorithms
  - (可选) pre_shared_key 模式

ServerHello
  - 选定的密码套件
  - key_share：服务器 DH 公钥
  - (可选) encrypted_extensions

服务器发送 Certificate + CertificateVerify + Finished
  - Certificate：服务器证书链
  - CertificateVerify：对握手摘要的签名（证明拥有证书私钥）
  - Finished：HMAC 握手摘要

客户端发送 Certificate (可选) + CertificateVerify + Finished

开始加密应用数据
```

**密钥派生**：在 TLS 1.3 中，密钥通过 HKDF-Expand-Label 从 (EC)DHE 共享密钥派生：
```
early_secret = HKDF-Extract(0, PSK)
handshake_secret = HKDF-Extract(DHE, early_secret)
master_secret = HKDF-Extract(0, handshake_secret)
```
每阶段派生出 traffic keys（client/server handshake traffic keys, client/server application traffic keys）。

**密钥协商**：使用 (EC)DHE（椭圆曲线 Diffie-Hellman 交换），提供前向安全性。支持 X25519（Curve25519）和 P-256/P-384。客户端在 ClientHello 中发送多个 key_share 候选，服务器选择支持的曲线。

**身份认证**：通过 X.509 证书和 CertificateVerify 消息实现。CertificateVerify 签名覆盖到当前为止的所有握手消息，确保握手完整性。

### 8.2 安全性质

**AEAD（Authenticated Encryption with Associated Data）**：同时提供机密性（加密）和认证（MAC），且比"Encrypt-then-MAC"更高效。常用的 AEAD 方案：
- AES-256-GCM：AES 在 GCM 模式下加解密，GMAC 作为认证标签。优点是硬件加速（AES-NI），缺点是 nonce 重复即灾难
- ChaCha20-Poly1305：流密码 ChaCha20 + 认证器 Poly1305。无硬件加速但软件实现高效，在移动端比 AES-GCM 更快
GCM 中 E(K, nonce, plaintext) 得到 ciphertext + tag，解密的先决条件是 tag 验证通过。

**Forward Secrecy（前向安全）**：长期密钥泄露不会导致历史会话密钥暴露。在 TLS 1.3 中，每次握手都生成独立的 (EC)DHE 密钥对，会话密钥由 ephemeral DH 和长期证书共同派生。即使服务器的长期签名私钥泄露，攻击者也只能验证证书，无法解密被记录的历史流量。所有密文数据搭配 ephemeral DH 共享密钥计算。

**Replay Protection（防重放）**：接收方检测并丢弃已处理过的消息。TLS 1.3 使用序列号（每个方向独立的递增序列号）作为 GCM nonce 或 ChaCha20 nonce 的一部分。序列号超出窗口的消息被丢弃。0-RTT 数据由于没有交互过程，天然面临重放风险。

**0-RTT 风险**：客户端可以在重连时直接发送加密数据（首次握手的 PSK 导出的密钥加密）。但 0-RTT 数据可以被重放——攻击者截获 0-RTT 数据后可以多次提交给服务器。因此 0-RTT 请求必须是幂等的（多次执行效果与一次相同），如只读查询。TLS 1.3 通过 0-RTT 的 max_early_data_size 限制数据量，但仍建议应用层处理重放检测。

## 第9章 密码协议设计原则

### 9.1 核心原则

**不要自行发明密码算法**：密码算法经过数十年密码分析和审查才被认为是安全的。像 AES、ChaCha20、SHA-3、Curve25519 等算法是大量顶级密码学家集体智慧的成果。自行设计的算法几乎一定存在致命弱点。

**Domain Separation（域分离）**：不同协议或上下文中必须使用不同的密钥派生路径。如果"协议 A 的加密密钥"和"协议 B 的加密密钥"通过不同 info 标签派生，即使 A 的密钥泄露，B 的密钥也不受影响。具体做法是在 KDF 的 info 参数以及哈希计算中加入域名/协议标识/角色标识。示例：TLS 1.3 的 HKDF-Expand-Label 中，label 格式为 "tls13 " + 特定字符串，确保跨协议不可重用。

**Nonce唯一性**：任何 (nonce, key) 对不能重复使用。对于 AES-GCM，同一 (key, nonce) 加密不同消息会导致认证密钥泄露；对于 ChaCha20-Poly1305，密钥流重复；对于 OTP，一次性密钥加密两次就是灾难。nonce 可以是：随机数（足够大的空间保证碰撞概率可忽略）、计数器（需要持久化状态）、基于当前时间的值（但时钟回拨问题）。

### 9.2 设计规范

**防重放（Replay Protection）**：消息中加入时间戳（需要时钟同步）或序列号（需要状态同步）或 challenge-response 交互。在协议层次上，接收方需要维护一个滑动窗口，拒绝窗口外的消息。在 FL 通信中，每次更新带上轮次编号 $t$ 和客户端随机数，服务器检查轮次匹配且未处理过。

**Transcript Binding（会话绑定）**：将完整的会话消息摘要（transcript hash）绑定到关键密码操作中，防止双方对会话中间状态的理解不一致。TLS 1.3 的 CertificateVerify 签名覆盖握手摘要，Finished 消息也绑定握手的完整状态。

**Context Binding（上下文绑定）**：将协议上下文信息（角色、会话 ID、协议版本、时间戳）绑定到加密操作中。例如在密钥派生时加入角色标记 "client" vs "server"，使双方的通信密钥不同向。

**密钥分离（Key Separation）**：不同用途使用不同密钥。加密密钥≠MAC密钥≠签名密钥≠派生密钥。一个密钥只用于一个算法、一个目的。如果加密和 MAC 使用同一密钥，可能被攻击者利用来构造伪造消息。

**Encrypt-then-MAC 顺序**：加密和认证的顺序至关重要。推荐 Encrypt-then-MAC：先加密后计算 MAC。这样接收方先验证 MAC，MAC 验证失败就不解密，避免 padding oracle 攻击。MAC-then-Encrypt（先 MAC 后加密）允许攻击者分析密文长度判断 MAC 结果的正确性。TLS 1.2 的 Cipher Block Chaining (CBC) 模式配合 MAC-then-Encrypt 导致了一系列 padding oracle 攻击（如 POODLE）。

**Fail Closed（失败关闭）**：任何异常情况、解析错误、验证失败都拒绝访问，而非降级或开放。对于解密失败、签名验证失败、证书过期等情况，协议应立即终止连接并返回错误，而不是尝试降级到不安全模式。

**Algorithm Agility（算法敏捷性）**：协议应支持算法切换和版本升级，并防止降级攻击。通过版本协商、密码套件列表的方式实现。但算法敏捷性也是双刃剑——降级攻击正是利用了"回退到旧版本"的能力。TLS 1.3 通过 supported_versions 扩展和降级保护（每次版本协商时在 ServerHello 中嵌入降级 SCSV 信号）防止攻击者强制回退。

## 第10章 形式化安全分析

### 10.1 分析方法

**Security Game（安全游戏）**：定义攻击者的目标和能力。安全证明通过游戏序列（Game Hopping）证明攻击者无法以不可忽略的概率获胜。以 IND-CPA 安全为例：
1. 挑战者生成密钥 $k \leftarrow \text{KeyGen}(1^\lambda)$
2. 攻击者选择两条等长消息 $m_0, m_1$
3. 挑战者随机选择 $b \in \{0,1\}$，返回 $\text{Enc}(k, m_b)$
4. 攻击者输出猜测 $b'$，获胜当 $b' = b$
方案是 IND-CPA 安全的当 $\Pr[b' = b] \leq \frac{1}{2} + \text{negl}(\lambda)$

**Symbolic Model（符号模型）**：将密码原语视为理想黑盒——加密完美隐藏消息、签名不可伪造、哈希无碰撞。用符号推理（如 Dolev-Yao 模型）验证协议的逻辑正确性。攻击者可以拦截/重放/篡改/删除消息，但不能破解理想密码原语。工具：ProVerif、Tamarin、Scyther。

**Computational Model（计算模型）**：考虑具体困难假设（DDH、LWE、SRSA）和攻击者的计算能力。安全证明显式地依赖计算假设和可忽略函数。例如，证明"如果 DDH 假设成立，则 ElGamal 是 IND-CPA 安全的"。工具：Cryptoverif、EasyCrypt。

### 10.2 分析性质

**Protocol State Machine（协议状态机建模）**：将协议参与方的行为建模为有限状态机，状态是消息收发和内部变量，转移是收到消息时的处理逻辑。形式化验证探索所有可能的状态转移路径，检测死锁、断言失败、不安全状态。

**Trace Property（迹性质）**：协议执行的迹（trace）是消息事件的有序序列。迹性质包括：
- 认证（Authentication）：每次接受消息时，发送者确实发送过该消息
- 保密性（Secrecy）：秘密值不会出现在公开信道中
- 完整性（Integrity）：消息在传输中未被篡改

**Equivalence Property（等价性质）**：判断两个协议迹是否不可区分。用于建模匿名性、不可链接性、隐私保护。例如，消息发送者的匿名性意味着：包含发送者 A 的迹与包含发送者 B 的迹在观察者看来不可区分。工具用 diff-equivalence 验证。

**Authentication/Secrecy Property**：认证是"某人发送了某消息"，通常用 correspondence 断言形式化——"如果 Bob 接受了消息 m，那么确实存在 Alice 发送了 m 的事件"。保密性是"恶意者不知道某值"，在符号模型中用"秘密值不出现在恶意者的知识中"表达。

**Universal Composability（UC，通用可组合性）**：由 Canetti 提出的框架，目标是保证协议在任意环境中组合执行仍然安全。UC 安全证明协议模拟理想功能（Ideal Functionality），"现实协议"的执行应与"理想世界"不可区分。UC 安全协议可以安全地与其他协议并发执行。相比独立安全分析，UC 保证更强但也更难证明。

## 第11章 侧信道攻击

### 11.1 攻击类型

**Timing Attack（计时攻击）**：通过测量操作执行时间来推断秘密数据。如果某个算法分支依赖于秘密值（如密码比对的逐字符比较），执行时间会泄露秘密信息的渐进信息。例如，Kocher 在 1996 年首次展示了对 RSA 的计时攻击——模幂操作时间与密钥位相关，通过统计测量可以恢复私钥。

**Cache Attack（缓存攻击）**：通过测量缓存命中/未命中模式推断受害进程使用的数据。Prime+Probe：攻击者填充缓存行（Prime），等待受害进程执行，然后测量哪个缓存行被加载（Probe）。基于 Flush+Reload 的攻击可以恢复 AES 查找表的索引，从而恢复密钥字节。

**Power Analysis（功耗分析）**：
- **SPA（Simple Power Analysis）**：直接从单条功耗轨迹中观察操作序列。例如，RSA 模幂中"平方"和"平方+乘法"在不同密钥位上有不同功耗特征，直接读取密钥
- **DPA（Differential Power Analysis）**：统计多个功耗轨迹的差异。将功耗与中间值的某个比特的预测关联，用统计测试（如 t-test）恢复密钥。对 AES、DES 等对称密码极其有效，通常只需要数百到数千条轨迹

**Electromagnetic Attack（电磁攻击）**：测量设备运行时产生的电磁辐射，与功耗分析原理类似但可以局部化（探针对准芯片特定区域采集信号）。频率成分分析可以分离不同模块的电磁信号。

### 11.2 防御

**Constant-time Programming（常数时间编程）**：消除所有数据依赖的分支和内存访问，使执行时间和访问模式与秘密数据无关。原则：
- 不使用 `if(secret)` 条件分支，用数学运算替代（如 bit masking）
- 不使用 secret 作为数组索引（避免 cache 泄露）
- 加密/解密操作固定循环次数（不提前退出）
- 使用 CPU 提供的常数时间指令（如 AES-NI 的 AESENC）

关键技巧示例—常数时间的字节比较：
```c
int constant_time_memcmp(const void *a, const void *b, size_t n) {
    const unsigned char *pa = a, *pb = b;
    unsigned char result = 0;
    for (size_t i = 0; i < n; i++)
        result |= pa[i] ^ pb[i];
    return result; // 0 表示相等
}
```

**分支预测泄露**：即使使用恒定操作时间，条件分支的分支预测模式也可能泄露秘密。在 Spectre 攻击中，攻击者训练分支预测器，然后强制预测错误使受害者执行越界内存访问，通过缓存侧信道泄露结果。

**内存访问模式泄露**：即使加密算法本身是常数时间，内存分配模式、数据结构访问顺序、缓存行加载顺序都可能泄露信息。OS 层面的侧信道（如 page fault 分析）也能推断秘密 — 即使用 SGX 也不能完全抵抗。

## 第12章 故障攻击

### 12.1 注入方法

**Fault Injection（故障注入）**：通过物理手段在计算过程中引入错误，观察错误输出以推断秘密信息。典型的故障模型是单比特翻转（Single Bit Flip）或单字节故障。

**Voltage/Clock Glitch（电压/时钟毛刺）**：短暂降低供电电压或超过额定时钟频率，使芯片在特定指令处出错。电压过低导致晶体管建立时间不够，时钟过快导致信号来不及稳定。可控性强（可以精确定位到某条指令），但需要物理接触。常用于嵌入式设备破解。

**Laser Fault（激光故障注入）**：用激光照射芯片的特定区域（通过芯片背面或正面），局部改变晶体管状态。精度极高——可以定位到单个晶体管或寄存器。需要解封装（去除芯片封装层），设备昂贵但效果最好。

### 12.2 分析方法

**Differential Fault Analysis（DFA，差分故障分析）**：收集正确输出和故障输出，通过差分分析恢复密钥。对 AES 的 DFA：在第 9 轮或第 10 轮的 MixColumns 之前注入单字节故障，正确输出与错误输出的差分可以约束密钥空间。通常 1-2 个故障注入可以将密钥空间缩小到可穷举的范围。

**CRT-RSA故障攻击**：RSA 使用中国剩余定理加速签名/解密：
$$
s_p = m^{d \bmod (p-1)} \bmod p, \quad s_q = m^{d \bmod (q-1)} \bmod q
$$
$$
s = \text{CRT}(s_p, s_q)
$$
如果 $s_p$ 或 $s_q$ 中一个计算错误（如电压毛刺导致），得到错误签名 $s' \neq s$。那么：
$$
\gcd(m - s'^e \bmod N, N) = p
$$
单次故障即分解 N。这是最著名的故障攻击之一，也是为什么 RSA 实现必须做签名验证（签名后再用公钥验证结果的正确性）和冗余检查。

## 第13章 实现错误

### 13.1 随机数问题

**弱随机数（Weak RNG）**：熵不足导致密钥可预测。案例：2012 年 Bitcoin 大量私钥被破解因为使用了 Android 上的 SecureRandom 的早期实现，初始化时熵不足。Debian OpenSSL 漏洞（2008）：Valgrind 报告未初始化内存警告，开发者"修复"为移除了熵源调用，导致 OpenSSL 密钥生成只用 PID（可预测）。

**Nonce复用（Nonce Reuse）**：AES-GCM 的 nonce 重复使用会导致认证密钥泄露。具体来说，使用同一 (key, nonce) 加密两条不同消息，攻击者可以直接计算认证密钥 $H$。两次密文和标签分别为 $(C_1, T_1)$ 和 $(C_2, T_2)$，攻击者可以解方程得到 $H$。WiFi 的 WPA2 协议曾因为 nonce 重用（TKIP 的 IV 重用）而被彻底攻破。

**IV重复（IV Reuse in Stream Cipher）**：流密码产生密钥流 $k = \text{Stream}(K, IV)$，加密 $C = P \oplus k$。如果 IV 重复，$C_1 \oplus C_2 = P_1 \oplus P_2$，两条明文异或结果直接暴露，语言分析可恢复完整明文。Microsoft PPTP 的 CHAP 认证协议曾因 IV 生成错误导致密码验证信息泄露。

### 13.2 常见漏洞

**Padding Oracle（填充提示攻击）**：PKCS#7 填充模式中，解密失败和填充验证失败给出不同的错误信息，攻击者可以逐字节猜测明文。POODLE（2014）：TLS 1.0 中使用 CBC 模式 + MAC-then-Encrypt，攻击者通过修改密文观察服务器是否暴露出填充错误，恢复明文。防御：不区分"解密失败"和"MAC 失败"的错误信息，始终返回通用错误。

**密钥硬编码**：密钥直接写在代码中，通过二进制反编译即可提取。常见于 IOT 设备和移动 App。防御：密钥存储在安全硬件（如 Android Keystore、iOS Secure Enclave）中，通过 API 使用而不直接暴露。

**密钥日志泄露**：调试日志中打印密钥、中间值。在日志聚合系统（ELK）中可能被大量人员访问。防御：生产环境禁止密钥日志；日志脱敏处理；使用密钥引用而非密钥值。

**错误处理泄露**：返回不同错误信息（如"解密失败"vs"MAC 验证失败"）帮助攻击者区分解密阶段。在 Lucky13 攻击中，攻击者利用 CBC-MAC 解密的时序差异（填充正确时 MAC 验证耗时略长）恢复明文。防御：统一错误信息；常数时间错误处理。

**编码不一致（Encoding Mismatch）**：同一数字签名在不同编码下的安全漏洞。例如，X.509 证书的字符串编码不一致（BMPString vs PrintableString）导致同一个证书的不同签名存在。一个著名的例子是 MD5 证书碰撞攻击，利用编码差异构造同签名不同内容的证书。

**密文可塑性（Ciphertext Malleability）**：无认证加密（如 CTR 模式、CBC 模式不配合 MAC）允许攻击者修改密文，导致解密出可预测的明文修改。经典攻击：修改 CTR 模式密文的某字节，解密后相应位置的明文被翻转 XOR($\Delta$)。防御：始终使用 AEAD（认证加密）。

**版本降级攻击**：攻击者强制客户端和服务器使用较低版本协议，利用旧版协议的已知漏洞。例如，攻击者修改 ClientHello 中的 supported_versions 字段（或删除 TLS 1.2+ 的支持），强制使用 TLS 1.0。TLS 1.3 通过降级保护机制（在 ServerHello 中添加特殊标记）使服务器在降级时发出可检测的信号。

## 第14章 协议攻击

### 14.1 攻击类型

**Replay Attack（重放攻击）**：攻击者截获合法消息后重新发送，使接收方重复处理该消息。例如身份认证场景中"我是 Alice"的重放。防御：在消息中加入 nonce（一次性随机数）或时间戳，接收方检查 nonce 是否已被使用或时间戳是否在窗口内。在 FL 场景中，每轮更新的 nonce 包含轮次编号 + 客户端随机数。

**MITM（Man-in-the-Middle，中间人攻击）**：攻击者同时与通信双方建立连接，传递篡改后的消息。在 TLS 中，如果客户端不验证服务器证书（或证书无效时仍然继续），MITM 攻击者可以插入自己的证书，解密并转发通信。防御：强制证书验证、公钥固定（Certificate Pinning）、双向 TLS（mTLS）。

**Reflection Attack（反射攻击）**：攻击者将接收到的消息反射回发送者。例如，在 challenge-response 认证中，攻击者让发送者对自己进行认证——"证明你是 Alice"的 challenge 被反射回 Alice，Alice 给出 response，攻击者用这个 response 向原始验证者证明身份。防御：在协议中包含方向标识（"这是从 A 到 B 的消息"），使发送者和接收者的角色不可互换。

**Unknown Key-share Attack（未知密钥共享攻击）**：A 认为自己与 B 建立了共享密钥，但实际上该密钥是与 C 共享的。C 使 A 相信她在和 B 通信，同时 C 用自己与 A 的密钥冒充 A 与 B 通信。防御：在密钥派生时绑定双方身份的哈希（如 $\text{KDF}(g^{ab}, \text{"A"} || \text{"B"}))$。

### 14.2 高级攻击

**Downgrade Attack（降级攻击）**：攻击者干扰版本协商过程，强制双方使用较弱的安全算法。如前述的 TLS 降级。在 FL 中，攻击者可以降级客户端使用的加密强度（如从 HE 降级到明文），然后窃取更新。防御：在协商消息上使用签名或 MAC，验证协商结果的一致性。

**Cross-protocol Attack（跨协议攻击）**：一个协议中使用的密钥材料在另一个协议中被利用。例如，RSA 签名密钥和 RSA 加密密钥使用同一密钥对，攻击者可以让签名预言机加密某消息，或让解密预言机签名某哈希。防御：严格的密钥分离——不同算法和不同目的使用不同密钥，Domain Separation 标签区分。

**Key Confusion（密钥混淆）**：同一密钥用于不同目的。例如，将本应用于加密的 AES 密钥用于 CMAC 认证，攻击者可以利用 AES 加密预言机构造 CMAC 的碰撞。防御：密钥分离——"One key, one purpose"。

**Oracle Attack（预言机攻击）**：攻击者利用协议提供的密码原语（解密、签名、MAC 验证）作为"预言机"来获取秘密信息。Bleichenbacher 攻击：利用 RSA PKCS#1 v1.5 的 padding oracle（服务器返回"padding 正确"或"padding 错误"），攻击者解密任意密文。一次完整的 Bleichenbacher 攻击需要约 100 万次查询。TLS 1.3 移除了 RSA PKCS#1 v1.5 加密。

## 第15章 隐私保护训练

### 15.1 训练架构

**MPC训练（安全多方计算训练）**：多个参与方在不泄露各自数据的前提下联合训练模型。常用方案：
- 加法秘密共享 + Beaver Triple 辅助乘法：参与方将数据/梯度拆分为秘密份额，每方拥有随机份额，运算时通过交互收集计算结果
- Garbled Circuit（混淆电路）：双方安全计算适用于布尔电路，训练深度网络时电路规模爆炸
- SPDZ 协议族：支持恶意安全的 MPC，预处理阶段生成 Beaver Triple，在线阶段只需加法通信
MPC 训练的核心开销在安全乘法（秘密共享乘法需要通信和随机数预处理）。每层网络的正向和反向传播都需要大量安全乘法。

**HE训练（同态加密训练）**：在密文上执行梯度下降，以密文形式更新模型参数。服务器只处理密文，无法知道参数值。
- Leveled HE（BGV/BFV/FHEW/TFHE）：支持多次乘法，但噪声增长限制了计算深度。神经网络的多层非线性激活函数在 HE 上极其困难
- CKKS：支持浮点近似运算，适合神经网络。但激活函数（ReLU/Sigmoid）需要多项式逼近，精度受限
HE 训练迄今主要适用于线性模型和浅层神经网络（2-3层）。对于深度网络，HE 的计算开销是不可接受的——一次密文乘法比明文慢 $10^6$ 倍。

**TEE训练（可信执行环境训练）**：在 Enclave 中执行训练。数据在 Enclave 内解密，CPU 保证主机 OS 无法访问 Enclave 内存。GPU 场景下，NVIDIA Confidential Computing（CC-Suite）允许 GPU 内存加密。TEE 的优势是不需要修改训练算法，性能开销远低于 HE/MPC（<5%）。挑战：侧信道攻击、远程认证基础设施、信任硬件厂商、TEE 内存限制。

**联邦学习（数据本地化）**：数据不出客户端，只交换模型/梯度。这是前面几章的主要内容。FL 是隐私保护训练中实用度最高的方案，但需要在密码学保护下才能抵御半诚实服务器。

**DP-SGD（差分隐私随机梯度下降）**：在每个梯度更新中加入噪声。步骤：
1. 对 batch 中每个样本计算梯度 $\nabla \ell_i$
2. 每个梯度裁剪到范数 $C$：$\bar{\nabla} \ell_i = \nabla \ell_i / \max(1, \|\nabla \ell_i\|_2 / C)$
3. 加入高斯噪声：$\tilde{g} = \frac{1}{B} (\sum_i \bar{\nabla} \ell_i + \mathcal{N}(0, \sigma^2 C^2 \mathbf{I}))$
4. 应用更新：$\mathbf{w} \leftarrow \mathbf{w} - \eta \tilde{g}$
使用 Moments Accountant 或 Rényi DP 精确计算隐私消耗。

**Split Learning（分割学习）**：将网络层分割，每方持有部分层。典型架构：客户端持有底层特征提取器，服务器持有顶层分类器。前向时客户端提取特征（中间表示）传给服务器，反向时服务器传回梯度到 cut layer。Split Learning 保护了原始数据（服务器只看到中间表示），但中间表示仍可能泄露信息（通过特征重建攻击）。

### 15.2 混合架构

| 方案 | 隐私强度 | 计算开销 | 通信开销 | 精度影响 | 适用场景 |
|:---|:---|:---|:---|:---|:---|
| FL-only | 弱（梯度泄露） | 低 | 中 | 无 | 非敏感数据 |
| FL+DP | 中（统计隐私） | 低 | 中 | 有 | 医疗/金融 |
| FL+SecAgg | 中（隐藏更新） | 中 | 高 | 无 | 跨设备 |
| FL+HE | 强（加密聚合） | 高 | 极高 | 无 | 跨孤岛 |
| FL+MPC | 强（秘密共享） | 高 | 极高 | 无 | 多方计算 |
| TEE | 强（硬件隔离） | 低 | 低 | 无 | 云部署 |
| Split Learning | 中 | 低 | 中 | 无 | 边缘推理 |
| MPC训练 | 强 | 极高 | 极高 | 无 | 小模型 |
| HE训练 | 强 | 极高 | 高 | 有 | 线性模型 |

混合架构实践：
- HE+FL：高安全跨机构 FL，小批量加密聚合
- MPC+DP：更强的隐私（MPC 保护通信，DP 保护输出）
- TEE+FL：服务器端使用 TEE 执行聚合和训练
- FL+LoRA+DP+SecAgg：实际落地最多的 FedLLM 架构

## 第16章 隐私保护推理

### 16.1 推理方案

**HE推理（同态加密推理）**：客户端加密输入 $E(\mathbf{x})$ 发送给服务器，服务器在密文上运行模型后返回 $E(f(\mathbf{x}))$，客户端解密得到结果 $f(\mathbf{x})$。
- 方案选择：CKKS 是首选（支持浮点逼近运算）
- 计算复杂度：密文矩阵乘法 $O(n^3)$，每个乘法深度增长线性，需要 bootstrapping 控制噪声
- 典型延迟：CKKS 单层 MLP（2层）在 256 维输入上约几秒，ResNet-50 约数十分钟
- 激活函数限制：ReLU 需要多项式逼近（如 $x^2$, $x^3$ 的低次近似或 min/max 逼近），逼近误差影响精度

**MPC推理（安全多方计算推理）**：输入和模型权重都以秘密共享形式分布在各方（或多台服务器）。执行安全矩阵乘法和安全激活函数。
- 秘密共享矩阵乘：$\mathbf{X} \mathbf{W} = \sum_{i,j} X_i \cdot W_j$，每个乘法需要 Beaver Triple
- 比较运算（ReLU）在布尔电路上执行，开销大
- 通信轮次与网络深度线性相关（每层需要交互）
- 延迟：百毫秒到秒量级（取决于网络深度和带宽）

**TEE推理（可信执行环境推理）**：在 Enclave 中运行推理。用户通过远程认证确认 Enclave 的正确性后，发送加密输入，Enclave 解密、推理、加密输出。延迟极低（接近明文推理），不需要修改模型。适用于对延迟敏感的场景（如实时推荐）。挑战是 GPU 场景的 TEE 仍然处于早期（NVIDIA CC 正在解决）。

**Client-aided推理（客户端辅助推理）**：利用客户端的计算能力分担部分计算。例如：底层在客户端明文执行，上层在服务器密文执行。降低服务器的 HE/MPC 负载。典型例子是在 HE 推理中，客户端持有私钥参与部分解密（如交互式推理协议）。

### 16.2 隐私分类

**模型隐私**：保护模型权重 $\mathbf{W}$ 不被客户端获取。在推理中，客户端可能从模型参数中提取知识（模型窃取）。解决方案：
- HE 推理中，客户端看不到模型参数
- TEE 推理中，模型在 Enclave 内，客户端无法直接读取
- MPC 推理中，服务器端的秘密份额组合仍不能恢复完整模型

**输入隐私**：保护用户输入 $\mathbf{x}$ 不被服务器看到。这是最简单的推理隐私需求——服务器只处理密文输入。
- HE 推理天然提供输入隐私（服务器只看到 $E(\mathbf{x})$）
- MPC 推理中，客户端输入以秘密共享形式存储

**输出隐私**：推理结果 $f(\mathbf{x})$ 只返回给授权方。很多场景要求结果也不被服务器看到（特别是医疗诊断、财务评估）。HE 推理中，结果密文只有客户端能解密。MPC 推理通过秘密共享保证结果的机密性。

| 方案 | 模型隐私 | 输入隐私 | 输出隐私 | 延迟 | 通信量 |
|:---|:---|:---|:---|:---|:---|
| HE推理 | ✓（模型明文但只在服务器） | ✓（输入密文） | ✓（结果只有客户端解密） | 高(秒-分钟) | 高 |
| MPC推理 | ✓（模型秘密共享） | ✓（输入秘密共享） | ✓（结果秘密共享） | 中(百毫秒-秒) | 极高 |
| TEE推理 | ✓（Enclave内不可读） | ✓（输入在Enclave解密） | ✓（输出在Enclave加密） | 低(毫秒) | 低 |
| 明文推理 | ✗（服务器明文处理） | ✗ | ✗ | 低(毫秒) | 低 |

## 第17章 可验证机器学习

### 17.1 验证类型

**推理正确性证明**：客户端需要确信服务器返回的推理结果是正确计算的。服务器用 ZKP（零知识证明）证明：
$$
\{( \mathbf{x}, \mathbf{W}, \mathbf{y}) \mid \mathbf{y} = f_{\mathbf{W}}(\mathbf{x}) \}
$$
不泄露 $\mathbf{W}$ 或 $\mathbf{x}$ 的情况下证明 $\mathbf{y}$ 是正确结果。对于神经网络，需要将推理过程编码为算术电路（或 R1CS），然后生成证明。

**模型版本证明**：服务器向客户端证明模型确实是某个特定版本，没有被替换为旧版本或恶意版本。使用对模型权重的承诺（如 Merkle Root 或 Pedersen Commitment）：
$$
C_{\mathbf{W}} = \text{Commit}(\mathbf{W})
$$
客户端验证 $\mathbf{y} = f_{\mathbf{W}}(\mathbf{x})$ 且 $\mathbf{W}$ 匹配承诺 $C_{\mathbf{W}}$。

**数据承诺（Data Commitment）**：训练数据集的完整性证明。通过 Merkle Tree 对训练集建立承诺，叶节点是每个样本的哈希。可以证明某个样本确实属于训练集（Merkle 证明），或者证明训练过程中使用的数据未经篡改。

**Training Proof（训练证明）**：证明训练过程正确执行，即模型 $\mathbf{W}^{(T)}$ 确实是通过 SGD 从 $\mathbf{W}^{(0)}$ 在数据集 $\mathcal{D}$ 上 $T$ 步迭代得到的。这是一个极难的问题——每条梯度需要证明，导致证明规模极大。思路包括：
- 只验证最后几轮的梯度（牺牲可证安全性换取效率）
- 使用 SNARK 递归聚合验证多轮训练
- 分布式训练中的验证（多个验证者交叉检查）

### 17.2 zkML

**zk-SNARK/STARK 应用于 ML 推理验证**：将模型推理过程编码为 R1CS/Plonkish/代数中间表示，生成证明证明执行正确性。当前最前沿的 zkML 项目：
- **ezkl**：将 ONNX 模型编译为 Halo2 电路，支持推理验证
- **Modulus**（NVIDIA）：将 ML 模型转换为 STARK 证明
- **Giza**：ZK 机器学习框架，支持 CNN、Transformer

**Verifiable Inference**：完整的可验证推理流程：
1. Server 将模型权重 $\mathbf{W}$ 的承诺 $C_{\mathbf{W}}$ 公开发布
2. Client 提交 $\mathbf{x}$（或加密的 $\mathbf{x}$），Server 计算 $\mathbf{y} = f_{\mathbf{W}}(\mathbf{x})$
3. Server 生成证明 $\pi$：存在 $\mathbf{W}$ 使得 $\text{Commit}(\mathbf{W}) = C_{\mathbf{W}} \land \mathbf{y} = f_{\mathbf{W}}(\mathbf{x})$
4. Client 验证 $\pi$ 接受 $\mathbf{y}$

**模型量化与电路化**：浮点运算在 ZK 电路中极昂贵（加法和乘法在有限域中，浮点数需要定点量化）。步骤：
1. 将模型量化为 INT8 或 INT16（线性量化 $x_q = \text{round}(x / s + z)$）
2. 将 ReLU、BN 等操作转为加法/乘法电路
3. 优化电路规模（剪枝、蒸馏、低秩分解）
4. 生成证明（处理非线性层如 Softmax 用多项式逼近）
量化精度与证明成本的权衡：INT4 电路最小但精度损失大，INT16 精度高但电路规模翻倍。

## 第18章 大模型安全与密码技术

### 18.1 隐私保护

**Prompt隐私**：用户输入的 prompt 可能包含敏感信息（病历、合同、身份证号）。需要确保 prompt 在传输和处理过程中不被泄露。方案包括客户端加密 prompt、TEE 推理、HE 推理。

**上下文隐私**：对话历史中的多轮内容同样敏感。在持续对话中，需要通过协议保证前文内容的隐私。提示词注入（Prompt Injection）也属于上下文安全范畴——恶意 prompt 试图越狱模型或提取系统提示，密码学无法直接防御但可以保障模型推理过程的完整性。

**RAG数据库隐私**：外部知识库可能包含机密文档。检索时，用户的查询暴露给知识库管理者；知识库可能通过检索结果影响模型输出。方案是加密向量检索——用户查询被加密后在密文域执行相似度搜索，知识库管理者不知道查询内容。使用 CKKS 相似度计算或 MPC 距离计算。

**模型参数保护**：大模型的参数是巨大的知识产权。在推理服务中，需要防止用户提取模型参数。HE/MPC 推理可以防止参数泄露（服务器只暴露计算能力而非权重）。模型水印可以追踪参数泄露的来源。

**API查询隐私**：调用方不希望暴露自己的意图（查询的主题、频率）。方案：
- Oblivious HTTP（OHTTP）：将查询内容与身份分离
- Private Information Retrieval（PIR）：从数据库获取记录而不暴露请求
- 匿名凭证 + TEE：不暴露调用者身份

### 18.2 关键技术

**加密向量检索（Encrypted Vector Search）**：在加密数据库上执行 kNN 搜索。查询向量 $\mathbf{q}$ 被加密为 $E(\mathbf{q})$，存储在服务端的向量 $\mathbf{v}_i$ 也加密为 $E(\mathbf{v}_i)$。计算加密距离：
$$
E(\|\mathbf{q} - \mathbf{v}_i\|^2) = E(\mathbf{q} \cdot \mathbf{q}) - 2E(\mathbf{q}) \cdot E(\mathbf{v}_i) + E(\mathbf{v}_i \cdot \mathbf{v}_i)
$$
CKKS 支持一次性向量加密（SIMD 打包），一次计算数百维向量。HE 的距离计算返回加密距离，服务器不能确定距离值（需要排序时问题更复杂——HE 上的比较运算极慢）。改用近似最近邻搜索的 MPC 化方案（如 MPC-friendly 的 HNSW 或 LSH）。

**PSI（Private Set Intersection，私有求交）**：两方各自持有集合，在不泄露非交集元素的前提下计算交集。用于纵向联邦学习中的实体对齐。PSI 基于：
- 不经意伪随机函数（OPRF）：一方对输入应用 OPRF，另一方有 OPRF 密钥，交集判断转化为 OPRF 值的匹配
- 公钥加密 + Bloom Filter：用加法同态加密实现交集计算，通信量与较小集合大小成比例
大规模 PSI（百万级）需要优化：Sort-Compare-Shuffle (Circuit PSI) 或基于 OT 的协议。

**安全聚合（Secure Aggregation）**：已在前面章节详述。在 FL 中，安全聚合确保聚合过程中的客户端更新隐私。

**联邦LoRA**：结合 LoRA 和 FL，客户端只上传 LoRA 矩阵，通信量大幅降低，使加密聚合（HE/SecAgg）成为可能。

**DP微调**：在 LLM 微调过程中添加差分隐私。在 LLM 上应用 DP 带来挑战：
- 模型参数量大导致隐私预算随维度增大
- 预训练模型已经包含大量先验知识，DP 噪声破坏适配效果
- PEFT（LoRA）+ DP 是当前主流方向——只对 LoRA 参数加噪，受保护参数空间小（$r(d+k)$ vs $d \times k$）

**可验证大模型推理（Verifiable LLM Inference）**：证明 LLM 推理过程的正确性。由于 LLM 规模巨大（数十亿参数），直接生成 SNARK 证明是一个计算挑战。当前进展：
- 稀疏证明：证明某些层或子网络的正确性（替代完整证明）
- 增量验证：多轮对话中验证每一轮的推理延续
- 承诺验证 + 随机抽查：不生成完整证明，通过多个验证者的随机挑战确保正确性
- 利用模型蒸馏：用小模型验证大模型输出的合理边界

## 第19章 技术比较

### 19.1 MPC、HE、TEE与ZKP比较

| 维度 | MPC | HE | TEE | ZKP |
|:---|:---|:---|:---|:---|
| 数据持有方 | 多方 | 单方（加密数据交给计算方） | 数据方（数据进入Enclave） | 证明方（Prover） |
| 计算执行方 | 多方（交互计算） | 计算方（密文上运算） | 计算方（Enclave内明文） | 验证方（不参与计算） |
| 交互性 | 在线阶段需要交互 | 无需交互（非交互式操作） | 无需交互 | 一次性交互（证明-验证） |
| 硬件依赖 | 无 | 无 | 需要TEE CPU | 无 |
| 正确性 | 协议保证 | 正确性保证 | 信任硬件 | 数学保证 |
| 输入隐私 | ✓ | ✓ | ✓（Enclave解密） | ✗（Prover可见输入） |
| 模型隐私 | ✓ | ✓ | ✓（Enclave内） | ✓（不泄露Witness） |
| 通信成本 | 高（每轮交互） | 低（一次上传，密文） | 低（一次上传，加密） | 中（证明大小因方案而异） |
| 计算成本 | 高（安全乘法） | 极高（密文运算） | 低（接近明文） | 高（证明生成） |
| 参与方数 | 2-数十（大量交互代价高） | 2（加密方-计算方） | 2（用户+Enclave） | 2（Prover-Verifier） |
| 恶意安全 | 支持（SPDZ, BMR) | N/A（加密数据被动保护） | 硬件可信基 | 主动/被动都可 |
| 典型延迟 | 秒-分钟 | 分钟-小时 | 毫秒-秒 | 秒-分钟（证明生成） |

**选型建议**：
- 高吞吐低延迟 → TEE
- 双方安全计算且需绝对正确性保证 → MPC
- 客户端加密、服务端计算、一次交互 → HE
- 可验证性需求（验证而非隐私）→ ZKP
- 混搭：HE+ZKP（加密计算 + 可验证性）、TEE+MPC（硬件可信的多方计算）

### 19.2 ABE、PRE、FE与广播加密比较

| 维度 | ABE | PRE | FE | 广播加密 |
|:---|:---|:---|:---|:---|
| 授权粒度 | 属性/策略级别 | 用户级别（委托） | 函数级别 | 用户级别（群组） |
| 密钥发行方 | 属性授权机构(AA) | 委托方/代理 | 密钥授权中心 | 广播者/TA |
| 密钥托管 | AA持有主密钥 | 用户/代理持有 | KGC持有主密钥 | TA持有主密钥 |
| 用户撤销 | 属性更新/属性撤销 | 委托撤销 | 密钥更新 | 私钥更新 |
| 密文大小 | 随属性数线性 | 固定 | 随输入大小相关 | O(log N) 或 O(√N) |
| 合谋抵抗 | 用户不能组合属性 | 代理和用户不能合谋 | 用户不能组合函数能力 | 非授权用户不能解密 |
| 策略表达 | 属性策略/访问结构 | 部分委托 | 函数 f | 用户集 |

**CP-ABE（Ciphertext-Policy ABE）**：密文关联访问策略（如 "(医生 AND 内科) OR (主任)"），密钥关联属性（如 {医生, 内科}）。解密当且仅当属性满足策略。ABE 基于双线性配对（Bilinear Pairing $e: G_1 \times G_2 \rightarrow G_T$）。

**PRE（Proxy Re-Encryption）**：代理持有 re-encryption key $rk_{A \rightarrow B}$，将用 A 公钥加密的密文转换为 B 公钥可解密的密文，不泄露底层明文。用于加密数据转发、去中心化存储。

**FE（Functional Encryption）**：密钥 $sk_f$ 允许计算密文 $E(m)$ 上的函数 $f(m)$，不泄露 $m$ 的其他信息。比 ABE 更强大——ABE 只支持 "能否解密"，FE 支持任意函数。但 FE 的构造更困难，目前主要支持内积函数（Inner Product FE）。

**广播加密（Broadcast Encryption）**：发送者用一个密文对 $N$ 个用户中的 $S$ 个授权用户广播，非授权用户无法解密。使用树结构管理子集覆盖（Subset Cover）实现对数级密文大小。典型应用：付费电视、DRM。

### 19.3 密码学隐私与差分隐私比较

**密码学隐私**关注的是计算过程中输入、中间结果、通信是否泄露给参与方或外部观察者。保证的是"没有人能看到你的数据"。

**差分隐私**关注的是输出结果能否暴露某条记录是否存在。保证的是"即使有人公开看到了结果，也无法确定你是否参与了训练"。

| 维度 | 密码学隐私（SMPC/HE） | 差分隐私 |
|:---|:---|:---|
| 保护对象 | 计算过程中的数据、中间值、通信 | 输出的统计泄露 |
| 攻击模型 | 半诚实/恶意参与方、外部窃听 | 任意辅助信息、任意后处理 |
| 保证类型 | 计算过程安全（Process Privacy） | 输出结果安全（Output Privacy） |
| 精度影响 | 无（精确计算） | 有（噪声引入偏差） |
| 计算开销 | 极大（加密/交互） | 极小（加噪） |
| 组合性 | 可组合（UC） | 可组合（Post-processing, Adaptive） |
| 后处理攻击 | 不直接防御（A正确聚合但结果可被分析） | 自动免疫（后处理不影响DP） |

**二者互补**：
- MPC + DP：MPC 保护计算过程，DP 保护聚合结果。在联邦学习中最经典的组合——安全聚合（MPC）防止服务器看单更新，差分隐私防攻击者从全局模型做成员推断
- Secure Aggregation + DP：SeecAgg 隐藏中间通信，DP 防输出侧攻击。二者结合提供全程隐私保护
- HE + DP：HE 保护加密计算过程，DP 确保即使解密结果也不泄露个体
- FL + DP：FL 保证数据不离开客户端，DP 保证模型参数不记忆个体

**关键洞察**：密码学隐私和差分隐私不是二选一，而是分层防御的两个层面。密码学解决"过程安全"（数据不能被看到），DP 解决"结果安全"（数据不能被反向推断）。真正的隐私保护系统需要二者的结合。

### 19.4 联邦学习与密码学的边界

澄清一些常见的误解：

**FL本身不是加密协议**：FL 只是一种分布式训练架构，通信内容可以明文发送。在没有密码学保护时，中央服务器可以看到每个客户端的梯度。

**FedAvg不保证梯度隐私**：FedAvg 只是模型参数的加权平均，没有加密成分。从 FedAvg 的梯度中可以反推出训练数据。

**LoRA不保证训练数据隐私**：LoRA 减少通信量但不改变梯度的信息含量。$r$ 越小压缩越多，但泄漏仍然存在。

**Secure Aggregation只隐藏单个更新**：即使使用 Secure Aggregation，服务器无法看单个客户端的更新，但仍能看到最终聚合结果。聚合结果可能被用于成员推断、属性推断等攻击。

**DP提供统计隐私但影响模型效用**：DP 加噪会降低模型准确率，需要在隐私预算和模型质量之间权衡。$\epsilon$ 越小隐私越好但精度越低。

**HE/MPC保护计算过程但不能单独阻止最终模型泄露**：即使训练过程完全在 HE/MPC 保护下执行，最终的模型仍然可能泄露训练数据。例如，模型过拟合的程度不变，成员推断攻击仍有效。

**总结**：密码学保护的是"谁在计算中看到了什么"；联邦学习改变的是"模型在哪里训练"；差分隐私改变的是"输出中包含多少个人信息"。三者正交互补，构建安全系统需要结合使用，认清每层的保护边界和盲点。

## 第20章 实验与工程实践

### 20.1 基础密码实验

以下代码仅供教学理解，**绝不可用于生产环境**：

**模幂运算**（方乘算法）：
```
def mod_pow(base: int, exp: int, mod: int) -> int:
    result = 1
    base = base % mod
    while exp > 0:
        if exp & 1:
            result = (result * base) % mod
        base = (base * base) % mod
        exp >>= 1
    return result
```

**扩展欧几里得**（求模逆）：
```
def egcd(a: int, b: int):
    if b == 0: return (a, 1, 0)
    g, x1, y1 = egcd(b, a % b)
    return (g, y1, x1 - (a // b) * y1)

def mod_inv(a: int, mod: int) -> int:
    g, x, _ = egcd(a, mod)
    if g != 1: raise ValueError("not invertible")
    return x % mod
```

**RSA教学**：密钥生成 $p,q \rightarrow N=pq,\  \phi(N)=(p-1)(q-1),\  ed \equiv 1 \pmod{\phi(N)}$。加密 $c = m^e \bmod N$，解密 $m = c^d \bmod N$。$r=2048+$ 位才安全。

**Diffie-Hellman**：Alice $a$ 发送 $g^a$，Bob $b$ 发送 $g^b$，共享密钥 $g^{ab}$。安全依赖于 CDH 假设。实际使用椭圆曲线变种 ECDH。

**Schnorr识别协议**：Prover 选随机 $r$ 发送 $t=g^r$，Verifier 发送 challenge $c$，Prover 回复 $s=r+cx$（$x$ 为私钥）。验证 $g^s = t \cdot y^c$（$y=g^x$ 为公钥）。零知识性源于 $c$ 随机且不可预测。

**Shamir秘密共享**：将秘密 $s$ 拆分为 $n$ 份，任意 $t$ 份可恢复。多项式 $f(x)=s + a_1 x + \dots + a_{t-1} x^{t-1}$，份额为 $(i, f(i))$。通过 Lagrange 插值恢复：
$$
s = \sum_{j=1}^{t} f(i_j) \cdot \prod_{k \neq j} \frac{-i_k}{i_j - i_k}
$$

**Merkle Tree**：叶节点为数据块哈希，内部节点为孩子哈希拼接后的哈希。根为 Merkle Root。验证成员关系只需 $\log n$ 个节点证明路径。

**Pedersen Commitment**：$C(m,r) = g^m h^r$。绑定：找不到 $(m', r') \neq (m,r)$ 使得 $C(m', r') = C(m,r)$（基于离散对数假设）。隐藏：给定 $C$，没有 $r$ 无法获取 $m$ 的信息。

### 20.2 MPC实验

**百万富翁问题**（Yao's Protocol）：Alice 和 Bob 各自有数字 $a, b$，想比较 $a > b$ 而不泄露 $a, b$。使用 Garbled Circuit：
1. Alice 为每条线生成密钥对 $(K^0_i, K^1_i)$
2. 为每个门生成混淆真值表（用输入线密钥加密输出线密钥）
3. Alice 将混淆电路和她的输入密钥发给 Bob
4. Bob 通过 OT（Oblivious Transfer）获取他的输入密钥
5. Bob 评估电路得到输出

**秘密共享求和**：$n$ 方秘密共享向量 $\mathbf{v}_i$，求 $\sum \mathbf{v}_i$。每方将份额随机化后发送给一个 Combiner，Combiner 本地求和即得结果。

**Beaver Triple乘法**：提前生成共享的 Beaver Triple $([a], [b], [c])$ 满足 $c = a \cdot b$。在线阶段：
1. 各方本地计算 $[e] = [x] - [a]$, $[f] = [y] - [b]$
2. 揭示 $e, f$（明文）
3. 各方本地计算 $[z] = [c] + e \cdot [b] + f \cdot [a] + e \cdot f$
核心：只要 Triple 生成正确，乘法结果正确且不泄露 $x, y$。

**安全比较**：将数值转为二进制表示的 Boolean 秘密共享，用混淆电路或 Garbled Circuit 比较。逐位比较电路：
```
bitwise_compare(a, b):
    gt = False, eq = True
    for i from high to low:
        gt |= eq & a_i & ~b_i
        eq &= (a_i == b_i)
    return gt
```

**安全线性回归**：秘密共享梯度更新。每轮：(1) 安全乘法计算 $\mathbf{X}^T \mathbf{X} \mathbf{w}$；(2) 安全计算 $\mathbf{X}^T \mathbf{y}$；(3) 更新 $\mathbf{w}$。使用 Beaver Triple 实现所有乘法。

**安全神经网络推理**：将网络各层转化为安全计算电路。ReLU 通过比较电路实现，Softmax 通过多项式逼近 + 安全除法。实际工程中使用 MP-SPDZ 或 CrypTen 框架。

### 20.3 HE实验

**Paillier加法同态**：公钥 $(N,g)$，私钥 $\lambda$。
- 加密：$c = g^m r^N \bmod N^2$，$r$ 随机
- 同态加法：$c_1 \cdot c_2 \bmod N^2 = E(m_1 + m_2)$
- 明文数乘：$c_1^k \bmod N^2 = E(k \cdot m_1)$

**BFV整数运算**：RLWE 基础，消息在多项式环 $R_t = \mathbb{Z}_t[x]/(x^n+1)$ 中。
- 每个密文是 $(c_0, c_1)$ 两个多项式
- 加法：$(c_0'+c_0'', c_1'+c_1'')$
- 乘法：密文大小指数增长 → 需要 Relinearization（密钥交换）缩小到 $(c_0, c_1)$
- 需要 Rescaling 控制噪声

**CKKS向量运算**：SIMD 风格打包——一个密文包含一个向量，一次运算处理所有元素。编码（Encoding）将浮点向量编码为多项式（使用 Canonical Embedding + 缩放），加密后执行运算。CKKS 支持定点近似运算，适合神经网络。

**密文矩阵乘法**：多个向量打包后执行旋转（Rotate）+ 内积累加。利用 GHS 方法（Galois 自同构实现旋转）：
1. 将矩阵 $M$ 拆分为行向量，加密为 $n$ 个密文（或用一个密集文打包整个矩阵）
2. 向量与密文的行做 Hadamard 乘积
3. 使用旋转 + 累加（Sum of Rotations）得到点积

**线性模型推理**：在 HE 上计算 $\mathbf{y} = \mathbf{W} \mathbf{x} + \mathbf{b}$。每个神经元对应一次密文乘法和加法。

**多项式激活函数**：ReLU 在 HE 上无法直接实现（需要比较操作）。代替方案：
- 平方函数 $x^2$（简单但只适合正或负值的单调激活）
- Chebyshev 多项式逼近（在区间 $[-1,1]$ 上逼近 ReLU）
- 低次多项式 $0.125x^2 + 0.5x + 0.25$ 等

**噪声预算分析**：CKKS 的每个乘法消耗噪声预算（乘法深度）。深度 $\times$ 乘法系数决定需要多少 Level。Level 耗尽后需要 Bootstrapping（E[self 恢复噪声预算]）。Bootstrapping 成本约为同深度乘法的 10-50 倍。

### 20.4 ZKP实验

**Schnorr零知识证明**（非交互式版本）：
```
Prover:
  1. 选择随机 r, 计算 t = g^r
  2. 计算挑战 c = H(g, y, t)
  3. 计算 s = r + c*x (mod q)
  输出 (t, s)

Verifier:
  1. 计算 c' = H(g, y, t)
  2. 验证 g^s == t * y^c'
```

**Fiat-Shamir非交互化**：将交互式零知识证明转换为非交互式签名。用 hash $H$ 生成 challenge $c$ 替换 Verifier 的随机选择。安全性在随机预言机模型（Random Oracle Model）下证明。

**范围证明（Range Proof）**：证明 $x \in [0, 2^n)$ 而不泄露 $x$。Bulletproofs 方案：将 $x$ 表示为二进制 $a_1, \dots, a_n$，证明每位是 0 或 1 且 $x = \sum 2^{i-1} a_i$。证明大小对数级 $O(\log n)$。

**Merkle成员证明**：证明一个 leaf 是 Merkle Tree 的成员：
```
Proof: (path_nodes[0..d-1], path_directions[0..d-1])
Verifier: h = leaf
  for i in 0..d:
    if direction[i] == left: h = hash(path_nodes[i], h)
    else: h = hash(h, path_nodes[i])
  check h == root
```

**简单R1CS电路**：R1CS（Rank-1 Constraint System）形式 $A \mathbf{s} \cdot B \mathbf{s} = C \mathbf{s}$，其中 $\mathbf{s}$ 是 witness 向量。例如证明"我已知 $x$ 满足 $x^3 + x + 5 = 35$"：
```
s = [one, x, out, v1, v2]
constraints:
  v1 = x * x:    (0,1,0,0,0)·(0,1,0,0,0) = (0,0,0,1,0)
  v2 = v1 * x:   (0,0,0,1,0)·(0,1,0,0,0) = (0,0,0,0,1)
  out = v2 + x + 5: (0,1,0,0,1) + (5,0,0,0,0) * one = (0,0,1,0,0)
```
最后一个约束用线性组合而非 R1CS 表达。

**模型推理正确性证明**：将神经网络每层转化为 R1CS 约束。每层矩阵乘法产生 $O(d_k \cdot d_{k+1})$ 个约束，ReLU 产生 $O(d_{k+1})$ 个约束（通过比较电路）。对于 ResNet-50 约 25M 参数，约束数约 $10^9$——使用 zk-SNARK 生成证明耗时数十分钟，验证毫秒级。

### 20.5 联邦学习隐私实验

**FedAvg基线**：
```
1. Server 初始化 w0
2. for each round t:
   a. Server 选择 K 个客户端
   b. 每个客户端 k: wk = LocalTrain(wt, Dk)
   c. Server: wt+1 = sum(nk/n * wk)
```

**梯度泄露实验**：用简化的梯度反演攻击验证梯度的信息泄露。在 MNIST 上训练两层 CNN，从梯度中重建图像：
```python
# 攻击者重构输入
x_g = torch.randn_like(x).requires_grad_(True)
optimizer = torch.optim.LBFGS([x_g], lr=0.1)
for i in range(100):
    def closure():
        optimizer.zero_grad()
        # 计算假梯度
        loss = model(x_g).sum()
        grad_fake = torch.autograd.grad(loss, model.parameters())
        # 最小化梯度差异
        grad_diff = sum((g_f - g_r).pow(2).sum() for g_f, g_r in zip(grad_fake, grad_real))
        grad_diff.backward()
        return grad_diff
    optimizer.step(closure)
```

**安全聚合模拟**：用 Shamir 秘密共享模拟 3-out-of-5 安全聚合。每个客户端将更新拆分为 5 份，发送给 5 个服务器。任意 3 个服务器可以恢复聚合结果。

**DP-SGD实验**：在 MNIST 上实现 DP-SGD。测试不同 $\epsilon$（0.1, 1, 10, 100）下的模型准确率变化。观测 $\epsilon$ 越小，准确率下降越明显。

**联邦LoRA实验**：在 FL 场景下用 LoRA 微调 BERT/RoBERTa 做文本分类。比较全量联邦微调与联邦 LoRA 的通信量和准确率差异。固定 $r=8$ 时通信量降低约 300×，准确率损失在 1% 以内。

**恶意客户端模拟**：模拟标签翻转攻击、后门攻击对联邦训练的影响。使用 Krum、Median、Trimmed Mean 防御，比较不同 attack ratio 下的模型性能变化。

**Robust Aggregation比较**：在 Non-IID 数据上模拟 Byzantine 客户端（随机更新），对比 FedAvg、Median、Krum、Trimmed Mean、Bulyan 的收敛速度和准确率。Krum 在少于 50% 恶意客户端时有效。

**隐私-准确率-通信成本权衡**：设计实验对比不同方案的三维 Pareto front：
| 方案 | 隐私（DP ε） | 准确率 | 通信量/轮 |
|:---|:---|:---|:---|
| 明文FL | 无 | 95% | 1x |
| DP-SGD ε=8 | 8 | 93% | 1x |
| DP-SGD ε=1 | 1 | 88% | 1x |
| SecAgg | 无（隐藏更新） | 95% | 3x |
| SecAgg+DP | 1 | 88% | 4x |
| HE聚合 | 无（加密计算） | 95% | 50x |
| FL+LoRA | 无 | 94% | 0.01x |
| FL+LoRA+DP+SecAgg | 1 | 87% | 0.1x |

## 第21章 阅读密码论文的统一框架

### 21.1 分析框架

阅读每篇密码论文时回答以下关键问题：

1. 参与方有哪些？各自拥有什么？（数据所有者、计算方、密钥机构、用户、第三方）
2. 系统的输入和输出是什么？（明文数据、密钥、密文、签名、证明）
3. 保护什么？（数据隐私、模型隐私、查询隐私、认证、完整性）
4. 攻击者模型是什么？（半诚实/恶意、静态/自适应、有界/无界、是否合谋）
5. 安全定义是什么？（IND-CPA、IND-CCA、EUF-CMA、SIM安全、UC安全）
6. 困难假设是什么？（DDH、LWE、CDH、DLP、SRSA、Generic Group、QROM）
7. 协议用了哪些密码原语？（HE、MPC、ZKP、OT、SS、Commitment、PRF）
8. 协议的通信复杂度和计算复杂度？（O(n)、O(n^2)、带宽、轮次）
9. 安全证明是 Symbolic 还是 Computational？是否有理想功能（Ideal Functionality）？
10. 是否需要可信设置（Trusted Setup）？（CRS、随机预言机、公钥基础设施）
11. 是否支持动态加入/退出用户？（用户添加/撤销是否影响系统）
12. 是否泄露元数据？（密文长度、访问模式、计算时间、是否可链接）
13. 是否支持批量处理或并行化？（SIMD、Batch、Amortized 效率）
14. 是否支持恶意或活跃安全？（不诚实多数、adaptively corruptible）
15. 协议是否可组合？（UC 安全、独立安全、并发安全）
16. 是否支持公开可验证性？（验证是否需要私钥）
17. 具体参数如何？（密钥大小、密文大小、证明大小、签名大小的具体值）
18. 有没有 Benchmark？（实现语言、时间、硬件配置、比较基线）
19. 开源代码是否可用？（GitHub 仓库、许可协议）
20. 实际部署中的工程挑战是什么？（噪声管理、近似精度、网络延迟、密钥管理）

### 21.2 密码协议流程记录模板

记录每个密码协议时使用以下结构：

**系统参与方**：
- 数据拥有者（Data Owner）：拥有原始数据，负责加密
- 数据使用者（Data User）：请求数据/计算结果
- 密钥机构（KA/KGC）：生成和分发密钥
- 计算方（Cloud/Server）：执行密态计算
- 代理（Proxy）：转换密文/认证

**算法接口**：
- $\text{Setup}(1^\lambda) \rightarrow \text{pp}$：全局参数
- $\text{KeyGen}(\text{pp}) \rightarrow (sk, pk)$：密钥生成
- $\text{Encrypt}(pk, m) \rightarrow ct$：加密
- $\text{Decrypt}(sk, ct) \rightarrow m$：解密
- $\text{Evaluate}(pk, f, ct_1, \dots, ct_n) \rightarrow ct_f$：密文计算
- $\text{Verify}(vk, ct, \pi) \rightarrow \{0,1\}$：验证
- $\text{ReKeyGen}(sk_A, pk_B) \rightarrow rk_{A \rightarrow B}$（PRE）：重加密密钥生成

**正确性形式化定义**：
$$
\Pr[\text{Decrypt}(sk, \text{Encrypt}(pk, m)) = m] = 1 - \text{negl}(\lambda)
$$
对于 HE：$\Pr[\text{Decrypt}(sk, \text{Evaluate}(pk, f, c_1, \dots, c_n)) = f(m_1, \dots, m_n)] \geq 1 - \text{negl}(\lambda)$

**安全模型**（以 HE 的 IND-CPA 为例）：
- 攻击者能力：可以加密任意明文（有 Encrypt Oracle）
- 查询阶段：攻击者提交 $(m_0, m_1)$
- 挑战阶段：挑战者返回 $E(m_b)$
- 优势：$\left| \Pr[b' = b] - \frac{1}{2} \right| \leq \text{negl}(\lambda)$

**性能指标**：
- 密钥生成时间、密钥大小（比特）
- 加密/解密时间、密文大小（比特）
- 评估时间（毫秒/操作）
- 通信带宽（每轮/总计）
- 安全参数 $\lambda$（通常 128 或 256 比特安全级别）

### 21.3 综合项目

**项目1：加密数据共享系统**
- 核心：CP-ABE + PRE + 用户撤销 + 对象存储 + KMS
- 架构：
  - KMS 管理 ABE 主密钥和用户密钥（通过 HSM 保护主密钥）
  - 数据拥有者用 CP-ABE 加密数据（策略如"部门A AND (级别>=3)"）
  - 加密数据存储在对象存储（S3/MinIO）
  - 用户撤销时通过属性更新或重加密（PRE 转换）
  - 审计日志记录所有加密/解密/授权事件
- 实现考量：ABE 密文大小优化、策略解析引擎、撤销效率

**项目2：隐私保护联邦学习**
- 核心：FL + Secure Aggregation + DP + 门限解密 + 鲁棒聚合
- 架构：
  - 客户端用 Secure Aggregation（Bonawitz 方案）掩码梯度
  - 服务器聚合时应用 DP 噪声（用户级 DP）
  - 使用门限解密：聚合结果需要至少 $t$ 个客户端协作解密（防单点密钥泄露）
  - Krum 或 Median 检测和过滤恶意更新
  - 每轮训练后更新隐私预算账本
- 实现考量：通信优化、容错处理（掉线客户端处理）、DP 参数调优

**项目3：隐私保护大模型微调**
- 核心：FedLLM + LoRA + 安全聚合 + DP + 签名 + 可验证聚合
- 架构：
  - 服务端分发冻结的预训练模型，客户端只更新 LoRA 低秩矩阵
  - 客户端 sign 自己的 LoRA 更新（签名含客户端 ID 和轮次）
  - 安全聚合保护 LoRA 更新隐私（服务器无法区分单个客户端）
  - DP 对聚合后的 LoRA 参数加噪
  - 聚合结果通过 ZKP（如 Bulletproofs）可验证正确性
  - 模型水印嵌入（训练后验证所有权）
- 实现考量：LoRA rank 选择（隐私-通信-精度三维权衡）、大模型加载推理

**项目4：可验证隐私计算**
- 核心：MPC/HE + ZKP + 承诺 + 验证 + 审计
- 架构：
  - 计算方执行 HE 或 MPC 计算
  - 同时生成证明电路，证明计算过程正确（每个门/每个操作对应约束）
  - 验证方检查 ZKP 验证承诺的一致性
  - 公共审计日志存储所有计算请求的承诺根
  - 挑战-响应协议随机抽查部分计算结果的正确性
- 实现考量：证明生成效率、电路优化、噪声管理、批量验证
