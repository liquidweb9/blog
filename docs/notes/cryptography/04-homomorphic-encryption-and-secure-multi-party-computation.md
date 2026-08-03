# 同态加密与安全多方计算

---

## 第1章 同态加密基础

### 1.1 同态性质

同态加密（Homomorphic Encryption, HE）的核心思想是：**在密文上直接进行计算，结果解密后等价于在明文上做同样计算**。这是密码学中"可计算加密"的终极目标之一。

**定义**：设 $\text{Enc}(pk, m) \to c$，$\text{Dec}(sk, c) \to m$。若对任意运算 $\circ$，存在有效算法 $\text{Eval}$ 使得：

$$
\text{Dec}(sk, \text{Eval}(pk, \circ, c_1, ..., c_n)) = \circ(m_1, ..., m_n)
$$

则称该加密方案对运算 $\circ$ 是同态的。

**加法同态**：$\text{Dec}(sk, c_1 \oplus c_2) = m_1 + m_2$。密文域加法对应明文域加法。

**乘法同态**：$\text{Dec}(sk, c_1 \otimes c_2) = m_1 \times m_2$。密文域乘法对应明文域乘法。

**密文域计算**：第三方（Server）在只持有公钥 $pk$ 和密文 $c_i$ 的情况下，可以运行 $\text{Eval}$ 得到计算结果密文 $c_{\text{result}}$，但对 $m_i$ 和结果明文一无所知。

**明文/密文空间**：
- 明文空间 $\mathcal{M}$：通常是环 $\mathbb{Z}_t$（整数模 $t$）或多项式环 $R_t = \mathbb{Z}_t[X]/(X^N+1)$
- 密文空间 $\mathcal{C}$：通常是环 $R_q^2$ 或 $R_q^k$，$q \gg t$ 提供噪声空间
- 密文相对明文的膨胀比 $\frac{|\mathcal{C}|}{|\mathcal{M}|}$ 是工程中重要的成本指标

### 1.2 同态加密分类

按照支持的计算能力，同态加密分为以下层次：

| 类型 | 支持运算 | 典型代表 |
|------|---------|---------|
| PHE (Partially HE) | 仅加法或仅乘法 | RSA, ElGamal, Paillier |
| Somewhat HE (SWHE) | 有限次加法和乘法 | 早期Gentry方案雏形 |
| Leveled FHE | 预定层数的所有运算 | BFV, BGV, CKKS |
| FHE (Fully HE) | 任意次所有运算 | 所有Leveled FHE + Bootstrapping |

**PHE (Partially Homomorphic Encryption)**：仅支持加法同态或乘法同态中的一种，无法同时支持两者（或同时支持时密文大小爆炸）。计算能力有限，但在特定场景（如电子投票、隐私计费）已足够。

**有限层级（Somewhat HE）**：同时支持加法和乘法，但乘法深度受限于噪声预算。噪声随乘法呈指数级增长，到达一定程度后解密失败。只是理论过渡，实践中很少直接使用。

**Leveled FHE**：通过参数化设置（如更大的 $q$ 和多项式次数 $N$）预先分配足够的噪声预算来支持目标乘法深度 $L$。不需要Bootstrapping，但参数随 $L$ 增长。公式体会为：$q \sim B^{L+1}$ 或 $q \sim B^{O(L)}$，其中 $B$ 是单次乘法噪声增长因子。

**FHE (Fully Homomorphic Encryption)**：通过Bootstrapping（自举）在计算过程中刷新密文，使其噪声重置到低水平，从而支持无限深度的计算。这是Gentry 2009年博士论文的里程碑贡献。

### 1.3 典型部分同态方案

**RSA 乘法同态**：

RSA加密：$c = m^e \mod N$，解密：$m = c^d \mod N$。

$$
c_1 \cdot c_2 = m_1^e \cdot m_2^e = (m_1 \cdot m_2)^e \mod N
$$

密文乘积解密后得到 $m_1 \cdot m_2$。这是天然的乘法同态。注意RSA本质上是在 $\mathbb{Z}_N^*$ 上的确定性加密（教科书RSA），语义安全需要引入随机填充OAEP，但填充后会破坏同态性。因此RSA同态在实际密码学协议中使用有限。

**ElGamal 乘法同态**：

密钥生成：$sk = x \in \mathbb{Z}_q$，$pk = (G, q, g, h = g^x)$。

加密：随机数 $r \in \mathbb{Z}_q$，$c = (c_1 = g^r, c_2 = m \cdot h^r)$。

解密：$m = c_2 \cdot (c_1^x)^{-1} = m \cdot g^{xr} \cdot g^{-xr} = m$。

同态乘法：

$$
(c_1, c_2) \cdot (c_1', c_2') = (g^{r+r'}, (m \cdot m') \cdot h^{r+r'})
$$

解密得 $m \cdot m'$。ElGamal是乘法同态且在DDH假设下是语义安全的。

**Paillier 加法同态**：

Paillier基于合数剩余假设（$N = pq$，判定 $N$ 次剩余困难性）。

公钥 $N$，私钥 $\lambda = \text{lcm}(p-1, q-1)$。

加密：$c = g^m \cdot r^N \mod N^2$，其中 $g$ 是生成元，$r$ 随机。

同态加法：

$$
c_1 \cdot c_2 = g^{m_1+m_2} \cdot (r_1 r_2)^N \mod N^2
$$

解密得 $m_1 + m_2 \mod N$。这是密码学中最常用的加法同态方案之一。

**Paillier 还支持标量乘法**：$c_1^k \to k \cdot m_1 \mod N$。

---

## 第2章 全同态加密核心机制

### 2.1 密文噪声

**为什么存在噪声**：

几乎所有现代FHE方案（BFV/BGV/CKKS/TFHE）都基于**带错误学习问题（Learning With Errors, LWE）**或其环变体 **Ring-LWE (RLWE)**。安全性依赖于：给定 $(a, b = a \cdot s + e)$，区分 $b$ 与随机数困难。其中 $e$ 就是**噪声/错误**，是安全性的根本来源。没有噪声，LWE就退化为线性方程组，存在多项式时间求解算法。

同态加密中，密文结构为：

$$
c = (a, b = a \cdot s + \Delta m + e)
$$

其中 $\Delta$ 是缩放因子（scaling factor），用于将明文 $m$ 嵌入到密文空间中并和噪声 $e$ 分离。

**同态运算为何增噪**：

- **加法**：噪声相加 $e_{\text{add}} = e_1 + e_2$，范数 $\|e_{\text{add}}\| \leq \|e_1\| + \|e_2\|$，线性增长。
- **乘法**：噪声相乘 $e_{\text{mult}} = e_1 \cdot s_2 + e_2 \cdot s_1 + e_1 \cdot e_2 + \text{重线性化噪声}$，增长远快于加法。

乘法噪声比加法大得多。在BFV中，乘法噪声约为 $\|e_{\text{mult}}\| \approx \delta \cdot B \cdot (\|m_1\| + \|m_2\|) + B^2$，其中 $\delta$ 是多项式展开系数。

**噪声预算（Noise Budget）**：

用模数 $q$ 和明文模数 $t$ 的比值来估算：初始噪声预算约为 $\log_2(q/t)$ 比特。每次乘法消耗约 $\log_2(\text{噪声增长因子})$ 比特。当噪声预算耗尽（即 $e > q/t$），解密将出错。

**模数链（Modulus Chain）**：

BGV/CKKS使用模数链 $q_0 < q_1 < ... < q_L$。初始密钥和密文使用 $q_L$（最大模数），每次乘法后执行Modulus Switching切换到更小的 $q_{L-1}$。相当于"丢弃"一部分噪声。模数链长度 $L+1$ 对应可支持的乘法深度。

### 2.2 Bootstrapping

**核心思想**：

Bootstrapping（自举）是Gentry 2009年提出的革命性概念。本质是：**在密文上同态执行解密电路，把"脏"密文刷新为"干净"密文**。

设 $c$ 是当前密文，噪声已接近上限。构造：

$$
c' = \text{Enc}(\text{Dec}(sk, c))
$$

但 $sk$ 被加密为 $\overline{sk}$，因此可在公钥下执行：

$$
c' = \text{Eval}(\text{Dec}_{\overline{sk}}(c))
$$

$c'$ 是对 $m$ 的**新密文**，噪声被重置到接近0的水平。

**为什么这能实现FHE**：

有了Bootstrapping，任何有限深度的Eval操作后都可以刷新密文，从而支持无限深度。因此：Leveled FHE + Bootstrapping = FHE。

**解密电路同态执行**：

解密电路本身必须"浅"（低乘法深度）。LWE解密是线性的：$m = \langle c, sk \rangle \mod q \mod p$。但取模运算需要转换为加减法，导致电路深度增加。所有FHE方案都精心设计了低深度的解密表示。

**计算成本**：

Bootstrapping是FHE中最昂贵的操作。在2024年的优化中：
- TFHE：约 10-50ms 每次（位级）
- CKKS：约 100ms-1s（浮点数级）
- BFV/BGV：约 1-10s

相比普通同态运算（微秒级），Bootstrapping慢3-6个数量级。

**Programmable Bootstrapping (PBS)**：

TFHE 的独特创新。PBS 不仅能刷新密文，还能**同时计算任意函数**。它利用自举过程中的累加器查表（LUT），在刷新噪声的同时完成 $f(m)$ 的计算。这使得TFHE特别适合布尔电路和条件分支。

### 2.3 密文运算

**加法**：

BFV/BGV层面：$(c_1 + c_2) = (a_1 + a_2, b_1 + b_2)$，对应多项式系数相加。噪声增长 $O(B)$。

CKKS层面：分量直接相加，对应复向量加法。

**乘法**：

密文乘法 $c_{\text{mult}} = (c_1 \cdot c_2)$ 需要扩展密文维度。初始密文是 $(a, b)$ 两个多项式，相乘后得到：

$$
c_{\text{mult}} = (c_{1,0} c_{2,0}, c_{1,0} c_{2,1} + c_{1,1} c_{2,0}, c_{1,1} c_{2,1})
$$

这是3个多项式的向量（二次扩展）。多次连续乘法会导致维度指数级膨胀。

**Relinearization（重线性化）**：

将3维密文压缩回2维。核心思想是使用**重线性化密钥**（evaluation key, evk）将二次项 $c_{1,1} \cdot c_{2,1}$ 重新编码为 $sk$ 的一次项。

数学本质：

$$
c_{1,1} \cdot c_{2,1} \cdot s^2 \approx \text{evk}(s^2) \cdot (a', b')
$$

其中 $\text{evk}(s^2) = \text{Enc}(s^2)$ 是公钥发布的辅助密钥。重线性化后密文恢复2维。

**Rescaling（重缩放）**：

用于CKKS方案。CKKS中密文为 $c = a \cdot s + \Delta m + e$，其中 $\Delta = 2^p$。乘法后缩放因子平方 $\Delta^2$，通过 rescaling 除以 $\Delta$ 恢复为 $\Delta$，同时截断低比特噪声。

**Modulus Switching（模数切换）**：

用于BGV方案。将密文从 $c \mod q$ 转换为 $c' \mod q'$，$q' < q$。近似缩放 $c' \approx \frac{q'}{q} \cdot c$。这削减了噪声，代价是损失了一部分模数空间。

**Key Switching（密钥切换）**：

将密钥为 $s_1$ 的密文转换为密钥为 $s_2$ 的密文。用于Relinearization（$s^2 \to s$）和多密钥场景。同样需要辅助密钥 $\text{ksk}_{s_1 \to s_2}$。

**Rotation（旋转）**：

CKKS/BGV的SIMD打包中，加密向量 $[m_0, m_1, ..., m_{N-1}]$ 可以通过旋转操作变为 $[m_k, m_{k+1}, ..., m_{k-1}]$。用于实现Sum、Dot Product等操作。需要旋转密钥 $\text{rk}_k$。

### 2.4 SIMD与Packing

**批量编码（Packing, Batching）**：

利用中国剩余定理（CRT）或复数嵌入，在一个明文多项式中打包多个独立消息。

对于多项式环 $R = \mathbb{Z}[X]/(X^N+1)$，明文槽（slots）数量 = $N$（对于CKKS复数编码）或 $N/d$（对于BFV/BGV利用CRT分解）。

$$
\text{Encode}(m_0, m_1, ..., m_{k-1}) \to p(X) \in R_t
$$

加密后，对密文的加法/乘法对应**分量级**的加法/乘法（SIMD并行）。

**Slot（槽）**：

- BFV/BGV：利用分圆多项式的CRT性质，$X^N+1$ 分解为 $k$ 个不可约因子，每个因子对应1个slot
- CKKS：利用复嵌入（canonical embedding），将复数向量 $\mathbb{C}^{N/2}$ 编码为多项式

一个同态乘法同时对所有slot执行：$\text{EvalMult}(c_1, c_2)$ 解密后每个slot得到 $m_{1,i} \cdot m_{2,i}$。

**Rotate-and-Sum**：

要在所有slot上执行求和（如内积），需要：

1. 使用 Rotate 操作将向量元素重新排列
2. 使用 Add 累加

经典算法（所有归约的log步骤）：

```
for i = 1, 2, 4, ..., k/2:
    sum += rotate(sum, i)
```

复杂度 $O(\log k)$ 次旋转。

**密文矩阵运算**：

将矩阵按行或列打包到多个密文中。常用策略：
- **行主序打包**：每行一个密文，矩阵乘法通过行-列内积实现
- **对角打包（Diagonal Packing）**：按对角线打包，$O(n)$ 个密文表示 $n \times n$ 矩阵
- **Baby-Step Giant-Step**：复杂度 $O(\sqrt{n})$ 的矩阵向量乘法

CKKS在矩阵乘法中尤其高效，因为在复向量上的线性变换天然适合SIMD。

---

## 第3章 主流HE方案

### 3.1 BFV

BFV（Brakerski-Fan-Vercauteren）是基于RLWE的整数算术方案，执行**精确整数运算**。

**密文结构**：

$$
c = (a, b = a \cdot s + \Delta m + e) \in R_q^2
$$

其中 $\Delta = \lfloor q / t \rfloor$，$t$ 是明文模数，$q$ 是密文模数，$m \in R_t$。

**解码与解密**：

$$
m' = \left\lfloor \frac{t \cdot \langle c, s \rangle}{q} \right\rceil \mod t
$$

其中 $\langle c, s \rangle = b - a \cdot s = \Delta m + e$。

**噪声增长**：

- 加法：$\|e_{\text{add}}\| \leq \|e_1\| + \|e_2\|$
- 乘法：$\|e_{\text{mult}}\| \approx \delta \cdot \|m_1\| \cdot \|e_2\| + \delta \cdot \|m_2\| \cdot \|e_1\| + \|e_1\| \cdot \|e_2\| + \mathcal{O}(\text{relin})$

其中 $\delta$ 是多项式展开系数（约 $N$）。重线性化贡献约 $B_{\text{ks}}$（密钥交换噪声）。

**编码方式**：

整数的多项编码：$m \to p(X)$ 即常多项或按系数编码。SIMD打包时利用CRT将 $\mathbb{Z}_t$ 分解为多个 slot。

**优劣势**：
- 优点：精确整数运算，适合精确性敏感的场景（如数据库查询、精确统计）
- 缺点：乘法的噪声增长较快（与多项式次数 $N$ 和明文大小有关），大整数运算需要大参数

### 3.2 BGV

BGV（Brakerski-Gentry-Vaikuntanathan）与BFV是同一时期、相同安全基础的姊妹方案，但**噪声管理策略不同**。

**核心机制**：

BGV不使用缩放因子 $\Delta$，而是直接编码：$c = (a, b = a \cdot s + m + e \pmod q)$，其中 $m \in R_t$ 直接被加到密文上（小噪声）。

**模数切换（Modulus Switching）**：

BGV的核心噪声控制手段。乘法后噪声增长，将密文从模 $q$ 切换到模 $q'$：

$$
c' = \left\lfloor \frac{q'}{q} \cdot c \right\rceil
$$

乘以 $q'/q$ 缩小了噪声，代价是损失 $(q - q')$ 的模数空间。设计模数链 $q_0 < q_1 < ... < q_L$，每个层级对应一个模数。

**层级同态（Leveled HE）**：

设置 $L$ 层模数链，支持最多 $L$ 次乘法（不考虑加法）。初始密文在最高层 $L$，每个乘法后做一次模数切换降低一层，直到 $q_0$。额外的预算需要增大 $L$，从而增大 $q$ 和 $N$。

**与BFV的联系**：

- 相同安全基础：RLWE
- BFV固定 $q$，用 $\Delta$ 管理噪声；BGV减小 $q$，不用 $\Delta$
- BFV的Rescaling与BGV的Modulus Switching本质相似
- 性能上：BFV在小明文（低 $t$）时更高效；BGV在深层电路中更有优势（不需要每次乘法都rescaling）
- 实践中两者差距不大，具体取决于实现优化（如Microsoft SEAL库同时实现了BFV和CKKS）

### 3.3 CKKS

CKKS（Cheon-Kim-Kim-Song）是目前在机器学习隐私推理领域中应用最广泛的FHE方案。与BFV/BGV的本质区别在于它执行**近似算术**而非精确算术。

**密文结构**：

$$
c = (a, b = a \cdot s + m + e) \in R_q^2
$$

其中 $m$ 是**编码后的明文**（复数向量），$e$ 是近似计算中可容忍的误差。

**编码方式（复数嵌入）**：

利用分圆环的规范嵌入（canonical embedding），将 $N/2$ 维复数向量编码为多项式：

$$
\text{Encode}(z_0, z_1, ..., z_{N/2-1}) \to m(X) \in R
$$

解码时存在约 $\pm \sigma$ 的近似误差，取决于编码/解码精度。

**Scale 管理**：

CKKS中每个密文附带一个 scale $\Delta$（通常 $\Delta = 2^p$，$p=30\sim60$）。实际密文值 $= \Delta \cdot m_{\text{plain}}$。

- 乘法后：$scale = \Delta^2$，需要 Rescaling 除以 $\Delta$ 恢复为 $\Delta$
- Rescaling 同时截断了低比特的噪声

**Rescaling 操作**：

```
c_mult = multiply(c1, c2)   // scale = Δ²
c_rescaled = rescale(c_mult) // scale = Δ, modulus q -> q/Δ
```

每做一次乘法，模数链消耗一层。这与BGV的模数切换异曲同工。

**误差传播**：

CKKS引入三种误差源：
1. **编码/解码误差**：浮点数->多项式->浮点数转换中舍入
2. **同态运算误差**：乘法、旋转等操作产生的近似
3. **重缩放误差**：除以 $\Delta$ 时截断

整体误差 $E_{\text{total}} \approx \sqrt{n} \cdot \sigma$ 在固定精度下可控。误差与深度 $L$ 的关系约为 $\sigma \cdot \sqrt{L}$。

**ML推理应用**：

CKKS在隐私推理中占据主导地位：
- 线性层（FC, Conv）：矩阵乘法 + 加法，CKKS的SIMD天然支持
- 激活函数：需要多项式近似（见第4章）
- 优势：高效向量化、误差在可接受范围内、参数紧凑

### 3.4 TFHE

TFHE（Turbo/Fast Fully Homomorphic Encryption）由Chillotti等人在2016年提出，是目前**最快**的位级FHE方案。

**基础结构**：

TFHE基于 **GLWE（General LWE）** 和 **GGSW（Gentry-Garg-Sahai-Waters）** 密文类型。

- LWE密文：$(a, b) \in \mathbb{Z}_q^{n+1}$，解密 $m = (b - \langle a, s \rangle) \mod q$
- GGSW密文：矩阵形式的密文，用于自举中的累加器

**门级Bootstrapping（Gate Bootstrapping）**：

TFHE的自举（PBS）是**门级**的——每次逻辑门运算都伴随一次自举。这看似昂贵，但由于自举极其高效（微秒级），反而成为了优势。

一次Gate Bootstrapping的步骤：
1. 将密文通过累加器（ACC）转换为多项式环上的表示
2. 利用盲转置（Blind Rotate）实现查表
3. 提取LWE密文

**查表运算（Look-Up Table, LUT）**：

PBS的核心优势之一是可以在Bootstrapping过程中执行任意函数 $f: \{0,1\}^k \to \{0,1\}$。这通过将真值表编码为多项式系数实现。

例如AND门的LUT：$[0, 0, 0, 1]$ 对应 $f(x_1, x_2) = x_1 \land x_2$。

**TFHE的运算类型**：
- 二元门：AND, OR, XOR, NAND, NOR, XNOR
- 多元门：MUX, Majority, 任意 $k$-输入布尔函数
- 算术：加法器、比较器、移位器等通过布尔电路组合

**与CKKS的区别**：

| 维度 | TFHE | CKKS |
|------|------|------|
| 运算类型 | 布尔位运算 | 浮点数算术 |
| 明文空间 | $\mathbb{Z}_2$ | $\mathbb{C}^{N/2}$ |
| Bootstrapping | 每次运算后（ms级） | 深度预算耗尽后（s级） |
| 查表 | 原生支持（PBS） | 需多项式近似 |
| 适合场景 | 条件分支、比较、控制流 | 向量算术、线性代数 |
| 精度 | 精确布尔 | 近似浮点 |

**TFHE优化进展**：
- **Chimera**：TFHE + CKKS混合，利用各自优势
- **Multi-bit PBS**：一次处理多位
- **可编程自举的GPU加速**：NVIDIA GPU上达到10-100倍加速

---

## 第4章 HE工程问题

### 参数选择

参数集 $(\lambda, N, q, t, \sigma)$：
- $\lambda$：安全级别（128, 192, 256-bit）
- $N$：多项式次数（1024, 2048, 4096, 8192, 16384, 32768）
- $q$：密文模数（bit长度 $\sim 20$ 到 $\sim 1800$）
- $\sigma$：噪声标准差（通常 $3.2$ 或 $6.4$）

**安全级别**：根据LWE安全估计器（如 lwe-estimator），给定 $(N, q, \sigma)$ 可计算攻击复杂度。常见参数：
- 128-bit 安全：$N=4096, \log_2 q \approx 109$（基础级）
- 128-bit 安全：$N=8192, \log_2 q \approx 218$（中深度）
- 128-bit 安全：$N=16384, \log_2 q \approx 438$（深度）

**乘法深度 $L$**：每个乘法消耗约 30-60 bit的模数（取决于方案和参数）。$L = \lfloor \log_2 q / \text{per\_mult} \rfloor$。

### 密文膨胀

- **膨胀比**：密文大小 / 明文大小
- 典型值：一个CKKS密文 $N=4096, q=109\text{bit}$，约 109KB，包含 $N/2=2048$ 个复数，膨胀比约 1000-10000 倍
- 小密文（如TFHE的LWE密文）：约 1KB 每条，膨胀比小很多
- 工程含义：大膨胀比限制了大数据的全同态加密传输

### 通信成本

- **密钥交换**：评估密钥、旋转密钥、重线性化密钥（$O(L \cdot N^2)$ 量级，可达GB级别）
- **密文传输**：中间结果密文通过网络传输
- **优化**：压缩、使用sealable传输协议、利用客户端预处理

### 客户端/服务器分工

经典隐私推理工作流：

```
客户端: 输入 x → Enc(x) → 发送密文 → 接收结果密文 → Dec → 结果
服务器: 接收密文 → Eval(Model, Enc(x)) → 返回结果密文
```

**分工考虑**：
- 客户端：加密、解密、密钥生成、在线预处理（生成Beaver三元组等）
- 服务器：同态运算、Bootstrapping、参数管理

**离线/在线分离**：客户端可离线生成大量评估密钥和辅助数据，在线阶段只需发送输入密文。

### 非线性函数在HE中的处理

FHE原生支持加法和乘法，非线性函数需近似。

**多项式近似**：

用有限次多项式近似目标函数。常用方法：
- **Chebyshev近似**：在区间 $[-1, 1]$ 上最小化最大误差
- **Minimax近似**：通过Remez算法得到最优一致逼近
- **Taylor展开**：局部最优但在大范围内误差发散
- **LS（Least Squares）近似**：全局均方误差最小

近似多项式次数 $d$ 决定了需要的乘法深度 $L \approx \log_2 d$。

**Softmax函数**：

$$
\text{Softmax}(x_i) = \frac{e^{x_i}}{\sum_j e^{x_j}}
$$

HE中的挑战：指数运算。处理方式：
1. 用多项式近似 $e^x$（约8-12次多项式在 $[-10, 10]$ 内足够）
2. 用同态除法实现 $\frac{\cdot}{\sum}$（或近似：用乘法 + 牛顿法求逆）
3. CKKS中可以接受 $10^{-3}$ 到 $10^{-5}$ 的近似误差

**ReLU函数**：

$$
\text{ReLU}(x) = \max(0, x)
$$

最大值运算在HE中是条件分支，需要逼近：
1. 多项式近似：$\text{ReLU}(x) \approx \frac{x + P(x)}{2}$，其中 $P$ 是符号函数逼近
2. 分段多项式：$[x < 0]$ 用比较器的多项式近似
3. 平方近似：$\text{ReLU}(x) \approx \frac{x + \sqrt{x^2 + \epsilon}}{2}$

实践中使用3-5次多项式在 $[-5, 5]$ 上可达到1%的相对误差。

**比较运算（$\geq, <, =$）**：

比较 = 符号函数 $\text{sign}(x-y)$ 的近似。常用：
- **傅里叶系数的正弦近似**：$\text{sign}(x) \approx \frac{2}{\pi} \sum_{k=1,3,5,...} \frac{\sin(kx)}{k}$
- **多项式逼近**：如 $\text{sign}(x) \approx x \cdot (1 + \sum c_i x^{2i})$
- **TFHE直接查表**：LUT原生支持比较，精确且高效

### HE与MPC混合协议

HE和MPC是互补的：

| 方面 | HE | MPC |
|------|-----|-----|
| 通信轮数 | $O(1)$ | $O(\text{电路深度})$ |
| 计算开销 | 高（多项式运算） | 低（对称操作） |
| 参与方数量 | 1 Server + N Clients | N方协作 |
| 安全性 | 计算安全（量子不安全？） | 信息论安全或计算 |
| 掉线容忍 | 高（非交互） | 低（需在线） |

**混合协议的常见模式**：
1. **客户端用HE加密输入发送给服务器，MPC在服务器间处理**：既获得了非交互性（客户端只发不参与），又避免了HE的昂贵运算
2. **HE做离线预处理**：一方生成HE密文，多方用MPC协议计算中间值
3. **MPC-in-the-Head + HE**：用HE替代MPC中的承诺方案

### HE在隐私推理中的适用边界

**适合的场景**：
- 模型参数隐私（服务器不想泄露权重）且 用户输入隐私
- 非交互式：用户离线，服务器独立完成推理
- 低深度网络：如小型CNN、Logistic回归、浅层Transformer
- 批处理推理：利用SIMD优化

**不适合的场景**：
- 深度网络（ResNet-152, GPT-4）：乘法深度爆表，参数巨大
- 需要精确比较的条件控制流：TFHE可处理但速度慢
- 高吞吐在线服务：HE密文处理速度远低于明文推理（慢1000-10000倍）

**典型延迟**（2024年水平，CKKS $N=4096$）：
- 单次密文乘法：~0.5-2ms
- 单次Bootstrapping：~0.1-1s
- MNIST推理：~2-10s
- ResNet-20推理：~30-300s
- Transformer单层前向：~10-60s

**未来方向**：
- GPU/FPGA/ASIC加速（10-100倍提升）
- 更高效的Bootstrapping方案
- HE友好型神经网络架构设计（减少激活函数复杂度、控制深度）

---

## 第5章 MPC基本模型

### 5.1 MPC解决的问题

**安全多方计算（Secure Multi-Party Computation, MPC）** 允许 $n$ 个参与方 $P_1, ..., P_n$，各自持有私密输入 $x_1, ..., x_n$，共同计算联合函数 $f(x_1, ..., x_n)$，使得：

1. 每方只得到 $f$ 的输出结果（和自身输入推导出的信息）
2. **任何合谋方组无法获知其他方的私密输入**

这是密码学中"联合计算但不泄露私密输入"的核心问题模型。

**经典例子**：
- **百万富翁问题**（Yao, 1982）：两个富翁比较谁更富，但不透露各自财富
- **联合统计**：多个医院联合训练AI模型，不泄露各自的患者数据
- **密封拍卖**：竞拍者各自出价，计算赢家和价格，不泄露其他出价

**形式化**：
理想世界存在可信第三方（TTP），各方将输入发送给TTP，TTP计算 $f$ 后广播结果。MPC的目标是在**没有可信第三方**的真实世界中，模拟出理想世界的行为。

### 5.2 安全目标

**输入隐私（Input Privacy）**：

各参与方的私密输入 $x_i$ 仅被用于计算 $f$ 所需的程度，任何额外信息都不应泄露。形式化为：存在模拟器 $\mathcal{S}$，使得真实协议的执行视图与 $\mathcal{S}$ 在理想世界中生成的视图不可区分。

**输出正确性（Output Correctness）**：

输出必须等于 $f(x_1, ..., x_n)$ 在正确输入下的计算结果。恶意方不能篡改输出。

**独立输入（Independence of Inputs）**：

参与方选择输入时不能依赖于其他方的输入（除了通过协议本身获取的信息）。这要求输入在协议开始前就已确定。

**公平性（Fairness）**：

要么所有参与方都得到输出，要么没有方得到。如果仅部分方得到输出，协议不公平。在恶意方占多数的场景中，公平性通常无法保证（没有输出即可）。

**Guaranteed Output Delivery (GOD)**：

诚实方**保证**能获得输出，即使恶意方试图阻止。这是比公平性更强的要求。GOD在诚实方占多数时可实现。

**安全定义框架**：
- **半诚实安全**：各参与方遵守协议，但试图从协议视图中提取额外信息
- **恶意安全**：参与方可任意偏离协议，但无法获取额外信息或影响输出

### 5.3 攻击模型

**半诚实（Semi-honest / Honest-but-Curious）**：

参与方严格遵循协议规范，但会**记录所有收到的消息**并尝试推导额外信息。这是最常见的基础假设。

现实意义：各方有商业/法律激励去遵守协议，但会好奇地分析数据。实现半诚实安全是MPC的"最小公分母"。

**恶意（Malicious / Active）**：

参与方可以**任意偏离协议**：
- 提前中止
- 发送伪造消息
- 修改中间状态
- 适应性选择输入

恶意安全需要**强制协议**（force protocol）确保偏差可检测或被惩罚。

**腐化模型（Corruption Model）**：

- **静态腐化（Static Corruption）**：协议开始前，攻击者就选定腐化哪些参与方，且在协议过程中不变
- **适应性腐化（Adaptive Corruption）**：攻击者可在协议过程中**根据看到的信息**动态决定腐化谁。这更难防御。

**Honest / Dishonest Majority**：

- **Honest Majority**：诚实方多于腐化方（$t < n/2$）。可实现公平性、GOD、信息论安全。
- **Dishonest Majority**：腐化方可占多数（$t < n$，允许 $n-1$ 方合谋）。只能做到计算安全，公平性通常无法保证。

哈希（Hash）符号：$n$ 方中至多 $t$ 方腐化。

---

## 第6章 秘密共享

### 6.1 加法秘密共享

**核心思想**：将秘密 $s \in \mathbb{Z}_p$ 分割为 $n$ 份共享 $[s_1, ..., s_n]$，使得任意 $< n$ 份得不到 $s$ 的任何信息（信息论安全），全部 $n$ 份可恢复 $s$。

**Share生成**：

随机选取 $[s]_1, ..., [s]_{n-1} \xleftarrow{R} \mathbb{Z}_p$，令：

$$
[s]_n = s - \sum_{i=1}^{n-1} [s]_i \pmod p
$$

**重构**：

$$
s = \sum_{i=1}^n [s]_i \pmod p
$$

**加法本地计算**：

$$
[s + t]_i = [s]_i + [t]_i \pmod p
$$

每方本地计算即可，零交互！这是秘密共享最强大的性质。

**乘法需交互原因**：

$$
[s \cdot t]_i \neq [s]_i \cdot [t]_i
$$

$[s]_i \cdot [t]_i$ 包含交叉项，不能直接得到 $s \cdot t$ 的正确共享。需要参与方之间交互来消去交叉项。这正是Beaver三元组和SPDZ中乘法的核心动机。

具体而言：

$$
s \cdot t = \left(\sum_i [s]_i\right) \cdot \left(\sum_i [t]_i\right) = \sum_i [s]_i[t]_i + \sum_{i \neq j} [s]_i[t]_j
$$

本地项 $\sum_i [s]_i[t]_i$ 可计算，但交叉项 $\sum_{i \neq j} [s]_i[t]_j$ 需交互。

### 6.2 Shamir秘密共享

**核心思想**：利用 $t$ 次多项式插值实现 $t$-out-of-$n$ 门限秘密共享。

**设定**：门限 $t$，总方数 $n$，秘密 $s \in \mathbb{F}_p$。

**Share生成**：

随机选取 $a_1, ..., a_{t-1} \xleftarrow{R} \mathbb{F}_p$，构造多项式：

$$
f(X) = s + a_1 X + a_2 X^2 + ... + a_{t-1} X^{t-1}
$$

第 $i$ 方的共享：$[s]_i = f(i)$（在非零取值点 $i \neq 0$ 处求值）。

**重构（Lagrange插值）**：

任意 $t$ 个共享 $(i_1, [s]_{i_1}), ..., (i_t, [s]_{i_t})$ 可通过Lagrange插值恢复 $f(0) = s$：

$$
s = \sum_{k=1}^t [s]_{i_k} \cdot \lambda_{i_k}(0)
$$

其中 Lagrange 系数：

$$
\lambda_{i_k}(0) = \prod_{j \neq k} \frac{0 - i_j}{i_k - i_j}
$$

**信息论安全**：

任意 $t-1$ 个共享不泄露任何关于 $s$ 的信息。对于任意猜测 $s'$，都存在一个 $t-1$ 次多项式通过给定的 $t-1$ 个点和 $(0, s')$，且所有多项式等可能。所以信息论上不可区分。

**同态性质**：

- **加法**：$[s+t]_i = [s]_i + [t]_i$，多项式 $f_s + f_t$ 次数仍为 $t-1$
- **乘法**：$[s \cdot t]_i = [s]_i \cdot [t]_i$，多项式 $f_s \cdot f_t$ 次数变为 $2(t-1)$，需 $2t-1$ 点重构。因此乘法后需要**截断**（reduction）将度数降回 $t-1$

Shamir适合诚实多数的场景（$t \leq n/2$）。

### 6.3 复制秘密共享

**核心思想**：将秘密拆分为多个加法共享碎片，并分配给多方，每方持有多个碎片。用于处理 $n$ 方中 $t$ 方腐化的场景，特别适合 **3方诚实多数**（$n=3, t=1$）。

**3方构造**：

对于秘密 $s \in \mathbb{F}_p$，生成3个随机碎片 $s_1, s_2, s_3$ 满足 $s = s_1 + s_2 + s_3 \pmod p$。

分配方式：

| 方 | 持有的碎片 |
|----|-----------|
| $P_1$ | $s_1, s_2$ |
| $P_2$ | $s_2, s_3$ |
| $P_3$ | $s_3, s_1$ |

每方持有两个碎片，单个腐化方看不到完整信息（缺少一个碎片）。

**加法**：每方本地相加对应碎片即可。

**乘法**（3方场景）：

目标：计算 $z = x \cdot y$。

每方持有：$P_1$: $(x_1, x_2, y_1, y_2)$，$P_2$: $(x_2, x_3, y_2, y_3)$，$P_3$: $(x_3, x_1, y_3, y_1)$。

展开：

$$
z = x_1y_1 + x_1y_2 + x_1y_3 + x_2y_1 + x_2y_2 + x_2y_3 + x_3y_1 + x_3y_2 + x_3y_3
$$

分配方式：让 $P_1$ 计算 $\alpha_1 = x_1y_1 + x_1y_2 + x_2y_1$，$P_2$ 计算 $\alpha_2 = x_2y_2 + x_2y_3 + x_3y_2$，$P_3$ 计算 $\alpha_3 = x_3y_3 + x_3y_1 + x_1y_3$。

然后每方将 $\alpha_i$ 用加法秘密共享拆分为3份，发送给其他方。最终各方持有 $z$ 的复制秘密共享。

这种方法在诚实多数场景下高效且通信量小。

### 6.4 Verifiable Secret Sharing (VSS)

基本秘密共享假设分发者诚实。如果分发者是恶意的，可能发送不一致的共享给不同方。VSS解决了**共享一致性验证**问题。

**Feldman VSS**：

基于Shamir秘密共享 + **Pedersen承诺**的变体（离散对数承诺）。

1. 分发者构造 $f(X) = s + a_1 X + ... + a_{t-1} X^{t-1}$
2. 广播承诺：$c_0 = g^s, c_1 = g^{a_1}, ..., c_{t-1} = g^{a_{t-1}}$
3. 发送 $s_i = f(i)$ 给 $P_i$
4. $P_i$ 验证：$g^{s_i} \stackrel{?}{=} \prod_{j=0}^{t-1} c_j^{i^j}$

若验证通过，说明 $P_i$ 收到的共享在同一个 $t-1$ 次多项式上。

**安全性**：
- 绑定性质：分发者不能打开同一承诺为不同值（DL假设）
- 隐藏性质：$c_0 = g^s$ 在DL假设下隐藏 $s$（但计算性，非信息论）

**Pedersen VSS**：

Feldman VSS的隐藏性质是计算性的（$g^s$ 泄露DL信息）。Pedersen使用**双承诺**实现信息论隐藏：

使用两个生成元 $(g, h)$，承诺 $E(s, r) = g^s h^r$。$r$ 的随机性使得承诺即使对 $s$ 也是信息论隐藏的。

**应用场景**：
- 分布式密钥生成（DKG）
- 共识协议中的秘密分发
- 恶意方环境下的安全计算

---

## 第7章 MPC主要技术路线

### 7.1 Garbled Circuit (GC)

Yao 1982年提出的**两方安全计算**协议，通常用于半诚实安全，可扩展到恶意安全。

**思想**：将函数 $f$ 表示为布尔电路，一方（Garbler）对电路"加密"（混淆），另一方（Evaluator）在不解密的情况下执行。

**Wire Label（线标签）**：

每条电路线 $w$ 对应两个标签：
- $w^0$：代表逻辑值 0
- $w^1$：代表逻辑值 1

每个标签是随机比特串（如 128-bit）。标签不泄露所代表的比特值。

**Garbled Table（混淆表）**：

以AND门为例：$c = a \land b$。

真值表：
| $a$ | $b$ | $c$ |
|-----|-----|-----|
| 0 | 0 | 0 |
| 0 | 1 | 0 |
| 1 | 0 | 0 |
| 1 | 1 | 1 |

Garbler用 $a$ 和 $b$ 的标签加密 $c$ 的标签：

$$
\begin{aligned}
T_0 &= \text{Enc}_{k_a^0, k_b^0}(k_c^0) \\
T_1 &= \text{Enc}_{k_a^0, k_b^1}(k_c^0) \\
T_2 &= \text{Enc}_{k_a^1, k_b^0}(k_c^0) \\
T_3 &= \text{Enc}_{k_a^1, k_b^1}(k_c^1)
\end{aligned}
$$

将这4个条目随机打乱后发送给Evaluator。

**Garbled Row Reduction** 优化：通过调整标签使第一个密文为全0，减少1/4通信量。

**Evaluator执行**：

Evaluator持有输入线标签（通过OT获得），尝试解密混淆表中的每一条目，只有正确的密钥才能解密成功。通常通过填充0（padding with zeros）在解密后判断是否成功。

**Oblivious Transfer (OT)**：

Evaluator需要获得自己输入对应的标签，但**不能**让Garbler知道自己的输入。OT协议解决了这个问题：
- Garbler输入：$(w^0, w^1)$
- Evaluator输入：比特 $b$
- Evaluator输出：$w^b$
- Garbler不知道 $b$

OT可扩展到每次传输大量标签（IKNP OT Extension）。

**Free-XOR**：

Kolesnikov和Schneider 2008年提出的优化。选全局偏移 $\Delta$，对所有线设置 $w^1 = w^0 \oplus \Delta$。

XOR门的混淆表为空！Evaluator只需将输入标签做XOR：

$$
k_c = k_a \oplus k_b
$$

检查：若 $k_a = a^b \oplus \Delta \cdot a$，$k_b = b^b \oplus \Delta \cdot b$，则 $k_a \oplus k_b = (a \oplus b)^? \oplus \Delta \cdot (a \oplus b)$。

Free-XOR将XOR门的通信和计算降为0，极大推动了GC的实际应用。

**Half-Gates**（Zahur等人2015年）：

AND门进一步优化。每个AND门只需要 $2$ 个密文条目（而非 $4$ 个），目前是**最优**的AND门混淆表达。

**Garbled Circuit的应用**：
- 两方安全计算（PSI、隐私查询）
- 局域网延迟下可达每秒数百万门运算
- 高延迟网络下通信量是主要瓶颈

### 7.2 GMW协议

Goldreich-Micali-Wigderson 1987年提出的**多方安全计算**协议，基于布尔电路和秘密共享。

**核心结构**：

每方持有输入的 **XOR共享**（即加法共享在GF(2)上）：

$$
x = [x]_1 \oplus [x]_2 \oplus ... \oplus [x]_n
$$

**XOR Gate（本地）**：

$$
[x \oplus y]_i = [x]_i \oplus [y]_i
$$

零交互，与算术秘密共享的加法一致。

**AND Gate（需交互）**：

计算 $z = x \land y$：

$$
z = \left(\bigoplus_i [x]_i\right) \land \left(\bigoplus_i [y]_i\right) = \bigoplus_i [x]_i[y]_i \oplus \bigoplus_{i < j} ([x]_i[y]_j \oplus [x]_j[y]_i)
$$

关键在于 $[x]_i[y]_i$ 可本地计算，而交叉项 $[x]_i[y]_j$ 需要两方 $(P_i, P_j)$ 的交互。这种交互通过**1-out-of-4 OT**实现：

- $P_i$ 输入4个可能值：$r_{ij}^{00}, r_{ij}^{01}, r_{ij}^{10}, r_{ij}^{11}$
- $P_j$ 输入选择位 $([x]_j, [y]_j)$
- $P_j$ 输出 $r_{ij}^{[x]_j, [y]_j}$

最终 $P_i$ 的共享为 $[z]_i = [x]_i[y]_i \oplus \bigoplus_{j \neq i} r_{ij}$，$P_j$ 的共享中包含了OT输出。

**轮数与电路深度**：

GMW的**通信轮数**等于**电路乘法深度**（AND门的最大链长度）。

这是因为每层AND门需要一次OT交互，必须等前一层结果确定后才能执行。对于深度为 $D$ 的电路，GMW需要 $D$ 轮通信。

对比：
- Garbled Circuit：一轮通信（Garbler一次性发送整个混淆电路）
- GMW：$D$ 轮通信，适合低深度电路或低延迟网络

**GMW的优势**：
- 可扩展到任意多方
- 在线阶段只需 XOR 门（可提前预处理AND门）
- 适合长管道（pipeline）实现

### 7.3 Beaver Triple

Beaver Triple 是MPC中**乘法交互**的核心优化技术。它将乘法协议的交互分离为**预处理阶段（离线）** 和 **在线阶段**。

**定义**：

Beaver三元组是满足 $c = a \cdot b \pmod p$ 的随机秘密共享三元组 $([a], [b], [c])$，其中 $a$ 和 $b$ 是随机数（与任何实际数据无关）。

预处理阶段，各方共同生成三元组（可由TTP信任中心或通过HE/OT生成）。

**在线乘法协议**：

给定 $[x]$ 和 $[y]$，计算 $[z] = [x \cdot y]$：

1. 各方本地计算 $[d] = [x] - [a] = [x - a]$
2. 各方本地计算 $[e] = [y] - [b] = [y - b]$
3. 重建 $d = \text{Reconstruct}([d])$，$e = \text{Reconstruct}([e])$（通信！）
4. 各方本地计算 $[z] = [c] + d \cdot [b] + e \cdot [a] + d \cdot e$

验证：

$$
\begin{aligned}
z &= c + d \cdot b + e \cdot a + d \cdot e \\
  &= a \cdot b + (x-a) \cdot b + (y-b) \cdot a + (x-a)(y-b) \\
  &= x \cdot y
\end{aligned}
$$

**为什么高效**：

- 在线阶段仅需**一轮通信**（Reconstruct $d$ 和 $e$）
- 本地计算是简单的算术运算
- 所有 Open（重构）操作可批处理

**预处理阶段**：

生成Beaver三元组有多种方法：
- **HE-based**：一方用同态加密生成加密随机数，各方执行同态乘法
- **OT-based**：利用OT扩展生成随机乘法三元组
- **Shamir-based**：利用Shamir秘密共享的乘法 + 截断

**Beaver三元组在MPC中的核心地位**：

几乎所有的高效MPC方案（SPDZ、MASCOT、TinyOT、ABY）都使用Beaver三元组作为乘法的基础构建块。

### 7.4 SPDZ类协议

SPDZ（命名来自作者首字母：Damgård, Pastro, Smart, Zakarias）是2012年提出的**恶意安全、 dishonest majority** 的MPC协议系列。后续变体包括 SPDZ2k、MASCOT、Overdrive、Phase 等。

**核心思想**：

将**信息论安全**（通过秘密共享）与**计算安全**（通过MAC验证）结合。

**认证秘密共享（Authenticated Shares）**：

对于秘密 $x$，与其共享一起维护一个**消息认证码（MAC）**：

$$
\text{Share}(x) = ((\delta_x)_1, ..., (\delta_x)_n, \gamma_x)
$$

其中 $\delta_x$ 是 $x$ 的消息认证码值，分布为加法共享 $[\delta_x]_i = M \cdot [x]_i + \Delta_i$，且全局密钥 $\Delta_i$ 每方持有部分。

**离线阶段**（预处理）：
- 生成Beaver三元组和随机数
- 所有共享附带MAC

**在线阶段**：
- 加法、MulConstant 等操作本地执行（MAC随同更新）
- 乘法使用Beaver三元组
- Open（重构）时检查MAC

**MAC检查（MACCheck）**：

打开秘密 $x$ 时，各方打开 $[x]_i$ 和 MAC片段，验证：

$$
\sum_i [\delta_x]_i \stackrel{?}{=} M \cdot x + \sum_i \Delta_i
$$

若恶意方篡改共享或MAC，MACCheck将以压倒性概率（$1 - 1/|\mathbb{F}|$）失败。

**SPDZ系列的演变**：

| 协议 | 预处理 | 特点 |
|------|--------|------|
| SPDZ (2012) | HE-based 三元组生成 | 首次实现dishonest majority恶意安全 |
| MASCOT (2016) | OT-based 三元组生成 | 比HE快100倍 |
| Overdrive (2017) | 优化的HE生成 | 高低速版本 |
| SPDZ2k (2018) | $\mathbb{Z}_{2^k}$ 上的SPDZ | 适合整数运算 |

**预处理模型（Preprocessing Model）**：

SPDZ将协议分为两个阶段，在线阶段只需 **Open + MACCheck**：

```
预处理阶段（慢，可离线完成）：
  生成大量 Beaver 三元组、随机数、随机平方等

在线阶段（快，输入依赖）：
  输入共享 → 计算（本地区加乘 + Open）→ MACCheck → 输出
```

这种分离使得在线阶段极其高效（只需 $O(n)$ 轮通信和 Open 操作）。

### 7.5 MPC-in-the-Head

MPC-in-the-Head（Ishai等人2007年）是一个重要的理论构造，将MPC技术用于构建**零知识证明**和**数字签名**。

**核心思想**：

1. 证明者（Prover）在"头脑中"模拟一个MPC协议的运行
2. 将MPC视图（view）的一部分发送给验证者
3. 验证者通过检查MPC协议的执行一致性来验证知识

**MPC视图转证明**：

假设证明者要证明存在 $w$ 使得 $x = f(w)$。

1. 证明者将 $w$ 作为MPC输入拆分为 $m$ 个共享
2. 在"头脑中"运行 $m$ 方MPC协议计算 $f(w) = x$
3. 得到 $m$ 个参与方的视图（view = 输入 + 随机数 + 接收消息）
4. 承诺（commit）所有视图
5. 验证者随机挑选 $k$ 个视图打开检查
6. 若打开的视图与MPC协议一致，则验证者相信存在 $w$ 使得 $f(w) = x$

**安全性**：
- **完备性**（Soundness）：若 $f(w) \neq x$，则MPC协议至少产生一个错误视图。验证者选到未错视图的概率为 $\epsilon < 1$。重复 $t$ 轮后，错误概率降为 $\epsilon^t$。
- **零知识**：打开的视图不泄露 $w$（MPC的安全性保证每个视图不泄露输入）。

**Fiat-Shamir变换**：

将上述交互式证明转换为**非交互式**的零知识证明或签名：

1. 证明者模拟 $t$ 轮MPC协议
2. 计算 $h = \text{Hash}(\text{all commitments})$，用 $h$ 决定打开的视图
3. 验证者检查 $h$ 和打开的视图的一致性

**与ZKP和签名的联系**：

- **ZKP**：MPC-in-the-Head提供了构造ZKP的一般框架——任何MPC协议可转化为ZKP
- **数字签名**：Fiat-Shamir变换 + MPC-in-the-Head 可构造**后量子安全的数字签名**（如Picnic算法族）

**Picnic签名方案**（NIST PQC标准化候选）：

使用MPC-in-the-Head + LowMC（MPC友好分组密码）构造的签名。安全性依赖于对称密码而非数论假设，因此是**后量子安全**的。

---

## 第8章 MPC工程实现

### 算术电路与布尔电路

MPC协议可基于两种电路模型：

**算术电路（Arithmetic Circuit）**：

- 在有限域 $\mathbb{F}_p$ 或环 $\mathbb{Z}_{2^k}$ 上计算
- 基本操作：加法、乘法（加法和乘法构成完备集）
- 优势：自然的定点数编码、线性代数高效
- 代表协议：SPDZ、Shamir MPC、ABY3

**布尔电路（Boolean Circuit）**：

- 在 GF(2) 上计算
- 基本操作：XOR, AND（功能完备集）
- 优势：位级操作精确、比较/截断/移位高效
- 代表协议：Yao GC、GMW（布尔版）、TinyOT

**混合协议（Mixed Protocol）**：

现代MPC框架（如ABY, ABY2.0, MOTION）支持**混合电路中切换**：

```
算数域 → 布尔域（Bits）：用 A2B 转换
布尔域 → 算数域（Reconstruct）：用 B2A 转换
```

A2B/B2A转换可通过OT或其他转换协议实现，是混合计算的核心开销。

### 定点数与浮点数

**定点数编码**：

在算术域 $\mathbb{F}_p$ 中编码小数 $x$：

$$
x' = \lfloor x \cdot 2^f \rfloor \in \mathbb{Z}_p
$$

其中 $f$ 是小数的精度位数（bit）。如 $f=16$，则 $x=3.14$ 编码为 $3.14 \times 65536 = 205887$。

**截断（Truncation/Division）**：

乘法后精度翻倍：$(x \cdot 2^f) \cdot (y \cdot 2^f) = xy \cdot 2^{2f}$，需要截断 $f$ 位回到 $xy \cdot 2^f$。

截断在MPC中需要交互：

1. **精确截断**：$[x] \to [\lfloor x / 2^f \rfloor]$，可通过安全右移实现
2. **近似截断**：$[x] \to [\lfloor x / 2^f \rceil]$，增加随机误差但效率高
3. **Protocol for Trunc**：在SPDZ中使用 $[x] + [r]$ 掩码后打开，再截断

截断的通信成本通常**低于乘法的成本**。

**浮点数近似**：

布尔电路中可使用IEEE 754的浮点表示，但电路极大（数十万门）。实践中通常改用**定点数**。

### 比较运算

**算术域中的比较** $[x < y]$：

方法1：将 $[x - y]$ 转换为布尔表示 → 获取最高位（符号位）

$$
[x - y] \xrightarrow{A2B} [bit_0], [bit_1], ..., [bit_{k-1}] \to [sign]
$$

方法2：使用**Ravel's Theorem**的离线 + 在线分解

**布尔域中的比较**：

在Garbled Circuit或布尔GMW中，比较器简单用布尔门实现：

```
x < y 等价于：从高到低扫描位，找到第一个不同的位
```

对于 $k$-bit 数，需要 $O(k)$ 个AND门（布尔深度 $O(\log k)$ 或 $O(k)$ 取决于电路设计）。

### 除法

**定点数除法** $[z] = [x] / [y]$：

近似方法：
1. **Newton-Raphson 迭代**：$[y_{i+1}] = [y_i] \cdot (2 - [x] \cdot [y_i])$，收敛到 $1/x$
2. **Goldschmidt 算法**：乘除法
3. **多项式近似**：$1/x$ 在区间 $[1, 2)$ 上的多项式近似

每个迭代需要 $O(1)$ 轮通信（加减法本地，乘法需交互）。

### 激活函数近似

**MPC中的Sigmoid/tanh/ReLU**：

- **ReLU**：通过比较运算 + 选择器（MUX）实现。$[relu(x)] = [x] \cdot [x > 0]$
- **Sigmoid**：$\sigma(x) = 1 / (1 + e^{-x})$。可分段线性近似或多项式近似
- **tanh**：类似Sigmoid，通过对称性简化

**比较运算的延迟**：比较需要布尔化或高位运算，通常是神经网络推理中的瓶颈。

### 网络延迟与通信轮数

**MPC性能的决定因素**：

| 因素 | 局域网（LAN） | 广域网（WAN） |
|------|-------------|-------------|
| 延迟 | 0.1-1ms | 10-100ms |
| 带宽 | 1-10 Gbps | 10-100 Mbps |
| **MPC瓶颈** | 计算 | 轮数 |

**轮数最小化**：

- **GC**：$O(1)$ 轮（混淆电路一张表）
- **GMW+Beaver**：$O(D)$ 轮（$D$ 是乘法深度）
- **GC + GMW混合**：将高深度部分转为GC，低深度部分用GMW

**管道（Pipelining）**：

可利用数据并行性，将乘法深度 $D$ 分摊到多个实例上：

$$
\text{effective rounds} = O(D / \text{pipeline\_width})
$$

### 掉线处理

实际部署中，参与方可能掉线（crash, network failure）。

- **同步（Synchronous）**：各方在固定轮次中逐一通信。某方掉线即中断。
- **异步（Asynchronous）**：消息可延迟。掉线在超时后被检测。

**常见处理方式**：
1. **Commit + Reveal**：有掉线时运行恢复协议，利用VSS重新分发共享
2. **检查点（Checkpoint）**：保存中间状态，掉线方重新加入时恢复
3. **监督者（Supervisor）**：中心化监控掉线情况

在 dishonest majority 下，掉线可能是恶意方刻意中断（denial of service）。这时的应对更强——需要**超时退出**并追究责任。

### 预处理管理

**三元组储备**：

预处理阶段生成大量Beaver三元组供在线使用。在线阶段需要消耗三元组进行乘法。

假设模型推理需要 $M$ 次乘法，则需储备 $M$ 个三元组。但三元组的生成成本很高（尤其是在恶意安全下）。

**策略**：
- **按需生成**：在线阶段需要时动态生成（增加延迟）
- **批量生成**：离线批量生成大量三元组，在线直接消耗
- **混合**：离线生成基础量，在线使用空闲时间补充

**三元组的多方供应**：

在SPDZ中，三元组是全局共享的，所有方共同参与生成。在ABY3（三方）中，两方生成，第三方验证。

### HE混合方案

**HE在MPC中的应用**：

| 用途 | 说明 |
|------|------|
| 预处理生成三元组 | SPDZ使用BFV/CKKS生成Beaver三元组 |
| 输入加密传输 | 客户端用HE加密输入，服务器间MPC处理 |
| 减少轮数 | 用HE替代OT，将多轮交互压缩为单轮 |
| Convert操作 | A2B/B2A转换中利用HE加速 |

**代表性混合系统**：

- **EMP-toolkit**：C++ GC框架，支持HE扩展
- **ABY**：GC + GMW + HE算术混合
- **MOTION**：支持算术/布尔/HE混合
- **EzPC/ATLAS**：HE + MPC混合ML推理

**适用边界**：

HE + MPC混合在以下场景优势明显：
- 客户端只发送不参与（非交互输入）
- 服务器间低延迟网络但轮数敏感
- 需要恶意安全但不想为BEAVER三元组付出通信开销

---

## 总结

同态加密与安全多方计算是隐私计算的两大支柱技术：

- **HE** 适合非交互式场景，计算密集，密文膨胀大，但轮数为 $O(1)$
- **MPC** 适合多方协作场景，通信密集，轮数深，但计算相对轻量
- **HE + MPC混合** 正在成为隐私计算工程部署的主流范式

在选择技术路线时，需根据**网络条件、计算资源、安全假设、延迟要求**统一权衡。没有银弹——但在特定场景下，合理的方案选择和对参数的深度优化可以使隐私计算在实际系统中达到可用性能水平。
