# 隐私增强协议与差分隐私

## 第1章 私有集合求交 PSI

### 1.1 PSI 问题定义

**Private Set Intersection (PSI)** 解决的是：两方或多方各自持有集合，他们想得到**集合的交集**（或与之相关的结果），但**不能获得交集中的元素以外的任何信息**。

```
Alice: S_A = {a, b, c, d}
Bob:   S_B = {c, d, e, f}
PSI 输出: S_A ∩ S_B = {c, d}
```

关键约束：

- Alice 不知道 Bob 非交集元素（`e, f`）
- Bob 不知道 Alice 非交集元素（`a, b`）
- 双方不能推导出对方集合的大小（可选安全要求）

PSI 是隐私保护的**基础构建块**，被广泛用于：

- **广告点击重合**：两家公司想找出共同用户，但不暴露各自用户列表
- **联系人发现**：App 找出通讯录中已注册的好友
- **密码泄露检测**：检查密码是否在已知泄露集合中
- **基因数据匹配**：多家医院找出共同基因序列片段

### 1.2 PSI 分类

**按参与方数量：**

| 类型 | 描述 |
|------|------|
| **Two-party PSI** | Alice 和 Bob 两方参与，最常见 |
| **Multi-party PSI** | 三方及以上，协议交互更复杂，通常用 OPRF 或电路 |

**按输出类型：**

| 类型 | 描述 |
|------|------|
| **PSI** | 输出交集元素本身 |
| **PSI Cardinality** | 只输出交集大小 \|S_A ∩ S_B\|，不输出具体元素 |
| **Labeled PSI** | 额外输出交集元素的关联标签数据（如 Cookie 对应的用户画像） |
| **Threshold PSI** | 交集大小超过阈值才输出结果 |

**按场景特性：**

| 类型 | 描述 |
|------|------|
| **Unbalanced PSI** | 一方集合极大（如 Server 有亿级），另一方极小（如 Client 几十个），需要非对称优化 |
| **Private Join and Compute** | 类似 SQL JOIN，在两方密钥列匹配后，仅输出聚合计算结果 |

### 1.3 PSI 实现路线

PSI 的实现有多条技术路线，各自有不同的假设条件和性能特征。

#### DH-based PSI（Diffie-Hellman）

基于 DH 密钥交换的可交换加密性质。

**核心思想**：双方各自用私钥加密自己的元素，因为加密可交换，交集元素会得出相同的结果。

```
Alice 私钥 a, Bob 私钥 b
H(x)^{a*b} = H(x)^{b*a}

Alice 发送 {H(x)^a | x ∈ S_A}
Bob 发送 {H(x)^b | x ∈ S_B}
Alice 计算 {H(y)^a | y ∈ S_B} 与自己的比对找交集
Bob 计算 {H(z)^b | z ∈ S_A} 与自己的比对找交集
```

**协议流程**：

1. Alice 和 Bob 商定一个哈希函数 $H: \{0,1\}^* \to \mathbb{G}$（映射到群 $\mathbb{G}$）
2. Alice 选私钥 $a$，Bob 选私钥 $b$
3. Alice 发送 $\{H(x)^a \mid x \in S_A\}$ 给 Bob
4. Bob 发 $\{H(y)^b \mid y \in S_B\}$ 给 Alice
5. Bob 计算 $\{H(x)^{ab} \mid x \in S_A\}$，与自己的 $\{H(y)^b \mid y \in S_B\}$ 匹配
6. Alice 计算 $\{H(y)^{ab} \mid y \in S_B\}$，与自己的 $\{H(x)^a \mid x \in S_A\}$ 匹配

**特点**：

- 通信复杂度 $O(|S_A| + |S_B|)$，双方均摊
- 需要完整集合，不支持流式
- 安全性依赖于 Decision Diffie-Hellman (DDH) 假设

#### OT-based PSI（Oblivious Transfer）

将交集问题转化为 **Oblivious Transfer** 调用的组合。

**核心思路**：将集合元素编码为 OT 的选择位。

Naor-Pinkas PSI（1997）的开创性工作：
- 将集合 $S_A$ 视为 OT 的发送方消息集
- 将集合 $S_B$ 视为 OT 的接收方选择
- 通过 OT 实现交集计算

**特点**：

- 通信复杂度 $O(n \log m)$（$n$ 为大集合大小，$m$ 为小集合大小）
- 通常用于小规模集合或作为其他方案的基础
- 后续优化：**KKRT**（Kolesnikov-Kumaresan-Rosulek-Trieu, 2016）用 OT Extension 大幅提升性能

#### OPRF-based PSI（推荐实现方案）

见第2章 OPRF 的细节。这是目前**最主流、最实用**的 PSI 方案。

**核心思路**：OPRF 让 Alice 得到 $F_k(x)$ 对每个 $x \in S_A$，Bob 得到 $F_k(y)$ 对每个 $y \in S_B$。

```
Bob 拥有 OPRF 密钥 k
Alice 通过 OPRF 得到 {F_k(x) | x ∈ S_A}
Bob 自行计算 {F_k(y) | y ∈ S_B}
双方比较伪随机输出 => 交集
```

**PSI from OPRF（经典构造：ECDH-OPRF → PSI）**：

1. Bob 生成 PRF 密钥 $k$
2. Alice 和 Bob 执行 OPRF：对 Alice 每个元素，Alice 得到 $F_k(x)$
3. Bob 本地计算 $\{F_k(y) \mid y \in S_B\}$ 并排序后发给 Alice
4. Alice 在自己的 $\{F_k(x)\}$ 和 Bob 的列表中找交集

**特点**：

- 通信量：Alice 只需发送 $|S_A|$ 个 blinded 元素，Bob 发回 $|S_B|$ 个 OPRF 输出
- 支持 Unbalanced PSI：Bob（Server）预计算 F_k 列表，Alice 只需发少量 OPRF 请求
- 支持 **OPRF Batching** 降低开销

#### HE-based PSI（同态加密）

使用**加法同态加密**或**全同态加密**计算集合交集。

**基本思路**：

1. Bob 将集合 $S_B$ 编码为多项式 $P(x) = \prod_{y \in S_B} (x - y)$
2. Alice 用 HE 加密她的每个元素，发给 Bob
3. Bob 在密文上计算 $P(Enc(x))$，结果是 0 当且仅当 $x \in S_B$
4. 但 Bob 不知道 Alice 的元素，也不能区分 0 和非 0 密文

**特点**：

- 通信复杂度理论上可以到 $O(|S_A| + \log|S_B|)$（多项式编码 + HE）
- 计算开销极大（尤其 FHE），实际中不如 OPRF/OT
- 适合与**可验证性**结合（HE 天然支持验证）

#### Circuit-based PSI

将集合交集视为**布尔电路**的求值过程。

**思路**：

- 对元素排序后，用**比较电路**（Equality Check）和**排序电路**构造交集
- 结合 **Garbled Circuit** 或 **GMW** 实现安全两方计算

**特点**：

- 通用性强，可在电路内执行任意后处理（如 Labeled PSI 的标签处理）
- 复杂度 $O(n \log n)$，常数因子大
- 通常只在元素规模小且需要复杂逻辑时使用

### 1.4 PSI 安全与泄露

即使 PSI 协议本身是安全的，**侧信道泄露** 仍可能造成隐私风险。

#### 集合大小泄露

- **问题**：协议交互中，双方可能推断对方集合大小
- **缓解**：Padding 集合（加假元素）、Differential Privacy 加噪、Oblivious 传输模式

#### 交集大小泄露

- **问题**：即使只输出交集标签，交集大小也可能被利用
- **Intersection Size Attack**：已知交集大小 + 辅助信息可反推用户存在性
- **缓解**：只输出 Threshold PSI（如交集大于1000才告知），或 DP 加噪

#### 恶意输入

- **问题**：一方故意选择特殊的集合元素试图推断对方信息
- **Active Attack**：Bob 选 $S_B = \{r\}$（一个随机元素），观察 Alice 行为判断 $r$ 是否在 Alice 集合中
- **缓解**：使用 **Malicious-secure PSI**（ZK Proof、承诺机制），或引入可信第三方

#### 重复查询攻击

- **问题**：同一方多次发起 PSI 请求，每次略微改变集合，分析输出变化
- **Differential Attack**：与 DP 类似，通过多次交集的差异推断个体信息
- **缓解**：服务端追踪 query 记录、限制 query 次数、每次加入独立噪声、使用 **Auditable PSI**

---

## 第2章 不经意伪随机函数 OPRF

### 2.1 OPRF 问题定义

**Oblivious Pseudorandom Function (OPRF)** 是一个**两方协议**，让接收方用自己的私密输入 $x$ 得到 $F_k(x)$，同时：

1. **接收方隐私**：服务端不知道 $x$（输入隐私）
2. **服务端隐私**：接收方不知道 $k$（密钥隐私），仅得到 $F_k(x)$

**形式化**：

```
服务端 S: 拥有 PRF 密钥 k
接收方 C: 拥有输入 x ∈ {0,1}*

∩ 协议执行后 ∩
C 得到 F_k(x)
S 得到 ⊥（无输出）
```

**安全性要求**：

- **Correctness**：$C$ 正确得到 $F_k(x)$
- **Receiver Privacy**：$S$ 不能区分 $C$ 的输入是 $x_0$ 还是 $x_1$（模拟器在理想世界中仿真）
- **Sender Privacy**：$C$ 不能区分 $F_k(x)$ 与 $F_{k'}(x)$（即 $C$ 不能获得 $k$ 的信息）

### 2.2 OPRF 构造

#### 经典构造：基于 DH-OPRF

最有名的 OPRF 是使用 **Elliptic Curve Diffie-Hellman（ECDH）** 构造。

```
C: x → H(x) ∈ G（映射到椭圆曲线）
C: 选随机数 r, 发送 blinded_input = H(x) * r
S: 计算 response = k * blinded_input = k * H(x) * r
C: unblind: F_k(x) = response * r^{-1} = k * H(x)
```

**为什么不直接发 H(x) 给 S？**

如果 $C$ 直接发 $H(x)$，$S$ 可以用自己的密钥 $k$ 计算 $k \cdot H(x)$ 发回，但 $S$ 知道 $H(x)$，在 $x$ 空间较小的情况下可以穷举 $x'$ 并比对 $H(x')$ 与 $H(x)$，从而知道 $C$ 的输入。所以必须**盲化**。

**Blinding 在这里的作用**：

- $C$ 发 $H(x) \cdot r$，$r$ 是随机数
- $S$ 看到的是均匀随机群元素，无法反推 $x$
- $C$ 收到后乘 $r^{-1}$ 去掉盲化因子，最终得到 $k \cdot H(x)$

#### 基于 OT 的 OPRF

将 PRF 视为一个函数，通过 **Correlated OT** 或 **Oblivious Transfer Extension** 构造 OPRF。

更具体的：**KKRT OPRF**（Kolesnikov et al., 2016）

- 将 PRF 定义为 $F_k(x) = C(k, x)$（相关随机提取）
- 通过 OT Extension 高效实现 **Batch OPRF**，适用于大规模 PSI

#### 基于 VOLE 的 OPRF

**Vector OLE (VOLE)** 可以构造高效的 **Silent OPRF**：

- 利用 **Pseudorandom Correlation Generator (PCG)** 预生成相关随机性
- 通信量极小（几十 KB 即可生成数百万 OPRF 实例）
- 代表工作：**CM20**（Chase-Miao, 2020）、**Worst-case to Average-case Reduction**

### 2.3 VOPRF（可验证 OPRF）

**Verifiable OPRF (VOPRF)** 增加**可验证性**：接收方可以验证服务端确实用了正确的密钥 $k$。

- 服务端额外提供 $k$ 的**公钥承诺** $PK = g^k$
- 计算 **零知识证明** 证明 $response = k \cdot blinded\_input$
- 代表：**OPRF 标准化工作**（IRTF CFRG, RFC 9497）

VOPRF 的应用：

- **Privacy Pass**：匿名令牌，用户通过 VOPRF 获得不可伪造的令牌，绕过 CAPTCHA
- **苹果 Private Relay / iCloud Private Access**：验证隐私中继

### 2.4 OPRF 在 PSI 中的应用

**PSI from OPRF** 是最主流的 PSI 实现方式：

```
设 S_B 为服务端集合, S_A 为客户集合

准备阶段（服务端离线）：
  服务端计算 {F_k(y) | y ∈ S_B}，排序后存储

在线阶段：
  1. 客户对每个 x ∈ S_A，与服务器执行 OPRF
  2. 客户得到 {F_k(x) | x ∈ S_A}
  3. 客户将 {F_k(x)} 与服务器预计算的 F_k(y) 列表比对 → 交集
```

**Unbalanced PSI 优势**：

- 服务端可预计算 OPRF 值，客户只需发 $|S_A|$ 个 OPRF 请求
- 通讯 $O(|S_A| \log |S_B|)$，而非 $O(|S_B|)$

**OPRF Batching**：一次 OPRF 协议处理多个元素

- 对 $\{H(x_1), \dots, H(x_n)\}$ 用相同密钥 $k$ 操作
- 可以打包在一个协议消息中发送
- 通信量 $O(1)$ 个群元素（而不是 $O(n)$），通过 **Interleaved OPRF** 或 **Batch OPRF**

### 2.5 OPRF 在密码认证中的应用

**OPAQUE 协议**（IETF 标准，RFC 9192）：

- **PAKE（Password-Authenticated Key Exchange）** 的增强版
- 服务端存 $H(pw)^k$（$k$ 为服务端密钥），客户端通过 OPRF 获取 $H(pw)^k$
- 客户端用此推导认证密钥
- 安全性：即使服务端数据库泄露，攻击者无法暴力破解密码（因为需要 $k$）
- **OPRF 在 OPAQUE 中的角色**：服务端对密码执行 OPRF，客户端得到盲化的密码 Hash，然后做 PAKE 认证

### 2.6 OPRF 在隐私令牌中的应用

**Privacy Pass**（Cloudflare）：

- 用户在绕过 CAPTCHA 后获得一个 OPRF 令牌
- 令牌是 $F_k(x)$，$x$ 是某个 nonce，$k$ 是服务端密钥
- 用户后续请求携带令牌，服务端验证 $F_k(x)$ 但不记录用户身份
- **VOPRF 保证令牌的真伪性**：用户通过公钥验证服务端正确计算了 $F_k(x)$

**苹果 iCloud Private Access**：VOPRF 用于匿名验证用户的订阅状态

---

## 第3章 私有信息检索 PIR

### 3.1 PIR 问题定义

**Private Information Retrieval (PIR)** 让用户从数据库 $DB = \{x_1, \dots, x_n\}$ 中检索第 $i$ 条记录，同时：

1. **服务器不知道 $i$**（查询隐私）
2. 用户得到正确的 $x_i$

**和 PSI 的区别**：

| 特性 | PIR | PSI |
|------|-----|-----|
| 数据结构 | 数据库（有序/索引） | 集合（无序） |
| 查询方式 | 按索引 $i$ 查询 | 求集合交集 |
| 输出 | 一条具体记录 $x_i$ | 交集元素（可能多个） |
| 安全性 | 隐藏查的"位置" | 隐藏不在交集中的元素 |
| 典型应用 | 查专利数据库 | 广告重合分析 |

**和 OT 的区别**：

| 特性 | PIR | OT |
|------|-----|-----|
| 数据库大小 | $n$ 条记录，$n$ 可很大 | 通常 2 条消息（1-out-of-2 OT）|
| 通信开销 | 希望比 $O(n)$ 小很多 | 基础 OT 是 $O(1)$ 或 $O(\kappa)$ |
| 安全性模型 | 通常仅服务器隐私（单服务器） | 双方都安全 |
| 效率目标 | 亚线性通信（$\text{poly}\log n$） | 常数轮、线性计算 |

**和可搜索加密（SE）的区别**：

| 特性 | PIR | 可搜索加密 |
|------|-----|------------|
| 查询方式 | 按索引 | 按关键词 |
| 服务器端 | 计算密态索引 | 搜索加密的索引 |
| 泄露 | 不泄露任何信息 | 泄露搜索模式、访问模式 |
| 加密性 | 可以不加密数据库 | 必须加密数据库 |

### 3.2 PIR 分类

#### Information-theoretic PIR (IT-PIR)

**核心思想**：数据库复制到 $m$ 个不共谋的服务器，每台服务器只看到部分查询。

**2-server PIR（经典构造）**：

- 数据库 $DB$ 长度为 $n$ 位
- 用户想查第 $i$ 位
- 用户生成 $q_1, q_2 \in \{0,1\}^n$，满足 $q_1 \oplus q_2 = e_i$（第 $i$ 位为 1，其余 0）
- Server 1 收到 $q_1$，返回 $DB \cdot q_1$（点积 $\mod 2$）
- Server 2 收到 $q_2$，返回 $DB \cdot q_2$
- 用户计算 $(DB \cdot q_1) \oplus (DB \cdot q_2) = DB \cdot e_i = x_i$

**安全性**：

- 每台服务器单独看到的 $q_j$ 是均匀随机的，不可能知道 $i$
- **前提**：服务器之间不共谋

**通信复杂度**：

- $n$-server PIR：$O(m \cdot n^{1/(m-1)})$，$m$ 为服务器数
- 时间复杂度 $O(n)$（服务器必须线性扫描整个数据库）

#### Computational PIR (CPIR)

**核心思想**：用**加密算法**隐藏查询索引，不需多服务器。

**基于同态加密的 PIR**：

```
用户：生成公私钥 (pk, sk)
用户：加密查询 Enc_pk(i) 发给服务器

服务器：计算：
  for j in 1..n:
    c_j = IF j == i THEN Enc(1) ELSE Enc(0)
  返回: ∏_{j=1}^n c_j^{x_j} = Enc(∑ IF j==i THEN x_j ELSE 0) = Enc(x_i)
    注意上面的是乘法同态版本（如 Paillier）

用户：解密得到 x_i
```

**更高效的方法（基于 RLWE 的 PIR）**：

- 使用 **Ring-LWE** 同态加密，对密文打包
- 用 **FHE-like** 技术：将数据库编码为矩阵，用 SIMD（Single Instruction Multiple Data）处理
- 代表工作：**SealPIR**（2018）、**Spiral（2022）**

**通信复杂度**：

- 理论上可达到 $\text{poly}\log n$（亚线性）
- 实际通信量：SealPIR 约 1-2 MB 对 $n = 2^{24}$ 规模的数据库
- 计算开销随数据库线性增长（必须全量处理）

#### Single-server vs Multi-server PIR

| 类型 | 假设 | 通信量 | 计算量 | 是否需多服务器 |
|------|------|--------|--------|---------------|
| IT-PIR | 服务器不共谋 | $O(n^{1/(m-1)})$ | $O(n)$ 每服务器 | 是（$m \ge 2$）|
| CPIR | 计算安全 | $O(\text{poly}\log n)$ | $O(n)$ | 否 |
| Hybrid | 弱假设 | 折中 | 折中 | 不一定 |

### 3.3 PIR 的安全性

**Query Privacy**：强安全性保证

- **Perfect Privacy**（IT-PIR）：查询分布与任意其他查询不可区分
- **Computational Privacy**（CPIR）：查询密文与随机密文计算不可区分（基于格/DDH等假设）

**PIR 不提供的保护**：

1. **内容隐私**：数据库可以不加密，用户得到明文
2. **查询结果隐私**：用户可以随意使用结果
3. **数据库隐私**：用户可能获得多条记录的组合信息（审计性问题）
4. **访问模式保护**：PIR 只隐藏"查了什么索引"，**不隐藏"查了多少次"**（需要 ORAM 或 DP 配合）

### 3.4 PIR 与相关原语对比

```
OT:    ┌────┐  ┌───┐  用户选 i, 从 {m0, m1} 中得到 mi
       │ S  │  │ C │
       └────┘  └───┘

PIR:   ┌────────┐  ┌───┐  用户从 n 条记录中查第 i 条
       │ DB(n)  │  │ C │
       └────────┘  └───┘

SE:    ┌──────────────┐  ┌───┐  用户搜关键词 w，得含 w 的所有文档
       │ Encrypted DB │  │ C │
       └──────────────┘  └───┘
```

**PIR vs OT**：

- OT 的通信开销是常数（2 条消息），PIR 即使在最佳情况下也至少需要 $\log n$ 通信
- OT 用于通用安全多方计算，PIR 专门优化大规模数据库场景

**PIR vs 可搜索加密（SE）**：

- SE 泄露访问模式（哪些文档包含关键词），PIR 完全不泄露
- SE 效率高（亚线性搜索时间），PIR 需要线性扫描数据库
- SE 适合"关键词搜索"，PIR 适合"按索引检索"

### 3.5 PIR 的实际部署

**PIR 的瓶颈**：

- **计算瓶颈**：服务器必须处理整个数据库，无法使用索引优化
- **通信瓶颈**：虽然理论上可以 $\text{poly}\log n$，实际实现中仍有数 MB 通信

**实际部署案例**：

- **Brave Search**（Fast, Anonymous, and Random TRIPIR）：使用 3-server IT-PIR 实现匿名搜索
- **Google Key Transparency**：用户通过 PIR 验证密钥状态
- **Alibaba**：PIR 用于专利和保护敏感数据查询

---

## 第4章 ORAM（Oblivious RAM）

### 4.1 Access Pattern 泄露问题

即使数据被加密，CPU 对内存的**访问模式**仍会泄露敏感信息。

**访问模式（Access Pattern）** 包括：

- **读/写地址序列**：$a_1, a_2, \dots, a_T$
- **读/写频率和顺序**
- **条件分支的跳转模式**

**已知攻击**：

- **Obliviousness Attack**（Goldreich-Ostrovsky）：分析内存访问可以恢复排序结果
- **VSH Attack**（Virtual Machine Side-channel）：在虚拟化环境中监控内存页访问
- **Spectre/Meltdown**：利用推测执行泄露访问模式

**举例**：二分查找

```
输入: 有序数组 A[1..n], 要找的值 v
if A[mid] > v: 去左半区（地址低）
else: 去右半区（地址高）
```

攻击者看到访问序列就能推断比较结果，从而恢复目标元素。这是 **二分查找泄露查询值** 的经典案例。

### 4.2 Oblivious RAM 模型

**Oblivious RAM (ORAM)** 的目标：将程序对内存的读写访问**转换成**让攻击者无法区分任何两个具有相同长度的执行轨迹。

```
真实访问: a_1, a_2, ..., a_T
ORAM 变换后: a'_1, a'_2, ..., a'_T'

安全性: 对于任意两个输入，如果执行时间相同，访问模式（地址序列）计算不可区分
```

**ORAM 架构**：

```
CPU <---> ORAM Controller <---> RAM
                |
          隐藏真实地址
          重排序、填充、混洗
```

#### ORAM 的关键指标

- **Bandwidth Overhead（带宽开销）**：处理一次逻辑读写所需的物理读写次数。$O(\log n)$ 是理想目标
- **Client Storage（客户端存储量）**：客户端需要存储的数据量（暂存、位置映射等）
- **Server Storage（服务器端存储量）**：服务器存储的冗余数据量
- **Round Complexity（轮数）**：协议需要几次交互
- **Recursion（递归）**：是否可以用递归结构降低客户端存储

### 4.3 Path ORAM（当前最实用的 ORAM）

**Path ORAM**（Stefanov et al., 2013）是现代 ORAM 的奠基性方案。

#### 数据结构

- **Binary Tree**：深度为 $L$ 的二叉树，每个节点是一个 bucket（包含 $Z$ 个 block）
- **Position Map**：每个 block 对应一个 leaf label $l$（树中的某个叶子节点的序号）
- **Stash**：客户端本地暂存区

#### 基本操作

```
Read(addr):
  1. l = PositionMap[addr]              # 查找 block 当前位置
  2. PositionMap[addr] = RandomLeaf()    # 更新为新随机位置
  3. ReadAndDecryptPath(l)              # 读取从根到叶子 l 的路径
  4. 在路径和 Stash 中找到 addr 的数据并返回
  5. EvictPath(l):                      # 将路径中的 block 重新写回
     把路径上的每个 block（可以在该 bucket 范围内放尽量深的）
     最后将路径加密写回
```

**核心直觉**：

- 每次访问 block 后，在**客户端重映射 block 到随机的叶子**
- 每次读写都从根到叶子读**一整条路径**，无论访问哪个 block
- 攻击者看到的是**从根到随机叶子的路径读写**，无法区分访问的是哪个 block

#### 安全性

- **Oblivious**：每次访问都是从根到叶子的路径读写
- 路径长度相同（$L$ 层）、访问模式与具体 block 无关
- 只有 **Stash 大小**可能泄露少量信息（但可通过概率分析控制泄露）

#### 参数选择

设总 block 数为 $N$：
- 树深度 $L = \lceil \log_2 N \rceil$（约 $N$ 个叶子）
- 每个 bucket 大小 $Z$：通常 $Z = 4$ 或 $5$
- Stash 大小：$O(\log N)$（概率保证失败 $\text{negl}$）

#### 带宽开销

- 每次访问读/写一条路径：$O(Z \cdot L) = O(\log N)$ 个 block
- 带宽开销 $O(\log N)$ block 传输

### 4.4 其他 ORAM 方案

| 方案 | 年份 | 带宽开销 | 客户端存储 | 特点 |
|------|------|---------|-----------|------|
| **Tree ORAM** | 2013 | $O(\log N)$ | $O(\log N)$ | 路径 ORAM 基础 |
| **Circuit ORAM** | 2015 | $O(\log N)$ | $O(1)$ | 适合 MPC 电路 |
| **Oblivious Parallel RAM (OPRAM)** | 2015 | 并行化 | — | 多处理器 |
| **Onion ORAM** | 2015 | $O(\log N)$ | $O(1)$ | 递归位置映射 |
| **Differential ORAM** | 2016 | $O(\log N)$ | $O(1)$ | DP 抵抗频率分析 |

### 4.5 ORAM 与 TEE 结合

**问题**：Intel SGX / AMD SEV 中，Enclave 内的内存访问可能被 OS / Hypervisor 观察到。

**Oblivious TEE**（如 **Oblivious SGX**）：

- 利用 ORAM 隐藏 Enclave 内部的内存访问模式
- 确保 Enclave 的地址线无法被特权软件监控

**ZeroTrace**（2018）：
- 在 SGX 中实现 ORAM 控制器
- 用 TEE 保证 ORAM 控制器的可信执行

**Oblivious Neural Networks**：
- 在 ORAM 上执行神经网络推理
- 基因序列分析、医疗诊断等隐私敏感场景

### 4.6 ORAM 与 MPC 结合

**Oblivious RAM 在安全多方计算中的作用**：

- MPC 中每个参与方操作的是秘密共享数据，访问模式可能泄露
- **Circuit ORAM** 将 ORAM 转化为可在 Garbled Circuit 中执行的形式
- 用于 **Private Database Query**、**Private Inference**

### 4.7 ORAM 与可搜索加密结合

**Oblivious Searchable Encryption**：

- 可搜索加密泄露**访问模式**和**搜索模式**
- 结合 ORAM 实现 **Oblivious Access**
- 代表：**ObliviSearch**、**Differential Searchable Encryption**

**Trade-off**：

- SE 效率高（亚线性搜索）
- ORAM 隐藏访问模式但开销 $O(\log N)$
- 联合方案：用 SE 做关键词检索，用 ORAM 隐藏检索后的结果访问

---

## 第5章 安全聚合（Secure Aggregation）

### 5.1 基本目标

**问题**：服务器想聚合多个客户端的贡献（如 ML 梯度），但看不到任何单个客户端的值。

```
客户端 i: 有向量 x_i ∈ ℝ^d
目标：服务器得到 sum_i x_i（或 mean），但对单个 x_i 一无所知
```

**形式化**：
$$
\text{Server outputs } \sum_{i=1}^{n} x_i \quad \text{while learning no additional info about any } x_i
$$

**安全聚合的挑战**：

1. **客户端掉线**：部分客户端可能中途退出，聚合必须健壮
2. **动态参与**：客户端可随时加入或离开
3. **恶意客户端**：客户端发送恶意值破坏聚合结果
4. **大规模通信**：$n$ 可达 $10^5$-$10^7$，通信必须高效
5. **稀疏梯度**：$x_i$ 是稀疏的，可优化带宽
6. **与差分隐私结合**：在聚合中加噪声实现用户级 DP

### 5.2 典型方法

#### 加法秘密共享（Additive Secret Sharing）

**思路**：每个客户端将自己的值拆分给其他客户端，服务器只得到恢复后的聚合。

```
每个 x_i 拆分为: x_i = x_i^1 + x_i^2 + ... + x_i^n (mod p)
服务器收集恢复后得 ∑ x_i
```

**问题**：需要 $O(n^2)$ 通信（每个客户端向所有人发共享），不实用。

#### Pairwise Mask（成对掩码，Google 方案）

**Bonawitz et al.（2017）** 的突破性工作，用于联邦学习。

```
每个客户端 i:
  for j = 1..n, j ≠ i:
    与客户端 j 协商共同密钥 s_{i,j}
    if i < j: 掩码为 +s_{i,j}
    if i > j: 掩码为 -s_{i,j}

客户端 i 发送: y_i = x_i + ∑_{j≠i, i<j} s_{i,j} - ∑_{j≠i, i>j} s_{i,j}

服务器: ∑ y_i = ∑ x_i (因为成对掩码相互抵消)
```

**安全性**：

- 单一方看到的是 $y_i = x_i + \text{mask}$，无法恢复 $x_i$
- 服务器要得到 $x_i$ 需要知道所有 $s_{i,j}$，这是不可能的

**处理掉线**：

- 当客户端 $j$ 掉线，所有需要 $s_{i,j}$ 的客户端需要重新计算
- 使用 **秘密共享** 备份 $s_{i,j}$：每个客户端将密钥碎片分发给其他客户端
- 掉线客户端的掩码由其他客户端揭晓

**协议流程**（Bonawitz et al.）：

```
Round 1: 客户端广播公钥
Round 2: 客户端公布参与签名（确定参与方）
Round 3: 客户端两两协商共享秘密
Round 4: 客户端发送 masked 输入 y_i
Round 5: 服务器检测掉线客户端
Round 6: 幸存的客户端发送掉线客户端的秘密共享碎片
Round 7: 服务器恢复掩码，得到聚合结果
```

**通信复杂度**：

- 每对客户端需要交换密钥：$O(n^2)$
- 实际部署中可通过 **Broadcast** 优化为 $O(n)$

#### 门限秘密共享（Threshold Secret Sharing）

**思想**：使用 Shamir 秘密共享，$t$-out-of-$n$ 重构。

- 每个客户端将 $x_i$ 拆分为 $n$ 个碎片
- 服务器只需要至少 $t$ 个碎片即可重构
- 客户端掉线 $< n-t$ 个时，聚合不受影响

**与 Pairwise Mask 结合**：

- 用秘密共享备份掩码：$s_{i,j}$ 被拆分为碎片分发给所有客户端
- 掉线时，剩余客户端用碎片恢复掩码

#### 同态加密（HE-based Secure Aggregation）

**思路**：客户端用服务器的公钥加密梯度，服务器在密文上直接求和。

```
服务器：生成 HE 公私钥 (pk, sk)，分发 pk
客户端 i：加密 Enc_pk(x_i) 发给服务器
服务器：计算 Enc_pk(∑ x_i) = ∏ Enc_pk(x_i)
服务器：解密得到 ∑ x_i
```

**问题**：

- 不能处理掉线：服务器无法解密 $\prod_{i \in Survive} Enc(x_i)$ 除非所有存活客户端都加密
- 支持掉线的方案需要 **Threshold HE**（分布式解密）
- 密文尺寸大，计算开销高

**HE-based 的优势**：

- 天然支持稀疏梯度的压缩（明文打包）
- 适合与 MPC 结合（安全聚合 + 安全计算）

#### MPC-based Secure Aggregation

**通用 MPC**（如 SPDZ、BMR、ABY）：

- 所有客户端对 $x_i$ 做 **加法秘密共享**
- 服务器在所有共享上计算 $\sum x_i$
- 支持任意计算（不只是求和），但通信开销大

**优化**：

- **Randomized Aggregation**：只用一个 public coin 做随机掩码
- **Verifiable Secret Sharing**：检测恶意客户端篡改碎片

### 5.3 工程问题

#### 客户端掉线

| 方法 | 处理方式 | 额外开销 |
|------|---------|---------|
| **Pairwise Mask + SS** | 碎片恢复掉线者的掩码 | $O(n^2)$ 通信 |
| **Threshold SS** | 只需 $t$ 个客户端 | $O(n^2)$ 通信 |
| **Erasure Coding** | 用纠删码恢复掉线方数据 | $O(n)$ 通信 |

**Google 实践**（Bonawitz et al., 2017）：

- 将掩码密钥用 Shamir 秘密共享分割给其他客户端
- 掉线者掩码由剩余客户端提供的碎片恢复
- 通信量 $O(n^2)$，但使用 **Bell-LaPadula 模型** 可优化

#### 动态参与

- **Rounds-based Model**：每轮确定参与客户端列表
- **Dynamic Secure Aggregation**（Xu et al., 2019）：
  - 新客户端可以在任何轮次加入
  - 使用 **动态秘密共享** 重新分配密钥
  - 配合 Mask 系统，加入/离开只需更新局部的掩码

#### 恶意客户端

- **恶意修改值**：客户端发送 $y_i' = y_i + \delta$ 破坏最终聚合
- **检测**：用 **Zero-knowledge Proof** 证明 $y_i$ 是 $x_i$ 的有效掩码
- **纠正**：使用 **Robust Aggregation**（如 Median、Trimmed Mean、Krum）
- **Input Verification**：服务器验证 $y_i$ 的范数是否在合理范围内

#### 大规模通信

- **Nested Mask**（Bell et al., 2020）：用树状结构减少两两配对的通信
- **Hierarchical Aggregation**：将客户端分组，组内先聚合，组间再聚合
- **Dropout Mask**：随机子集参与掩码，降低通信

#### 稀疏梯度

- **Compressed Sensing**：只发送非零梯度的掩码
- **Top-k 梯度**：只聚合梯度最大的 $k$ 个分量
- **Sparse Mask**：只对非零部分做掩码，用 Bloom Filter 差分压缩

#### 与差分隐私结合

- **Central DP + Secure Aggregation**：服务器拿到聚合结果后加噪声
- **Local DP + Secure Aggregation**：客户端加噪声，再安全聚合（噪声叠加）
- **Distributed DP**（见第10章）：在安全聚合协议内部**分布式加噪**

---
**Secure Aggregation 在联邦学习中的地位**：

```
每个客户端: x_i (local gradient)
      ↓
[Secure Aggregation]
   → Pairwise Mask / HE / MPC
      ↓
服务器: ∑ x_i + noise (DP)
      ↓
更新全局模型
```

---

## 第6章 可验证计算（Verifiable Computation）

### 6.1 问题定义

**Outsourced Computation** 场景：

```
客户 C: 想计算 f(x)
  但 C 的计算能力弱 ➔ 外包给服务器 S
服务器 S: 计算 y = f(x)，返回结果
问题: C 如何确信 y 是正确的？
```

**Verifiable Computation（VC）** 让客户**高效验证**服务器提交结果的正确性，即使服务器可能恶意。

**要求**：

- **Correctness**：诚实服务器总能生成可被接受的证明
- **Soundness**：恶意服务器不能对错误的结果 $y' \neq f(x)$ 生成可接受的证明
- **Efficiency**：验证必须比重新计算 $f(x)$ 更快

**Proof of Correct Execution（正确执行证明）**：服务器提供某种"证据"，客户在接受前验证。

### 6.2 分类

| 类型 | 证明 | 验证成本 | 假设 |
|------|------|---------|------|
| **Interactive Proof (IP)** | 多轮交互 | 低 | 无（信息论安全）|
| **Interactive Argument (IA)** | 多轮交互 + 加密 | 低 | 计算安全 |
| **SNARK** | 单轮，短证明 | 极低 | 安全假设（KZG/CRS）|
| **STARK** | 单轮，无设置 | 极低 | 哈希函数 |
| **Bulletproofs** | 单轮，无设置 | $O(\log n)$ | 离散对数 |

### 6.3 SNARK-based Verification

**SNARK（Succinct Non-interactive Argument of Knowledge）**：

- **Succinct**：证明大小 $O(1)$ 或 $O(\log n)$（远小于计算本身）
- **Non-interactive**：仅需一条证明消息
- **Knowledge**：证明者知道自己有一个**满足条件的证据**（对应 R1CS / QAP）

**技术路线**：

```
计算 f(x) → 算术电路 → R1CS → QAP → 多项式委托证明
```

1. **算术化**：将 $f$ 转为算术电路（加法和乘法门）
2. **R1CS**：将电路转为 Rank-1 Constraint System（约束系统）
3. **QAP**：转换 R1CS 为 Quadratic Arithmetic Program（多项式形式）
4. **多项式承诺**：证明者在 $s$ 点上的求值正确（使用 KZG / IPA / FRI）

**Groth16（2016）**：

- 最著名的零知识证明系统
- 证明大小：3 个群元素（约 192 字节）
- 验证时间：一次配对运算
- **缺点**：需要 **Trusted Setup**（CRS），每个电路需独立设置

**Plonk（2019）**：

- Universal Setup：只需一次可信设置，适用于所有电路
- 使用 **Plonkish 约束系统**（Permutation + Gate Constraint）
- 证明大小：约 1 KB，验证时间约 5 ms

**STARK（可扩展透明知识论证）**：

- **Transparent**：不需要可信设置（只用哈希）
- Scalable：证明和验证时间 $\text{poly}\log T$
- 使用 **FRI 协议**（Fast Reed-Solomon IOPP）做多项式承诺
- 证明大小大（$O(\log^2 T)$），但安全性只依赖哈希抗碰撞

### 6.4 MPC/HE 结果验证

#### MPC 结果验证

MPC 本身提供**正确性保证**吗？

- **Semi-honest MPC**：协议假设参与方诚实，但在加密中保证隐私，不保证结果正确
- **Malicious MPC**：使用 **MAC-based** 或 **Commitment + ZK** 确保诚实行为

**SPDZ 协议族**（Damgård et al., 2012-2018）：

- 秘密共享 + **Information-theoretic MAC**
- 每次计算的每个共享值都有 MAC 保护
- 输出前验证 MAC：确保没有参与方篡改共享

```
计算过程：
  每个值 x 被共享为 ⟨x⟩ = (x_1, ..., x_n) 并附带 MAC σ_i

输出前：
  打开 x = ∑ x_i
  验证 ∑ σ_i = MAC_key * x

如果任何方修改了 x_i，MAC 验证失败
```

**ABY 2.0**（2021）：

- 混合协议：Garbled Circuit + Secret Sharing + HE
- 使用 **AND Triples** 进行离线 / 在线分离
- 协议结束时验证 Triples 的正确性

#### HE 结果验证

**同态加密结果的验证**仍然是一个开放问题：

- 给定 $c = Enc(f(x))$ 和结果 $m = Dec(c)$
- 服务器如何证明 $m = f(x)$ 且 $c$ 是正确计算的？

**验证方法**：

1. **Zero-Knowledge Proof of Correct Decryption**：证明 $m$ 确实是 $c$ 的解密结果
2. **Verifiable Homomorphic Computation**：
   - 服务器提供计算的**中间密文**和**证明链**
   - 客户检查链上每个步骤的运算正确性

**Cross-check**：

- 外包到多个服务器，比较结果（$k$-out-of-$n$ 诚实假设）
- 三服务器：如果至少两个结果相同，客户认为正确

**Verifiable FHE**（Fiore et al., 2014）：

- 基于 **Homomorphic MAC** 实现
- 服务器除了返回结果外，还附带有同态计算产生的 MAC 标签
- 客户用密钥验证 MAC

### 6.5 可验证 ML 推理

机器学习模型的**外包推理验证**：

```
客户 C: 输入 x，模型 M（部署在云上）
云 S : 输出 y = M(x)
问题: C 怎么知道 y 是 M(x) 的正确结果？
```

**Verifiable ML Inference** 方法：

1. **SNARK for ML 模型**：
   - 将 ML 模型（如神经网络、决策树、SVM）转为**算术电路**
   - 用 SNARK/STARK 生成推理证明
   - 代表：**zkCNN**（Gao et al., 2021）、**vCNN**（Lee et al., 2019）

2. **MPC-assisted Verification**：
   - 客户和服务器用 **MPC** 一起计算推理
   - 结果的正确性通过 MPC 协议的恶意安全保证
   - 代表：**ABY 2.0 for NN**、**Piranha**（2021）

3. **Commit-and-Prove**：
   - 服务器预计算模型承诺（Commit 到模型参数）
   - 客户用 Commitment 绑定的模型参数做验证
   - Compressed verification with sampling

**Verifiable ML 的挑战**：

| 挑战 | 原因 | 当前进展 |
|------|------|---------|
| **非线性激活** | ReLU、Sigmoid 难以用算术电路表示 | 分段线性近似、多项式逼近 |
| **大模型** | ResNet-50 有 25M+ 参数 | 用递归证明（Recursive SNARK）|
| **精度 vs 正确性** | 浮点数不精确，SNARK 用有限域 | 定点数缩放 + 取整 |
| **动态计算** | Attention、RFs 的结构变化 | 电路大小预分配 |

---

## 第7章 差分隐私基础

### 7.1 邻接数据集

**差分隐私的核心直觉**：某个算法在"几乎相同"的两个数据集上的输出应该"几乎一样"。

**邻接数据集（Adjacent Datasets）** 的定义取决于"差异"的模式。

#### Add/Remove 邻接

$$
D \text{ 和 } D' \text{ 邻接} \iff D' = D \cup \{r\} \text{ 或 } D \setminus \{r\}
$$

即：一个数据集比另一个多/少一条记录。

**使用场景**：数据库由**独立的个体**组成，隐私保护针对是否包含某个个体。

#### Replace-one 邻接

$$
D \text{ 和 } D' \text{ 邻接} \iff |D| = |D'|, \text{且仅有一条记录不同}
$$

即：大小相同，替换了一条记录。

**使用场景**：所有记录本身已经存在（如调查数据集），保护的是个体回答的**具体取值**。

#### 用户级 vs 样本级隐私

| 级别 | 邻接定义 | 保护范围 |
|------|---------|---------|
| **用户级** | 一个用户的所有记录 | 用户是否出现在数据集中 |
| **样本级** | 一条具体样本 | 单个观测值的隐私 |
| **事件级** | 一个具体事件 | 时间序列中的具体事件 |

**用户级隐私是更强的保证**：如果每个用户贡献多条记录，需要保护用户整体的存在性，而不是单条记录。

```
用户级: Alice 有 5 条记录, 邻接意味着包含/不包含 Alice 的所有记录
样本级: 只保护其中某一条记录
```

### 7.2 ε-DP（纯差分隐私）

**定义**：一个随机算法 $\mathcal{M}: \mathcal{D} \to \mathcal{R}$ 满足 $\varepsilon$-DP，当且仅当对任意邻接数据集 $D, D'$ 和任意输出集合 $S \subseteq \mathcal{R}$：

$$
\Pr[\mathcal{M}(D) \in S] \le e^\varepsilon \cdot \Pr[\mathcal{M}(D') \in S]
$$

**直观理解**：

- 算法在 $D$ 和 $D'$ 上的输出分布**几乎相同**
- $\varepsilon$ 是**隐私预算**，控制两个分布的"接近程度"
- 越小 $\varepsilon$ 越安全，$\varepsilon = 0$ 表示输出完全独立于数据（但不会有用）

**理解 $e^\varepsilon$**：

- $\varepsilon = 0.1$：两个分布的概率比不超过 $e^{0.1} \approx 1.105$（十分接近）
- $\varepsilon = 1.0$：概率比不超过 $e^{1} \approx 2.718$
- $\varepsilon = 10$：概率比可达 $e^{10} \approx 22026$（几乎无隐私保护）

**"为什么 DP 能保护个体？"**

因为任何攻击者（无论是否有辅助信息）看到输出 $\mathcal{M}(D)$ 后，对任何个体 $r$ 是否在 $D$ 中的"后验置信度"不会比先验置信度增加太多。具体来说，攻击者判断 $r \in D$ 的赔率（odds）最多变化 $e^\varepsilon$ 倍。

$$
\frac{\Pr[r \in D \mid \mathcal{M}(D) = y]}{\Pr[r \notin D \mid \mathcal{M}(D) = y]} \le e^\varepsilon \cdot \frac{\Pr[r \in D]}{\Pr[r \notin D]}
$$

这在贝叶斯意义上**限制了信息的泄露**。

### 7.3 (ε,δ)-DP（近似差分隐私）

**定义**：一个随机算法 $\mathcal{M}$ 满足 $(\varepsilon, \delta)$-DP，当且仅当对任意邻接数据集 $D, D'$ 和任意输出集合 $S \subseteq \mathcal{R}$：

$$
\Pr[\mathcal{M}(D) \in S] \le e^\varepsilon \cdot \Pr[\mathcal{M}(D') \in S] + \delta
$$

**$\delta$ 的含义**：

- $\delta$ 允许隐私保证"偶尔失败"的概率
- 失败的场景：算法在 $D$ 和 $D'$ 上输出**完全不同**的分布
- $\delta$ 应该是**可忽略的**（$\delta \ll 1/n$，$n$ 为数据集大小）

**为什么需要 $\delta$？**

1. **Laplace 机制不行的地方**：有些统计结果需要无限的大随机性（如 Gaussian 机制）
2. **组合定理的紧性**：多次 DP 组合后的紧界需要 $\delta$
3. **实际灵活性**：增加极小 $\delta$ 可以大幅降低所需噪声

**参数选择建议**：

- $\delta = 10^{-9}$ 或更小（小于 $1/n$ 的"安全"值）
- $\varepsilon = 1$ 被认为是合理隐私保护，$\varepsilon = 0.1$ 是强隐私
- $\varepsilon > 10$ 提供很少实质性隐私保护
- **US Census Bureau 2020** 采用 $\varepsilon = 17.14$，$\delta = 2^{-50}$

**$(\varepsilon, \delta)$-DP vs 纯 DP**：

```
纯 DP (ε-DP):
  分布始终在 e^ε 因子内，没有任何例外
近似 DP ((ε,δ)-DP):
  以概率 1-δ 满足 ε-DP，以概率 δ 可能完全失败
```

---

## 第8章 差分隐私机制

### 8.1 Laplace 机制

**适用场景**：数值查询，输出的敏感度（Sensitivity）可定义。

**$L_1$ 敏感度**：

$$
\Delta f = \max_{D, D' \text{ adj.}} \|f(D) - f(D')\|_1
$$

对于一个数值查询 $f: \mathcal{D} \to \mathbb{R}^k$。

**Laplace 机制**：

$$
\mathcal{M}(D) = f(D) + (Lap_1(\Delta f / \varepsilon), \dots, Lap_k(\Delta f / \varepsilon))
$$

其中 $Lap(b)$ 的 PDF 为：

$$
p(x) = \frac{1}{2b} \exp\left(-\frac{|x|}{b}\right)
$$

**满足 $\varepsilon$-DP** 的证明思路：

对于 $D, D'$，$f(D)$ 和 $f(D')$ 最多差 $\Delta f$：

$$
\frac{\Pr[\mathcal{M}(D) = y]}{\Pr[\mathcal{M}(D') = y]} = \frac{\exp(-\varepsilon |y - f(D)| / \Delta f)}{\exp(-\varepsilon |y - f(D')| / \Delta f)} \le \exp(\varepsilon |f(D) - f(D')| / \Delta f) \le e^\varepsilon
$$

**例子：计数查询**

- $f(D) = $ 某个区间的人数，$\Delta f = 1$（一个人的增减最多改变计数 1）
- 发布 $\tilde{f} = f(D) + Lap(1/\varepsilon)$
- 如果 $\varepsilon = 1$：噪声尺度 $1/\varepsilon = 1$（标准差 $\sqrt{2}$）

**例子：平均值**

- $f(D) = \frac{1}{n} \sum x_i$，$\Delta f = \frac{\max - \min}{n}$
- 加入 $Lap(\Delta f / \varepsilon)$

### 8.2 Gaussian 机制

**适用场景**：数值查询，要求是 $(\varepsilon, \delta)$-DP。

**$L_2$ 敏感度**：

$$
\Delta_2 f = \max_{D, D' \text{ adj.}} \|f(D) - f(D')\|_2
$$

**Gaussian 机制**：

$$
\mathcal{M}(D) = f(D) + \mathcal{N}(0, \sigma^2 I)
$$

其中噪声尺度 $\sigma$ 需满足一定的 $(\varepsilon, \delta)$-DP：

$$
\sigma \ge \frac{\Delta_2 f \cdot \sqrt{2 \ln(1.25 / \delta)}}{\varepsilon}
$$

**对比 Laplace vs Gaussian**：

| 特性 | Laplace | Gaussian |
|------|---------|----------|
| 隐私类型 | $\varepsilon$-DP | $(\varepsilon, \delta)$-DP |
| 敏感度 | $L_1$ | $L_2$ |
| 噪声形状 | 双指数 | 指数平方 |
| 尾部 | 重尾（尖峰） | 轻尾（集中） |
| 适合多维 | 需 $L_1$ 敏感度 | 自然支持 $\mathbb{R}^k$ |
| 组合更好 | 否 | 是（有中心极限行为） |

### 8.3 Exponential 机制

**适用场景**：非数值输出（如选最优参数、推荐、分类、图结构），但需要**效用函数**。

**效用函数** $u: \mathcal{D} \times \mathcal{R} \to \mathbb{R}$：

- $u(D, r)$ 表示输出 $r$ 对数据集 $D$ 的"效用"
- 目标：选择使 $u$ 大的 $r$

**敏感度**（效用函数的）：

$$
\Delta u = \max_{r} \max_{D, D' \text{ adj.}} |u(D, r) - u(D', r)|
$$

**Exponential 机制**：

$$
\Pr[\mathcal{M}(D) = r] \propto \exp\left(\frac{\varepsilon \cdot u(D, r)}{2 \Delta u}\right)
$$

即：

$$
\Pr[\mathcal{M}(D) = r] = \frac{\exp\left(\frac{\varepsilon \cdot u(D, r)}{2 \Delta u}\right)}{\sum_{r' \in \mathcal{R}} \exp\left(\frac{\varepsilon \cdot u(D, r')}{2 \Delta u}\right)}
$$

**满足 $\varepsilon$-DP**：分配概率给 $r$ 时，效用越高概率越大，但受 $\varepsilon$ 控制。

**例子：推荐系统**

- 数据集 $D$：用户评分
- 输出空间 $\mathcal{R}$：电影列表
- 效用函数 $u(D, r) = $电影 $r$ 的平均评分
- $\Delta u = \frac{1}{n}$（一条评分变化影响最大 1/n 分）
- 选择概率：高评分电影更可能被推荐，但低评分电影也有一定概率

### 8.4 Randomized Response（随机响应）

Warner 1965 年的开创性工作，是 DP 的**起源思想**。

**二元回答场景**（例如回答"是否有吸毒史？"）：

```
用户有真实答案 a ∈ {0, 1}

Randomized Response RR_p:
  以概率 p:   输出真实答案 a
  以概率 1-p: 输出随机答案（均匀 0 或 1）

更标准的形式：
  Pr[输出 = 1 | 真实 = 1] = p + (1-p)/2 = (1+p)/2
  Pr[输出 = 1 | 真实 = 0] = (1-p)/2
```

**隐私保证**：

$$
\max_{a, a'} \frac{\Pr[\text{输出} \mid \text{真实}=a]}{\Pr[\text{输出} \mid \text{真实}=a']} = \frac{(1+p)/2}{(1-p)/2} = \frac{1+p}{1-p}
$$

所以：

$$
\varepsilon = \ln\left(\frac{1+p}{1-p}\right), \quad p = \frac{e^\varepsilon - 1}{e^\varepsilon + 1}
$$

**校正（Unbiased Estimation）**：

- 收集到 $n$ 个回答，其中 $n_1$ 回答 "是"
- 真实比例 $\pi = \frac{1}{n} \sum a_i$ 的估计：
  $$
  \hat{\pi} = \frac{n_1/n - (1-p)/2}{p}
  $$

**方差**：

$$
\text{Var}[\hat{\pi}] = \frac{1}{np^2} \left(\frac{1}{4} - \frac{p^2}{4} - \frac{p^2 \pi^2}{4}\right) \approx \frac{1}{np^2} \cdot \frac{1}{4}
$$

### 8.5 Sparse Vector Technique（SVT）

**SVT 是 DP 查询优化中的"圣杯"**：用**固定隐私预算**回答**大量查询**，只要大多数查询的结果是"不重要"的。

**场景**：有一系列查询 $q_1, q_2, \dots, q_k$，但只关心那些**超过某个阈值 $T$** 的查询结果。

**经典 SVT 算法**：

```
输入：数据集 D，查询 q_1...q_k，阈值 T，隐私预算 ε
输出：回答序列 a_1...a_k（只对超过阈值的查询回答具体值）

1. 噪声阈值：T̃ = T + Lap(2/ε₁)        # 阈值加噪
2. for i = 1 to k:
3.   噪声值：ν_i = Lap(4/ε₂)            # 查询加噪
4.   if f(D, q_i) + ν_i ≥ T̃:           # 超过阈值才回答
5.     输出 a_i = f(D, q_i) + Lap(2/ε₂)
6.   else:
7.     输出 ⊥（无结果，表示未超过阈值）
8.   当回答个数达到 c 时终止
```

**隐私分析**：SVT 只用了 $O(\varepsilon)$ 就回答了所有查询，而不是 $O(k \varepsilon)$。

**应用**：大规模统计查询、数据发布、发现异常值。

### 8.6 Report Noisy Max（RNM）

**问题**：在 $k$ 个候选答案中找到"最好"的那个，但不要泄露 $k$ 个具体值。

**RNM 算法**：

```
输入：数据集 D，k 个查询 q_1...q_k，隐私预算 ε
输出：得分最高的查询索引 i*

1. for i = 1 to k:
2.   加噪得分：s̃_i = q_i(D) + Lap(2k/ε)      # 注：每个都加了大噪声
   # 或更高效：只加一次噪声（Exponential 机制思想）
3. 输出 i* = argmax s̃_i

更高效版本（NoisyMax）：
  for i = 1 to k:
    if Exp(ε/2) + q_i(D) > 当前最大值: 更新
  这等价于 Exponential 机制的流式实现
```

**RNM vs Exponential 机制**：

- RNM 是 Exponential 机制的**具体实现**
- 当效用函数 $u(D, i) = q_i(D)$ 且 $\Delta u = 1$ 时，RMN 等价于 $\varepsilon/2$-DP 的 Exponential 机制

---

## 第9章 隐私组合与会计

### 9.1 Sequential Composition（顺序组合）

如果算法 $\mathcal{M}_1$ 满足 $\varepsilon_1$-DP，$\mathcal{M}_2$ 满足 $\varepsilon_2$-DP，则在同一个数据集上**顺序输出**二者构成：

$$
(\varepsilon_1 + \varepsilon_2)\text{-DP}
$$

**直觉**：每次发布增加 $\varepsilon_i$，隐私预算线性累加。

**顺序组合定理**：

$$
\mathcal{M}(D) = (\mathcal{M}_1(D), \mathcal{M}_2(D)) \text{ 满足 } \left(\sum_i \varepsilon_i\right)\text{-DP}
$$

**意义**：

- 如果想发布多个统计量，总隐私预算是各次发布的 $\varepsilon_i$ 之和
- $\varepsilon = 20$ 由 20 次 $\varepsilon = 1$ 的查询组成
- 这是 DP 实际应用中最关键的约束：**预算耗尽**

### 9.2 Parallel Composition（并行组合）

如果 $\mathcal{M}$ 满足 $\varepsilon$-DP，且在**不重叠的数据集**上运行：

$$
\mathcal{M}(D_1), \mathcal{M}(D_2), \dots, \mathcal{M}(D_k) \text{ 满足 } \varepsilon\text{-DP}
$$

**直觉**：一个个体只属于一个分区，只被 $\mathcal{M}$ 影响一次。

**并行组合定理**：

如果数据集 $D = D_1 \cup D_2 \cup \dots \cup D_k$（互斥分区），对每个 $D_i$ 运行 $\mathcal{M}$（相同的 DP 算法）：

$$
\text{整体发布满足 } \varepsilon\text{-DP}
$$

**意义**：

- 对数据集的**分区**（例如按年龄分组）做 DP，每组只需独立的 $\varepsilon$
- 整个数据集的隐私不因为分区而退化

### 9.3 Advanced Composition（高级组合）

基本顺序组合定理是**最坏情况**的界：$\varepsilon_{\text{total}} = \sum \varepsilon_i$。但实际中，多次 DP 的累计隐私损失往往**远小于线性累加**。

**高级组合定理**（Dwork-Rothblum-Vadhan, 2010）：

如果 $\mathcal{M}_1, \dots, \mathcal{M}_k$ 每个都是 $(\varepsilon, \delta)$-DP，则它们的组合满足：

$$
(k\varepsilon, k\delta + k\varepsilon(e^\varepsilon - 1))\text{-DP}
$$

更常用的形式：

$$
k \text{ 次 } (\varepsilon, 0)\text{-DP} \text{ 组合后满足：}
(k\varepsilon(e^\varepsilon - 1), k\varepsilon(e^\varepsilon - 1))\text{-DP}
$$

但实际上常用**紧版本**：

$$
k \text{ 次 } \varepsilon\text{-DP} \text{ 组合为 }
\left(\varepsilon \sqrt{2k \ln(1/\delta')}, k\delta + \delta'\right)\text{-DP}
$$

其中 $\delta'$ 是额外的容错参数。

**举例**：

- 100 次 $\varepsilon = 0.1$ 查询
- 基本组合：总 $\varepsilon = 10$（无隐私保护）
- 高级组合：总 $\varepsilon \approx 0.1 \times \sqrt{200 \ln(10^9)} \approx 0.1 \times 30 \approx 3.0$（近乎 $3\times$ 保护）

### 9.4 Privacy Amplification by Subsampling（子采样放大）

**核心洞察**：在**随机子集**上运行 DP 算法，实际隐私保证会**增强**。

**定理**：如果 $\mathcal{M}$ 是 $\varepsilon$-DP，且 $D'$ 是对 $D$ 的**无放回子采样**（采样比例 $\gamma = n'/n$），则 $\mathcal{M}(D')$ 满足：

$$
(\ln(1 + \gamma(e^\varepsilon - 1)), \gamma\delta)\text{-DP}
$$

当 $\varepsilon$ 很小时，近似为 $(\gamma\varepsilon, \gamma\delta)\text{-DP}$。

**直觉**：

- DP-SGD 每次迭代只采样一个 minibatch，从而获得 $\gamma \varepsilon$ 的隐私放大
- $\gamma$ 越小（batch 占比越低），隐私增益越强

**例子**：

- $\varepsilon = 1$，子采样率 $\gamma = 0.001$（0.1% 数据）
- 放大后有效 $\varepsilon' \approx 0.001$（1000 倍增益！）

**Poisson Subsampling**：

- 对每条数据以概率 $\gamma$ 独立抽样
- 比固定大小的子集更容易做隐私分析
- 广泛应用于 DP-SGD 的隐私会计

### 9.5 Rényi DP（RDP）

**定义**：算法 $\mathcal{M}$ 在阶 $\alpha$ 下满足 $(\alpha, \varepsilon_{\text{RDP}})$-RDP，如果：

$$
\frac{1}{\alpha - 1} \ln \mathbb{E}_{y \sim \mathcal{M}(D)} \left[\left(\frac{\Pr[\mathcal{M}(D) = y]}{\Pr[\mathcal{M}(D') = y]}\right)^\alpha\right] \le \varepsilon_{\text{RDP}}
$$

**RDP vs DP**：

- RDP 是对 $\varepsilon$-DP 的推广（$\alpha \to \infty$ 时 RDP 等价于 DP）
- RDP 在**组合分析**和**高斯机制**上有更好的紧性

**RDP 的组合**：

$$
k \text{ 次 } (\alpha, \varepsilon_i)\text{-RDP} \text{ 组合为 } \left(\alpha, \sum_i \varepsilon_i\right)\text{-RDP}
$$

**RDP → DP 转换**：

$$
(\alpha, \varepsilon)\text{-RDP} \implies \left(\varepsilon + \frac{\ln(1/\delta)}{\alpha - 1}, \delta\right)\text{-DP}
$$

**RDP 在 DP-SGD 中的应用**：

- 每次 SGD 迭代的隐私分析用 RDP 更紧
- 总隐私 = 各迭代 RDP 之和 → 转换为 $(\varepsilon, \delta)$-DP

### 9.6 zCDP（零集中差分隐私）

**定义**：算法 $\mathcal{M}$ 满足 $\rho$-zCDP，如果对所有邻接 $D, D'$ 和 $\alpha \in (1, \infty)$：

$$
D_\alpha(\mathcal{M}(D) \| \mathcal{M}(D')) \le \rho\alpha
$$

其中 $D_\alpha$ 是 $\alpha$-Rényi 散度。

**zCDP vs RDP**：

- zCDP 是 RDP 的一种特殊形式的参数化（要求 $\varepsilon_{\text{RDP}} \le \rho\alpha$ 对所有 $\alpha$）
- zCDP 在**高斯机制**下更简洁：加 $\mathcal{N}(0, \sigma^2)$ 满足 $\frac{1}{2\sigma^2}$-zCDP

**zCDP 组合**：

$$
k \text{ 次 } \rho_i\text{-zCDP} \text{ 组合为 } \left(\sum_i \rho_i\right)\text{-zCDP}
$$

### 9.7 Moments Accountant（矩会计）

**Moments Accountant**（Abadi et al., 2016）是 DP-SGD 中用于精确跟踪隐私预算的方法。

**核心思想**：

- 跟踪每个步骤的**矩生成函数**（MGF）而非简单的 $\varepsilon$
- 使用 **log moments** 的累加：
  $$
  \alpha_{\mathcal{M}}(\lambda) = \max_{D, D'} \ln \mathbb{E}_{y \sim \mathcal{M}(D')} \left[\left(\frac{\Pr[\mathcal{M}(D) = y]}{\Pr[\mathcal{M}(D') = y]}\right)^\lambda\right]
  $$

**组合**：

$$
\alpha_{\mathcal{M}_{1:k}}(\lambda) \le \sum_{i=1}^k \alpha_{\mathcal{M}_i}(\lambda)
$$

**隐私保证**：

给定 $\delta$，最小的 $\varepsilon$ 满足：

$$
\varepsilon = \min_{\lambda} \frac{\alpha_{\mathcal{M}}(\lambda) - \ln \delta}{\lambda}
$$

**优势**：

- 比基础组合定理更紧——在 DP-SGD 中的隐私损失计算节省高达 3-10 倍
- 自动考虑子采样放大的效果
- 只依赖于**噪声尺度** $\sigma$ 和**子采样率** $\gamma$

### 9.8 Privacy Loss Distribution（PLD）

**Privacy Loss Distribution（PLD）** 是比 Moments Accountant 更精确的隐私分析方法。

**隐私损失随机变量**：

$$
\text{PrivacyLoss}_{y} = \ln\left(\frac{\Pr[\mathcal{M}(D) = y]}{\Pr[\mathcal{M}(D') = y]}\right)
$$

- 对于邻接 $D, D'$，输出 $y$ 的隐私损失
- 如果 $\mathcal{M}$ 满足 $\varepsilon$-DP，则 $|\text{PrivacyLoss}| \le \varepsilon$

**PLD 计算**：

1. 对 $\mathcal{M}$ 的每个输出 $y$ 计算隐私损失
2. 得到**隐私损失的分布**
3. 组合多个机制的 PLD 用**卷积**

**与 Moments Accountant 比较**：

| 方法 | 精度 | 效率 |
|------|------|------|
| Moments Accountant | 高（渐进紧） | 快（解析公式）|
| PLD 会计 | 精确（紧） | 慢（数值卷积/傅里叶）|
| RDP 组合 | 高 | 中 |
| 基础组合 | 松 | 最快 |

**PLD 工具**：

- **Google DP Library** 中的 `PrivacyLossDistribution`
- **Microsoft WhiteNoise Library** 的 PLD 会计器
- 用 FFT（快速傅里叶变换）高效计算 PLD 卷积

---

## 第10章 本地与分布式差分隐私

### 10.1 Central DP（中心化 DP）

**模型**：

```
原始数据 → 可信数据收集器 → DP 发布
                ↓
           加噪声（中心化）
```

**特点**：

- **可信数据收集器**存在，直接访问明文数据
- 收集器在发布统计结果时**加噪声**
- 个体用户**不需要加噪声**
- 噪声量随 $\Delta f / \sqrt{n}$ 收缩（$n$ 为数据量），效用极高

**适用场景**：

- 人口普查（US Census 2020）
- 研究机构内部数据分析
- 可信平台（如 Google、Apple 内部）

**优势**：

- 效用最高——噪声与数据集大小成反比 $(O(1/n))$
- 实现简单——单点加噪
- 支持复杂统计查询

**劣势**：

- **最少假设**：需要一个**可信的第三方**
- 如果收集器被攻破，所有原始数据泄露

### 10.2 Local DP（本地 DP）

**模型**：

```
原始数据 → 用户加噪声 → 收集器（不可信） → 聚合估计
```

**特点**：

- **不需要信任收集器**
- 每个用户在本地给数据加噪声后再提交
- 收集器只能看到加噪后的数据
- 收集器用**校正统计**恢复聚合信息

**形式化**：

$\mathcal{M}$ 满足 **$\varepsilon$-Local DP** 如果对所有 $x, x'$ 和所有 $S \subseteq \mathcal{R}$：

$$
\Pr[\mathcal{M}(x) \in S] \le e^\varepsilon \cdot \Pr[\mathcal{M}(x') \in S]
$$

**和 Central DP 的区别**：

| 维度 | Central DP | Local DP |
|------|-----------|----------|
| 信任模型 | 信任收集器 | 不信任收集器 |
| 加噪声位置 | 服务器 | 客户端 |
| 噪声尺度 | $\approx 1/(n\varepsilon)$ | $\approx 1/(\varepsilon)$ |
| 数据效用 | 高（$n$ 放大效应） | 低（噪声被 $n$ 平均）|
| 收集器泄露 | 不抵抗 | 抵抗 |
| 通信开销 | 小 | 大（传输加噪后数据）|

**RAPPOR（Google Chrome 部署）**：

- 全称：Randomized Aggregatable Privacy-Preserving Ordinal Response
- 用于 Chrome 收集用户浏览习惯
- 使用 **Randomized Response** + **Bloom Filter** + **永久/即时随机化**

**RAPPOR 流程**：

```
1. 将客户端特征值编码到 Bloom Filter（k 个 Hash 到 m bits）
2. 永久随机化：对 Bloom Filter 的每位以概率 p 保留，q 翻转，1-p-q 随机
3. 即时随机化：第二次随机化（再次翻转一些位）
4. 服务器端：用 LASSO/EM 恢复特征频率分布
```

**Local DP 的挑战**：

- **高维数据**噪声巨大（稀疏编码低效）
- **统计效率低**：Local DP 估计量的方差是 Central DP 的 $O(n)$ 倍
- **复杂查询困难**：比如计算 95 分位数在本地 DP 下非常困难

### 10.3 Shuffle Model（混洗模型）

**模型**：

```
原始数据 → 用户加噪 → Shuffler（混洗）→ 收集器 → 聚合
                        ↓
                   匿名化、混洗、顺序打乱
```

**关键洞察**：

- 混洗提供了"中间层"：$n$ 个用户发送加噪消息，混洗器随机排列后交给收集器
- 混洗不改变 $\varepsilon$，但使得不需要**可信收集器**
- 混洗模型比 Local DP **严格更强**：可以用更小的 $\varepsilon$ 达到相同的隐私

**安全性**：

- 收集器看不到哪些消息来自哪个用户
- 混洗后的消息顺序随机，消除关联性
- 结合 Differential Privacy 进一步放大隐私

**Privacy Amplification via Shuffling**（Balle et al., 2019）：

- 如果每个用户用 $\varepsilon_0$-Local DP 加噪，混洗后整体满足：

  $$
  \varepsilon \approx \varepsilon_0 \cdot \sqrt{\frac{\ln(1/\delta)}{n}}
  $$

- 即：噪声水平相当于 $\varepsilon_0 / \sqrt{n}$ 的 Central DP！

**实际部署**：

- **Encode, Shuffle, Analyze (ESA) Protocol**
- **Prochlo**（Google）：用于大规模移动数据收集
- **Apple's Differential Privacy**：在 iOS 中结合了混洗和本地 DP

### 10.4 Distributed DP（分布式差分隐私）

**模型**：

```
原始数据 → 秘密共享/HE 加密 → 安全聚合加噪 → 收集器 → 聚合
                                 ↓
                            分布式加噪（在协议内部）
```

**Distributed DP 的核心思想**：

- 结合 **Secure Aggregation** 和 **Differential Privacy**
- 客户端通过安全聚合**分布式**生成噪声，收集器只看到加噪后的聚合结果
- 收集器没有权限移除噪声（因为噪声在**聚合协议内部**产生）

**工作流**：

```
1. 每个客户端 x_i 准备数据
2. 客户端共同执行 Secure Aggregation 协议
   在协议内部（Mask/HE+SS）加入噪声 z_i
3. 收集器得到: y = ∑ x_i + ∑ z_i = ∑ x_i + Z
4. 总噪声 Z 满足所需的 DP 隐私预算
```

**如何分布式加噪**？

- 每个客户端计算 $y_i = x_i + r_i$，其中 $r_i$ 是用于**集中噪声**的碎片
- 秘密共享 $\sum r_i = $ 目标噪声 $Z \sim Lap(\Delta f / \varepsilon)$
- 收集器得到 $\sum y_i = \sum x_i + Z$

**Distributed DP vs Central vs Local**：

```
Central DP:    [数据] → 收集器(加噪) → 发布
Local DP:      [数据+加噪] → 收集器 → 发布
Shuffle DP:    [数据+加噪] → 混洗器 → 收集器 → 发布
Distributed DP: [数据] → 安全聚合(内加噪) → 收集器 → 发布
                    ↑
              加噪在协议内产生
```

**Distributed DP 的优势**：

- **不需要信任收集器**：聚合 + 噪声 = 隐私保护
- **噪声量 = Central DP 级别**（$O(1/n)$ 而不是 $O(1)$）
- **抵抗恶意收集器**：收集器不能看到原始数据
- **抵抗侧信道攻击**：即使收集器记录所有通信，也无法反推个体数据

**代表性工作**：

- **Distributed DP for Federated Learning**（McMahan et al., 2017）
- **Robust Aggregation + Distributed DP**（Bonawitz et al., 2019）
- **Additively Homomorphic Encryption + DP**（Shi et al., 2011）

### 10.5 中央噪声 vs 客户端噪声

| 类型 | 噪声来源 | 协议 | 隐私预算 | 示例 |
|------|---------|------|---------|------|
| **中央噪声** | 服务端 | HE/Secure Aggregation | 低成本 | 联邦学习中服务端加噪 |
| **客户端噪声** | 每个客户端 | Local DP | 高成本 | Chrome RAPPOR |
| **分布式噪声** | 协议内部 | 安全聚合 + 贡献噪声碎片 | 低成本 | 安全聚合内部加噪 |

**关键权衡**：

- **中央噪声**: 效用最好，但需要信任服务器不泄露聚合结果
- **客户端噪声**: 不信任任何方，但效用最差
- **分布式噪声**: 不信任服务器且效用好，但协议设计更复杂

---

## 第11章 DP 机器学习

### 11.1 DP-SGD（Differentially Private Stochastic Gradient Descent）

**DP-SGD** 是 Abadi et al.（2016）将差分隐私引入深度学习训练的核心算法。

**标准 SGD vs DP-SGD**：

```
标准 SGD:
  对每个 batch B:
    计算梯度 g_i = ∇ℓ(w, x_i) for x_i ∈ B
    w ← w - η · (1/|B|) ∑ g_i

DP-SGD:
  对每个 batch B（Poisson 子采样）:
    计算梯度 g_i = ∇ℓ(w, x_i) for x_i ∈ B
    g̅_i = g_i / max(1, ‖g_i‖₂/C)          # ① Gradient Clipping
    g̃ = (1/|B|)(∑ g̅_i + 𝒩(0, σ²C²I))      # ② 加噪声
    w ← w - η · g̃                           # ③ 更新
```

**DP-SGD 与标准 SGD 的对比**：

| 阶段 | 标准 SGD | DP-SGD |
|------|---------|--------|
| 子采样 | 随机 | **Poisson 子采样**（隐私分析需要）|
| 梯度处理 | 无限制 | **Clipping**（限制敏感度）|
| 聚合 | 平均 | **平均 + 高斯噪声** |
| 毕业 | 直接更新 | 更新 + 隐私会计 |

### 11.2 Gradient Clipping（梯度裁剪）

**为什么需要裁剪？**

- 差分隐私的噪声尺度取决于 $L_2$ 敏感度 $\Delta_2 f$
- SGD 中 $f$ 对应 gradient norm
- 如果不裁剪，$\Delta_2 f$ 可能无限大（$C$ 必须有限）

**裁剪操作**：

$$
\text{clip}(g, C) = g \cdot \min\left(1, \frac{C}{\|g\|_2}\right)
$$

即：如果 $\|g\|_2 > C$，缩放到范数 $C$；否则保持不变。

**裁剪阈值 $C$ 的选择**：

- $C$ 过大：$\Delta_2 f$ 大，噪声多，效用下降
- $C$ 过小：梯度被过度截断，模型信息损失
- 经验值：**$C$ 设置为梯度中位数范数附近**
- 自适应裁剪：$C$ 随训练动态调整（如 **AutoClip**、**Adaptive Clipping**）

**Per-layer Clipping vs Flat Clipping**：

- **Flat Clipping**：$C$ 对所有参数相同
- **Per-layer Clipping**：每层独立裁剪，更精细地控制敏感度
- **Group Clipping**：对某些参数组裁剪，平衡精细度与实现复杂度

### 11.3 Noise Multiplier（噪声乘数）

**噪声乘数** $\sigma$ 控制 DP-SGD 中添加的噪声量：

$$
g̃ = \frac{1}{|B|} \left(\sum \text{clip}(g_i, C) + \mathcal{N}(0, \sigma^2 C^2 I)\right)
$$

**$\sigma$ 对隐私的影响**：

- $\sigma$ 越大 → 隐私越好（$\varepsilon$ 越小）→ 模型效用可能越差
- $\sigma$ 越小 → 隐私越差（$\varepsilon$ 越大）→ 模型效用越好

**噪声尺度与隐私预算的关系**（Abadi et al., 2016）：

给定：
- 训练轮数 $T$（epochs）
- 数据集大小 $n$
- 子采样率 $\gamma = |B| / n$（batch ratio）
- 噪声尺度 $\sigma$

则使用 **Moments Accountant** 得到的隐私预算 $\varepsilon$ 满足：

$$
\varepsilon \approx \frac{2\sqrt{T \ln(1/\delta)} \cdot \sqrt{e^{1/\sigma^2} - 1}}{\sigma \cdot \varepsilon^{??}}
$$

**经验值**（来自 Google 实践）：

- $\sigma = 1.0$：强隐私（$\varepsilon \approx 1-3$），但可能影响模型准确率
- $\sigma = 0.5$：中等隐私（$\varepsilon \approx 3-8$），通常准确率降低 1-3%
- $\sigma = 0.1$：弱隐私（$\varepsilon \approx 20+$），几乎无影响

### 11.4 Sampling Rate（子采样率）

**子采样率 $\gamma$** 对 DP-SGD 有三个影响：

1. **隐私成本**：$\gamma$ 越小，Privacy Amplification 越强（隐私越好）
2. **收敛速度**：$\gamma$ 越小（batch 越小），梯度噪声越大，但迭代次数更多
3. **噪声分布**：$\gamma$ 影响 Poisson 子采样下的隐私损失分布

**隐私放大效果**（具体数值）：

| $\gamma$ | $\sigma$ | epochs | $\varepsilon$（$\delta=10^{-5}$）|
|----------|---------|--------|-------|
| 0.001 | 1.0 | 100 | $\approx 0.5$ |
| 0.01 | 1.0 | 100 | $\approx 3$ |
| 0.1 | 1.0 | 100 | $\approx 25$ |

**实践中**：

- 大模型：$\gamma \approx 0.01-0.1$（每个 epoch 约 10-100 步）
- 超大模型：$\gamma \approx 0.001-0.01$
- **Sampling Rate 与 $\sigma$ 共同决定隐私成本**

### 11.5 Privacy Accountant（隐私会计器）

**隐私会计器**的作用：在 DP 训练过程中**实时跟踪已消耗的隐私预算**。

**会计过程**：

```
输入: ε_target, δ, σ, γ, T（训练轮数）
过程：
  for each 迭代 t = 1..T·(1/γ):
    会计器计算当前总 ε(t)
    如果 ε(t) > ε_target: 停止训练
输出: 实际 ε
```

**实现方式**：

| 会计器 | 实现方法 | 精度 | 速度 |
|--------|---------|------|------|
| **Moments Accountant** | 解析 RDP 公式 | 高 | 快 |
| **PRV Accountant** | PLD 数值卷积 | 精确 | 慢 |
| **GDP** | 中心极限近似 | 近似 | 最快 |

**ML Privacy Meter**（TensorFlow Privacy）：

```
from tensorflow_privacy import compute_dp_sgd_privacy

eps = compute_dp_sgd_privacy(
    n=60000,          # 数据集大小
    batch_size=256,   # batch 大小
    noise_multiplier=1.1,
    epochs=15,
    delta=1e-5
)
# 输出: DP-SGD with ε ≈ 3.0
```

**Rényi Accountant**：

```
RDP 各阶累加 → 转换为 (ε, δ)-DP
```

### 11.6 用户级 DP 训练

**用户级 DP** 指保护的是**一个用户的所有贡献**（而非单个样本），在联邦学习中尤为重要。

**定义**：

两个数据集 $D$ 和 $D'$ 邻接，如果 $D'$ 比 $D$ 多/少一个**用户**的所有数据。

**用户级 DP-SGD**：

```
用户 i 有 n_i 条样本，总梯度 g_i = (1/n_i) ∑_{j=1}^{n_i} ∇ℓ(w, x_{i,j})

对每个用户 i:
  g̅_i = clip(g_i, C)
  发 g̅_i 给服务器

服务器:
  g̃ = (1/m)(∑ g̅_i + 𝒩(0, σ²C²I))   # m 为用户数
  w ← w - η · g̃
```

**用户级 DP 的挑战**：

1. **用户贡献不均**：$n_i$ 差异大，裁剪更困难
2. **用户数少**：相比样本数 $N$，用户数 $m$ 更小，噪声更大
3. **梯度不一致**：每个用户内部样本的梯度差异可能大

**用户级 DP vs 样本级 DP**：

- **样本级 DP**：保护每一条训练样本，噪声尺度约 $O(1/n)$
- **用户级 DP**：保护每个用户全部数据，噪声尺度约 $O(1/m)$
- 通常 $m \ll n$，所以用户级 DP 的噪声更大

### 11.7 对准确率的影响

**DP 训练对模型准确率的典型影响**：

| 隐私预算 $\varepsilon$ | 影响 | 示例（CIFAR-10, ResNet-18） |
|----------------------|------|---------------------------|
| $\infty$（无 DP） | 基线 | 95% |
| $\varepsilon = 3$ | 轻微下降 | 93-94% |
| $\varepsilon = 1$ | 明显下降 | 90-92% |
| $\varepsilon = 0.3$ | 显著下降 | 80-85% |
| $\varepsilon = 0.1$ | 严重下降 | 60-70% |

**影响准确率的因素**：

1. **模型大小**：大模型需要更多参数学习，DP 噪声对其影响更严重（维度诅咒）
2. **数据集大小**：$n$ 越大，隐私放大越好，噪声影响越小
3. **数据分布**：类平衡数据比不平衡数据对 DP 更鲁棒
4. **训练技巧**：DP 训练对超参数更敏感（学习率、裁剪阈值）

**缓解 DP 性能下降的方法**：

- **Large batch training**：增大 batch 降低噪声方差
- **Data augmentation**：增强数据，降低对精确梯度的依赖
- **Adversarial training** + DP：提升鲁棒性（见下一节）
- **Pretraining + Fine-tuning**：先用公开数据预训练，再用 DP 微调

### 11.8 Membership Inference 防护边界

**Membership Inference Attack（MIA）**：攻击者判断数据点是否在训练集中。

**DP 对 MIA 的防护**：

对于任何 $(\varepsilon, \delta)$-DP 训练算法，攻击者判断"样本 $x$ 是否在训练集中"的**优势**被限制为：

$$
\text{Advantage} \le e^\varepsilon - 1 + \delta \approx \varepsilon \quad (\text{当 } \varepsilon \text{ 很小时})
$$

**具体而言**：

对攻击者 $A$，其成功概率：

$$
\Pr[A(\mathcal{M}(D)) = 1] - \Pr[A(\mathcal{M}(D')) = 1] \le e^\varepsilon - 1 + \delta
$$

**DP 如何防御 MIA**：

1. **Clip 梯度**：防止模型记住长尾样本（极端的梯度值被裁剪）
2. **加噪声**：让模型输出均匀化，减少对特定样本的过拟合
3. **子采样**：每条样本出现在不同 minibatch 的情况不同，降低信息量

**实际效果**：

- $\varepsilon = 2$ 时，MIA 成功率通常接近随机（50%）
- $\varepsilon = 8$ 时，MIA 成功率略高于随机
- $\varepsilon \ge 10$ 时，MIA 可以检测到明显规律

**DP vs 其他 MIA 防御**：

| 防御方法 | 理论保证 | 对准确率影响 |
|---------|---------|-------------|
| **DP-SGD** | 强（严格数学证明）| 中到大 |
| **Dropout** | 无理论保证 | 小 |
| **Label Smoothing** | 无理论保证 | 小到中 |
| **模型蒸馏** | 弱 | 小 |

### 11.9 DP 训练实践总结

**DP-SGD 超参数选择指南**：

```
目标: 给定 ε_target, δ, 训练模型

步骤:
1. 确定子采样率 γ: 根据 batch size / 数据集大小
2. 梯度裁剪阈值 C: 设置为梯度范数的中位数（通常 0.1-1.0）
3. 噪声乘数 σ: 从隐私会计器中反推
   给定 ε_target, γ, epochs → 找最小的 σ
4. 学习率: 通常比非 DP 低（η ≈ η_std / (1 + σ²/γ²)）

经验规律:
  γ ↑, σ ↑, ε ↓   （需平衡）
  增大 n, 相同 ε 下 σ 更小
  增大 epochs, ε 按 √T 增长（不是线性）
```

**DP 训练的关键理解**：

- DP 保证的是**训练过程**的隐私，而非模型本身
- 训练完成后，模型可公开部署
- 隐私预算 $\varepsilon$ 是**累积的**：每个 epoch 收敛 $\varepsilon$ 更小，但更多 epoch 压缩 $\varepsilon$
- DP 不防止"模型被逆向攻击"，只保证去除/增加单条记录不影响输出分布

---

# 总结与关系梳理

## 隐私增强协议

```
                ┌─────────────┐
                │   PSI       │ ← OPRF / OT / HE / DH
                │ 集合求交     │
                └──────┬──────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  OPRF    │ │   PIR    │ │   ORAM   │
    │ 伪随机函数│ │ 私有检索  │ │ 遗忘RAM  │
    │ 输入秘密  │ │ 查询秘密  │ │ 访问秘密  │
    └──────────┘ └──────────┘ └──────────┘
          │
          ▼
    ┌──────────┐ ┌──────────────┐
    │ Secure   │ │  Verifiable  │
    │Aggregator│ │  Computation │
    │安全聚合   │ │  可验证计算   │
    └──────────┘ └──────────────┘
```

## 差分隐私

```
基础定义: (ε,δ)-DP → 邻接数据集 → 不可区分性
       ↓
基本机制: Laplace / Gaussian / Exponential / RR / SVT / RNM
       ↓
隐私会计: 顺序/并行/高级组合 → RDP → zCDP → Moments Acct. → PLD
       ↓
部署模型: Central → Local → Shuffle → Distributed
       ↓
最终应用: DP-SGD → Clipping → Noise Multiplier → Privacy Accountant
       ↓
实践影响: 准确率下降 vs 隐私保证 → Membership Inference 防护
```

**隐私增强协议 + 差分隐私的融合**：

- **PSI + DP**：交集中加入 DP 噪声，防止交集大小/频率泄露
- **Secure Aggregation + DP**：分布式加噪，服务器只得到聚合+噪声
- **ORAM + DP**：在访问模式保护基础上实现 DP 组合
- **PIR + DP**：防止重复查询推断个体数据
