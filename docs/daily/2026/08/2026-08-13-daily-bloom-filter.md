---
title: 布隆过滤器（Bloom Filter）原理与实践
date: 2026-08-13
tags:
  - 数据结构
  - 缓存
  - 工程实践
description: 布隆过滤器用位数组和多个哈希函数，以极小内存判断元素「一定不存在」还是「可能存在」，是解决缓存穿透的经典方案。
---

# 布隆过滤器（Bloom Filter）原理与实践

## 一句话结论

布隆过滤器用「位数组 + 多个哈希函数」在极小内存里记录大规模元素的存在性：它说「不存在」就一定不存在，说「存在」只代表可能存在。它用少量误判率换取了远低于 HashSet 的内存占用，因此是缓存穿透防护、URL 去重、黑名单过滤等海量数据场景的经典选择。

## 1. 什么是布隆过滤器

布隆过滤器（Bloom Filter）是一种**空间效率非常高的概率型数据结构**，主要用于判断：

> **一个元素是否存在于某个集合中。**

它最早由 Burton Howard Bloom 在 1970 年提出。

与 `HashSet`、`HashMap` 等数据结构不同，布隆过滤器并不会真正保存元素本身，而是通过：

* 位数组（Bit Array）
* 多个哈希函数（Hash Function）

来记录元素的存在状态。

布隆过滤器最大的特点是：

> **判断不存在时一定不存在，判断存在时不一定真的存在。**

也就是说：

* 返回 `false`：元素**一定不存在**
* 返回 `true`：元素**可能存在**

这种特性分别称为：

* **无假阴性（False Negative）**
* **存在假阳性（False Positive）**

---

## 2. 为什么需要布隆过滤器

假设现在有一个系统，需要判断某个用户 ID 是否存在。

数据库中有：

```text
1 亿个用户
```

最简单的方式是直接查询数据库：

```sql
SELECT id
FROM user
WHERE id = ?
```

但如果大量请求查询的都是不存在的数据，例如：

```text
userId = 999999999999
```

这些请求就会不断访问数据库。

如果攻击者故意构造大量不存在的数据进行查询，就可能导致：

```text
大量请求
    ↓
缓存未命中
    ↓
数据库查询
    ↓
数据库压力急剧增加
```

这种问题就是典型的：

> **缓存穿透（Cache Penetration）**

我们希望在请求进入数据库之前，先快速判断：

```text
这个 ID 有没有可能存在？
```

于是可以在缓存和数据库之前增加一层布隆过滤器：

```text
                ┌─────────────┐
请求 ─────────→ │ Bloom Filter│
                └──────┬──────┘
                       │
              ┌────────┴────────┐
              │                 │
          一定不存在          可能存在
              │                 │
              ↓                 ↓
          直接返回          查询 Redis
                                │
                                ↓
                              MySQL
```

如果 Bloom Filter 判断：

```text
不存在
```

那么可以直接拒绝请求，不访问 Redis 和数据库。

---

## 3. 布隆过滤器的数据结构

布隆过滤器主要由两个部分组成：

```text
Bloom Filter
│
├── Bit Array
│
└── Hash Functions
```

### 3.1 Bit Array

首先创建一个长度为 `m` 的位数组。

例如：

```text
m = 16
```

初始情况下所有位都是 `0`：

```text
下标：

 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
------------------------------------------------
 0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0
```

因为每个位置只需要保存：

```text
0 / 1
```

所以它的空间消耗非常小。

例如：

```text
1 亿 bit
```

需要的内存大约是：

```text
100,000,000 / 8
≈ 12.5 MB
```

因此 Bloom Filter 非常适合保存大规模数据的“存在性信息”。

---

## 4. 添加元素的过程

假设现在需要向 Bloom Filter 中添加：

```text
"user:1001"
```

假设 Bloom Filter 使用三个哈希函数：

```text
Hash1
Hash2
Hash3
```

计算得到：

```text
Hash1("user:1001") % 16 = 2
Hash2("user:1001") % 16 = 7
Hash3("user:1001") % 16 = 12
```

于是将位数组对应位置设置为 `1`：

```text
 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
------------------------------------------------
 0  0  1  0  0  0  0  1  0  0  0  0  1  0  0  0
```

也就是说，一个元素不会只对应一个位置，而是对应：

```text
k 个位置
```

其中：

```text
k = 哈希函数数量
```

---

## 5. 查询元素的过程

假设查询：

```text
"user:1001"
```

仍然使用完全相同的三个哈希函数：

```text
Hash1("user:1001") → 2
Hash2("user:1001") → 7
Hash3("user:1001") → 12
```

检查 Bit Array：

```text
bit[2]  = 1
bit[7]  = 1
bit[12] = 1
```

三个位置全部为 `1`：

```text
1 && 1 && 1
```

于是 Bloom Filter 返回：

```text
true
```

表示：

> `user:1001` **可能存在**。

---

## 6. 为什么“不存在”一定准确

假设查询：

```text
"user:9999"
```

计算得到：

```text
Hash1 → 3
Hash2 → 7
Hash3 → 14
```

检查数组：

```text
bit[3]  = 0
bit[7]  = 1
bit[14] = 0
```

由于其中存在 `0`：

```text
0 && 1 && 0
```

Bloom Filter 直接判断：

```text
false
```

也就是说：

> 这个元素一定没有被加入 Bloom Filter。

原因非常简单。

如果一个元素曾经被添加，那么它对应的所有位置都一定会被设置为 `1`。

因此只要其中一个位置还是 `0`：

```text
至少一个 bit = 0
```

就说明：

```text
该元素绝对没有被添加过
```

---

## 7. 为什么“存在”不一定准确

这是 Bloom Filter 最重要的地方。

假设之前插入了两个元素：

```text
A
B
```

A 对应：

```text
Hash(A) → 2、5、8
```

B 对应：

```text
Hash(B) → 3、7、10
```

Bit Array：

```text
 0  1  2  3  4  5  6  7  8  9 10
----------------------------------
 0  0  1  1  0  1  0  1  1  0  1
```

现在查询一个从来没有加入过的元素：

```text
C
```

假设：

```text
Hash(C) → 2、7、10
```

而这三个位置：

```text
bit[2]  = 1
bit[7]  = 1
bit[10] = 1
```

Bloom Filter 就会认为：

```text
C 可能存在
```

但实际上：

```text
C 从来没有插入过
```

这就是：

> **假阳性（False Positive）**

---

## 8. Bloom Filter 的核心特性

因此可以总结为：

| Bloom Filter 返回值 | 实际含义  |
| ---------------- | ----- |
| `false`          | 一定不存在 |
| `true`           | 可能存在  |

注意：

```text
不存在 → 100% 准确
存在   → 有一定误判概率
```

所以 Bloom Filter 更准确的描述应该是：

> **用于快速判断一个元素“一定不存在”还是“可能存在”。**

而不是简单理解为：

> 判断元素是否存在。

---

## 9. 为什么不能直接使用 HashSet

有人可能会问：

> HashSet 也可以 O(1) 判断元素是否存在，为什么还需要 Bloom Filter？

核心原因在于：

> **内存占用。**

假设需要保存：

```text
1 亿个字符串 ID
```

使用：

```java
HashSet<String>
```

不仅需要保存字符串，还需要保存：

```text
HashSet
HashMap Node
对象头
hash
引用
数组
String
byte[] / char[]
```

实际内存可能达到数 GB，甚至十几 GB。

而 Bloom Filter 并不保存真实数据：

```text
user:100001
user:100002
user:100003
```

只保存：

```text
000101000101001010...
```

因此几亿条数据的存在性判断，通常只需要几十 MB 到几百 MB 内存。

二者本质上的差异是：

```text
HashSet
    ↓
保存真实元素
    ↓
100% 精确
    ↓
占用空间大


Bloom Filter
    ↓
只保存哈希后的 bit
    ↓
允许一定误判
    ↓
空间极小
```

---

## 10. 时间复杂度

假设 Bloom Filter 使用：

```text
k 个 Hash Function
```

那么插入一个元素需要计算 `k` 次哈希：

```text
O(k)
```

查询同样需要：

```text
O(k)
```

由于实际工程中：

```text
k 通常是一个固定的小常数
```

所以通常可以认为：

```text
插入：O(1)

查询：O(1)
```

空间复杂度主要取决于 Bit Array 的大小：

```text
O(m)
```

---

## 11. 布隆过滤器的数学模型

布隆过滤器通常有三个重要参数：

```text
n = 预计插入元素数量

m = Bit Array 位数

k = Hash Function 数量
```

例如：

```text
n = 1,000,000

m = 10,000,000 bit

k = 7
```

---

### 11.1 一个 bit 仍然为 0 的概率

假设 Bit Array 长度为：

```text
m
```

一次 Hash 设置某个 bit 的概率为：

```text
1 / m
```

没有设置这个 bit 的概率为：

```text
1 - 1/m
```

插入一个元素需要进行 `k` 次 Hash。

插入 `n` 个元素之后，总共进行了：

```text
kn
```

次设置。

因此，一个 bit 仍然为 0 的概率约为：

```text
(1 - 1/m)^(kn)
```

当 `m` 比较大时，可以近似为：

```text
e^(-kn/m)
```

所以 bit 为 `1` 的概率约为：

```text
1 - e^(-kn/m)
```

---

## 12. Bloom Filter 的误判率

查询一个实际上不存在的元素。

它经过 `k` 个哈希函数之后，如果对应的 `k` 个位置恰好全部为 `1`，就会产生误判。

因此误判概率：

```text
P ≈ (1 - e^(-kn/m))^k
```

其中：

```text
P = False Positive Probability

n = 元素数量

m = Bit Array 大小

k = Hash Function 数量
```

可以看到：

```text
m 越大 → 误判率越低

n 越大 → 误判率越高
```

但是：

```text
k 并不是越大越好
```

因为 Hash Function 太多，也会更快地把 Bit Array 设置成大量的 `1`。

---

## 13. 最优 Hash Function 数量

在：

```text
m
n
```

确定的情况下，理论上的最优哈希函数数量为：

```text
k = (m / n) × ln2
```

由于：

```text
ln2 ≈ 0.693
```

所以：

```text
k ≈ 0.693 × m / n
```

例如：

```text
m = 10,000,000

n = 1,000,000
```

那么：

```text
m / n = 10
```

所以：

```text
k ≈ 10 × 0.693
  ≈ 6.93
```

实际可以选择：

```text
k = 7
```

---

## 14. 根据误判率计算 Bit Array 大小

实际开发中，我们通常知道：

```text
预计元素数量 n
允许误判率 p
```

例如：

```text
预计 1000 万条数据
误判率允许 1%
```

那么可以通过公式计算：

```text
m = -n × ln(p) / (ln2)^2
```

即：

```text
m = -n ln(p)
    -----------
      (ln2)^2
```

然后：

```text
k = (m / n) × ln2
```

---

## 15. Java 简单实现 Bloom Filter

下面实现一个简化版 Bloom Filter。

```java
import java.nio.charset.StandardCharsets;
import java.util.BitSet;

public class SimpleBloomFilter {

    /**
     * Bit Array 大小
     */
    private final int bitSize;

    /**
     * 哈希函数数量
     */
    private final int hashCount;

    /**
     * 使用 BitSet 保存 bit
     */
    private final BitSet bitSet;

    public SimpleBloomFilter(int bitSize, int hashCount) {
        this.bitSize = bitSize;
        this.hashCount = hashCount;
        this.bitSet = new BitSet(bitSize);
    }

    /**
     * 添加元素
     */
    public void add(String value) {

        for (int i = 0; i < hashCount; i++) {

            int hash = hash(value, i);

            int index = Math.floorMod(hash, bitSize);

            bitSet.set(index);
        }
    }

    /**
     * 判断元素是否可能存在
     */
    public boolean mightContain(String value) {

        for (int i = 0; i < hashCount; i++) {

            int hash = hash(value, i);

            int index = Math.floorMod(hash, bitSize);

            if (!bitSet.get(index)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 简化 Hash 算法
     *
     * 实际生产环境建议使用成熟 Hash 算法。
     */
    private int hash(String value, int seed) {

        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);

        int hash = seed;

        for (byte b : bytes) {
            hash = 31 * hash + b;
        }

        return hash;
    }
}
```

使用：

```java
public class Main {

    public static void main(String[] args) {

        SimpleBloomFilter bloomFilter =
                new SimpleBloomFilter(
                        1_000_000,
                        7
                );

        bloomFilter.add("user:1001");
        bloomFilter.add("user:1002");

        System.out.println(
                bloomFilter.mightContain("user:1001")
        );

        System.out.println(
                bloomFilter.mightContain("user:9999")
        );
    }
}
```

输出可能为：

```text
true
false
```

需要注意：

```java
bloomFilter.mightContain("user:1001")
```

返回 `true` 的含义是：

```text
可能存在
```

而不是：

```text
100% 存在
```

---

## 16. 使用 Guava BloomFilter

实际 Java 项目通常不需要自己实现 Bloom Filter。

Google Guava 已经提供了成熟实现：

```java
BloomFilter<T>
```

Maven：

```xml
<dependency>
    <groupId>com.google.guava</groupId>
    <artifactId>guava</artifactId>
    <version>${guava.version}</version>
</dependency>
```

创建：

```java
BloomFilter<String> bloomFilter =
        BloomFilter.create(
                Funnels.stringFunnel(StandardCharsets.UTF_8),
                1_000_000,
                0.01
        );
```

参数含义：

```text
1_000_000
    ↓
预计插入 100 万个元素


0.01
    ↓
期望误判率 1%
```

添加元素：

```java
bloomFilter.put("user:1001");
```

判断：

```java
boolean exists =
        bloomFilter.mightContain("user:1001");
```

完整示例：

```java
import com.google.common.hash.BloomFilter;
import com.google.common.hash.Funnels;

import java.nio.charset.StandardCharsets;

public class BloomFilterDemo {

    public static void main(String[] args) {

        BloomFilter<String> bloomFilter =
                BloomFilter.create(
                        Funnels.stringFunnel(StandardCharsets.UTF_8),
                        1_000_000,
                        0.01
                );

        bloomFilter.put("100001");
        bloomFilter.put("100002");
        bloomFilter.put("100003");

        System.out.println(
                bloomFilter.mightContain("100001")
        );

        System.out.println(
                bloomFilter.mightContain("999999")
        );
    }
}
```

---

## 17. 本地 Bloom Filter 的问题

虽然 Guava Bloom Filter 很方便，但它存在一个明显问题：

```text
Bloom Filter 存在 JVM 本地内存
```

如果系统只有：

```text
一个服务实例
```

没有太大问题。

但是分布式系统可能存在：

```text
Server A

Server B

Server C
```

那么每个 JVM 都有自己的 Bloom Filter：

```text
Server A → Bloom Filter A

Server B → Bloom Filter B

Server C → Bloom Filter C
```

这就会产生：

```text
数据一致性
内存重复占用
初始化成本
数据同步
```

等问题。

因此分布式系统中通常会考虑：

> **Redis Bloom Filter**

---

## 18. Redis Bloom Filter

Redis 可以通过 RedisBloom 模块提供 Bloom Filter。

常见命令包括：

```text
BF.RESERVE
BF.ADD
BF.EXISTS
BF.MADD
BF.MEXISTS
```

例如创建 Bloom Filter：

```bash
BF.RESERVE user:bloom 0.01 1000000
```

含义：

```text
user:bloom
    ↓
Bloom Filter Key

0.01
    ↓
误判率 1%

1000000
    ↓
预计元素数量 100 万
```

添加：

```bash
BF.ADD user:bloom 100001
```

查询：

```bash
BF.EXISTS user:bloom 100001
```

如果返回：

```text
0
```

表示：

```text
一定不存在
```

如果返回：

```text
1
```

表示：

```text
可能存在
```

---

## 19. Bloom Filter 解决缓存穿透

这是 Bloom Filter 最经典的应用场景。

假设商品查询接口：

```text
GET /product/{id}
```

原来的架构：

```text
Request
   │
   ↓
Redis
   │
   │ Cache Miss
   ↓
MySQL
```

攻击者不断请求：

```text
/product/99999999901

/product/99999999902

/product/99999999903
```

这些 ID 根本不存在。

所以：

```text
Redis 永远 Miss

MySQL 不断被访问
```

形成缓存穿透。

增加 Bloom Filter：

```text
              Request
                 │
                 ↓
           Bloom Filter
            /          \
           /            \
     不存在              可能存在
        │                   │
        ↓                   ↓
   直接返回空             Redis
                             │
                       Cache Miss
                             │
                             ↓
                           MySQL
```

伪代码：

```java
public Product getProduct(Long productId) {

    String key = productId.toString();

    if (!bloomFilter.mightContain(key)) {
        return null;
    }

    Product product = redis.get(key);

    if (product != null) {
        return product;
    }

    product = productRepository.findById(productId);

    if (product != null) {
        redis.set(key, product);
    }

    return product;
}
```

这样，大部分非法 ID：

```text
999999999999
```

会被 Bloom Filter 直接拦截。

---

## 20. 新增数据怎么办

这是实际项目中非常重要的问题。

假设 Bloom Filter 初始化时存在：

```text
productId：

1001
1002
1003
```

此时 Bloom Filter 已经加载了：

```text
1001
1002
1003
```

后来数据库新增：

```text
1004
```

如果只写数据库：

```text
DB：

1001
1002
1003
1004
```

但是 Bloom Filter 还是：

```text
1001
1002
1003
```

那么查询：

```text
1004
```

Bloom Filter 可能直接判断：

```text
不存在
```

导致真实数据无法查询。

因此新增业务数据时需要同步更新 Bloom Filter。

典型流程：

```text
创建商品
   │
   ↓
写数据库
   │
   ↓
更新 Bloom Filter
```

或者通过：

```text
MQ
CDC
Binlog
```

异步更新 Bloom Filter。

---

## 21. 数据库与 Bloom Filter 一致性问题

例如：

```text
1. DB INSERT product 1004 成功

2. Bloom Filter ADD 1004 失败
```

此时：

```text
数据库存在 1004

Bloom Filter 不存在 1004
```

就可能产生严重问题。

因为 Bloom Filter 会：

```text
错误拦截真实数据
```

这实际上产生了 Bloom Filter 本来理论上不应该产生的：

> False Negative

需要注意，这不是 Bloom Filter 算法本身产生的 False Negative，而是：

> **系统数据同步不一致导致的 False Negative。**

工程中一般可以使用：

```text
消息队列

失败重试

定时校验

Binlog / CDC

Bloom Filter 定期重建
```

提高最终一致性。

---

## 22. Bloom Filter 为什么不能直接删除元素

普通 Bloom Filter 有一个重要限制：

> **通常不能直接删除元素。**

原因在于不同元素可能共享同一个 bit。

例如：

```text
A → 2、5、8

B → 3、5、9
```

可以看到：

```text
bit[5]
```

同时被：

```text
A
B
```

使用。

如果删除 A，并直接执行：

```text
bit[5] = 0
```

那么查询 B 时：

```text
3 → 1
5 → 0
9 → 1
```

Bloom Filter 就会认为：

```text
B 不存在
```

但实际上 B 仍然存在。

因此普通 Bloom Filter：

```text
可以 Add

可以 Query

不能安全 Delete
```

---

## 23. Counting Bloom Filter

如果业务必须支持删除，可以使用：

> **Counting Bloom Filter**

普通 Bloom Filter 每个位置保存：

```text
0 / 1
```

Counting Bloom Filter 保存的是计数器：

```text
0
1
2
3
...
```

例如：

```text
A → 2、5、8

B → 3、5、9
```

插入 A：

```text
bit[2]++
bit[5]++
bit[8]++
```

插入 B：

```text
bit[3]++
bit[5]++
bit[9]++
```

那么：

```text
bit[5] = 2
```

删除 A：

```text
bit[2]--
bit[5]--
bit[8]--
```

此时：

```text
bit[5] = 1
```

所以不会影响 B。

代价则是：

```text
需要更多内存
```

因为每个位置不能再只使用 1 bit。

---

## 24. Bloom Filter 容量超过预期会发生什么

创建 Bloom Filter 时一般需要指定：

```text
expectedInsertions
```

例如：

```java
BloomFilter.create(
    funnel,
    1_000_000,
    0.01
);
```

表示设计目标是：

```text
100 万个元素

误判率 1%
```

如果最终插入：

```text
500 万
1000 万
```

Bloom Filter 并不会突然无法使用。

但是 Bit Array 中的 `1` 会越来越多：

```text
0000000000

↓

0101010010

↓

1110111111

↓

1111111111
```

最终：

```text
绝大多数 bit 都变成 1
```

这时候查询任意不存在的元素：

```text
Hash1 → 1
Hash2 → 1
Hash3 → 1
```

都会越来越容易满足。

结果就是：

> **误判率急剧升高。**

最极端情况下：

```text
所有 bit = 1
```

那么：

```text
任意查询都会返回 true
```

Bloom Filter 就基本失去了过滤价值。

---

## 25. Bloom Filter 的典型应用场景

除了缓存穿透之外，还有很多应用。

### 25.1 URL 去重

爬虫系统可能需要抓取：

```text
几十亿 URL
```

需要判断：

```text
这个 URL 是否抓过？
```

使用 HashSet 存储几十亿 URL 成本很高。

Bloom Filter 可以快速判断：

```text
可能抓过

一定没抓过
```

---

### 25.2 用户是否看过某条内容

推荐系统：

```text
用户已经浏览：

文章 A
文章 B
文章 C
```

推荐新内容时，可以利用 Bloom Filter 快速判断：

```text
这个用户是否可能已经看过？
```

避免频繁推荐重复内容。

---

### 25.3 黑名单判断

例如：

```text
IP 黑名单
手机号黑名单
账号黑名单
设备 ID 黑名单
```

可以先通过 Bloom Filter 快速过滤。

---

### 25.4 数据库 Join 优化

在分布式数据库中执行：

```text
大表 Join
```

之前可以先通过 Bloom Filter 判断另一张表：

```text
是否可能存在对应 Key
```

过滤掉大量无效数据。

---

### 25.5 大数据系统

Bloom Filter 在很多大型系统中都有应用，例如：

```text
HBase
Cassandra
LevelDB
RocksDB
```

以 LSM Tree 为例，在查询磁盘 SSTable 之前，可以先通过 Bloom Filter 判断：

```text
这个 SSTable 是否可能包含目标 Key
```

如果判断：

```text
一定不存在
```

就没有必要产生磁盘 I/O。

---

## 26. Bloom Filter 与其他数据结构对比

| 数据结构                  | 空间 |          查询 | 精确性 |      删除 |
| --------------------- | -: | ----------: | --: | ------: |
| HashSet               |  高 |        O(1) |  精确 |      支持 |
| Bitmap                | 较低 |        O(1) |  精确 |      支持 |
| Bloom Filter          | 极低 | O(k) ≈ O(1) | 有误判 | 普通版本不支持 |
| Counting Bloom Filter |  中 |        O(k) | 有误判 |      支持 |

---

## 27. Bitmap 和 Bloom Filter 的区别

Bitmap 也使用 bit。

比如保存整数：

```text
1
3
5
```

可以直接设置：

```text
bit[1] = 1
bit[3] = 1
bit[5] = 1
```

这种方式是：

```text
一个 ID → 一个确定的位置
```

所以没有误判。

但是如果 ID 范围非常大，例如：

```text
1
999999999999999
```

Bitmap 就需要非常大的地址空间。

Bloom Filter 不直接使用 ID 作为数组下标，而是：

```text
Hash(ID) % m
```

因此可以将非常大的数据范围映射到一个固定大小的 Bit Array。

代价就是：

```text
Hash Collision
```

从而产生：

```text
False Positive
```

---

## 28. Bloom Filter 的优点

Bloom Filter 的主要优点包括：

#### 1. 空间效率极高

只需要保存 bit。

#### 2. 查询速度非常快

查询只需要：

```text
k 次 Hash
+
k 次 Bit 查询
```

#### 3. 插入速度快

不需要维护复杂的数据结构。

#### 4. 适合超大规模数据

例如：

```text
千万
亿
十亿级
```

数据的存在性判断。

---

## 29. Bloom Filter 的缺点

Bloom Filter 同样有明显限制。

#### 1. 存在误判

```text
true ≠ 一定存在
```

#### 2. 普通 Bloom Filter 不支持删除

因为多个元素可能共享 bit。

#### 3. 必须提前估计容量

需要合理估算：

```text
n
p
```

否则误判率可能越来越高。

#### 4. 无法获取原始数据

Bloom Filter 只能回答：

```text
可能存在 / 一定不存在
```

无法回答：

```text
这个元素具体是什么？
```

#### 5. 无法遍历数据

Bloom Filter 中没有保存原始元素，因此不能：

```text
forEach
```

遍历其中所有元素。

---

## 30. Bloom Filter 的完整工作流程

插入：

```text
                      Element
                         │
                         ↓
              ┌──────────────────┐
              │ Hash1 Hash2 Hash3│
              └─────┬────┬───────┘
                    │    │
                ┌───┘    └───┐
                ↓            ↓
               H1     H2     H3
                │      │      │
                ↓      ↓      ↓
              Bit Array

          000001001000100100
```

查询：

```text
                      Element
                         │
                         ↓
                Hash1 Hash2 Hash3
                  │     │     │
                  ↓     ↓     ↓
                  2     7     12
                  │     │     │
                  ↓     ↓     ↓
                  1     1     1
                         │
                         ↓
                     可能存在
```

如果：

```text
1 0 1
```

则：

```text
一定不存在
```

---

## 31. 一个比较完整的缓存查询方案

在实际项目中，可以设计为：

```text
                       用户请求
                           │
                           ↓
                  参数合法性校验
                           │
                           ↓
                    Bloom Filter
                      /        \
                     /          \
                不存在           可能存在
                  │                │
                  ↓                ↓
             返回 Not Found      Redis
                                   │
                           ┌───────┴───────┐
                           │               │
                       Cache Hit       Cache Miss
                           │               │
                           ↓               ↓
                        返回数据          MySQL
                                           │
                                  ┌────────┴────────┐
                                  │                 │
                                存在              不存在
                                  │                 │
                                  ↓                 ↓
                              写入 Redis         缓存空值
                                  │
                                  ↓
                                返回
```

这里 Bloom Filter 并不是用来完全替代：

```text
Redis
MySQL
```

而是：

> **作为第一层快速过滤器。**

---

## 32. Bloom Filter 在缓存架构中的定位

可以将缓存体系理解为：

```text
L0：参数校验

L1：Bloom Filter

L2：Local Cache

L3：Redis

L4：Database
```

Bloom Filter 解决的是：

```text
大量明显不存在的数据
```

而 Redis 解决的是：

```text
热点数据访问数据库的问题
```

因此：

```text
Bloom Filter != Cache
```

它们解决的是不同问题。

---

## 33. 面试常见问题

### Q1：什么是 Bloom Filter？

Bloom Filter 是一种基于：

```text
Bit Array
+
多个 Hash Function
```

实现的概率型数据结构。

主要用于判断：

```text
一个元素是否可能存在于集合中
```

特点是：

```text
判断不存在 → 一定不存在

判断存在 → 可能存在
```

---

### Q2：为什么 Bloom Filter 会产生误判？

因为：

```text
不同元素经过 Hash 后可能映射到相同的 bit
```

多个元素共同将某些 bit 设置为 `1`。

一个从未插入过的元素也可能恰好映射到这些已经为 `1` 的位置，从而出现 False Positive。

---

### Q3：Bloom Filter 会不会出现 False Negative？

从算法本身来说：

```text
不会
```

如果一个元素已经正常插入 Bloom Filter，并且 Bloom Filter 中的数据没有被错误删除或损坏，那么查询时一定不会判断为不存在。

但是实际分布式系统中，如果出现：

```text
数据库写入成功
Bloom Filter 更新失败
```

则可能因为系统数据不一致而表现出类似 False Negative 的现象。

---

### Q4：Bloom Filter 为什么不能删除？

因为不同元素可能共享相同 bit。

直接把：

```text
1 → 0
```

可能影响其他元素。

需要支持删除时可以考虑：

```text
Counting Bloom Filter
```

---

### Q5：Hash Function 是越多越好吗？

不是。

Hash Function 太少：

```text
区分度不足
```

Hash Function 太多：

```text
Bit Array 很快被填满
```

因此存在理论最优值：

```text
k = (m / n) × ln2
```

---

### Q6：Bloom Filter 满了怎么办？

严格来说不是“满”，而是随着元素不断增加：

```text
Bit Array 中 1 的比例越来越高
```

导致：

```text
False Positive Rate
```

越来越高。

可以：

```text
扩大容量

重新构建 Bloom Filter

使用 Scalable Bloom Filter
```

---

### Q7：Bloom Filter 可以解决缓存击穿吗？

不能直接解决。

Bloom Filter 主要解决：

> **缓存穿透**

缓存穿透：

```text
查询根本不存在的数据
```

缓存击穿：

```text
某个热点 Key 失效后，大量请求同时访问数据库
```

缓存击穿通常使用：

```text
互斥锁
逻辑过期
SingleFlight
```

等方式解决。

---

## 34. Bloom Filter、缓存穿透、缓存击穿、缓存雪崩

这几个概念非常容易混淆。

### 缓存穿透

```text
请求的数据根本不存在
```

流程：

```text
Redis Miss
    ↓
DB Miss
```

大量重复。

常见解决方式：

```text
Bloom Filter
缓存空值
参数校验
```

---

### 缓存击穿

```text
一个热点 Key 突然过期
```

大量请求同时：

```text
Redis Miss
    ↓
Database
```

常见解决方式：

```text
Mutex
逻辑过期
SingleFlight
```

---

### 缓存雪崩

```text
大量 Key 同时过期
```

或者：

```text
Redis 整体不可用
```

导致大量请求访问数据库。

常见解决方式：

```text
TTL 随机化
Redis 高可用
多级缓存
限流
熔断
```

因此：

```text
缓存穿透 → Bloom Filter

缓存击穿 → Mutex / Logical Expiration

缓存雪崩 → TTL Randomization / HA / Circuit Breaker
```

---

## 35. 实际项目设计建议

如果 Bloom Filter 用于商品、用户、订单等数据库主键过滤，可以考虑以下设计。

#### 初始化阶段

```text
Application Start
        │
        ↓
查询所有有效 ID
        │
        ↓
构建 Bloom Filter
```

如果数据量特别大，不建议：

```text
SELECT *
```

而是只查询：

```sql
SELECT id
FROM product;
```

并采用：

```text
分页
游标
流式读取
```

进行初始化。

---

#### 新增数据

```text
INSERT DB
    │
    ↓
Success
    │
    ↓
Bloom Filter ADD
```

对于高可靠系统，可以通过：

```text
DB
 ↓
Binlog
 ↓
CDC
 ↓
MQ
 ↓
Bloom Filter
```

维护数据。

---

#### 删除数据

普通 Bloom Filter 不处理删除。

数据库即使删除：

```text
product 1001
```

Bloom Filter 依旧可能认为：

```text
1001 可能存在
```

这只是一次：

```text
False Positive
```

请求最终查询 Redis / DB 后发现不存在即可。

因此很多场景中：

> 删除数据时不删除 Bloom Filter 中的数据也是可以接受的。

系统只需要通过周期性重建 Bloom Filter 清理历史数据。

---

## 36. 总结

Bloom Filter 的核心结构非常简单：

```text
Bloom Filter
=
Bit Array
+
Multiple Hash Functions
```

插入：

```text
Element
   ↓
Hash1 Hash2 Hash3
   ↓     ↓     ↓
Set Bit = 1
```

查询：

```text
Element
   ↓
Hash1 Hash2 Hash3
   ↓     ↓     ↓

全部为 1
    ↓
可能存在


至少一个为 0
    ↓
一定不存在
```

它最重要的特性可以浓缩为一句话：

> **Bloom Filter 说“不存在”，那就一定不存在；Bloom Filter 说“存在”，只能说明可能存在。**

其核心优势是：

```text
极低内存
+
极快查询
+
适合海量数据
```

代价则是：

```text
允许 False Positive
+
普通版本无法删除
```

因此 Bloom Filter 特别适合：

```text
缓存穿透
URL 去重
黑名单过滤
推荐去重
大数据查询优化
LSM Tree 磁盘查询过滤
```

在工程实践中，应该重点关注：

```text
预计元素数量 n

Bit Array 大小 m

Hash Function 数量 k

False Positive Rate

数据同步与重建机制
```

而不是单纯把 Bloom Filter 当成一个：

```text
contains()
```

数据结构。

从本质上来说，它是在：

> **空间占用、查询性能与数据准确性之间进行的一种工程权衡。**
