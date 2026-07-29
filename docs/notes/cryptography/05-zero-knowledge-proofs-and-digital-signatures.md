# 零知识证明与数字签名

> **核心问题**：如何在不泄露秘密的前提下证明你知道这个秘密？如何让数字签名在隐私、效率和灵活性上达到极致？这两部分分别回答"零知识"和"数字签名"两大主题。

## 第1章 零知识证明基础

零知识证明（Zero-Knowledge Proof, ZKP）是一种**交互协议**，其中一方（Prover，证明者）向另一方（Verifier，验证者）证明某个断言为真，同时不泄露任何额外信息。

---

### 1.1 三个基本性质

一个零知识证明系统必须满足以下三个核心性质：

#### 完备性（Completeness）

> **定义**：如果断言为真，诚实的 Prover 总能说服诚实的 Verifier。

$$
\Pr[\langle P, V \rangle(x) = 1 \mid x \in L] = 1
$$

其中 $\langle P, V \rangle(x)$ 表示交互协议的输出（1 表示接受），$L$ 是语言（所有真断言的集合）。

**直观理解**：好人不会冤枉好人。如果你真的知道秘密，你一定能证明。完备性保证了协议的"充分性"——诚实的 Prover 永远不会被拒绝。

#### 可靠性（Soundness）

> **定义**：如果断言为假，恶意的 Prover 无法说服诚实的 Verifier（除非以极小的概率作弊成功）。

$$
\Pr[\langle P^*, V \rangle(x) = 1 \mid x \notin L] \leq \varepsilon
$$

其中 $\varepsilon$ 称为 **Soundness Error**（可靠性误差），通常要求 $\varepsilon \leq 2^{-128}$ 或更小。

**直观理解**：坏人骗不了好人。如果你不懂秘密，你几乎不可能蒙混过关。可靠性保证了协议的"必要性"——只有真正知道秘密的人才能通过验证。

这里有一个微妙之处：可靠性误差不可能完全为 0（除了平凡的协议），因为恶意 Prover 总可以靠运气猜对挑战。我们的目标是将误差压到可忽略的程度。

#### 零知识性（Zero-Knowledge）

> **定义**：存在一个 Simulator（模拟器），它能在不访问 Prover 秘密的情况下，生成与真实交互不可区分的 Transcript（交互记录）。

形式化地，存在 PPT（概率多项式时间）模拟器 $S$，使得对任意 $x \in L$：

$$
\text{View}_V[\langle P, V \rangle(x)] \approx_c S(x)
$$

其中 $\text{View}_V$ 是 Verifier 在真实交互中看到的所有信息（包括消息和随机数）。

**直观理解**：验证者看完整个证明过程后，除了"断言为真"这个结论外，得不到任何其他信息。即使验证者把整个对话录下来给别人看，别人也看不出 Prover 是否真的知道秘密。

---

#### 三个性质的关系

- **完备性** + **可靠性** = 一个有用的**证明系统**（但可能泄露信息）
- 加上**零知识性** = 一个安全的**零知识证明系统**
- 完备性和可靠性是矛盾的（需要权衡），零知识性是对 Prover 隐私的保护

> **直觉**：想象你有一个朋友是色盲——他无法区分红球和绿球。你想在不告诉他哪个球是红色的情况下证明你能区分颜色。你让他把两个球藏在背后，然后随机拿出一个给你看，你再告诉他拿的是哪个。重复多次后，他相信你能区分颜色，但依然不知道哪个是红色——这就是零知识证明的雏形。

---

### 1.2 证明与论证

零知识协议分为两大类：

#### Proof（证明）vs Argument（论证）

| 特性 | Proof | Argument |
|------|-------|----------|
| 安全性基础 | **信息论可靠性**（无计算假设） | **计算可靠性**（依赖计算假设） |
| 恶意 Prover 能力 | 无限计算能力 | 多项式时间计算能力 |
| 典型例子 | 图同构的 ZKP | Schnorr 协议 |
| 安全性强度 | 无条件安全 | 条件安全（假设某些问题难解） |

**直观理解**：Proof 是"数学绝对证明"——即使对手是上帝也无法伪造。Argument 是"密码学实际证明"——只要对手算力有限就无法伪造。现实中几乎所有 ZKP 系统都是 Argument（包括 zk-SNARKs），因为我们依赖离散对数、双线性配对等计算假设。

#### 知识可靠性（Knowledge Soundness）

这是比普通可靠性更强的性质。普通可靠性只保证"断言为真"，而**知识可靠性**保证 Prover 不仅知道断言为真，而且**拥有一个 Witness（证据）**。

> **定义**：如果 Prover 成功说服 Verifier，那么存在一个 Extractor（提取器）能从 Prover 中提取出 Witness。

形式化地说，对任意能够说服 Verifier 的 Prover $P^*$，存在 Extractor $E$ 使得：

$$
\Pr[E^{P^*}(x) = w \mid \langle P^*, V \rangle(x) = 1] \geq 1 - \text{negl}
$$

**直观理解**：如果一个人能证明他知道私钥（例如通过签名），那么理论上我们可以通过"逆向工程"提取出这个私钥。这听起来危险，但它确保了知识可靠性——证明者不能仅仅靠运气通过验证。

#### Proof of Knowledge（PoK）

**PoK** 是满足知识可靠性的协议。它与普通 ZKP 的区别在于：

- 普通 ZKP：$\exists w \text{ s.t. } (x, w) \in R$（断言 $\exists w$）
- PoK：Prover knows $w$ such that $(x, w) \in R$（Prover 知道 $w$）

**为什么要区分？** 考虑 NP 语言的证据——NP 语言的定义是存在一个证据，但 ZKP 只证明存在性而不证明知识。PoK 更强，它要求 Prover 真的"持有"证据。

> **例子**：假设离散对数问题——断言"存在 $x$ 使得 $g^x = h$"是平凡的（因为 $x$ 一定存在），但"Prover 知道 $x$"是非平凡的。Schnorr 协议就是一个 PoK。

#### Extractor 的工作方式

Extractor 通过"rewinding"（倒带）技术工作：Extractor 运行 Prover 两次，用不同的挑战值，从两个响应中提取 Witness。

**协议需要 Special Soundness**（详见第2章）才能实现提取。

---

### 1.3 交互式证明

#### 协议角色

- **Prover（$P$）**：证明者，拥有秘密 Witness，试图说服 Verifier
- **Verifier（$V$）**：验证者，不拥有秘密，负责检查证明

#### 交互流程

一个典型的交互式证明分三步：

```
Prover                           Verifier
   |                                |
   |------- Commitment a -------->  |
   |                                |  生成随机挑战 c
   |<------- Challenge c ---------- |
   |                                |
   |------- Response z ---------->  |
   |                                |  验证 (a, c, z)
```

1. **Commitment（承诺）**：Prover 发送一个绑定到 Witness 的承诺
2. **Challenge（挑战）**：Verifier 发送一个随机挑战（Prover 无法提前预测）
3. **Response（响应）**：Prover 根据挑战和秘密计算响应并发送

#### Soundness Error

**Soundness Error** 是恶意 Prover 在不知道 Witness 的情况下成功欺骗 Verifier 的最大概率。

- 单轮交互：如果 Soundness Error 为 $1/2$（如 Schnorr 协议中，只有一个比特的挑战），则需要重复 $\lambda$ 次将误差降到 $2^{-\lambda}$
- 固定挑战空间大小 $|C|$ 时，Soundness Error $= 1/|C|$

> **重要**：Soundness Error 和挑战空间大小直接相关。因此实际协议中挑战空间往往很大（如 $2^{128}$），这样单轮交互就足够了。

#### 重复执行降低错误概率

如果协议的 Soundness Error 是 $1/2$，重复 $k$ 次后误差降为 $(1/2)^k$。

**两种重复方式**：

1. **顺序重复**：依次执行 $k$ 次，总误差指数级下降
2. **并行重复**：同时发送 $k$ 个承诺，然后收到 $k$ 个挑战，最后发 $k$ 个响应

需要注意的是，**并行重复不一定降低 Soundness Error**——对于某些协议（如 3-round 协议），并行重复的 Soundness 需要仔细分析。

> **实践建议**：使用大挑战空间（如 $\mathbb{F}_p$，$p \approx 2^{256}$），单轮就够了。

---

## 第2章 Sigma协议与Fiat-Shamir

### 2.1 Sigma协议结构

**Sigma 协议**是一类特殊的 3-轮交互协议，形式为:

```
P → V: a (Commitment)
V → P: c (Challenge)
P → V: z (Response)
```

"Sigma"（Σ）这个名字来源于协议的三轮结构，形如希腊字母 Σ。

#### 三轮流程详解

以**Schnorr 协议**（离散对数知识证明）为例：

**公开参数**：循环群 $\mathbb{G}$，生成元 $g$，阶为 $q$

**Prover 私密输入**：$x \in \mathbb{Z}_q$（Witness）

**公开输入**：$h = g^x$

**协议流程**：

1. **Commitment**：Prover 随机选择 $r \leftarrow \mathbb{Z}_q$，计算 $a = g^r$，发送 $a$

2. **Challenge**：Verifier 随机选择 $c \leftarrow \mathbb{Z}_q$，发送 $c$

3. **Response**：Prover 计算 $z = r + c \cdot x \mod q$，发送 $z$

**验证**：Verifier 检查 $g^z \stackrel{?}{=} a \cdot h^c$

**正确性验证**：

$$
g^z = g^{r + cx} = g^r \cdot (g^x)^c = a \cdot h^c
$$

#### Special Soundness

**Special Soundness** 是 Sigma 协议的核心安全性质：

> 如果给定两个接受同一承诺 $a$ 但不同挑战 $(c, c')$ 的 transcripts $(a, c, z)$ 和 $(a, c', z')$，则可以提取 Witness $x$。

对 Schnorr 协议：

$$
\begin{cases}
g^z = a \cdot h^c \\
g^{z'} = a \cdot h^{c'}
\end{cases}
\Rightarrow g^{z - z'} = h^{c - c'} \Rightarrow g^{\frac{z - z'}{c - c'}} = h
$$

因此 Witness $x = \frac{z - z'}{c - c'} \mod q$。

这意味着：如果 Prover 能在两次不同挑战下成功响应，他就"必然"知道离散对数 $x$。

#### Honest-Verifier Zero Knowledge（HVZK）

**HVZK** 是 Sigma 协议的零知识性质，但有一个重要的**限制**：

> 只有当 Verifier 诚实地遵循协议（即随机选择挑战）时，协议才是零知识的。

**模拟器构造**：对 Schnorr 协议，模拟器 $S$ 按如下方式生成 Transcript：

1. 随机选择 $c, z \leftarrow \mathbb{Z}_q$
2. 计算 $a = g^z \cdot h^{-c}$

这样生成的 $(a, c, z)$ 与真实交互不可区分——而且模拟器不需要知道 $x$。

**问题**：为什么是 HVZK 而不是完全的 ZK？

因为如果 Verifier **恶意地**选择挑战（例如 $c = H(a)$，将挑战绑定到承诺），那么模拟器无法按上述方式生成（它需要先知道 $a$ 才能计算 $c$，但 $a$ 又依赖于 $c$）。这就是下一节 Fiat-Shamir 变换要解决的问题。

---

### 2.2 Fiat-Shamir变换

**Fiat-Shamir 变换** 是将交互式 Sigma 协议转化为**非交互式证明**的核心技术。

#### 基本思想

用哈希函数代替 Verifier 的角色生成挑战：

$$
c = H(a)
$$

其中 $H$ 是一个哈希函数（在安全分析中被建模为 Random Oracle）。

#### 变换过程

```
交互式版本:
  P → V: a
  V → P: c (随机)
  P → V: z

非交互式版本 (Fiat-Shamir):
  P:   c = H(a)
  P:   z = Compute(a, c, witness)
  P → V: (a, z)  或更常见地  π = (c, z)

  V:   验证 (a, c, z) 其中 c = H(a)
```

#### 随机预言机模型（Random Oracle Model, ROM）

**Random Oracle（随机预言机）** 是一个理想化的哈希函数，它：
- 对任意输入返回一个均匀随机的输出
- 对相同的输入总是返回相同的输出
- 可以被任何参与方查询

Fiat-Shamir 变换的安全性在 ROM 下被证明：如果原始 Sigma 协议是 HVZK 且满足 Special Soundness，则 Fiat-Shamir 变换得到的非交互式协议在 ROM 中是安全的（即满足知识可靠性）。

#### 为什么 Fiat-Shamir 是安全的？

**直觉**：在 ROM 中，恶意 Prover 无法"预测"哈希输出，因此他无法提前知道挑战 $c$ 的值。这意味着他必须像交互式协议一样"先承诺，后响应"——Special Soundness 保证他无法作弊。

如果 Prover 可以计算 $c$ 后再修改 $a$，那就破坏了 Soundness——但哈希函数的单向性和确定性防止了这一点。

#### Transcript 绑定（Transcript Binding）

在 Fiat-Shamir 变换中，必须确保挑战 $c$ 绑定到完整的上下文，否则可能遭受**攻击**。

**攻击示例**：如果 $c = H(a)$，但不包含公开输入 $x$（如 $h$），那么 Prover 可以用另一个公开输入 $h'$ 重放同一个证明。

**正确实践**：将**所有公开信息**都包含在哈希中：

$$
c = H(a \parallel h \parallel \text{context})
$$

其中 $\parallel$ 表示拼接，$\text{context}$ 可能包括协议标识、会话 ID 等。

#### Domain Separation（域分离）

当同一个哈希函数被多个协议或同一协议的多个不同用途使用时，必须进行**域分离**：

$$
c_1 = H(\text{domain\_tag}_1 \parallel a)
$$
$$
c_2 = H(\text{domain\_tag}_2 \parallel b)
$$

**为什么需要域分离**？

如果两个不同的挑战使用同样的哈希模式，攻击者可能将一个协议中的证明重用到另一个协议中。域分离确保不同场景下的哈希值互不干扰。

**常见做法**：

$$
c = H(\text{"protocol-name"} \parallel \text{circuit-id} \parallel a \parallel \text{public-inputs})
$$

> **实践要点**：Fiat-Shamir 变换的实现细节非常关键。很多 ZKP 系统的安全问题都源于 Domain Separation 不当或 Transcript 绑定不完整。

---

## 第3章 通用零知识证明系统

### 3.1 算术电路

#### 从问题到电路

要将一个计算问题用 ZKP 证明，首先需要将其转化为**算术电路**（Arithmetic Circuit）。

**流程**：

```
原始问题 → 算术约束 → R1CS → QAP → 证明系统
```

#### 算术电路的定义

算术电路是一个有向无环图（DAG），其中：
- **输入节点**：变量（公开输入或私有 Witness）
- **内部节点**：加法门（$+$）和乘法门（$\times$）
- **输出节点**：约束的结果

整个电路定义了一个从输入到输出的计算过程。

**例子**：证明你知道 $x$ 使得 $x^3 + x + 5 = 35$。

对应的算术电路：
- 输入：$x$
- 门1：$a = x \times x$（$x^2$）
- 门2：$b = a \times x$（$x^3$）
- 门3：$c = b + x$（$x^3 + x$）
- 输出：$c + 5 = 35$

#### Constraint System（约束系统）

电路中的每个门对应一个约束。通常将约束写成以下形式：

$$
\begin{cases}
a_1 = x \times x \\
b_1 = a_1 \times x \\
c_1 = b_1 + x \\
35 = c_1 + 5
\end{cases}
$$

#### R1CS（Rank-1 Constraint System）

**R1CS** 是约束系统的矩阵表示。每个约束的形式为：

$$
\langle a, w \rangle \cdot \langle b, w \rangle = \langle c, w \rangle
$$

其中 $w$ 是 Witness 向量（包含所有线值），$a, b, c$ 是稀疏向量。

对于上述例子，令 Witness 向量 $w = (1, x, a_1, b_1, c_1, 35)$：

- 约束1（$a_1 = x \times x$）：$a = (0,1,0,0,0,0), b = (0,1,0,0,0,0), c = (0,0,1,0,0,0)$
- 约束2（$b_1 = a_1 \times x$）：$a = (0,0,1,0,0,0), b = (0,1,0,0,0,0), c = (0,0,0,1,0,0)$
- 约束3（$c_1 = b_1 + x$）：这是一个线性约束，需要拆分为乘法形式
- 约束4（$35 = c_1 + 5$）：同理

**实际系统中**：一个约束通常表达为一个三元组 $(A_i, B_i, C_i)$ 矩阵。

#### Witness

**Witness** 是所有满足约束的赋值向量。对验证者而言：
- **公开输入（Public Input）**：如 35 和公开的电路参数
- **私有输入（Private Input）**：如 $x$ 和中间变量

Prover 知道完整的 Witness，Verifier 只知道公开部分。ZKP 的作用就是让 Prover 证明"存在一个 Witness 扩展使得所有约束成立"。

#### 从 R1CS 到 QAP

**QAP（Quadratic Arithmetic Program）** 通过多项式插值将 $n$ 个 R1CS 约束压缩为三个多项式 $A(x), B(x), C(x)$：

$$
A(x) \cdot B(x) - C(x) = H(x) \cdot Z(x)
$$

其中 $Z(x) = \prod_i (x - \omega_i)$ 是 vanishing polynomial（在约束点处为 0）。

**意义**：将约束检查转化为多项式等式验证，为 zk-SNARK 的 Succinctness 奠定基础。

---

### 3.2 zk-SNARK

**zk-SNARK** = Zero-Knowledge Succinct Non-interactive Argument of Knowledge

#### Succinctness（简洁性）

- 证明大小：与计算复杂度无关（通常是常数大小，如 128 字节或几百字节）
- 验证时间：与计算复杂度无关（通常是线性的或接近常数）

这是 zk-SNARK 最吸引人的特点——无论证明的计算多大，证明总是很小，验证总是很快。

#### Non-interactivity（非交互性）

通过 Fiat-Shamir 变换或 CRS（Common Reference String）实现，Prover 生成证明后，任何拥有验证密钥的人都可以验证。

#### Trusted Setup（可信设置）

大部分 zk-SNARK 需要**可信设置**（Trusted Setup）阶段，生成：

- **Proving Key（$pk$）**：Prover 用来生成证明
- **Verification Key（$vk$）**：Verifier 用来验证证明

**问题**：可信设置中产生的 Trapdoor（如 $\tau$，即秘密随机数）如果被泄露，攻击者可以伪造证明。

**解决方案**：
- **Multi-party Ceremony**（多方仪式）：多方参与生成 CRS，只要至少一方诚实，Trapdoor 就是安全的
- **Transparent Setup**（透明设置）：不需要可信设置（如 STARK 和 Bulletproofs）

**Trusted Setup 的分类**：

| 类型 | 例子 | 特点 |
|------|------|------|
| 通用且可更新 | Groth16 | 每个电路都要设置 |
| 通用且不可更新 | CRS 固定 | 可以被不同电路共享 |
| 透明（无设置） | STARK, Bulletproofs | 不需要可信设置 |

#### Knowledge Soundness 与 SNARK

SNARK 要求**知识可靠性**——证明必须是一个 Proof of Knowledge（PoK），而不仅仅是证明存在性。

**提取器（Extractor）在 SNARK 中的作用**：在安全证明中，我们需要证明如果 Prover 能生成一个有效的证明，那么一定存在一个 Extractor 能够提取出 Witness。

**SNARK 的安全性**建立在以下假设之上：

1. **Knowledge of Exponent**（KeE）假设（对某些配对基础 SNARK）
2. **Discrete Log** 假设（对 Bulletproofs）
3. **Collision Resistance** 假设（对 STARKs）

---

### 3.3 zk-STARK

**zk-STARK** = Zero-Knowledge Scalable Transparent Argument of Knowledge

#### 透明设置（Transparent Setup）

STARK 最大的优点是**不需要可信设置**。证明者和验证者只需要公开的随机数（可以通过公共随机信标生成）。

**优势**：
- 没有 Trapdoor，安全假设更简洁
- 没有复杂的 Multi-party Ceremony
- 可以随时部署，不受初始设置限制

#### 哈希型安全基础

STARK 的安全性仅基于**哈希函数的抗碰撞性**（Collision Resistance）和**随机预言机模型**。不依赖离散对数或双线性配对等"代数假设"。

**含义**：STARK 是**抗量子的**（Quantum Resistant）——量子计算机无法通过 Shor 算法破解哈希函数。

#### 多项式承诺与 FRI 协议

STARK 使用 **FRI（Fast Reed-Solomon IOP of Proximity）** 协议来实现多项式承诺。

**核心思想**：
1. 将 Witness 编码为多项式的取值（使用 Reed-Solomon 码）
2. 通过**低度测试**（Low Degree Test）检查多项式是否确实有低度
3. FRI 协议通过递归折叠降低多项式度，每一步都进行承诺

**FRI 流程**（简化）：

```
步骤1: 将 Witness 编码为多项式 f(x) of degree < d
步骤2: 对 f(x) 在扩展域上求值，得到长向量（Reed-Solomon 编码）
步骤3: 递归地折叠：
   f_0(x) → f_1(x) = (f_0(x) + f_0(-x)) / 2 + β * (f_0(x) - f_0(-x)) / (2x)
步骤4: 验证者在每一步检查随机折叠的正确性
步骤5: 最终得到一个低度多项式，验证者直接检查
```

**FRI 的关键性质**：
- 证明大小：$O(\log^2 n)$（对非常大的 $n$）
- 验证时间：$O(n)$ 或 $O(\log^2 n)$（取决于具体实现）
- 无可信设置

#### 证明大小与验证成本

| 属性 | zk-SNARK (Groth16) | zk-STARK |
|------|-----|-------|
| 证明大小 | ~128-256 字节 | ~100-500 KB |
| 验证时间 | ~几毫秒 | ~几十毫秒 |
| 设置 | 可信设置（每个电路） | 透明（无设置） |
| 安全性假设 | 配对、Knowledge of Exponent | 哈希抗碰撞 |
| 量子安全 | 否 | 是 |

**权衡**：STARK 的证明大小远大于 SNARK，但不需要可信设置且抗量子。对于需要简洁证明的场景（如区块链），SNARK 更优；对于需要透明性和安全性的场景，STARK 更优。

---

### 3.4 Bulletproofs

**Bulletproofs** 是一种无需可信设置的 ZKP 系统，最著名的应用是**范围证明**（Range Proof）。

#### Inner Product Argument（IPA）

Bulletproofs 的核心是 **Inner Product Argument（内积论证）**——证明者可以证明两个向量 $a, b$ 的内积等于某个值 $c$，即 $\langle a, b \rangle = c$。

**基本协议**（递归结构）：

给定长度为 $n = 2^k$ 的向量 $a, b$：

1. **拆分**：将 $a, b$ 各拆为两半 $a_L, a_R$ 和 $b_L, b_R$
2. **承诺**：计算新的承诺和挑战值
3. **递归**：将问题规模减半，继续直到长度为 1
4. **输出**：长度为 1 时直接发送标量值

**通信复杂度**：$O(\log n)$ —— 证明大小随向量长度对数增长。

#### 无可信设置

Bulletproofs 不需要可信设置。它仅依赖**离散对数假设**——在通用群模型中工作。

**优势**：
- 不需要可信设置，部署简单
- 证明大小对数级增长（对大多数实际应用可接受）
- 支持证明聚合（Aggregation）

#### 范围证明（Range Proof）

**范围证明**是 Bulletproofs 最著名的应用：证明一个数值 $v$ 在区间 $[0, 2^n - 1]$ 内，而不泄露 $v$。

**核心构造**：
1. 将 $v$ 表示为二进制形式 $v = \sum_{i=0}^{n-1} a_i \cdot 2^i$，其中 $a_i \in \{0, 1\}$
2. 证明每个 $a_i$ 确实是 0 或 1：$a_i \cdot (1 - a_i) = 0$
3. 使用 Inner Product Argument 高效地证明所有约束

**应用场景**：
- **Monero**：使用 Bulletproofs 实现隐私交易中的范围证明
- **机密交易（Confidential Transactions）**：证明交易金额非负

#### 证明聚合（Proof Aggregation）

Bulletproofs 的另一个重要特性是**批量证明**（Batch Proof）：

- 聚合 $m$ 个范围证明的代价远小于 $m$ 倍单个证明
- 聚合证明的大小与单个证明的大小差不多（对数增长平缓）

---

### 3.5 Polynomial Commitment（多项式承诺）

**多项式承诺**是 ZKP 系统的核心构建块。它允许 Prover 承诺一个多项式 $f(x)$，然后对任意点 $z$ 打开承诺，证明 $f(z) = v$。

#### 三种主流的 Polynomial Commitment 方案

#### 1. KZG 承诺（Pairing-based）

**基于双线性配对**，最早由 Kate、Zaverucha 和 Goldberg 提出。

**设置**：
- 公共参数：$(g, g^\tau, g^{\tau^2}, \ldots, g^{\tau^d})$，其中 $\tau$ 是 Trapdoor（在可信设置后删除）
- 双线性配对：$e: \mathbb{G}_1 \times \mathbb{G}_2 \rightarrow \mathbb{G}_T$

**承诺**：对多项式 $f(x) = \sum_{i=0}^d f_i x^i$，计算：

$$
C = \prod_{i=0}^d (g^{\tau^i})^{f_i} = g^{f(\tau)}
$$

**打开证明**：要证明 $f(z) = v$，Prover 计算商多项式：

$$
q(x) = \frac{f(x) - v}{x - z}
$$

打开证明为 $\pi = g^{q(\tau)}$。

**验证**：Verifier 检查：

$$
e(C / g^v, g) = e(\pi, g^\tau / g^z)
$$

**性质**：
- 承诺大小：**常数**（1 个群元素）
- 证明大小：**常数**（1 个群元素）
- 验证时间：**常数**
- 需要**可信设置**

#### 2. IPA 承诺（Inner Product Argument based）

**基于离散对数假设**，不需要双线性配对。

**思想**：将多项式系数向量作为内积协议的输入。

**承诺**：使用 Pedersen 向量承诺，计算 $C = \text{Com}(f) = g^{\vec{f}} \cdot h^{\vec{r}}$

**打开证明**：使用 Inner Product Argument 递归地证明多项式求值正确。

**性质**：
- 承诺大小：常数
- 证明大小：$O(\log d)$
- 验证时间：$O(\log d)$（或通过批处理优化）
- **无可信设置**

#### 3. FRI 类承诺

**基于哈希函数**和 Reed-Solomon 编码。

**思想**：将多项式的求值作为承诺，通过 Merkle 树实现简洁性。

**承诺**：在扩展域上对多项式求值，构建 Merkle 树，根为承诺。

**打开证明**：FRI 协议提供批量打开（低度测试 + Merkle 证明）。

**性质**：
- 证明大小：$O(\log^2 d)$
- 验证时间：$O(d)$ 或 $O(\log^2 d)$
- **无可信设置**，抗量子
- 适用于 STARK

#### 方案对比

| 方案 | 承诺 | 证明大小 | 验证 | 设置 | 量子安全 |
|------|------|---------|------|------|---------|
| KZG | $O(1)$ | $O(1)$ | $O(1)$ | 可信 | 否 |
| IPA | $O(1)$ | $O(\log d)$ | $O(\log d)$ | 透明 | 否 |
| FRI | $O(1)$ | $O(\log^2 d)$ | $O(d)$ | 透明 | 是 |

#### Opening Proof 与 Batch Opening

**Opening Proof（打开证明）**：证明 $f(z) = v$。

**Batch Opening（批量打开）**：同时证明多个点 $f(z_1) = v_1, f(z_2) = v_2, \ldots, f(z_k) = v_k$，通信量小于 $k$ 倍的单个证明。

**KZG 的 Batch Opening**（核心技巧）：

要证明 $f(z_i) = v_i$ 对所有 $i = 1, \ldots, k$ 成立，构造：

$$
I(x) = \sum_{i=1}^k v_i \cdot L_i(x)
$$

其中 $L_i(x)$ 是 Lagrange 基多项式，使得 $L_i(z_j) = \delta_{ij}$。

定义：

$$
q(x) = \frac{f(x) - I(x)}{\prod_{i=1}^k (x - z_i)}
$$

批量证明就是 $\pi = g^{q(\tau)}$，验证检查：

$$
e(C / g^{I(\tau)}, g) = e(\pi, g^{\prod_i (\tau - z_i)})
$$

**效果**：无论打开多少个点，证明大小仍然是 1 个群元素！

---

### 3.6 递归证明

#### Proof Composition（证明组合）

**递归证明**的核心思想：**在一个 ZKP 中验证另一个 ZKP**。

```
证明 π1: "我知道 x 使得 f(x) = y"
证明 π2: "我知道 π1 是有效的"（在证明 π1 的有效性！）
```

**关键**：验证一个证明的计算成本必须小于生成该证明的计算成本，否则递归没有意义。

**优势**：
- **压缩**：可以将多个证明压缩为一个
- **验证链**：区块链上只需要验证最后一个证明
- **无限递归**：理论上可以无限压缩状态

#### IVC（Incrementally Verifiable Computation）

**IVC**（增量可验证计算）是递归证明的一种范型：

> Prover 维护一个状态 $s_i$，每一步执行函数 $F$ 得到新状态 $s_{i+1} = F(s_i)$。每一步都生成一个证明，证明"存在一个初始状态 $s_0$，经过 $i+1$ 次迭代后得到 $s_{i+1}$"。

**关键性质**：第 $i+1$ 步的证明验证了第 $i$ 步的证明，因此验证成本与迭代次数无关。

#### Folding Scheme（折叠方案）

**Folding Scheme** 是 Nova 协议引入的递归证明新方法，比 IVC 更高效。

**核心思想**：不直接验证证明，而是将两个 Relaxed R1CS 实例"折叠"为一个。

**Relaxed R1CS**：引入松弛变量 $e$ 和标量 $u$：

$$
A \cdot w \circ B \cdot w = u \cdot C \cdot w + e
$$

当 $u = 1, e = 0$ 时退化为标准 R1CS。

**折叠操作**：

给定两个 Relaxed R1CS 实例 $(A, B, C, w_1, e_1, u_1)$ 和 $(w_2, e_2, u_2)$，以及随机挑战 $r$：

$$
w = w_1 + r \cdot w_2
$$
$$
e = e_1 + r \cdot e_2 + r^2 \cdot (\text{cross term})
$$
$$
u = u_1 + r \cdot u_2
$$

**效果**：折叠后的实例仍然是一个 Relaxed R1CS 实例，且验证者只需要检查折叠的正确性（成本为 $O(1)$）。

**为什么叫 Folding**？——两个实例"折叠"成一个，递归地折叠整个证明链。

#### Rollup 应用

递归证明最成功的应用是区块链 Rollup：

```
Layer 2 (L2) 交易
     ↓
生成 Proof (证明所有 L2 交易的正确性)
     ↓
递归压缩 (多个 Prove 进一步聚合)
     ↓
提交到 Layer 1 (L1)
     ↓
L1 验证一个 Proof → 确认所有 L2 交易
```

**ZK-Rollup**（如 zkSync、StarkNet）：

- L2 交易批量生成一个 zk-SNARK/STARK
- L1 仅需常数时间验证
- 数据可用性（DA）成本是主要瓶颈

**递归 Rollup**：

- 多个 L2 块的证明可以递归聚合
- 最终 L1 只需要验证一个证明
- 实现**无限扩展**（理论上）

> **实践中的挑战**：递归证明的证明系统必须非常高效，因为每一步递归都涉及一个证明的验证。Nova（基于 Folding Scheme）和 Halo2（基于 IPA）是目前最主流的递归证明系统。

---

## 第4章 ZKP应用

### 身份认证（Identity Authentication）

**场景**：用户想向服务器证明身份，而不泄露密码或生物特征。

**实现**：
- Prover 持有私钥 $sk$，Verifier 知道公钥 $pk$
- Prover 使用 Sigma 协议（如 Schnorr）证明他知道 $sk$
- 服务器每次生成不同的 Challenge，防止重放攻击

**优势**：服务器不需要存储密码，即使数据库泄露也无法冒充用户。

### 匿名凭证（Anonymous Credentials）

**场景**：用户想证明自己是"18岁以上"或者"有驾照"，而不泄露具体年龄或驾照号。

**实现**：
- **Issuer** 签发一个签名（Credential）
- **Holder** 通过 ZKP 选择性披露属性
- **Verifier** 验证属性的真实性而不获取其他信息

**典型技术**：Camenisch-Lysyanskaya 签名 + ZKP

### 范围证明（Range Proof）

**场景**：证明"我的收入在 10万到 50万之间"（不泄露具体数字）。

**实现**：
- 将数字编码为二进制，证明每一位是 0 或 1
- 使用 Bulletproofs 高效实现

**应用**：
- 信用评分证明
- 薪资范围验证
- 年龄验证

### 隐私交易（Privacy Transaction）

**场景**：在不泄露交易金额、发送方和接收方的前提下证明交易合法。

**代表系统**：
- **Zcash**：使用 zk-SNARK（Groth16）实现隐私交易
- **Monero**：使用 Bulletproofs 实现范围证明
- **Tornado Cash**：使用 ZKP 实现混币器

**Zcash 的交易结构**：
```
公开输入：nullifier、commitment tree root
私有输入：私钥、金额、接收方地址
约束：发送方有足够的余额、金额不超限、承诺正确更新
证明：一个 Groth16 证明（~200 字节）
```

### 可验证机器学习（Verifiable ML）

**场景**：模型服务商想证明推理结果的正确性，而不泄露模型参数。

**挑战**：ML 模型很大，计算复杂，传统 ZKP 效率太低。

**进展**：
- **EZPC**：将 ML 模型编译为算术电路
- **zkCNN**：对 CNN 推理过程生成证明
- **vCNN**：用 GKR 协议验证卷积层

**当前瓶颈**：非线性和矩阵乘法的证明效率。

### 可验证外包计算（Verifiable Outsourced Computation）

**场景**：客户端将计算外包给云服务商，希望验证计算结果的正确性。

**协议**：
1. 客户端生成计算电路和证明密钥
2. 服务商执行计算并生成证明
3. 客户端验证证明（成本远低于重新计算）

**经典例子**：Set Intersection、Matrix Multiplication、SQL Query

### 储备证明（Proof of Reserves）

**场景**：交易所想证明拥有足额用户资产，而不泄露冷钱包地址和余额。

**实现**：
1. 构建 Merkle Sum Tree，叶子节点为用户余额
2. 交易所用私钥签署所有叶子节点的累加和
3. ZKP 证明签署的和 ≥ 用户总负债

**应用**：Binance、Kraken 等交易所的 Proof of Reserves 审计。

---

## 第5章 基础数字签名

数字签名的统一语法定义：

$$
\begin{aligned}
&\text{KeyGen}(1^\lambda) \rightarrow (sk, pk) \\
&\text{Sign}(sk, m) \rightarrow \sigma \\
&\text{Verify}(pk, m, \sigma) \rightarrow 0/1
\end{aligned}
$$

**安全性要求**：在**选择消息攻击（CMA）**下，攻击者无法伪造任意消息的签名（EUF-CMA）。

---

### RSA 签名

**密钥生成**：
- 选择大素数 $p, q$，计算 $n = p \cdot q$
- 选择 $e$ 使得 $\gcd(e, \phi(n)) = 1$
- 计算 $d = e^{-1} \mod \phi(n)$
- 公钥 $pk = (n, e)$，私钥 $sk = d$

**签名**：$\sigma = m^d \mod n$

**验证**：检查 $\sigma^e \stackrel{?}{=} m \mod n$

#### 安全性问题

**教科书 RSA 签名不可用**：
1. **存在性伪造**：选择 $\sigma'$，计算 $m' = (\sigma')^e \mod n$，就伪造了对 $m'$ 的签名
2. **乘法同态攻击**：$\sigma_1 \cdot \sigma_2 = (m_1 \cdot m_2)^d \mod n$

**修复方法**：使用**哈希函数**（Hash-and-Sign）：

$$
\sigma = H(m)^d \mod n
$$

这样攻击者无法利用代数结构。

**PSS（Probabilistic Signature Scheme）**：RSA 的最安全填充方式，包含盐值（Salt）。

### DSA（Digital Signature Algorithm）

DSA 是基于 **ElGamal 签名** 的变体，由 NIST 标准化。

**密钥生成**：
- 选择大素数 $p, q$ 使得 $q \mid (p-1)$
- 选择生成元 $g \in \mathbb{Z}_p^*$，阶为 $q$
- 选择私钥 $x \in \mathbb{Z}_q$，公钥 $y = g^x \mod p$

**签名**（对消息 $m$）：
- 选择随机数 $k \in \mathbb{Z}_q^*$
- 计算 $r = (g^k \mod p) \mod q$
- 计算 $s = k^{-1} \cdot (H(m) + x \cdot r) \mod q$
- 签名 $\sigma = (r, s)$

**验证**：
- 检查 $r, s \in [1, q-1]$
- 计算 $u_1 = H(m) \cdot s^{-1} \mod q$
- 计算 $u_2 = r \cdot s^{-1} \mod q$
- 检查 $r \stackrel{?}{=} (g^{u_1} \cdot y^{u_2} \mod p) \mod q$

#### 安全问题

- **$k$ 不能重复使用**：如果两次签名用同一个 $k$，可以解出私钥 $x$
- **$k$ 必须真随机**：如果 $k$ 的部分比特可预测（如 Sony PS3 的 ECDSA 漏洞），私钥会泄露

### ECDSA（Elliptic Curve DSA）

ECDSA 是将 DSA 移植到椭圆曲线上。

**椭圆曲线参数**：曲线 $E$ 上的基点 $G$，阶为 $q$

**密钥生成**：
- 私钥 $d \in \mathbb{Z}_q^*$
- 公钥 $Q = d \cdot G$

**签名**：
- 选择随机数 $k \in \mathbb{Z}_q^*$
- 计算 $R = k \cdot G$，令 $r = R_x \mod q$
- 计算 $s = k^{-1} \cdot (H(m) + d \cdot r) \mod q$
- 签名 $\sigma = (r, s)$

**验证**：
- 检查 $r, s$
- 计算 $u_1 = H(m) \cdot s^{-1} \mod q$
- 计算 $u_2 = r \cdot s^{-1} \mod q$
- 检查 $r \stackrel{?}{=} (u_1 \cdot G + u_2 \cdot Q)_x \mod q$

#### 与 DSA 的区别

- ECDSA 使用椭圆曲线运算，参数更小（256 位 vs 2048 位 RSA）
- ECDSA 的签名过程需要逆运算 $s^{-1}$（计算密集）
- **ECDSA 不是 Schnorr 签名**——它是 DSA 的椭圆曲线版本

### Schnorr 签名

Schnorr 签名基于 Sigma 协议 + Fiat-Shamir 变换。

**密钥生成**：
- 私钥 $x \in \mathbb{Z}_q$
- 公钥 $P = x \cdot G$

**签名**：
- 选择随机数 $r \in \mathbb{Z}_q$
- 计算 $R = r \cdot G$
- 计算 $c = H(R \parallel m)$
- 计算 $s = r + c \cdot x \mod q$
- 签名 $\sigma = (R, s)$（或 $(c, s)$）

**验证**：
- 计算 $c' = H(R \parallel m)$
- 检查 $s \cdot G \stackrel{?}{=} R + c' \cdot P$

#### Schnorr 的优势

1. **线性结构**：支持签名聚合（MuSig, BLS 等）
2. **无 $k^{-1}$ 运算**：比 ECDSA 更快
3. **可证明安全**：在 ROM 下是 EUF-CMA 安全的

### EdDSA（Edwards-curve Digital Signature Algorithm）

EdDSA 是 Schnorr 签名在 Edwards 曲线上的实现。

**曲线**：Ed25519（适用于 Curve25519）、Ed448（适用于 Goldilocks）

**特点**：
- **确定性签名**：$r = H(sk \parallel m)$，不需要随机数生成器
- **抗侧信道攻击**：没有条件分支，常数时间实现
- **批量验证**：支持同时验证多个签名
- **公钥更小**：32 字节

**签名过程**：
- $r = H(H_{10..31}(sk) \parallel m)$（确定性 nonce）
- $R = r \cdot B$（$B$ 是基点）
- $S = r + H(R \parallel A \parallel m) \cdot sk \mod q$
- 签名 $\sigma = (R, S)$

**EdDSA vs ECDSA**：
| 特性 | EdDSA | ECDSA |
|------|-------|-------|
| Nonce | 确定性（可预测但安全） | 随机（必须真随机） |
| 速度 | 更快 | 较慢 |
| 安全性证明 | 更简洁 | 较复杂 |
| 广泛使用 | SSH, TLS 1.3 | Bitcoin, Ethereum |

### Hash-based Signature（基于哈希的签名）

基于哈希函数的签名系统，**抗量子**。

#### Lamport 一次性签名（OTS）

**密钥生成**：
- 对每个比特，生成两个私钥值 $(sk_{i,0}, sk_{i,1})$
- 公钥为哈希值 $(pk_{i,0} = H(sk_{i,0}), pk_{i,1} = H(sk_{i,1}))$

**签名**：对消息 $m$ 的每个比特 $m_i$，选择 $sk_{i, m_i}$

**验证**：对每个比特 $i$，检查 $H(\sigma_i) \stackrel{?}{=} pk_{i, m_i}$

**致命问题**：**一次性**——签名两次就泄露私钥。

#### Merkle 签名方案（MSS）

使用 Merkle 树扩展 Lamport 签名，实现多次签名：

- 叶子节点：Lamport 公钥
- 内部节点：子节点哈希的哈希
- 根：Master 公钥
- 每次签名：一个 Lamport 签名 + Merkle 验证路径

**XMSS（eXtended Merkle Signature Scheme）**：NIST 推荐的后量子签名标准之一。

---

## 第6章 匿名签名

### 6.1 盲签名（Blind Signature）

**盲签名**允许用户让签名者对消息签名，而不让签名者看到消息内容。

#### 协议流程（RSA 盲签名）

```
用户                          签名者
  |                              |
  |  选择随机盲化因子 b          |
  |  计算 m' = m · b^e mod n     |
  |------- 盲化消息 m' ------->  |
  |                              |  σ' = (m')^d mod n
  |<------ 盲签名 σ' ----------  |
  |  去盲化: σ = σ' · b^{-1}    |
  |                              |
  |  得到消息 m 的合法签名 σ     |
```

#### 三个性质

1. **正确性**：$\sigma^e = (\sigma' \cdot b^{-1})^e = (m')^d \cdot b^{-e} = m \cdot b^e \cdot b^{-e} = m \mod n$

2. **不可伪造性**：签名者无法从 $\sigma'$ 中恢复 $m$（因为 $b$ 是随机的）

3. **不可链接性（Unlinkability）**：签名者无法关联 $(m, \sigma)$ 和 $(m', \sigma')$

#### 应用：电子现金（e-Cash）

**David Chaum 的经典方案**：
1. 银行使用盲签名签发电子货币（用户选择序列号，银行盲签名）
2. 用户消费时出示原始序列号和签名
3. 银行验证签名，检查序列号是否已花费

**关键**：银行不知道哪个用户对应哪个序列号（但能找到重复花费）。

**双重花费检测**：如果用户花两次同一序列号，银行可以追踪到身份。

---

### 6.2 环签名（Ring Signature）

**环签名**允许签名者代表一个群体（环）匿名签名，而**不暴露具体是谁**签的。

#### 临时公钥环

环签名不需要群管理员。签名者从一组公钥 $\{pk_1, \ldots, pk_n\}$ 中选择一个临时集合（环），其中**包含自己的公钥**，然后用自己的私钥生成签名。

**定义**：任何人都可以创建环——只要知道其他人的公钥即可。

#### 无群管理员

**环签名与群签名的关键区别**：
- 环签名：无需设置，无需管理员，签名者自己决定环成员
- 群签名：需要管理员，成员加入需要批准

#### 签名者匿名性

**匿名性**：给定签名 $\sigma$ 和环 $\{pk_1, \ldots, pk_n\}$，任何第三方无法以大于 $1/n$ 的概率确定哪个成员是真正的签名者。

**形式化**：签名者匿名性是**无条件**的（对某些构造）或**计算性**的。

#### 可链接环签名（Linkable Ring Signature）

**可链接环签名**额外支持**链接性**：可以判断两个签名是否来自同一个签名者，但**不能识别出是谁**。

**应用**：
- **Monero**：可链接环签名用于隐藏交易发送方
- 两个不同环中的签名如果来自同一用户，可以被链接，防止双重花费

#### 门限环签名（Threshold Ring Signature）

**门限环签名**要求 $t$ 个签名者共同生成一个环签名（$t$-out-of-$n$）：

- $t$ 个真实签名者合作
- 验证者只知道"至少 $t$ 个环成员签名"，不知道哪些成员签的

---

### 6.3 群签名（Group Signature）

**群签名**允许群成员代表整个群签名，群管理员可以在需要时撤销匿名性（Open）。

#### 群管理员

群签名中有两种管理员：
- **Issuer（签发者）**：负责添加新成员
- **Opener（打开者）**：负责追踪签名者身份（Open）

这两个角色可以分离（保证权力分散）。

#### 成员加入

1. 新用户与 Issuer 交互，生成成员证书
2. 证书通常是一个签名（由 Issuer 的密钥签发）
3. 用户使用证书生成群签名

#### 匿名签名

群签名在外部看来是完全匿名的——验证者只知道"这是某个群成员签的"，但不知道具体是谁。

#### Open 与追踪

群管理员（Opener）拥有**打开密钥**，可以：

1. 对给定签名 $\sigma$，提取签名者的身份 $id$
2. 提供"打开证明" $\pi_{\text{open}}$，证明 $id$ 确实是签名者

**应用场景**：在隐私保护系统中，当发生争议时可以追溯责任人。

#### 可撤销性（Revocability）

当成员被撤销时，有两种方式：

1. **累积器（Accumulator）**：维护一个动态集合，撤销时更新集合
2. **更新群公钥**：撤销后重新发布群公钥，撤销者无法再签名

**挑战**：高度动态的群体中，撤销效率是关键问题。

#### 环签名与群签名的区别

| 特性 | 环签名 | 群签名 |
|------|--------|--------|
| 设置 | 无需设置 | 需要群管理员 |
| 匿名性 | 第三方无法追踪 | 管理员可以追踪 |
| 环/群大小 | 由签名者决定 | 由管理员决定 |
| 可追溯 | 不能（可链接环签名除外） | 管理员可打开 |
| 主要应用 | 隐私交易、匿名投票 | 企业内部认证 |

---

### 6.4 匿名凭证（Anonymous Credentials）

**匿名凭证**系统允许用户获得一个凭证（Credential），然后在不暴露身份的情况下证明他们拥有某些属性。

#### Credential Issuance（凭证签发）

```
Issuer                              User
  |                                  |
  |  验证用户身份（现实世界）        |
  |  签发凭证 Cred = Sign(sk_I, attr) |
  |<----- 凭证 Cred ----------------|
```

#### Selective Disclosure（选择性披露）

用户可以选择性地披露属性而不泄露全部：

**例子**：
- 凭证包含：{姓名: "张三", 年龄: 25, 国家: "中国"}
- 用户只披露："年龄 ≥ 18"（不泄露具体年龄）
- 使用 ZKP 证明签名有效且属性满足条件

**关键性质**：
- 最小化信息泄露
- 非交互式
- 不可伪造

#### Unlinkability（不可链接性）

**不可链接性**保证：同一用户在不同场合出示凭证时，验证者无法关联这两次展示。

**实现**：
- **随机化凭证**：每次展示时重新随机化签名
- **ZKP + 承诺**：在 ZKP 中隐藏凭证的唯一标识

**典型系统**：Microsoft U-Prove、IBM Idemix（基于 Camenisch-Lysyanskaya 签名）

---

## 第7章 多参与方签名

### 7.1 多重签名（Multisignature）

**多重签名**允许多个签名者对**同一消息**生成一个紧凑的签名。

#### 多方同消息签名

**场景**：$n$ 个参与方，各自有密钥对 $(sk_i, pk_i)$，希望对同一个消息 $m$ 签名。

**输出**：一个签名 $\sigma$，验证者使用所有公钥验证。

**要求**：
- 签名大小与 $n$ 无关（紧凑）
- 验证者知道 $n$ 个公钥

#### Rogue-key Attack（流氓密钥攻击）

**场景**：攻击者知道其他参与方的公钥 $pk_1, \ldots, pk_{n-1}$，选择自己的公钥如下：

$$
pk_n = pk_{\text{own}} \cdot \prod_{i=1}^{n-1} pk_i^{-1}
$$

这样聚合公钥为：

$$
\tilde{pk} = \prod_{i=1}^n pk_i = pk_{\text{own}}
$$

**效果**：攻击者可以单独签署任何消息！

#### Proof of Possession（PoP，私钥拥有证明）

**防御 Rogue-key Attack**：

每个参与方在注册公钥时，需要提供一个**PoP**——用私钥对公钥的签名。

$$
\pi_i = \text{Sign}(sk_i, pk_i)
$$

验证者检查所有 PoP，确保每个参与方确实拥有对应的私钥。

**另一种防御方案**：使用**密钥聚合系数**（如 MuSig 方案），聚合公钥时每个公钥乘以不同的系数。

#### Schnorr 多重签名（MuSig）

**MuSig** 使用聚合系数解决 Rogue-key 问题：

1. 所有参与方交换公钥 $pk_i$
2. 计算聚合系数 $a_i = H(pk_1 \parallel \cdots \parallel pk_n \parallel pk_i)$
3. 聚合公钥 $\tilde{pk} = \prod_i pk_i^{a_i}$
4. 签名过程：多方交互生成 $(R, s)$，其中 $s = \sum_i s_i$（Schnorr 的线性性）

**安全性**：在 ROM 下可证安全（假设 DLOG 困难）。

---

### 7.2 聚合签名（Aggregate Signature）

**聚合签名**可以将 $n$ 个**不同消息**的签名聚合为一个紧凑签名。

#### 与多重签名的区别

| 特性 | 多重签名 | 聚合签名 |
|------|---------|---------|
| 消息 | **相同**消息 | **不同**消息 |
| 签名者 | 所有参与方 | 不同（可能无关） |
| 验证 | 知道所有公钥即可 | 需要所有公钥和消息 |

#### 聚合多个签名

**BLS 聚合签名**（基于双线性配对）：

对消息 $m_i$ 的签名 $\sigma_i = H(m_i)^{sk_i}$：

$$
\sigma_{\text{agg}} = \prod_i \sigma_i
$$

验证：

$$
e(\sigma_{\text{agg}}, g) = \prod_i e(H(m_i), pk_i)
$$

**注意**：如果不同消息相同，这个方案退化为多重签名。

#### 验证压缩

聚合签名的验证成本随 $n$ 线性增长（需要 $n$ 个配对运算对 BLS），但**通信成本**从 $O(n)$ 压缩到 $O(1)$。

**更高效的验证**：对 BLS 使用**批量验证**技术，可以将验证成本降低到 $O(\log n)$ 或近似常数。

---

### 7.3 门限签名（Threshold Signature）

**门限签名**要求 $t$ 个签名者（out of $n$）合作才能生成有效签名。

#### t-out-of-n 签名

**门限**：至少 $t$ 个签名者参与才能生成签名

- 如果少于 $t$ 个签名者，无法生成有效签名
- 如果多于 $t$ 个签名者，仍然可以生成签名

#### DKG（Distributed Key Generation，分布式密钥生成）

**DKG** 允许多方在不信任任何单一方的情况下共同生成密钥：

1. 每个参与方 $P_i$ 运行 $t$-out-of-$n$ 秘密共享生成私钥碎片 $sk_i$
2. 公钥 $pk$ 公开
3. 任何 $t$ 个参与方可以合作生成签名

**核心协议**：
- **Joint-Feldman DKG**：使用 Feldman VSS（可验证秘密共享）
- **Pedersen DKG**：改进的 DKG，更安全的承诺

#### Threshold RSA 签名

**RSA 门限签名**复杂得多，因为 RSA 的私钥 $d$ 不是直接的场元素。

**主要方案**：
- **Shoup 的阈值 RSA**（2000）：使用 Shamir 秘密共享在 $\mathbb{Z}_{\phi(n)}$ 中
- **需要可验证秘密共享（VSS）**

#### Threshold ECDSA 签名

**ECDSA 门限签名**尤其困难，因为 ECDSA 需要计算 $k^{-1}$ 和 $s = k^{-1} \cdot (m + r \cdot d)$，其中 $k$ 和 $d$ 是门限共享的。

**进展**：
- **GG18** (Gennaro & Goldfeder, 2018)：使用 Paillier 加密 + ZKP
- **GG20**：更高效的两方版本
- **CMP20** (Canetti et al.)：更简单的协议

**应用**：门限 ECDSA 广泛用于**多方钱包**和**跨链桥**。

#### Threshold Schnorr 签名

**Schnorr 门限签名**更直接，因为 Schnorr 签名是**线性**的：

$$
s = \sum_{i \in S} \lambda_i \cdot s_i
$$

其中 $\lambda_i$ 是 Lagrange 系数，$s_i = r_i + c \cdot sk_i$ 是各方的签名碎片。

**FROST（Flexible Round-Optimized Schnorr Threshold Signatures）**：
- 两轮签名（在预计算阶段后可以缩减为一轮）
- 支持 Identifiable Abort（可识别恶意参与方）

---

### 7.4 代理签名（Proxy Signature）

**代理签名**允许原始签名者将签名权委托给代理签名者。

#### 授权范围

原始签名者 $A$ 可以指定授权范围：

$$
\sigma_{\text{warrant}} = \text{Sign}(sk_A, \text{warrant})
$$

其中 $\text{warrant}$ 包括：
- 代理者身份 $B$
- 授权期限
- 可签消息类型
- 授权范围（如"只签财务类消息"）

#### 代理权撤销

**撤销方式**：
1. **有效期**：Warrant 中有过期时间
2. **显式撤销**：发布撤销声明
3. **链上撤销**：在区块链上记录撤销交易

**问题**：撤销后，代理者可能仍然持有之前的签名密钥。**On-chain 方案**通过每次签名时验证授权状态来解决。

#### 代理签名 vs 代理重加密（PRE）

| 特性 | 代理签名 | 代理重加密（PRE） |
|------|---------|-----------------|
| 功能 | 委托**签名权** | 委托**解密权** |
| 输出 | 签名 | 密文（可解密） |
| 代理者能否 | 代表原始签名者签名 | 转换密文 |

**差异本质**：代理签名改变的是**输出能力**（谁可以产生签名），PRE 改变的是**输入能力**（谁可以解密）。

---

## 第8章 特殊安全性质签名

### 前向安全（Forward Security）

**前向安全**保证：即使当前时间段的私钥泄露，攻击者无法伪造**之前时间段**的签名。

#### Key-evolving（密钥演化）

**核心思想**：私钥随时间变化（通过单向函数），公钥不变。

**演化方式**：

$$
sk_i = H(sk_{i-1}) \quad \text{或} \quad sk_i = sk_{i-1}^d \mod n
$$

**性质**：
- 给定 $sk_i$，无法恢复 $sk_{i-1}$（单向性）
- 公钥 $pk$ 始终不变
- 验证者不需要知道签名是在哪个时间段创建的（或者验证时需要时间参数）

**应用**：长期运行的密钥，如代码签名、CA 证书。

---

### 一次性签名（One-Time Signature）

**一次性签名**——同一个密钥只能签一条消息，签第二条消息就会泄露密钥。

#### 经典构造：Lamport OTS

**密钥生成**：
- 对每个比特 $i \in \{0, 1\}^\lambda$，生成两个值 $(sk_{i,0}, sk_{i,1})$
- 公钥：$pk_{i,b} = H(sk_{i,b})$

**签名**：对消息 $m$，根据 $m$ 的每个比特选择对应的 $sk$ 值

**安全性**：如果攻击者看到两条不同消息的签名，他可以推断出 $sk$ 的所有比特（因为不同消息的比特差异会暴露两个方向的 $sk$ 值）

**应用**：作为构建块用于更复杂的签名系统（如 XMSS、HORS）。

---

### 强不可伪造（Strong Unforgeability）

**EUF-CMA**（Existential Unforgeability under Chosen Message Attack）：攻击者不能伪造**任何新消息**的签名。

**SUF-CMA**（Strong Unforgeability under Chosen Message Attack）：攻击者不能伪造**任何新签名**——即使对已经签过的消息，也不能生成不同的签名。

**区别**：

- EUF-CMA：对未签过的消息，不能伪造签名
- SUF-CMA：对任意消息（包括已签过的），不能生成**不同的有效签名**

**为什么需要 SUF-CMA**？

考虑 ECDSA：给定签名 $(r, s)$，可以计算 $(r, -s)$ 也是一个有效签名（对某些曲线）——这是 EUF-CMA 安全的但非 SUF-CMA。

**应用**：在比特币中，如果签名方案不是 SUF-CMA，攻击者可以通过改变签名的编码来改变交易哈希（但交易仍然有效）。

---

### 指定验证者签名（Designated Verifier Signature）

**指定验证者签名**只允许**特定的验证者**相信签名的有效性，但对第三方不可传递。

#### 可否认性

**关键性质**：指定验证者 $V$ 可以用自己的私钥模拟出与真实签名不可区分的签名。

**构造**：给定一个标准的 ZKP 或 Schnorr 签名，指定验证者 $V$ 知道自己的私钥 $sk_V$，可以生成一个"看起来一样"的假签名。

**效果**：$V$ 向第三方展示签名时，第三方无法区分这是真的签名还是 $V$ 自己伪造的——因此 $V$ 无法"证明"给第三方看。

**应用**：私密通信——Bob 可以证明某个信息来自 Alice，但无法向 Charlie 证明（保护 Alice 的隐私）。

---

### 可否认签名（Deniable Signature）

**可否认签名**比指定验证者签名更一般化：签名者可以在事后否认自己签过某条消息。

**核心机制**：
- 在签名中加入随机化元素（如 ZKP）
- 任何方都可以生成"看起来有效"的假签名
- 没有人可以确定一个签名是否是"真"的

**与指定验证者签名的区别**：
- 指定验证者：只有特定验证者可以模拟
- 可否认：所有人都可以模拟

---

### 可编辑签名（Redactable Signature）

**可编辑签名**允许在签名后编辑消息的某些部分，而**不需要重新签名**。

**核心思想**：
1. 消息被编码为 Merkle 树或类似的承诺结构
2. 签名是对承诺的签名
3. 编辑时，删除某些叶子节点，保留对应的 Merkle 路径
4. 验证者检查：保留部分 + Merkle 路径 → 根哈希 → 签名验证

**应用**：
- 文档隐私：隐藏敏感部分（如医疗记录中的个人信息）
- 区块链压缩：只保留 Merkle 树的部分分支

**安全要求**：
- **不可伪造性**：不能添加未签名的内容
- **透明度**：不能隐藏编辑的事实（可以在签名中记录编辑范围）

---

### 适配器签名（Adaptor Signature）

**适配器签名**（又称**脚本less 脚本**）是一种"条件签名"——先声明一个预签名（Pre-signature），需要**秘密值** $y$ 的披露才能转化为完整签名。

#### 核心协议

**EOS 构造**（基于 Schnorr 的适配器签名）：

1. **预签名阶段**：Alice 知道秘密 $y$，Bob 不知道
   - Alice 发送预签名 $\tilde{\sigma} = (R, \tilde{s})$，其中 $\tilde{s} = r + c \cdot sk_A + y$
   - Bob 验证 $\tilde{s} \cdot G \stackrel{?}{=} R + c \cdot P_A + Y$（$Y = y \cdot G$）

2. **完成阶段**：Alice 发布 $\sigma = (R, s = \tilde{s} - y)$（或公开 $y = \tilde{s} - s$）
   - 观察 $\sigma$ 后，Bob 可以提取 $y = \tilde{s} - s$

**关键**：Bob 无法在不知道 $y$ 的情况下完成签名，但观察 Alice 完成签名后可以提取 $y$。

#### 应用：原子交换（Atomic Swap）

```
Alice (有比特币，想换以太坊)            Bob (有以太坊，想换比特币)
       |                                       |
       |  生成秘密 y, Y = y·G                 |
       |  发送比特币预签名                    |
       |-------- 预签名 σ_btc --------------> |
       |                                       |
       |                         发送以太坊预签名
       |<------- 预签名 σ_eth --------------- |
       |                                       |
       |  在以太坊链上完成 σ_eth (披露 y)     |
       |                                       |
       |  Bob 从 σ_eth 中提取 y               |
       |  在比特币链上完成 σ_btc              |
```

**安全性**：要么双方都完成交易，要么双方都拿不到对方的资产——原子性（Atomicity）。

**应用场景**：
- 跨链原子交换
- 闪电网络通道的 HTLC（哈希时间锁合约）替代方案
- 条件支付

---

### Verifiably Encrypted Signature（可验证加密签名）

**可验证加密签名**是签名的一个加密版本：第三方（仲裁者）可以解密验证签名，但不需要知道签名内容。

**构造**：
1. 签名者用仲裁者的公钥加密签名：$\text{Enc}(pk_A, \sigma)$
2. 同时提供一个 ZKP，证明"密文包含一个有效签名"
3. 仲裁者可以在争议时解密

**与适配器签名的区别**：

| 特性 | 适配器签名 | 可验证加密签名 |
|------|-----------|---------------|
| 开放方式 | 一方公开秘密 | 仲裁者解密 |
| 是否需要 ZKP | 否（代数结构保证） | 是（需要证明加密正确） |
| 典型应用 | 原子交换 | 公平交换、争议解决 |

**公平交换（Fair Exchange）**：
- Bob 支付后，Alice 释放签名
- 如果 Alice 不释放，仲裁者可以解密获得签名
- 所有人都相信仲裁者不会作弊（或者使用多方仲裁）

---

> **总结：零知识证明与数字签名**
>
> - **ZKP** 是"证明而不泄露"，从 Sigma 协议到 SNARK/STARK，平衡效率、安全性和信任假设
> - **匿名签名** 提供隐藏身份的签名能力（盲签名、环签名、群签名、匿名凭证）
> - **多参与方签名** 实现多方协作（多签、聚合签、门限签、代理签）
> - **特殊签名** 在前向安全、可否认、可编辑、适配器等方向提供更灵活的安全属性
