# 后量子密码、门限密码与可信硬件

## 第1章 格基础

### 1.1 格的定义

格（Lattice）是 $\mathbb{R}^n$ 中一组线性无关向量 $\mathbf{b}_1,\dots,\mathbf{b}_m$ 的所有整数线性组合构成的离散加法子群：

$$
\mathcal{L} = \left\{ \sum_{i=1}^m x_i \mathbf{b}_i \mid x_i \in \mathbb{Z} \right\}
$$

**Base（基）**：一组生成格的线性无关向量 $\mathbf{B} = [\mathbf{b}_1 \mid \cdots \mid \mathbf{b}_m] \in \mathbb{R}^{n \times m}$。同一格可以有无限多组基，不同基的几何性质差异巨大——"好基"向量短且接近正交，"坏基"向量长且接近共线。

**Lattice Point（格点）**：格的元素，即基向量的整数组合。格点的离散性意味着每个格点周围存在一个非零的最小距离（否则是稠密集而不是格）。

**Fundamental Parallelepiped（基本平行多面体）**：给定基 $\mathbf{B}$，定义

$$
\mathcal{P}(\mathbf{B}) = \left\{ \sum_{i=1}^m t_i \mathbf{b}_i \mid t_i \in [0,1) \right\}
$$

其体积为 $|\det(\mathbf{B})|$。基本平行多面体平铺整个空间，每个基本平行多面体恰好包含一个格点（模格的等价类表示）。

**Determinant（行列式）**：$\det(\mathcal{L}) = \sqrt{\det(\mathbf{B}^\top \mathbf{B})}$。当 $n=m$ 时为 $|\det(\mathbf{B})|$。行列式与基的选择无关，是格的固有属性，几何意义是基本平行多面体的体积，反映格点的"密度"——行列式越小，格点越密集。

**Dual Lattice（对偶格）**：定义

$$
\mathcal{L}^* = \{ \mathbf{y} \in \text{span}(\mathcal{L}) \mid \forall \mathbf{x} \in \mathcal{L},\ \langle \mathbf{x}, \mathbf{y} \rangle \in \mathbb{Z} \}
$$

对偶格的基 $\mathbf{B}^*$ 满足 $\mathbf{B}^\top \mathbf{B}^* = \mathbf{I}$，且 $\det(\mathcal{L}^*) = 1 / \det(\mathcal{L})$。对偶格在格密码的 Trapdoor 构造和 Gaussian Sampling 中扮演关键角色。

### 1.2 格困难问题

**SVP（Shortest Vector Problem，最短向量问题）**：给定格 $\mathcal{L}$ 的任意基，找到 $\mathcal{L}$ 中非零的最短向量 $\mathbf{v}$，满足 $\|\mathbf{v}\| = \lambda_1(\mathcal{L})$，其中 $\lambda_1$ 是格的最短向量长度（第一连续极小）。

**CVP（Closest Vector Problem，最近向量问题）**：给定格 $\mathcal{L}$ 和目标向量 $\mathbf{t} \in \mathbb{R}^n$，找到距离 $\mathbf{t}$ 最近的格点 $\mathbf{v} \in \mathcal{L}$。CVP 比 SVP 更难，但可以通过 Babai 算法在给定"好基"时近似求解。

**SIVP（Shortest Independent Vector Problem，最短独立向量问题）**：找到 $n$ 个线性无关的格向量 $\mathbf{v}_1,\dots,\mathbf{v}_n$，使 $\max_i \|\mathbf{v}_i\|$ 最小化。SIVP 与 SVP 密切相关，是 Regev 归约的核心问题之一。

**BDD（Bounded Distance Decoding，有界距离解码）**：CVP 的特例，承诺目标点 $\mathbf{t}$ 到格的距离 $\delta < \lambda_1 / 2$（小于唯一解码半径）。此条件下最近格点唯一，问题相对容易一些，但仍被用于构造加密方案。

**GapSVP（Decisional Shortest Vector Problem，判定性最短向量问题）**：区分 $\lambda_1(\mathcal{L}) \leq d$ 还是 $\lambda_1(\mathcal{L}) \geq \gamma d$，其中 $\gamma$ 是近似因子。GapSVP 是 SVP 的判定版本，在 Regev 的 LWE 困难性归约中起到核心作用。

这些问题的困难程度随近似因子 $\gamma$ 变化：$\gamma = \text{poly}(n)$ 时问题可能不困难（LLL 可以解决），$\gamma = \tilde{O}(\sqrt{n})$ 时一般认为量子多项式时间困难，$\gamma = O(1)$ 时即使量子算法也难以解决。

### 1.3 格基约简

**Gram-Schmidt正交化**：给定基 $\mathbf{B}$，正交基 $\mathbf{B}^*$ 通过逐次减去投影得到：

$$
\mathbf{b}_i^* = \mathbf{b}_i - \sum_{j<i} \mu_{i,j} \mathbf{b}_j^*, \quad \mu_{i,j} = \frac{\langle \mathbf{b}_i, \mathbf{b}_j^* \rangle}{\|\mathbf{b}_j^*\|^2}
$$

Gram-Schmidt 向量的长度积等于 $\det(\mathcal{L})$。最长的 Gram-Schmidt 向量长度下界决定了 SVP 近似算法的质量。

**LLL 算法（Lenstra-Lenstra-Lovász）**：1982年提出的多项式时间格基约简算法，输出满足以下性质的基：

- $\|\mathbf{b}_i^*\|^2 \ge (\delta - \mu_{i,i-1}^2) \|\mathbf{b}_{i-1}^*\|^2$（Lovász 条件）
- $\|\mathbf{b}_1\| \le 2^{(n-1)/2} \lambda_1(\mathcal{L})$（近似因子指数级）
- 时间复杂度 $O(n^5 \log B)$，是格密码分析的基础工具

LLL 可以破解某些参数不当的格密码方案（如早期 NTRU 参数），但对高维格（$n > 500$）实际效果有限。

**BKZ 算法（Block Korkin-Zolotarev）**：LLL 的推广，核心思想是将问题分解为块大小为 $\beta$ 的子格，对子格执行精确 SVP（使用枚举或筛法）：

- $\beta$ 越大，约简质量越好，但指数级更慢
- 输出基满足 $\|\mathbf{b}_1\| \le 2^{O(n/\beta)} \lambda_1(\mathcal{L})$（精度与块大小的关系）
- 实际攻击中 $\beta = 40\text{-}60$ 是常见选择

**Block Size（块大小）与 Root Hermite Factor（RHF，根 Hermite 因子）**：格约简的质量常用 $\delta_0$ 衡量：

$$
\|\mathbf{b}_1\| = \delta_0^n \cdot \det(\mathcal{L})^{1/n}
$$

$\delta_0$ 越接近 1 越好。BKZ 经验关系：$\delta_0 \approx (\beta^{1/\beta})^{\frac{1}{2(\beta-1)}}$。NIST PQC 标准化中常用 BKZ 模拟器估计安全强度，例如 $\beta = 100$ 时 $\delta_0 \approx 1.006$。

---

## 第2章 LWE与SIS

### 2.1 LWE

**Learning With Errors（带误差学习）**：给定 $m$ 个带噪声的线性方程，恢复秘密向量 $\mathbf{s} \in \mathbb{Z}_q^n$：

$$
\mathbf{A} \in \mathbb{Z}_q^{m \times n}, \quad \mathbf{b} = \mathbf{A} \mathbf{s} + \mathbf{e} \pmod{q}
$$

其中 $\mathbf{e}$ 从误差分布 $\chi$ 采样。

**核心参数**：
- $n$：秘密维度（安全参数）
- $q$：模数，通常为 $n^{\Theta(1)}$ 的多项式大小
- $m$：样本数，通常 $m = O(n \log q)$
- $\chi$：误差分布，通常取离散高斯分布 $\mathcal{D}_{\mathbb{Z}, \alpha q}$，标准差 $\alpha q \ge 2\sqrt{n}$

**Search-LWE（搜索性 LWE）**：给定 $(\mathbf{A}, \mathbf{b})$，找到秘密 $\mathbf{s}$。这是 LWE 最自然的"求逆"问题形式。

**Decision-LWE（判定性 LWE）**：区分 $(\mathbf{A}, \mathbf{b} = \mathbf{A}\mathbf{s} + \mathbf{e})$ 与均匀随机 $(\mathbf{A}, \mathbf{u})$。通过 Goldreich-Levin 类归约，可证明 Decision-LWE 与 Search-LWE 一样困难。

**最坏情况到平均情况归约**：Regev 的里程碑式成果证明——如果存在一个高效算法能以不可忽略的概率解决**平均情况**下的 LWE 问题，则存在一个量子算法可以解决**最坏情况**下的 GapSVP 和 SIVP（近似因子 $\tilde{O}(n/\alpha)$）。这就意味着 LWE 的安全性建立在格困难问题的最坏情况复杂性上，不依赖特定实例的分布假设。

LWE 的密码构造非常灵活：可以直接用于加密（$\mathbf{b}$ 作为公钥的一部分，$\mathbf{s}$ 作为私钥），也可以通过 Trapdoor 和 MP12 陷门技术构造更复杂的原语。

### 2.2 Ring-LWE

LWE 的效率瓶颈在于矩阵-向量乘法 $O(n^2)$。Ring-LWE 将秘密和误差限制在**多项式环** $\mathcal{R}_q = \mathbb{Z}_q[X]/(X^n + 1)$ 中，其中 $n$ 为 2 的幂次，保证分圆多项式的良好性质。

**核心思想**：在一个方程中编码 $n$ 个 LWE 关系，系数相乘代替矩阵乘法：

$$
\mathbf{b}(X) = \mathbf{a}(X) \cdot \mathbf{s}(X) + \mathbf{e}(X) \in \mathcal{R}_q
$$

**Ideal Lattice（理想格）**：Ring-LWE 对应的格是理想格——即由环中某个理想对应的格。理想格具有额外的代数结构，可能（在理论上）比一般格更容易攻击。

**计算效率**：
- 乘法通过 FFT（快速傅里叶变换）加速，复杂度从 $O(n^2)$ 降至 $O(n \log n)$
- 密钥和密文尺寸缩小为 $O(n)$ 而非 $O(n^2)$
- 非常适合嵌入式设备和带宽受限场景

**结构性假设风险**：Ring-LWE 额外假设了分圆环中代数结构的安全性。虽然目前没有实质性攻击，但存在以下担忧：
- 环中的对偶格结构可能导致更有效的攻击
- 某些特殊环（非 $X^n+1$ 的分圆环）已被发现不安全
- 量子算法在理想格上的表现可能优于一般格

### 2.3 Module-LWE

Module-LWE 是 Ring-LWE 和标准 LWE 之间的折中：使用 $\mathcal{R}_q^k$ 上的矩阵-向量运算：

$$
\mathbf{b} = \mathbf{A} \cdot \mathbf{s} + \mathbf{e} \in \mathcal{R}_q^k
$$

其中 $\mathbf{A} \in \mathcal{R}_q^{k \times \ell}$，秩 $k$ 称为**模块秩（module rank）**。

**设计权衡**：
- $k=1$ 退化为 Ring-LWE（高代数结构，高性能）
- $k$ 增大时代数结构减弱，安全性更靠近标准 LWE
- 实际使用小的 $k$（如 $k=2,3,4$）既获得性能优势又保持充分的安全性冗余

**在 ML-KEM / ML-DSA 中的使用**：
- **ML-KEM（原 Kyber）**：$k=2,3,4$ 对应三个安全级别，基于 Module-LWE 与 Module-LWR 的混合
- **ML-DSA（原 Dilithium）**：同样使用 Module-LWE/LWR，密钥和签名尺寸适中

Module-LWE 已成为 PQC 的主流选择，因为它：
- 比标准 LWE 高效一个数量级
- 比 Ring-LWE 有更好的安全基础
- 参数选择灵活，易于扩展安全级别

### 2.4 SIS

**Short Integer Solution（短整数解）**：给定 $m$ 个随机向量 $\mathbf{a}_i \in \mathbb{Z}_q^n$，找到一组系数 $z_i \in \{-1,0,1\}$（不全为零）使：

$$
\sum_{i=1}^m z_i \mathbf{a}_i = \mathbf{0} \pmod{q}
$$

等价于在格 $\mathcal{L}^\perp(\mathbf{A}) = \{\mathbf{x} \in \mathbb{Z}^m \mid \mathbf{A}\mathbf{x} = \mathbf{0} \pmod{q}\}$ 中寻找短向量。

**与 LWE 的关系**：SIS 是 LWE 的"对偶"问题。LWE 是给定 $\mathbf{A}, \mathbf{b} = \mathbf{A}\mathbf{s} + \mathbf{e}$ 求 $\mathbf{s}$（解码问题），SIS 是给定 $\mathbf{A}$ 求 $\mathbf{A}\mathbf{z}=0$ 的短解（找格中短向量）。两者通过对偶格和归约相互关联。

**在格签名中的应用**：

SIS 问题是格签名的安全基础（如最初的 GPV 签名框架）：
- 公钥：矩阵 $\mathbf{A}$
- 签名：在 SIS 格 $\Lambda^\perp(\mathbf{A})$ 上找到一个靠近哈希值的短向量
- 安全性：伪造签名需要在 SIS 格中找到短向量

**在承诺方案中的应用**：
- 基于 SIS 的承诺具有加法同态性
- 可构造高效的证据不可区分（Witness Indistinguishable）证明
- 用于构建更高级的密码协议（群签名、环签名、可验证加密等）

Ajtaí 的归约证明 SIS 在平均情况下与最坏情况下的 SIVP/GapSVP 等价，保证了 SIS 问题的最小困难下界。

---

## 第3章 NTRU类密码

NTRU（Number Theoretic Ring Unit）是历史上第一个实用的格密码方案，由 Hoffstein、Pipher 和 Silverman 于 1996 年提出。

**多项式环上的短多项式表示**：
NTRU 工作在截断多项式环 $\mathcal{R} = \mathbb{Z}[X]/(X^N - 1)$（当前标准使用 $X^n + 1$，类似 Ring-LWE）上。密钥由三个短多项式 $(f, g, h)$ 构成：

- 私钥：$f, g \in \mathcal{R}$，系数为小整数（如 $\{-1,0,1\}$）
- 公钥：$h = g \cdot f^{-1} \pmod{q}$

加密时，明文 $m$ 编码为小系数多项式，加密者选择随机短多项式 $r$：

$$
c = r \cdot h + m \pmod{q}
$$

解密时用私钥 $f$ 计算：

$$
a = c \cdot f = r \cdot g + m \cdot f \pmod{q}
$$

由于 $r, g, m, f$ 都是短多项式，系数不会超过 $q$，因此可以模掉 $q$ 恢复原始值，再通过 $f$ 的逆去除 $m$。

**NTRU 格的特殊结构**：

NTRU 对应的格是二维环面格：

$$
\mathcal{L} = \{(x, y) \in \mathcal{R}^2 \mid x \cdot h - y = 0 \pmod{q}\}
$$

等价于基矩阵：

$$
\mathbf{B} = \begin{bmatrix}
\mathbf{I} & \mathbf{0} \\
\mathbf{H} & q\mathbf{I}
\end{bmatrix}
$$

其中 $\mathbf{H}$ 是 $h$ 的乘法矩阵。这个格中存在短向量 $(f, g)$，因此攻击者如果能找到 $(f, g)$ 就可以恢复私钥。

**解密失败概率（Decryption Failure）**：
NTRU 解密需要正确的中心化取整，但如果 $r\cdot g + m\cdot f$ 的系数"太大"导致模 $q$ 回绕，就会产生解密错误。参数选择需满足：

$$
\|r \cdot g + m \cdot f\|_\infty < q/2
$$

设计时通常要求解密失败概率低于 $2^{-128}$ 甚至达到确定性解密。

**参数选择与安全级别**：
- NTRU 的现代标准化版本（如 NTRU-HRSS 和 NTRU-Prime）基于 $X^n - X^{n-1} - 1$ 等特殊多项式
- NTRU 在 NIST PQC 第 4 轮中作为备用 KEM 候选
- FN-DSA（Falcon）基于 NTRU 格的 Trapdoor 采样，是 NIST 标准化签名方案
- 关键安全参数：维度 $N$（通常 509-1024）、模数 $q$、多项式系数界 $\beta$

---

## 第4章 格密码构造

**Trapdoor（陷门）**：格陷门是一组短基（或等价短向量），使得持有者能高效求解困难的格问题（如 SIS、LWE）。

**GPV 框架（Gentry-Peikert-Vaikuntanathan）**：
- 公钥：随机均匀矩阵 $\mathbf{A} \in \mathbb{Z}_q^{n \times m}$
- 陷门：与 $\mathbf{A}$ 正交的短基 $\mathbf{T}_\mathbf{A} \in \mathbb{Z}^{m \times m}$
- 陷门持有者可以采样 $\mathbf{A}\mathbf{x} = \mathbf{u}$ 的短解（高斯采样）
- 非持有者面临 SIS 问题

**Gadget Matrix G**：
核心思想是用一个"通用"矩阵 $\mathbf{G}$，使得 $\mathbf{A} = [\bar{\mathbf{A}} | \mathbf{G} - \bar{\mathbf{A}}\mathbf{R}]$ 具有已知陷门。

$$
\mathbf{G} = \mathbf{I}_n \otimes \mathbf{g}^\top,\quad \mathbf{g}^\top = (1, 2, 4, \dots, 2^{\lceil \log q \rceil - 1})
$$

$\mathbf{G}$ 的陷门可以通过 $\mathbf{G}^{-1}$ 函数轻松求逆：$\mathbf{G}^{-1}(\mathbf{v})$ 输出一个"短"向量 $\mathbf{x}$ 满足 $\mathbf{G}\mathbf{x} = \mathbf{v}$。将任意 $\mathbf{A}$ 转换为带陷门的 $\mathbf{A}'$ 的核心技巧是：

$$
\mathbf{A}' = [\bar{\mathbf{A}} | \mathbf{G} - \bar{\mathbf{A}}\mathbf{R}]
$$

其中 $\mathbf{R}$ 是短矩阵作为陷门。

**Gaussian Sampling（高斯采样）**：
在格上采样服从高斯分布的点是许多格密码构造的核心原语。给定格基 $\mathbf{B}$ 和标准差 $s$：

$$
D_{\mathcal{L}, s, \mathbf{c}}(\mathbf{x}) \propto \exp(-\pi \|\mathbf{x} - \mathbf{c}\|^2 / s^2)
$$

- 使用 Klein 算法或 GPV 算法实现
- $s$ 需大于 $\|\tilde{\mathbf{B}}\| \cdot \omega(\sqrt{\log n})$ 才能获得正确分布
- 采样质量直接影响安全性证明

**Key Switching（密钥切换）**：
在全同态加密中，允许将密文从用密钥 $s_1$ 加密切换为用密钥 $s_2$ 加密，而不暴露明文。核心公式：

$$
\text{SwitchKeyGen}(s_1, s_2) \rightarrow \mathbf{K}
$$

$$
\mathbf{K} \cdot \mathbf{c}_1 \approx \mathbf{c}_2
$$

其中 $\mathbf{K}$ 是"切换密钥"，包含用 $s_2$ 加密的 $s_1$ 的位分解信息。

**Modulus Switching（模数切换）**：
将密文从模 $q$ 缩放为模 $p$（$p < q$），同时保持解密正确性并减少噪声增长。操作：

$$
\mathbf{c}' = \lfloor (p / q) \cdot \mathbf{c} \rceil
$$

引入的噪声约为 $O(\ell \cdot B)$（$\ell$ 为密文长度，$B$ 为边界），是控制全同态加密中噪声增长的关键技术。

**Relinearization（重线性化）**：
乘法后的密文维度从 $n$ 增长为 $n^2$。通过重线性化密文恢复到 $n$ 维（同时切换回原始密钥）。基本思想是用线性化密钥 $\mathbf{RLK}$ 表示"$s^2$"的加密：

$$
\mathbf{c}_{\text{mult}} \cdot \mathbf{RLK} \rightarrow \mathbf{c}_{\text{new}}
$$

**格基加密/签名/IBE/ABE/HE/ZKP 应用综述**：

| 原语 | 核心技术 | 特点 |
|------|---------|------|
| **加密（KEM）** | Module-LWE/LWR | ML-KEM，比 ECC 慢 2-5 倍但可行 |
| **签名** | Fiat-Shamir with Aborts / GPV | ML-DSA（紧凑）、FN-DSA（极紧凑） |
| **IBE** | GPV + Gaussian Sampling | 格 IBE 可抵抗量子攻击 |
| **ABE** | LWE + 张量积 + 属性编码 | 支持细粒度访问控制 |
| **FHE** | BGV/BFV/CKKS Bootstrapping | 实用全同态加密，LWE 噪声管理 |
| **ZKP** | 承诺-打开 + 乘积论证 | 格 ZKP 尺寸大但无陷门假设 |

---

## 第5章 后量子密码 PQC

### 5.1 量子算法威胁

**Shor 算法**：Peter Shor 于 1994 年提出的量子算法，可以在多项式时间内分解大整数和求解离散对数：

$$
O((\log N)^3) \ \text{量子门} \rightarrow \text{分解 } N = pq
$$

这意味着 RSA、ECC（ECDH、ECDSA、EdDSA）、DSA、ElGamal 等所有基于因数分解/离散对数困难性的公钥密码将被**彻底摧毁**。

**Grover 算法**：对无结构搜索问题的平方加速：

$$
O(\sqrt{N}) \ \text{量子查询} \rightarrow \text{在 } N \text{ 个元素中找到目标}
$$

对对称密码的影响：
- AES-128 安全强度从 128 比特降至 64 比特（不安全）
- AES-256 降至 128 比特（仍安全）
- SHA-256 的输出碰撞搜索从 $2^{128}$ 降至 $2^{64}$（需加倍输出长度）

**对 RSA/ECC 的根本性威胁**：
- Shor 算法在量子计算机上可在**数小时**内破解 2048 位 RSA
- 所有基于 ECDLP 的方案同样被破解
- 一旦大规模量子计算机建成（估计 2030-2040），当前的公钥基础设施将完全失效

**对对称密码的影响相对较小**：
- 对称密钥翻倍即可抵抗 Grover 攻击：AES-128 → AES-256
- 哈希输出长度翻倍：SHA-256 → SHA-512
- 对称密码的量子安全"成本"很低（性能影响 < 2 倍）

### 5.2 后量子密码路线

**格密码（已标准化）**：
- **ML-KEM（FIPS 203）**：基于 Module-LWE 的密钥封装机制
- **ML-DSA（FIPS 204）**：基于 Module-LWE/LWR 的签名方案
- **FN-DSA（FIPS 205）**：基于 NTRU 格的紧凑签名方案

**编码密码**：
- **Classic McEliece**：基于 Goppa 码的解码困难性
- 密钥极大（几百 KB 到 MB），但加密/解密极快
- 安全历史最久经考验（1978 年提出至今无实质改进攻击）
- 当前在 NIST 第 4 轮评估中

**哈希签名**：
- **SLH-DSA（SPHINCS+，FIPS 205）**：仅依赖哈希函数的安全性
- 无陷门、无代数结构、安全性极其保守
- 签名较大（~17-49 KB）、签名速度较慢
- 被视为"终极备份"——只要哈希函数安全，它就不会被破解

**多变量密码**：
- **基于多元二次方程组（MQ）** 的困难性
- **Rainbow（UOV 变体）** 曾进入 NIST 第 3 轮但被攻破
- **MAYO / UOV** 是当前候选
- 签名速度快、签名小，但密钥大

**同源密码**：
- 基于超奇异椭圆曲线同源映射（Isogeny）
- **SIKE** 曾是 NIST 第 3 轮候选，但在 2022 年被攻破（经典攻击而非量子攻击）
- 密钥尺寸小但计算慢，现阶段不受信任
- 未来的 SQIsign 等方案可能更具前景

### 5.3 KEM 与签名

**ML-KEM（Kyber）**：
- 基于 Module-LWE + Module-LWR
- 参数：$k=2$（ML-KEM-512，NIST Level 1）、$k=3$（ML-KEM-768，Level 3）、$k=4$（ML-KEM-1024，Level 5）
- 公钥 + 密文尺寸：~800+768 字节（Level 1）到 ~1568+1568 字节（Level 5）
- 加密/解密时间：微秒级（比 RSA-3072 快 3-5 倍）

**ML-DSA（Dilithium）**：
- 基于 Fiat-Shamir with Aborts 框架 + Module-LWE/LWR
- 参数：安全强度 Level 2/3/5
- 公钥 ~1312 字节、签名 ~2420 字节（Level 2）
- 签名速度极快，验证稍慢于 ECDSA

**FN-DSA（Falcon）**：
- 基于 NTRU 格的 GPV 签名框架（FFT 加速高斯采样）
- 公钥 ~897 字节、签名 ~666 字节（Level 1）—— 所有 PQC 签名中最紧凑
- 签名和验证都很快
- 实现复杂度高（浮点高斯采样、FFT 精度控制）

**SLH-DSA（SPHINCS+）**：
- 基于哈希签名（WOTS+ + 认证树结构）
- 无格、无编码、无多变量——仅依赖哈希函数
- 公钥 ~32 字节（极小），签名 ~17-49 KB（较大）
- 签名速度约为 ECDSA 的十分之一

**性能与带宽对比**：

| 方案 | 公钥 | 私钥 | 签名/密文 | 相对速度 |
|------|------|------|-----------|---------|
| ML-KEM-768 | 1184 B | 2400 B | 1088 B | 快 |
| ML-DSA-65 | 1952 B | 4000 B | 3293 B | 较快 |
| FN-DSA-1024 | 1793 B | 2305 B | 1333 B | 较快 |
| SLH-DSA-128s | 32 B | 64 B | 7856 B | 慢 |
| Classic McEliece | 261 KB | 6492 B | 128 B | 加密快 |
| RSA-3072 | 387 B | 1.5 KB | 387 B | 慢 |
| ECDSA-P256 | 32 B | 32 B | 64 B | 快 |

**混合密钥交换**：
过渡期内建议使用混合方案，同时安全地包含传统和后量子组件：

$$
K = \text{KDF}(\text{ECDH}(sk_A, pk_B) \ \|\ \text{ML-KEM}(ek_B))
$$

只有当 ECDH **且** ML-KEM 都被攻破时，K 才不安全。这保证了 PQC 过渡期间的向后兼容性和安全冗余。

### 5.4 PQC 迁移

**Crypto Inventory（密码清点）**：
迁移的第一步是全面清点系统中使用的所有密码算法和协议：
- TLS 证书中的公钥算法和曲线
- 代码签名、固件签名使用的算法
- 数据库加密、文件加密的密钥管理方案
- 内部 CA、证书链、信任锚
- 所有依赖 RSA/ECC 的第三方集成

**Harvest Now Decrypt Later 威胁**：
攻击者当前收集加密流量并存储，等待未来量子计算机可用时批量解密。这对需要长期保密的数据（机密文件、医疗记录、通信记录）构成严重威胁。**已经在传输中的数据必须尽快切换到 PQC**。

**Hybrid Cryptography（混合密码）**：
在过渡期内同时部署传统和后量子方案：
- 使用两路密钥交换，KDF 混合输出
- 使用双证书（传统证书 + PQC 证书）
- 确保 TLS 1.3 的混合扩展（如混合 PQ/T 密码套件）
- 不影响现有安全性：如果一方被攻破，另一方仍提供保护

**协议兼容性**：
- TLS 1.3 已在扩展中支持 PQC（如 `key_share` 扩展）
- X.509 证书格式需要扩展以适应大尺寸公钥和签名
- DNSSEC、SSH、IPsec、S/MIME、Code Signing 都需要协议升级
- IETF 正在制定 PQC 相关 RFC（如混合身份验证提案）

**证书/密钥尺寸增大问题**：
- 格密码公钥从 ECC 的 32 字节增长到 800-2000 字节
- 证书链传输增大 10-50 倍
- 影响：TLS 握手延迟增加、网络带宽占用增大
- 解决方案：证书压缩、OCSP stapling、TLS 1.3 0-RTT 的谨慎使用

**Crypto Agility（密码敏捷性）**：
设计系统时应支持快速切换密码原语：
- 协议协商中支持多种算法套件
- 密钥格式和序列化支持多版本
- 测试框架自动化验证迁移后的兼容性
- 未来可能再次切换到新的 PQC 方案（如更高效的格签名或编码密码）

---

## 第6章 门限密码

### 6.1 基本概念

门限密码（Threshold Cryptography）的核心思想：将私钥的控制权分散到 $n$ 个参与方中，至少需要 $t$ 个（阈值）才能完成密码操作。

**Threshold Encryption/Decryption（门限加密/解密）**：
- 公钥可公开使用，加密者直接对公钥加密
- 私钥由 $n$ 个参与方通过 Shamir 秘密共享（或其他方案）分享
- 解密时需要至少 $t$ 个参与方提供解密份额（Partial Decryption）
- 解密服务器组合 $t$ 个份额恢复明文
- 应用：企业级密钥管理、区块链多方钱包

**Threshold Signature（门限签名）**：
- 签名密钥以 $t$-out-of-$n$ 方式拆分
- $t$ 个参与方协作生成有效签名，但**任何单个参与方都不能推导出完整私钥**
- 外部验证者无法区分门限签名与普通签名（签名格式一致）
- 典型构造：基于 BLS 签名的阈值版本、基于 ECDSA 的 GG20/GG21 协议
- 应用：加密货币钱包（MPC 钱包）、跨链桥验证

**Threshold PRF（门限伪随机函数）**：
- 每个参与方持有密钥份额，所有方对相同输入计算部分 PRF 值
- 组合 $t$ 个部分值得到完整的 PRF 输出
- 应用：分布式密钥派生、隐私集合求交

**Threshold KEM（门限密钥封装）**：
- 结合 KEM 和门限解密，适用于 TLS 集群和云密钥管理
- 单方加密的密文需要 $t$ 个服务器协作才能打开

### 6.2 安全模型

**Honest Majority（诚实多数） vs Dishonest Majority（不诚实多数）**：

Honest Majority（$t < n/2$）：
- 假设大多数参与方诚实（遵守协议）
- 恶意方无法破坏协议执行
- 协议更简单高效
- 常用于区块链共识（拜占庭容错）

Dishonest Majority（$t < n$）：
- 最多 $n-1$ 个参与方都可被攻陷，协议仍安全
- 更严格的安全假设
- 需要更复杂的协议（如 SPDZ 系列和 MASCOT 协议）
- 常用于金融场景中最高安全要求

**恶意安全（Malicious Security） vs 半诚实安全（Semi-honest Security）**：

半诚实安全：
- 参与方遵守协议，但试图从协议消息中获取额外信息
- 较容易实现、效率高
- 在某些场景假设合理（如 HSM 集群内部）

恶意安全：
- 参与方可任意偏离协议（发送错误消息、中止协议、伪造数据）
- 需要在协议中增加验证机制（零知识证明、一致性检查）
- 常用技术：加性秘密共享 + MAC 验证（如 SPDZ 的 Beaver Triple）

实际系统往往选择"可滥用抽象"（ABY 风格）——在半诚实安全基础上增加零知识证明层达到恶意安全。

---

## 第7章 分布式密钥生成 DKG

### 7.1 无可信 Dealer

传统秘密共享需要一个可信 Dealer（分发者），这引入了单点信任问题——如果 Dealer 被攻陷或被贿赂，所有共享的秘密都会泄露。

DKG 的目标：在没有可信 Dealer 的情况下，$n$ 个参与方联合生成一对（公钥，私钥），其中私钥以门限形式分布。

**每个参与方自己生成秘密并分发 Share**：

每个参与方 $P_i$ 独立执行以下步骤：
1. 随机选择秘密 $s_i \in \mathbb{Z}_q$
2. 构造 $t-1$ 次多项式 $f_i(x) = s_i + a_{i,1}x + \cdots + a_{i,t-1}x^{t-1}$
3. 为每个参与方 $P_j$ 计算份额 $s_{i,j} = f_i(j)$
4. 通过安全信道发送 $s_{i,j}$ 给 $P_j$
5. 广播承诺 $c_{i,k} = g^{a_{i,k}}$（验证份额一致性）

**联合公钥生成过程**：

$$
\text{公钥} \; PK = \sum_{i=1}^n s_i \cdot g = g^{\sum s_i}
$$

参与方 $P_j$ 的最终密钥份额：

$$
sk_j = \sum_{i=1}^n s_{i,j} = \sum_{i=1}^n f_i(j)
$$

最终私钥 $sk = \sum s_i$，但没有任何单个参与方知道完整的 $sk$。

### 7.2 核心机制

**Share 分发与一致性验证**：

$P_j$ 收到 $s_{i,j}$ 后，验证：

$$
g^{s_{i,j}} = \prod_{k=0}^{t-1} (c_{i,k})^{j^k}
$$

如果验证失败，说明 $P_i$ 发送了错误的份额。

**Complaint 机制**：
当验证失败时：
- $P_j$ 广播投诉：指出 $P_i$ 的份额无效
- $P_i$ 需在链上/公开广播中出示正确份额
- 如果 $P_i$ 无法证明，则被视为恶意参与方
- 协议可以容忍最多 $f < n/3$（拜占庭）的恶意参与方

**Share Refresh（定期刷新 Share）**：

为防止长期静态攻击（攻击者花时间逐步攻陷多个参与方），参与方定期刷新份额：

1. 每个参与方 $P_i$ 生成一个 $t-1$ 次多项式 $\delta_i(x)$，其中 $\delta_i(0) = 0$
2. 向其他参与方分发 $\delta_i(j)$
3. 更新份额：$sk_j' = sk_j + \sum \delta_i(j)$

刷新后，公钥不变（因为 $\delta_i(0) = 0$），但每个参与方的份额完全改变。攻击者需要在新一轮中重新攻陷 $t$ 个参与方。

**Proactive Secret Sharing（主动秘密共享）**：
结合 Share Refresh 与份额恢复：

- 刷新：定期更新所有活跃参与方的份额
- 恢复：如果某个参与方宕机或丢失份额，通过其他参与方的份额协作恢复
- 可容忍移动 adversary：攻击者可以随时间攻陷不同的参与方集合，但只要任何时间段内被攻陷的参与方数不超过 $t-1$，私钥就是安全的

PSS 是 DKG 的"黄金标准"，应用于比特币托管、以太坊验证器密钥管理等高安全场景。

---

## 第8章 多方密钥管理

### 8.1 密钥生命周期

**密钥备份与恢复（门限恢复）**：
- 密钥份额使用 Shamir 秘密共享存储在不同地理位置的 HSM 或安全服务器中
- 恢复时，操作员收集 $t$ 个份额，使用拉格朗日插值重建密钥
- 恢复过程需严格审计：谁参与了恢复、时间、目的
- 最佳实践：恢复本身也需要多因子认证和管理员审批

**密钥轮换策略**：
- 定期轮换：每季度每年生成新密钥并废弃旧密钥
- 事件驱动轮换：人员离职、疑似泄露、审计发现问题时立即轮换
- 门限密码中的轮换：通过 DKG 生成新密钥对，旧密钥用于解密历史数据
- 无缝轮换：新旧密钥同时生效一段时间（grace period），逐步迁移

**门限托管（Threshold Escrow）**：
企业级密钥管理场景：
- 公司将根 CA 密钥、域控制器密钥等关键密钥交由多个高管托管
- 任何个人不能单独访问完整密钥
- 紧急情况下（如某人离职或去世），其他托管人可通过门限恢复访问
- 法律合规：满足 SOX、PCI-DSS 等的"双人控制"要求

### 8.2 基础设施

**HSM 与分布式 HSM**：
传统 HSM：
- 单一硬件设备，存储主密钥和执行密码操作
- FIPS 140-2/140-3 Level 3 或 4 物理安全认证
- 单点故障风险——如果 HSM 被物理盗窃或后门攻陷，密钥全失

分布式 HSM：
- 将 HSM 信任分散到多个设备上（各存密钥份额）
- 使用门限签名，任何单台 HSM 都不能独立签署
- 优点：无单点故障、可容忍部分设备被攻陷
- 缺点：操作延迟增加、网络同步复杂

**多云密钥控制**：
跨 AWS/GCP/Azure/私有云管理密钥：
- 每个云服务商托管一个 DKG 节点
- 密钥管理操作需通过门限协议（至少 $t$ 个云响应）
- 即使某个云服务商被攻陷或被政府要求交出数据，也无法恢复完整密钥
- 技术要求：跨云低延迟通信、一致性保证、灾难恢复

**Insider Threat 防护**：
核心原则：**任何单一方都不能访问完整密钥**
- 最小权限原则：每个管理员只管理自己的份额
- 职责分离：密钥操作需要多方会签（如 CFO + CISO 同时批准）
- 审计日志：所有密钥操作全程记录、不可篡改
- 秘密撤销：怀疑某份额泄露时，立即执行 Share Refresh
- 地理分布式：份额存储在不同国家，减少政治风险

---

## 第9章 TEE基本概念

### 9.1 核心定义

**TEE（Trusted Execution Environment，可信执行环境）**：是 CPU 提供的硬件级隔离执行区域。程序在主操作系统之外的安全隔离环境中运行，操作系统（包括内核和 hypervisor）不能访问 TEE 的内存和执行状态。

**Enclave（飞地）**：TEE 中的隔离执行实例。一个 Enclave 包含：
- 代码段：加载到 Enclave 内存中的程序二进制
- 数据段：Enclave 私有的数据（包括密钥、敏感数据）
- 只有 Enclave 自身的代码可以访问其内存

代表实现：
- **Intel SGX（Software Guard Extensions）**：CPU 内存加密引擎，每个应用可创建多个 Enclave
- **AMD SEV/SEV-SNP（Secure Encrypted Virtualization）**：虚拟机级别的加密隔离
- **Intel TDX（Trusted Domain Extensions）**：加密虚拟机，比 SEV 更强的完整性保护
- **ARM TrustZone**：移动设备上的系统级隔离（安全世界 vs 普通世界）

**内存加密**：
CPU 内部集成内存加密引擎（MEE）：
- 数据在写入 RAM 之前由 CPU 自动加密
- 从 RAM 读取时自动解密
- 加密密钥在 CPU 内部生成和管理，操作系统和外部设备看不到明文
- 保护：物理内存嗅探、冷启动攻击、DMA 攻击

**隔离执行（Isolated Execution）**：
即使操作系统以最高权限运行（ring 0），也无法访问 Enclave 内存：
- CPU 硬件内存保护：Enclave 页面只能由 Enclave 自身的代码访问
- 所有外部地址翻译（页表）由 CPU 验证
- 操作系统可以拒绝服务（杀死 Enclave 进程），但不能窃取数据
- 中断和异常进入 Enclave 时，CPU 自动保存/恢复 Enclave 状态

### 9.2 关键技术

**Remote Attestation（远程证明）**：
这是 TEE 最有价值的特性之一——让远程验证者相信代码在正确的 TEE 环境的运行，并且代码完整性未被篡改。

工作流程：
1. Enclave 测量（Measure）：启动时对 Enclave 代码和数据进行哈希（称为 MRENCLAVE 或度量值）
2. 证明请求：远程验证者发送一个 nonce（防重放）
3. 签名：Enclave 使用 CPU 内部的"证明密钥"（由 CPU 厂商烧录）对测量值 + nonce 签名
4. 验证：验证者使用厂商公钥验证签名，检查测量值是否与预期一致

```
证明 = (测量值, nonce, 用户数据) 签名自 CPU 私钥
验证者：检查签名 && 检查测量值 == 预期值 && nonce 新鲜
```

**Sealing（密封）**：
将密钥或其他持久数据与特定 Enclave 实例绑定：
- 密封密钥（Sealing Key）由 CPU 为每个 Enclave 的测量值唯一派生
- 数据加密后存储到不可信的外部存储（磁盘、数据库）
- 只有相同测量值的 Enclave 才能解封数据
- 用途：持久化私钥、缓存身份凭证、状态恢复

```
密封：E(明文, 测量值派生密钥)
解封：D(密文, 测量值派生密钥)，仅相同 Enclave 可解
```

---

## 第10章 TEE与密码学的关系

### 10.1 TEE不是纯密码学方案

理解 TEE 的安全模型至关重要——它与密码学方案有本质区别：

**TEE依赖硬件信任根（CPU厂商的可信计算基）**：
- 安全依赖于 Intel/AMD/ARM 的 CPU 设计、制造和密钥管理
- 用户必须信任 CPU 厂商没有在芯片中植入后门
- 必须信任厂商的证明密钥系统没有被滥用
- 必须信任厂商发布的微码更新（Microcode Update）没有引入漏洞

**密码学方案依赖数学假设，TEE依赖物理安全假设**：
- 密码学：如果 SVP/LWE 等数学问题难解，则方案安全（数学保证）
- TEE：如果 CPU 没有物理漏洞、厂商是诚实的、侧信道不可利用，则方案安全（物理/制造保证）
- 密码学安全性是可证明的（在标准模型或随机预言模型中），TEE 安全性只能通过漏洞挖掘来验证

### 10.2 对比分析

**TEE vs MPC（安全多方计算）**：

TEE 优势：
- 无需交互：一个 Enclave 独立计算，不需多方通信
- 无需电路编译：直接运行现有 C/Rust 代码
- 性能开销低：明文计算（仅有内存加密开销，约 5-15%）

TEE 劣势：
- 单点故障风险：一个 Enclave 被攻破则所有数据泄露
- 无信息论安全性：TEE 安全假设可能在未来被物理攻击打破
- 不可审计：不能开源验证 TEE 内部的硬件保证
- 平台锁定：依赖特定 CPU 厂商

MPC 优势：
- 信息论安全（甚至可抵抗量子攻击）
- 安全性可数学证明，不依赖硬件
- 去中心化信任：多个参与方互相制衡

MPC 劣势：
- 交互开销极高，通信带宽大
- 无法高效支持通用计算（尤其涉及循环和条件分支）
- 需要编写专门的电路/协议，实现复杂

**TEE vs HE（同态加密）**：

TEE 优势：
- 计算开销极低，支持任意计算
- 开发者友好——写普通代码即可
- 数据输出前在 Enclave 中解密，灵活性高

TEE 劣势：
- 无长期安全保证：密钥泄露则**所有历史数据**泄露
- HE 中的数据在密文下处理，即使私钥后泄露，历史数据也不受影响（forward secrecy）

HE 优势：
- 数据始终加密，操作者永不能访问明文
- 可验证计算（通过正确性证明）
- 长期安全性：即使密钥泄露也只影响未来数据

HE 劣势：
- 性能开销巨大（Bootstrapping 可能需数秒到数分钟）
- 编程困难，只支持有限运算
- 密文膨胀（密文比明文大 10-1000 倍）

**TEE vs ZKP（零知识证明）**：

TEE 优势：
- 可证明程序在隔离环境中执行（通过远程证明）
- 性能远超 ZKP

TEE 劣势：
- 不可证明计算正确性——除非增加密码协议辅助
- 验证者必须信任 TEE 厂商
- ZKP 不需要信任任何第三方

ZKP 优势：
- 不依赖任何信任假设（数学证明）
- 验证高效，证明者需大量计算（通用 ZKP）
- 公开可验证：任何人都可以验证证明

### 10.3 混合部署

**TEE + MPC**：
MPC 处理跨 Enclave 的联合计算：
- 每个 Enclave 作为 MPC 的一个参与方
- Enclave 内部状态对外不可见（即使对其他参与方）
- MPC 协议确保组合结果正确
- 例：多个金融机构各运行一个 Enclave，联合做反欺诈分析而不暴露各方数据
- 优势：MPC 保证安全性，TEE 降低 MPC 的通信和计算开销

**TEE + HE**：
TEE 中运行 HE 密钥生成和参数选择：
- HE 的密钥生成非常复杂（参数、噪声、安全级别的权衡）
- 在 TEE 中生成 HE 密钥并密封保存
- TEE 确保密钥安全，HE 保护数据处理过程
- 例：医疗数据在 TEE 中加密并标记，外包服务器在 HE 下做统计分析

**TEE + ZKP**：
TEE 生成执行轨迹的零知识证明：
- TEE 记录 Enclave 内部的所有操作日志
- 将执行轨迹转化为 ZKP（证明计算正确性）
- 验证者无需信任 TEE，只需验证 ZKP
- 给 TEE 添加了密码学级别的正确性保证
- 例：TEE 中的税务计算，输出计算结果的同时提供 ZKP 证明计算遵守税法

---

## 第11章 TEE安全问题

### 11.1 侧信道攻击

侧信道攻击不直接破坏 TEE 的加密隔离机制，而是通过观察 TEE 的物理行为泄露信息。

**Cache Attack（缓存攻击）**：
典型攻击：Prime+Probe
1. 攻击者 Enclave（或恶意 OS）填充 CPU 缓存行
2. 等待受害者 Enclave 执行（使用缓存）
3. 测量自己的缓存行是否被逐出——推断受害者访问了哪些缓存行
4. 结合缓存访问模式恢复加密密钥

此类攻击已成功破解 SGX Enclave 中的 RSA/AES 实现。防御措施：
- **Constant-Time 编程**：所有代码的执行路径和内存访问模式与数据无关
- **Cache Partitioning**：Enclave 使用专用的缓存集（如 Intel CAT）
- **Flush 指令**：在敏感操作前后清空缓存

**Page-fault Attack（页错误攻击）**：
操作系统控制页表，可以：
1. 取消映射 Enclave 的某些内存页
2. 当 Enclave 访问这些页时触发页错误（Page Fault）
3. 操作系统记录 Page Fault 的地址和时间
4. 通过大量 Page Fault 序列推断 Enclave 的控制流和数据访问模式

防御措施：
- **Oblivious Access**：无论数据是什么，都访问相同的内存地址序列
- **SGX Step**：单步执行模式，减少信息泄露
- **防页错误指令**（如 Intel 的 `MRKLE` 或 VT-d 的页错误抑制）

### 11.2 物理攻击

**Rollback Attack（回滚攻击）**：
攻击者可以记录 Enclave 的持久化状态，然后恢复到旧版本：
- Enclave 将状态密封存储到不可信磁盘
- 攻击者做快照，然后诱导 Enclave 执行某些操作（如支付一次）
- 攻击者恢复快照，Enclave 重新执行同一操作（双重支付）

防御措施：
- **防回滚计数器（Monotonic Counter）**：
- CPU 内部维护单调递增硬件计数器
- 每次密封状态时递增计数器并存储当前值
- 解封时检查计数器值不小于上次记录值
- Intel SGX 提供 Platform Service Enclave (PSE) 实现单调计数器，但性能受限（闪存写入速度）

**恶意操作系统**：
操作系统虽然不是 TEE 的信任根，但拥有极大的攻击面：
- **页表控制**：OS 可控制 Enclave 页表的映射关系，诱发 TLB 不一致攻击
- **中断控制**：OS 可以频繁中断 Enclave 执行，观察中断时的寄存器状态
- **调度控制**：OS 可以控制 Enclave 在多核间的迁移（带来 cache 共享风险）
- **异步退出（AEX）**：Enclave 被中断时，CPU 自动保存状态到 Enclave 存储区，OS 可观察保存的寄存器值

防御措施：
- Enclave 内部实现完整性检查（如 checksum 所有状态）
- 使用 Intel 的 `EREMOVE` 和 `ETRACK` 指令确保页表一致性
- 减少 Enclave 到 OS 的上下文切换

### 11.3 供应链信任

**芯片制造过程是否植入后门？**
- CPU 芯片从设计 → 制造 → 封装 → 分发涉及多个国家（如设计在美国，制造在台积电/三星）
- 每一步都有可能被植入硬件后门
- **检测难度极大**：现代 CPU 有数十亿晶体管，逆向工程几乎不可能
- **缓解措施**：
  - 使用开源 RISC-V TEE（如 Keystone、Penglai）
  - 结合多个 TEE 提供商取"交"或"并"信任
  - 在 TEE 中增加可观测性（监测异常行为和时序模式）
  - 学术界正在研究"分布式信任链"——通过区块链记录芯片制造审计日志

**Attestation 验证的远程可靠性**：
- 远程证明的安全性依赖于验证者能否**可靠地获取和验证证明密钥**
- Intel Attestation Service (IAS/DCAP) 在云端验证 Intel 的硬件证明
- 攻击面：
  - 如果 IAS/DCAP 被篡改，可以批准恶意 Enclave 的证明
  - 如果证明密钥撤销列表（CRL）被篡改，可以接受已泄露的 Enclave
  - 如果 MITM（中间人）攻击验证者与 IAS 的通信，可伪造证明结果
- **缓解措施**：
  - 验证者自托管证明验证服务（减少对外部 API 的依赖）
  - 多路验证：同时向 Intel、AMD、ARM 的证明服务验证
  - 结合「透明度日志」（类似 Certificate Transparency）发布所有合法的 Enclave 测量值
  - 最终验证者可使用 ZKP 对这些日志做密码学验证
