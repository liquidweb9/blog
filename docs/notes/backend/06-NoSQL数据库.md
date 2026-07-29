# NoSQL数据库（Redis与MongoDB）

---

## 1. 它是什么

### Redis
Redis（Remote Dictionary Server）是一个基于内存的键值（Key-Value）存储系统，通常被归类为 NoSQL 数据库。它支持多种数据结构，提供高性能的读写能力（QPS 可达 10w+），也可通过持久化将数据保存到磁盘。Redis 通常被用作**缓存**、**会话存储**、**消息队列**、**分布式锁**等场景。

### MongoDB
MongoDB 是一个面向文档的 NoSQL 数据库，使用 **BSON**（Binary JSON）格式存储数据。它以 **文档模型** 替代传统关系型数据库的行模型，支持灵活的嵌套结构，天然适合半结构化或非结构化数据。MongoDB 通过复制集保证高可用，通过分片实现水平扩展。

---

## 2. 为什么需要它

### Redis
- **高性能要求**：关系型数据库对热点数据的访问延迟较高（磁盘 IO），Redis 基于内存，读写延迟通常在微秒级。
- **丰富的数据结构**：传统缓存（如 Memcached）只支持简单的 K/V，Redis 提供 String、Hash、List、Set、ZSet 等结构，适配不同业务场景。
- **分布式协同**：分布式系统中需要分布式锁、计数器、限流等原子操作，Redis 的 Lua 脚本和原子命令天然支持。

### MongoDB
- **灵活的模式**：业务初期或快速迭代中，表结构频繁变化，关系型数据库的 Schema 变更成本高，MongoDB 无 Schema 约束（或说动态 Schema），开发效率更高。
- **海量数据水平扩展**：传统数据库在单表数据量达到亿级后分库分表成本很高，MongoDB 原生支持分片，扩展性更好。
- **文档嵌套能力**：对于一对多、多对多的复杂关系，MongoDB 的嵌入式文档可以减少 JOIN 操作，读性能更高。

---

## 3. 它解决什么问题

### Redis 解决的问题

| 问题 | 解决方式 |
|---|---|
| 数据库响应慢 | 将热点数据缓存到 Redis，减少 DB 查询 |
| 分布式锁 | 使用 SET NX + Lua 脚本实现原子锁 |
| 流量突发（秒杀） | Redis 单线程 + 原子操作做计数器/限流 |
| 排行榜/社交关系 | ZSet（有序集合）天然支持排名 |
| 计数值（点赞、阅读） | INCR/DECR 原子自增 |
| 消息队列 | List 的 LPUSH/BRPOP 或 Stream 实现 |
| 用户会话 | 缓存 Session，支持分布式会话共享 |

### MongoDB 解决的问题

| 问题 | 解决方式 |
|---|---|
| 表结构频繁变更 | 无 Schema 设计，文档字段可动态增减 |
| 复杂层级数据 | 嵌套文档 / 数组，一次查询获取完整数据 |
| 海量日志 / IoT 数据 | 分片集群 + 时间序列聚合 |
| 地理位置查询 | 2dsphere 索引，原生支持 GeoJSON |
| 高写入吞吐 | 复制集 + 分片，写入可水平扩展 |

---

## 4. 核心原理

### Redis 核心原理

#### 4.1 底层数据结构

| Redis 类型 | 底层编码（可能） | 说明 |
|---|---|---|
| String | int / embstr / raw | 整数直接存，短字符串用 embstr，长字符串用 raw |
| Hash | ziplist / hashtable | 少量字段用 ziplist 压缩，超过阈值转 hashtable |
| List | ziplist / quicklist | 3.2+ 使用 quicklist（多个 ziplist 组成的链表） |
| Set | intset / hashtable | 全整数且少时用 intset，否则 hashtable |
| ZSet | ziplist / skiplist + hashtable | 少量元素用 ziplist，否则用 skiplist 做排序 + hashtable 做 O(1) 查分 |
| Bitmap | String 的位操作 | 按位操作，节省内存 |
| HyperLogLog | 固定 12KB 的基数估算结构 | 用于 UV 统计，标准误差 0.81% |

#### 4.2 IO 模型
Redis 是**单线程 Reactor 模型**（事件循环），所有命令串行执行，天然避免并发竞争。6.0+ 在网络 IO 上引入多线程（IO Threads），但命令执行依然是单线程。

#### 4.3 持久化（RDB / AOF）

| 特性 | RDB | AOF |
|---|---|---|
| 原理 | 定时 fork 子进程生成全量快照 | 追加写每个写命令到 AOF 文件 |
| 文件大小 | 小 | 大（可 AOF 重写压缩） |
| 恢复速度 | 快 | 慢 |
| 数据安全 | 丢失两次 RDB 间隔的数据 | 根据 fsync 策略（每秒/每次写）最多丢 1s 或 0 数据 |
| 对性能影响 | fork 时阻塞，内存越大阻塞越长 | 写时追加，影响较小 |

**推荐策略**：同时开启 RDB + AOF，RDB 用于快速恢复，AOF 用于保证数据安全。

#### 4.4 主从复制
- 全量同步：从节点向主节点发送 `PSYNC`，主节点生成 RDB 快照发送给从节点，同时缓存增量命令，再从节点加载 RDB 后回放增量。
- 增量同步：主节点将写命令发送到复制缓冲区，从节点定时拉取。
- 主从异步复制，可能丢数据（可通过 `WAIT` 命令同步等待）。

#### 4.5 哨兵（Sentinel）
- 监控主节点和从节点的状态。
- 当主节点宕机时，自动执行故障转移（Failover），从从节点中选一个提升为主。
- 客户端通过 Sentinel 获取当前主节点地址。
- 哨兵本身至少 3 个实例（奇数）组成集群，避免脑裂。

#### 4.6 Cluster
- 采用**无中心化架构**，每个节点都保存完整的路由信息。
- 数据分片：**16384 个哈希槽**，每个 key 通过 `CRC16(key) % 16384` 决定槽位。
- 槽位分配到多个主节点，每个主节点可以有多个从节点做高可用。
- 客户端直连任意节点，返回 MOVED / ASK 重定向到正确节点。
- 一个操作涉及多个槽时会报错（不支持跨槽多键操作），但可通过 hash tag 将相关 key 固定到同一槽。

### MongoDB 核心原理

#### 4.1 文档模型与 BSON
- 文档是 MongoDB 的基本数据单元，类似 JSON 对象，使用 BSON（Binary JSON）编码。
- BSON 支持更多的数据类型（如 Date、Binary、ObjectId）且序列化/反序列化更快。

#### 4.2 集合与文档
- 集合（Collection）对应关系型数据库的表，文档（Document）对应行。
- 文档使用 `_id` 作为主键（默认 ObjectId），可自定义。
- 集合是**动态 Schema**，同一个集合中的文档字段结构可以不同。

#### 4.3 嵌套数据
- 文档可以包含另一个文档（嵌入式文档）或数组。
- **嵌入式**：适合"包含"关系（如订单包含多个商品），一次查询取全部数据。
- **引用式**：适合多对多或独立实体（如用户和文章），通过 `$lookup` 做类似 JOIN 的操作。

#### 4.4 索引
| 索引类型 | 说明 |
|---|---|
| 单字段索引 | 对单个字段建索引 |
| 复合索引 | 多个字段的组合索引，遵循最左前缀原则 |
| 多键索引 | 对数组字段建索引 |
| 文本索引 | 支持全文搜索 |
| 哈希索引 | 分片键常用 |
| 地理空间索引 | 2d / 2dsphere |
| TTL 索引 | 文档自动过期删除 |

#### 4.5 聚合管道（Aggregation Pipeline）
- 数据通过多阶段管道（$match、$group、$sort、$project、$lookup 等）处理。
- 类似关系型数据库的 GROUP BY + JOIN + WHERE 组合，但更灵活。
- 支持 `$unwind` 将数组拆分为多条文档、`$bucket` 分桶等高级操作。

#### 4.6 复制集（Replica Set）
- 一个主节点（Primary）+ 多个从节点（Secondary）。
- 主节点处理写入，从节点同步数据并可提供读服务（可配置）。
- 通过 **Oplog**（操作日志）实现同步。
- 主节点宕机后自动选举新的主节点（基于 Raft 协议）。

#### 4.7 分片（Sharding）
- 将数据按**分片键**分布到多个分片节点上。
- 组件：**mongos**（路由）、**Config Server**（配置）、**Shard**（数据分片）。
- 分片策略：
  - 范围分片：按分片键值范围分布，适合范围查询。
  - 哈希分片：按分片键的哈希值分布，适合写入均衡。
- 分片键选择非常重要，选择不当会导致数据分布不均。

---

## 5. 基本使用方法

### Redis 基本使用

#### 5.1 String
```bash
SET name "alice"
GET name              # "alice"
INCR counter          # 原子+1
EXPIRE name 60        # 设置60秒过期
SETEX name 60 "alice" # SET + EXPIRE 原子操作
SETNX lock 1          # 不存在才设置（分布式锁基础）
```

#### 5.2 Hash
```bash
HSET user:1001 name "alice" age 25
HGET user:1001 name           # "alice"
HGETALL user:1001             # 获取所有字段
HINCRBY user:1001 age 1       # 年龄+1
```

#### 5.3 List
```bash
LPUSH queue task1             # 左侧插入
RPUSH queue task2             # 右侧插入
LPOP queue                    # 左侧弹出
BRPOP queue 0                 # 阻塞式右侧弹出（消息队列）
LLEN queue                    # 长度
```

#### 5.4 Set
```bash
SADD tags "golang" "redis"
SMEMBERS tags                 # 所有成员
SISMEMBER tags "golang"       # 是否成员
SINTER set1 set2              # 交集
SUNION set1 set2              # 并集
SDIFF set1 set2               # 差集
```

#### 5.5 ZSet (Sorted Set)
```bash
ZADD leaderboard 100 "player1" 200 "player2"
ZINCRBY leaderboard 50 "player1"       # 加分
ZRANGE leaderboard 0 -1 WITHSCORES     # 按分升序
ZREVRANGE leaderboard 0 -1 WITHSCORES  # 按分降序（排行榜）
ZRANK leaderboard "player1"            # 排名
ZREVRANK leaderboard "player1"         # 倒序排名
```

#### 5.6 Bitmap
```bash
SETBIT user:sign:2026-07-29 100 1    # 第100个用户签到
GETBIT user:sign:2026-07-29 100      # 查询是否签到
BITCOUNT user:sign:2026-07-29        # 统计签到人数
```

#### 5.7 HyperLogLog
```bash
PFADD uv:page1 "user1" "user2" "user3"
PFADD uv:page1 "user1"              # 重复不计数
PFCOUNT uv:page1                    # 返回基数估算 ≈ 3
PFMERGE uv:total uv:page1 uv:page2  # 合并多个
```

### MongoDB 基本使用

```javascript
// 插入文档
db.users.insertOne({
  name: "alice",
  age: 25,
  tags: ["golang", "redis"],
  address: { city: "Beijing", district: "Haidian" }
})

// 查询
db.users.find({ age: { $gt: 20 } })
db.users.find({ "address.city": "Beijing" })
db.users.find({ tags: "redis" })  // 数组字段自动匹配

// 更新
db.users.updateOne(
  { name: "alice" },
  { $set: { age: 26 }, $push: { tags: "mongodb" } }
)

// 聚合
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $group: { _id: "$userId", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  { $limit: 10 }
])

// 索引创建
db.users.createIndex({ name: 1 })
db.users.createIndex({ "address.city": 1, age: -1 })

// TTL 索引：log 集合 7 天后自动删除
db.logs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 604800 })
```

---

## 6. 工程中的典型实现

### 6.1 缓存设计

#### 缓存模式（Cache Aside Pattern）
```
读：先查 Redis → 命中返回 → 未命中查 DB → 回写 Redis → 返回
写：先更新 DB → 删除/更新 Redis 缓存
```

**为什么要删除缓存而不是更新？**
- 更新缓存存在并发问题：线程 A 先更新 DB，线程 B 再更新 DB，B 比 A 先更新缓存，导致缓存中是旧值。
- 删除缓存后，下一次读请求会重新加载，天然一致。

#### 缓存穿透
**描述**：大量请求查询一个**不存在**的 key，缓存和 DB 都查不到，每次都打到 DB。

**解决方案**：
1. **缓存空值**：将 null 也缓存，设置短过期时间（如 30s），防止恶意攻击。
2. **布隆过滤器**：在 Redis 之前加一层布隆过滤器，判断 key 是否可能存在。

```python
# 缓存空值示例
def get_user(user_id):
    cache_key = f"user:{user_id}"
    data = redis.get(cache_key)
    if data is not None:
        return data
    data = db.query("SELECT * FROM users WHERE id = ?", user_id)
    # 无论是否存在都缓存
    redis.setex(cache_key, 60 if data else 30, data or "")
    return data
```

#### 缓存击穿
**描述**：一个**热点 key** 在失效的瞬间，大量请求并发涌入，直接打到 DB。

**解决方案**：
1. **互斥锁**：只允许一个线程重建缓存，其他线程等待。
2. **逻辑过期**：缓存不过期，但写入一个逻辑过期时间，后台异步刷新。

```python
# 互斥锁示例
def get_hot_data(key):
    data = redis.get(key)
    if data:
        return data
    # 尝试获取锁
    if redis.setnx(f"lock:{key}", "1", ex=5):
        try:
            data = db.query("...")
            redis.setex(key, 3600, data)
        finally:
            redis.delete(f"lock:{key}")
    else:
        # 等待并重试
        sleep(50)
        return redis.get(key)
    return data
```

#### 缓存雪崩
**描述**：大量 key 在同一时间过期，或 Redis 节点宕机，全部请求落到 DB。

**解决方案**：
1. **过期时间差异化**：在基础过期时间上加一个随机值（如 1-5 分钟），避免批量过期。
2. **多级缓存**：Redis + 本地缓存（Caffeine），本地缓存扛一部分请求。
3. **Redis 高可用**：部署哨兵集群或 Cluster，避免单点故障。
4. **服务限流降级**：对 DB 查询做限流，超出阈值直接返回默认值。

```python
# 过期时间加随机偏移
import random
base_ttl = 3600
jitter = random.randint(180, 600)  # 3-10分钟随机
redis.setex(key, base_ttl + jitter, value)
```

### 6.2 分布式锁

#### 基于 SET NX 的实现
```python
# 加锁
def acquire_lock(key, token, ttl=10):
    return redis.set(f"lock:{key}", token, nx=True, ex=ttl)

# 解锁（使用 Lua 保证原子性）
def release_lock(key, token):
    lua = """
    if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
    else
        return 0
    end
    """
    return redis.eval(lua, 1, f"lock:{key}", token)
```

#### Redlock（多节点锁）
- 在 Redis Cluster 或 5 个独立 Redis 节点上同时加锁。
- 超过半数加锁成功且耗时小于锁 TTL 则认为加锁成功。
- 防止主节点宕机后数据丢失导致锁失效。

#### 看门狗（Watchdog）自动续期
```python
# 在锁 TTL 过期前自动续期
def start_watchdog(redis, key, token, ttl=10):
    def renew():
        while running:
            sleep(ttl / 3)  # 过期前续期
            lua = """
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("EXPIRE", KEYS[1], ARGV[2])
            end
            return 0
            """
            redis.eval(lua, 1, key, token, ttl)
    Thread(target=renew, daemon=True).start()
```

### 6.3 Lua 脚本
Lua 脚本保证在 Redis 中**原子执行**，常用于复杂业务逻辑。

```lua
-- 限流脚本（滑动窗口）
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])  -- 窗口大小（秒）
local now = redis.call("TIME")[1]

-- 移除窗口之外的请求
redis.call("ZREMRANGEBYSCORE", key, 0, now - window)

local count = redis.call("ZCARD", key)
if count < limit then
    redis.call("ZADD", key, now, now .. ":" .. math.random())
    redis.call("EXPIRE", key, window)
    return 1
else
    return 0
end
```

### 6.4 热 Key 和大 Key

#### 热 Key（Hot Key）
- **现象**：某个 key 被超高并发访问，导致单节点 CPU 飙升。
- **发现**：`redis-cli --hotkeys`、`MONITOR` 命令（生产慎用）、客户端统计。
- **解决**：
  1. 本地缓存 + Redis 多级缓存。
  2. 将热 key 分散为多个 key（如 `key:0` ~ `key:9`），客户端随机读取。

#### 大 Key（Big Key）
- **现象**：String 超大（>10MB）、或集合类型元素过多（>万级），导致读写阻塞、内存不均、慢查询。
- **发现**：`redis-cli --bigkeys`、`MEMORY USAGE key`。
- **解决**：
  1. 拆分：将大 key 拆分为多个小 key。
  2. 压缩：对大 String 使用压缩算法（如 Snappy）。
  3. 选择合适结构：例如不要在一个 Set 中存百万成员。

### 6.5 数据一致性

#### 最终一致性方案
- 采用 Cache Aside 模式：**更新 DB → 删除缓存**。
- 配合**延迟双删**：先删缓存 → 更新 DB → 延迟再删一次缓存（解决并发读写导致的脏数据）。

```python
def update_user(user):
    redis.delete(f"user:{user.id}")
    db.update(user)
    # 延迟500ms再次删除
    Thread(target=lambda: (sleep(0.5), redis.delete(f"user:{user.id}"))).start()
```

#### 强一致性方案
- **先更新 DB，再更新缓存，用分布式锁同步**：写操作加锁，读操作不加锁但容忍短暂不一致。
- 或直接放弃缓存，使用 Read-Through / Write-Through 模式（缓存代理 DB）。

#### Canal + MQ 异步同步
- MySQL 开启 Binlog，Canal 监听并解析变更，发送到 MQ，消费端更新 Redis。
- 优势：与业务代码解耦，保证最终一致性。
- 劣势：引入额外组件，维护成本高。

---

## 7. 常见失败场景

### Redis 失败场景

| 场景 | 原因 | 后果 |
|---|---|---|
| 缓存雪崩 | 大量 key 同时过期 / Redis 宕机 | DB 被打垮，服务不可用 |
| 缓存穿透 | 查询不存在 key，空值未缓存 | DB 被无效请求打垮 |
| 缓存击穿 | 热点 key 过期，并发重建 | DB 单点压力暴增 |
| 大 Key 阻塞 | 对大 key 执行 DEL / KEYS / HGETALL | Redis 单线程阻塞，所有请求排队 |
| 热 Key 打挂节点 | 超高并发打到单个节点 | CPU 100%，Redis 响应超时 |
| 主从数据不一致 | 主从异步复制，主宕机丢数据 | 部分数据丢失 |
| 哨兵脑裂 | 网络分区导致两个主节点同时存在 | 数据写入冲突，合并困难 |
| Lua 脚本死循环 | 脚本长时间不返回 | Redis 阻塞，无法处理其他命令 |
| 内存耗尽 | 未设置 maxmemory / 淘汰策略不当 | 写入失败，OOM |

### MongoDB 失败场景

| 场景 | 原因 | 后果 |
|---|---|---|
| 分片键选择不当 | 分片键区分度低（如布尔字段） | 数据分布不均，部分分片成为热点 |
| 无索引查询 | 查询条件未加索引 | 全表扫描，CPU 和 IO 飙升 |
| 大量写入后磁盘满 | 写入量超出磁盘容量 | 复制集同步失败，节点不可用 |
| Oplog 太小 | Oplog 大小不足，从节点延迟过高 | 从节点无法追上主节点，需重新全量同步 |
| $lookup 滥用 | 频繁使用 $lookup 做关联查询 | 性能急剧下降（类似关系型 JOIN 但更慢） |

---

## 8. 如何调试

### Redis 调试

```bash
# 查看所有 key（慎用，会阻塞）
redis-cli KEYS "pattern:*"

# SCAN 替代 KEYS，无阻塞
redis-cli SCAN 0 MATCH "user:*" COUNT 100

# 查看慢查询
redis-cli SLOWLOG GET 10
redis-cli SLOWLOG LEN

# 查看连接和内存
redis-cli INFO clients
redis-cli INFO memory
redis-cli INFO stats

# 查看大 Key
redis-cli --bigkeys

# 查看热 Key（4.0+）
redis-cli --hotkeys

# 在线分析命令执行
redis-cli MONITOR | head -100   # 仅调试用，不要在生产长期开

# 诊断延迟
redis-cli --latency
redis-cli --latency-dist

# 分析 RDB 文件
redis-rdb-tools /path/to/dump.rdb
```

### MongoDB 调试

```javascript
// 查看慢查询
db.getProfilingStatus()
db.setProfilingLevel(1, 100)  // 记录超过100ms的查询

// 查看执行计划
db.users.find({ age: { $gt: 20 } }).explain("executionStats")

// 查看索引使用情况
db.users.aggregate([{ $indexStats: {} }])

// 查看当前操作
db.currentOp()

// 查看复制延迟
rs.status()
// 关注 secs_behind（主从延迟秒数）

// 分片集群状态
sh.status()
```

---

## 9. 如何测试

### Redis 测试

```python
import redis
import pytest

@pytest.fixture
def r():
    # 使用 MockRedis 或测试实例
    return redis.Redis.from_url("redis://localhost:6379/1")

def test_string(r):
    r.set("test:name", "alice")
    assert r.get("test:name") == b"alice"

def test_expire(r):
    r.setex("test:expire", 1, "value")
    assert r.get("test:expire") == b"value"
    time.sleep(1.1)
    assert r.get("test:expire") is None

def test_distributed_lock(r):
    token = str(uuid.uuid4())
    acquired = r.set("lock:test", token, nx=True, ex=10)
    assert acquired
    # 重复加锁失败
    assert not r.set("lock:test", "other", nx=True, ex=10)
    # 解锁
    lua = """
    if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
    end
    return 0
    """
    assert r.eval(lua, 1, "lock:test", token) == 1
```

### MongoDB 测试

```python
import pytest
from pymongo import MongoClient

@pytest.fixture
def db():
    client = MongoClient("mongodb://localhost:27017")
    test_db = client.test_db
    yield test_db
    client.drop_database("test_db")

def test_insert(db):
    result = db.users.insert_one({"name": "alice", "age": 25})
    assert result.inserted_id

def test_find(db):
    db.users.insert_one({"name": "bob", "age": 30})
    user = db.users.find_one({"name": "bob"})
    assert user["age"] == 30

def test_index(db):
    db.users.create_index([("name", 1)], unique=True)
    db.users.insert_one({"name": "alice"})
    with pytest.raises(Exception):
        db.users.insert_one({"name": "alice"})  # 唯一索引冲突
```

---

## 10. 如何监控

### Redis 监控

#### 关键指标

| 指标 | 说明 | 告警阈值 |
|---|---|---|
| `used_memory` / `maxmemory` | 内存使用率 | > 80% |
| `connected_clients` | 连接数 | 接近 maxclients |
| `instantaneous_ops_per_sec` | QPS | 根据容量设定 |
| `rejected_connections` | 拒绝连接数 | > 0 |
| `keyspace_hits` / `keyspace_misses` | 缓存命中率 | 命中率 < 90% |
| `latest_fork_usec` | 最近一次 fork 耗时 | > 1s |
| `rdb_last_bgsave_status` | RDB 保存状态 | err |
| `aof_last_bgrewrite_status` | AOF 重写状态 | err |
| `master_link_down_since_seconds` | 主从同步延迟 | > 30s |

#### 监控工具
- **Redis自身**：`INFO`、`SLOWLOG`、`MONITOR`（仅临时用）。
- **Prometheus + redis_exporter**：采集指标到 Grafana 展示。
- **阿里云 Redis / 腾讯云 Redis**：控制台自带监控告警。

### MongoDB 监控

#### 关键指标

| 指标 | 说明 | 告警阈值 |
|---|---|---|
| `asserts.total` | 断言数 | 短期内快速增长 |
| `connections.current` | 当前连接数 | 接近 maxConns |
| `opcounters.*` | 各类操作计数 | 异常突增 |
| `replSet.secs_behind` | 主从延迟 | > 10s |
| `mem.resident` | 常驻内存 | > 80% 物理内存 |
| `extra_info.page_faults` | 缺页中断数 | 持续升高 |

#### 监控工具
- **mongostat**：实时操作统计。
- **mongotop**：读写延迟统计。
- **Prometheus + mongodb_exporter**。
- **MongoDB Atlas / Ops Manager**：官方托管监控。

---

## 11. 常见面试问题

### Redis 面试题

**Q1: Redis 的数据结构有哪些？底层实现是什么？**
A: String（int/embstr/raw）、Hash（ziplist/hashtable）、List（quicklist）、Set（intset/hashtable）、ZSet（ziplist/skiplist+hashtable）、Bitmap（String位操作）、HyperLogLog（固定12KB基数估算）。详细参考 4.1 节。

**Q2: Redis 为什么快？**
A: ① 纯内存操作；② 单线程避免上下文切换和锁竞争；③ IO 多路复用（epoll）；④ 底层数据结构高效。

**Q3: Redis 持久化方案怎么选？**
A: RDB 快照全量备份，恢复快但有数据丢失风险；AOF 记录写命令，数据更安全但文件大恢复慢。**推荐混合使用**：RDB 做定时快照 + AOF 做增量持久化。参考 4.3 节。

**Q4: 缓存穿透、缓存击穿、缓存雪崩的区别和解决方案？**
A: 参考 6.1 节详细说明。一句话记："穿透"是查不存在；"击穿"是热点 key 过期并发重建；"雪崩"是大面积过期或宕机。

**Q5: Redis 分布式锁怎么实现？有什么坑？**
A: SET NX + EX 加锁，Lua 脚本解锁（校验 value 防误删）。坑：① 锁过期未执行完（加看门狗续期）；② 主从异步导致锁丢失（Redlock）；③ 不可重入（用 Redisson 的 RLock）。

**Q6: Redis Cluster 中数据如何分布？**
A: 16384 个哈希槽，CRC16(key) % 16384 决定槽位。槽分配到主节点，客户端通过 MOVED/ASK 重定向访问。参考 4.6 节。

**Q7: 热 Key 和大 Key 怎么处理？**
A: 热 Key → 本地缓存 + 分散 key；大 Key → 拆分 key、压缩、优化结构。参考 6.4 节。

**Q8: Redis 过期删除策略是什么？**
A: **惰性删除**（访问时检查过期并删除）+ **定期删除**（每 100ms 随机抽查部分 key）。当内存超过 maxmemory 时触发淘汰策略（LRU、LFU、TTL、随机等）。

**Q9: 如何保证 Redis 和 MySQL 的数据一致性？**
A: 采用 Cache Aside 模式（更新 DB → 删除缓存），配合延迟双删或 Canal + MQ 异步同步。参考 6.5 节。

**Q10: Redis 的 Pipeline 和事务的区别？**
A: Pipeline 只是批量发送命令减少网络 RTT，不保证原子性。MULTI/EXEC 事务保证原子性，但 WATCH 提供乐观锁。Lua 脚本兼具原子性和灵活性。

### MongoDB 面试题

**Q1: MongoDB 和关系型数据库的优劣？**
A: 灵活 Schema、嵌套文档、水平扩展好；但 JOIN 弱、事务支持较晚（4.0+ 才支持多文档事务）、不支持复杂关联查询。

**Q2: MongoDB 索引类型？复合索引的最左前缀原则？**
A: 参考 4.4 节。复合索引 `{a: 1, b: 1}` 可支持 `{a}` 和 `{a, b}` 查询，但不支持 `{b}` 单独查询。

**Q3: 分片键如何选择？**
A: 选择区分度高、写入均匀的字段（如用户 ID 的哈希）。避免单调递增或递减的字段（如时间戳），否则写入会集中到最后一个分片。

**Q4: $lookup 的性能问题？**
A: $lookup 类似 JOIN，但 MongoDB 上性能较差。建议：数据量大时尽量用嵌入式文档替代引用，或在使用 $lookup 的字段上加索引。

**Q5: 复制集选举机制？**
A: 基于 Raft 协议。主节点宕机后，从节点发起选举，获得大多数投票节点的投票才能成为新主。选举优先级根据 `priority` 参数决定。

---

## 12. 在我的项目中如何使用

### Redis 使用场景

| 业务场景 | 数据结构 | 说明 |
|---|---|---|
| 用户会话缓存 | String | `setex session:{token} 3600 {user_info}` |
| 接口限流 | String / ZSet | `incr rate_limit:{ip}:{second}` 或滑动窗口 Lua |
| 数据库查询缓存 | String | Cache Aside 模式，缓存热点查询结果 |
| 分布式锁 | String + Lua | SET NX + Lua 解锁，保障并发安全 |
| 排行榜 | ZSet | `ZINCRBY leaderboard:week {score} {userId}` |
| 点赞/收藏计数 | String | `incr post:like:{postId}` |
| 消息队列 | List / Stream | LPUSH + BRPOP 或 XADD + XREADGROUP |
| UV 统计 | HyperLogLog | `PFADD page:uv:{date} {userId}` |
| 签到/布隆过滤器 | Bitmap | `SETBIT sign:2026-07 {userId} 1` |
| 秒杀库存 | String + Lua | Lua 原子扣减 + 超卖检测 |

**典型配置**（Spring Boot + Lettuce / Redisson）：

```yaml
spring:
  redis:
    host: 127.0.0.1
    port: 6379
    password: 
    timeout: 3000ms
    lettuce:
      pool:
        max-active: 16
        max-idle: 8
        min-idle: 4
```

```java
// Redisson 分布式锁示例
@Bean
public RedissonClient redissonClient() {
    Config config = new Config();
    config.useSingleServer().setAddress("redis://127.0.0.1:6379");
    return Redisson.create(config);
}

public void doSomething() {
    RLock lock = redissonClient.getLock("business:lock");
    try {
        if (lock.tryLock(5, 10, TimeUnit.SECONDS)) {
            // 业务逻辑
        }
    } finally {
        if (lock.isHeldByCurrentThread()) {
            lock.unlock();
        }
    }
}
```

### MongoDB 使用场景

| 业务场景 | 说明 |
|---|---|
| 日志存储 | 结构化日志（访问日志、操作日志），使用 TTL 索引自动清理 |
| IoT 数据 | 设备上报的数据，时间序列聚合，分片集群处理海量写入 |
| 内容管理 | 文章/帖子（动态字段，嵌套评论），灵活 Schema 便于迭代 |
| 用户画像 | 用户标签系统，用数组和嵌套文档灵活存储多维度信息 |
| 元数据管理 | 配置文件、Feature Flag、动态 Schema 的配置中心 |

**典型连接配置**：

```yaml
spring:
  data:
    mongodb:
      uri: mongodb://user:pass@localhost:27017/myapp?replicaSet=rs0
```

```java
// Spring Data MongoDB 文档操作
@Document(collection = "operation_logs")
public class OperationLog {
    @Id
    private String id;
    private String userId;
    private String action;
    private Map<String, Object> detail;
    private LocalDateTime createdAt;
}

public interface OperationLogRepository extends MongoRepository<OperationLog, String> {
    List<OperationLog> findByUserId(String userId);
}

// 聚合管道
@Autowired
private MongoTemplate mongoTemplate;

public List<LogSummary> summaryByAction(LocalDateTime since) {
    Aggregation agg = Aggregation.newAggregation(
        Aggregation.match(Criteria.where("createdAt").gte(since)),
        Aggregation.group("action").count().as("total"),
        Aggregation.sort(Sort.by(Direction.DESC, "total"))
    );
    return mongoTemplate.aggregate(agg, "operation_logs", LogSummary.class).getMappedResults();
}
```

### 选型原则

| 场景 | 推荐 | 原因 |
|---|---|---|
| 高频读写、低延迟 | Redis | 内存操作，微秒级延迟 |
| 海量写入、灵活 Schema | MongoDB | 写入水平扩展，无需 DDL |
| 复杂事务、强一致 | MySQL | ACID 事务成熟度远高于 NoSQL |
| 简单 K/V 缓存 | Redis | 简单高效 |
| 全文搜索 | Elasticsearch | 专业搜索引擎，MongoDB 文本索引能力有限 |
| 结构化报表 | 关系型 DB + OLAP | 复杂 JOIN 和统计分析更成熟 |

**对普通后端岗位来说，核心原则是**：MySQL + Redis 是标准组合，MySQL 做持久化存储，Redis 做缓存/分布式协同。MongoDB 在特定场景（海量日志、IoT、灵活内容）下引入，不轻易作为主存储。

---

> **参考**：Redis 官方文档（redis.io）、MongoDB 官方文档（mongodb.com）、《Redis 设计与实现》（黄健宏）、《MongoDB 权威指南》。
