# MySQL

---

## 1. 它是什么

MySQL 是一个开源的关系型数据库管理系统（RDBMS），使用 SQL（Structured Query Language）作为查询语言。它以表格（Table）的形式组织数据，表由行（Row）和列（Column）构成，表之间通过外键等约束建立关联。

MySQL 最初由瑞典 MySQL AB 公司开发，后被 Sun Microsystems 收购，最终归于 Oracle 旗下。常见的分支版本包括 MariaDB 和 Percona Server。

## 2. 为什么需要它

应用程序在运行过程中会产生大量结构化数据（用户信息、订单、商品、日志等），这些数据需要持久化存储，并能够被高效地查询、更新和删除。文件系统无法满足复杂查询、并发控制、数据一致性等需求，因此需要数据库。

选择 MySQL 的理由：
- **成熟稳定**：20+ 年工业验证，社区庞大，生态丰富。
- **性能优秀**：InnoDB 引擎下读写性能良好，支持百万级 QPS（读多写少场景）。
- **易用性强**：SQL 标准，学习成本低，运维工具丰富。
- **成本可控**：开源免费，企业版可选，部署灵活（物理机、云 RDS）。
- **生态完善**：ORM 框架（MyBatis、JPA、Hibernate）、中间件（ShardingSphere、MyCat）、备份工具（XtraBackup、mysqldump）等。

## 3. 它解决什么问题

| 问题 | 说明 |
|------|------|
| 数据持久化 | 将数据写入磁盘，进程重启或机器宕机后不丢失 |
| 高效查询 | 通过索引、查询优化器快速检索数据 |
| 数据一致性 | 事务 ACID 保证并发操作下数据正确 |
| 并发控制 | 锁机制与 MVCC 管理多会话同时读写 |
| 数据完整性 | 主键、唯一约束、外键等保证数据合法 |
| 高可用 | 主从复制、集群方案保证服务不中断 |
| 水平扩展 | 分库分表突破单机容量瓶颈 |

## 4. 核心原理

### 4.1 存储引擎

MySQL 的插件式存储引擎架构，最常用的是 **InnoDB**（默认引擎）。

| 特性 | InnoDB | MyISAM |
|------|--------|--------|
| 事务支持 | 支持（ACID） | 不支持 |
| 行锁 | 支持 | 不支持（表锁） |
| 外键 | 支持 | 不支持 |
| MVCC | 支持 | 不支持 |
| 全文索引 | 支持（5.6+） | 支持 |
| 聚簇索引 | 是 | 否 |
| Crash Recovery | 支持 | 不支持 |

### 4.2 B+ 树索引

InnoDB 使用 **B+ 树** 作为索引结构。

**B+ 树特点：**
- 所有数据存储在叶子节点，非叶子节点只存键值和指针。
- 叶子节点之间通过双向链表链接，支持范围查询。
- 树的高度通常为 2~4 层，查询 IO 次数少且稳定。
- 节点大小通常为一个磁盘页（16KB），充分利用局部性原理。

**聚簇索引 vs 二级索引：**
- **聚簇索引**：InnoDB 表必有且只有一个，主键列作为聚簇索引，叶子节点直接存储整行数据。
- **二级索引**（辅助索引）：叶子节点存储主键值，回表查询完整数据。
- 因此主键越小越好（整型自增主键），二级索引也会更小。

### 4.3 联合索引

多个列组合成一个索引，遵循 **最左前缀原则**。

```sql
CREATE INDEX idx_a_b_c ON t(a, b, c);
```

以下查询能用到该索引：
- `WHERE a = 1`
- `WHERE a = 1 AND b = 2`
- `WHERE a = 1 AND b = 2 AND c = 3`
- `WHERE a = 1 ORDER BY b`

以下查询**不能**用到该索引（跳过了最左列）：
- `WHERE b = 2`
- `WHERE c = 3`

以下查询只能部分用到该索引（中间列跳过后，后续列无法使用）：
- `WHERE a = 1 AND c = 3` — 只能用 a，c 无法利用索引

### 4.4 覆盖索引

当查询所需的所有列都包含在索引中时，无需回表，直接从索引获取数据，称为 **覆盖索引**。

```sql
-- 假设 idx_a_b(a, b)
SELECT a, b FROM t WHERE a = 1;  -- 覆盖索引，无需回表
SELECT * FROM t WHERE a = 1;     -- 需要回表
```

### 4.5 事务与 ACID

| 特性 | 说明 |
|------|------|
| **A**tomicity（原子性） | 事务要么全部成功，要么全部回滚（undo log） |
| **C**onsistency（一致性） | 事务前后数据满足所有约束 |
| **I**solation（隔离性） | 并发事务互不干扰（锁 + MVCC） |
| **D**urability（持久性） | 提交后数据不丢失（redo log） |

### 4.6 隔离级别

SQL 标准定义了四种隔离级别，InnoDB 默认使用 **REPEATABLE READ**（可重复读）。

| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
|----------|------|------------|------|
| READ UNCOMMITTED | 可能 | 可能 | 可能 |
| READ COMMITTED | 不会 | 可能 | 可能 |
| REPEATABLE READ | 不会 | 不会 | InnoDB 下不会（MVCC + gap lock） |
| SERIALIZABLE | 不会 | 不会 | 不会 |

- **脏读**：读到其他事务未提交的数据。
- **不可重复读**：同一事务内两次读取同一行，结果不同（其他事务修改并提交）。
- **幻读**：同一事务内两次范围查询，结果集行数不同（其他事务插入并提交）。

### 4.7 MVCC（Multi-Version Concurrency Control）

InnoDB 通过 MVCC 实现非阻塞读，提高并发性能。

**核心组件：**
- **隐藏列**：每行数据有 `DB_TRX_ID`（创建/最后修改该行的事务ID）和 `DB_ROLL_PTR`（回滚指针，指向 undo log）。
- **undo log**：记录数据的历史版本，用于 MVCC 可见性判断和事务回滚。
- **Read View**：事务启动时生成的一个快照，记录活跃事务列表。

**可见性规则：**
- 如果行的 `trx_id` < Read View 中最小活跃事务 ID，则该版本对当前事务可见。
- 如果行的 `trx_id` 在活跃事务列表中，则该版本不可见，通过回滚指针找到旧版本。
- REPEATABLE READ 下，Read View 在事务第一次查询时生成，整个事务期间复用，因此不会有不可重复读问题。

### 4.8 锁机制

**按粒度：**
| 锁类型 | 说明 |
|--------|------|
| 行锁（Record Lock） | 锁住索引上的某一条记录 |
| 间隙锁（Gap Lock） | 锁住两个索引之间的间隙，防止幻读 |
| Next-Key Lock | 行锁 + 间隙锁，InnoDB RR 级别默认使用 |
| 表锁 | 锁住整张表，MyISAM 默认使用 |
| 意向锁 | 表级别的锁，表示事务即将对某些行加锁 |
| 元数据锁（MDL） | 保护表结构变更与 DML 互斥 |

**按思想：**
- **乐观锁**：假设冲突少，通过版本号或 CAS 实现，提交时检查冲突。
  ```sql
  UPDATE t SET count = count - 1, version = version + 1 WHERE id = 1 AND version = old_version;
  ```
- **悲观锁**：假设冲突多，直接加锁。
  ```sql
  SELECT * FROM t WHERE id = 1 FOR UPDATE;   -- 排他锁
  SELECT * FROM t WHERE id = 1 LOCK IN SHARE MODE;  -- 共享锁
  ```

### 4.9 主从复制

MySQL 主从复制基于 **binlog（二进制日志）**，流程如下：

```
主库（Master）→ binlog dump 线程 → 网络传输 → 从库（Slave）→ I/O 线程 → relay log → SQL 线程 → 从库数据
```

**复制模式：**
| 模式 | 说明 |
|------|------|
| 异步复制 | 主库不等待从库确认，性能最好，可能丢失数据 |
| 半同步复制 | 主库等待至少一个从库写入 relay log 后返回，兼顾性能与数据安全 |
| 同步复制 | 全等确认，性能差，少见（如 MySQL Group Replication） |

**常见拓扑：**
- 一主一从 / 一主多从
- 双主互备（Master-Master）
- 级联复制（主 → 从1 → 从2）
- 主从切换（MHA、Orchestrator 管理）

### 4.10 分库分表

当单表数据量过大（通常超过千万级），或单库连接数不够时，考虑分库分表。

**拆分方式：**
| 方式 | 说明 |
|------|------|
| 垂直分库 | 按业务模块拆分到不同数据库（订单库、用户库、商品库） |
| 垂直分表 | 将大表的宽列拆成多张表（主表 + 扩展表） |
| 水平分库 | 同一个表的数据按分片键分散到多个库 |
| 水平分表 | 同一个表的数据按分片键分散到多个表 |

**分片策略：**
- 取模（`user_id % 16`）
- 范围（`user_id 1~1000 → shard_0`）
- 一致性哈希（减少扩缩容时的数据迁移）
- 时间（按月分表）

**常见中间件：**
- ShardingSphere（JDBC / Proxy 两种模式）
- MyCat
- Vitess

**分库分表带来的问题：**
- 跨节点 JOIN 查询困难
- 分布式事务（Seata、TCC、消息事务）
- 全局主键（雪花算法、UUID、号段模式）
- 分页排序（需要在各分片查询然后归并）
- 数据迁移与扩容

## 5. 基本使用方法

### 5.1 表设计

```sql
-- 用户表
CREATE TABLE `user` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`   VARCHAR(32)     NOT NULL COMMENT '用户名',
  `email`      VARCHAR(128)    NOT NULL COMMENT '邮箱',
  `password`   VARCHAR(256)    NOT NULL COMMENT '密码哈希',
  `status`     TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '状态 1正常 0禁用',
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 5.2 数据类型选择

| 数据类型 | 推荐场景 | 注意 |
|----------|----------|------|
| TINYINT | 状态码、枚举（0~255） | 占用 1 字节 |
| INT / BIGINT | 主键、计数 | 无符号用 `UNSIGNED` |
| DECIMAL | 金额 | 避免用 FLOAT（精度丢失） |
| VARCHAR | 可变字符串 | 按实际长度分配，不要过大（如 VARCHAR(5000) 会降低性能） |
| CHAR | 定长字符串 | 手机号、身份证号（长度固定） |
| TEXT / BLOB | 大文本、二进制 | 慎用，尽量独立成表 |
| DATETIME / TIMESTAMP | 时间 | TIMESTAMP 受 2038 年限制，推荐 DATETIME |
| JSON | 灵活结构 | 5.7+ 支持，可建虚拟列索引 |

### 5.3 主键与外键

- **主键**：InnoDB 推荐使用自增 BIGINT 作为主键（聚簇索引页分裂少）。
- **逻辑主键**：业务无主键时创建 `auto_increment` 列。
- **UUID 主键**：适合分布式环境，但占用空间大且无序，影响插入性能（可用雪花算法或 `UUID_TO_BIN` 优化）。
- **外键**：理论上保证引用完整性，但实际生产环境常不用（影响性能、分库分表困难），由应用层保证。

### 5.4 范式与反范式

| 范式 | 说明 |
|------|------|
| 1NF | 列不可再分，原子性 |
| 2NF | 在 1NF 基础上，非主键列完全依赖于主键（消除部分依赖） |
| 3NF | 在 2NF 基础上，非主键列不传递依赖于主键（消除传递依赖） |

**反范式**：
- 适当冗余字段，避免 JOIN，提高查询性能。
- 如订单表中冗余商品名称、价格（即使商品表已存），避免查询时 JOIN。

### 5.5 SQL 增删改查

```sql
-- INSERT
INSERT INTO user (username, email, password) VALUES ('alice', 'alice@example.com', 'hash123');

-- 批量插入
INSERT INTO user (username, email, password) VALUES
  ('bob', 'bob@example.com', 'hash456'),
  ('carol', 'carol@example.com', 'hash789');

-- SELECT
SELECT id, username, email FROM user WHERE status = 1 ORDER BY created_at DESC LIMIT 20;

-- UPDATE
UPDATE user SET password = 'newhash' WHERE id = 1;

-- DELETE
DELETE FROM user WHERE id = 1;

-- 软删除（推荐）
ALTER TABLE user ADD COLUMN deleted_at DATETIME DEFAULT NULL;
UPDATE user SET deleted_at = NOW() WHERE id = 1;
SELECT * FROM user WHERE deleted_at IS NULL;
```

### 5.6 JOIN

```sql
-- INNER JOIN
SELECT o.id, u.username
FROM order o
INNER JOIN user u ON o.user_id = u.id;

-- LEFT JOIN（保留左表所有行）
SELECT u.id, u.username, o.id AS order_id
FROM user u
LEFT JOIN order o ON o.user_id = u.id;

-- RIGHT JOIN（较少用）
-- CROSS JOIN（笛卡尔积，慎用）
```

**JOIN 优化要点：**
- 被驱动表的关联列必须建索引。
- 小表驱动大表（`STRAIGHT_JOIN` 可强制顺序）。
- 避免用 `SELECT *`，只取需要列。

### 5.7 子查询

```sql
-- WHERE 子查询
SELECT * FROM user WHERE id IN (SELECT user_id FROM order WHERE amount > 100);

-- FROM 子句子查询（派生表）
SELECT avg_amount, COUNT(*) FROM (
  SELECT user_id, AVG(amount) AS avg_amount FROM order GROUP BY user_id
) AS t WHERE avg_amount > 50;

-- EXISTS 子查询（比 IN 更适合大数据量）
SELECT * FROM user u WHERE EXISTS (
  SELECT 1 FROM order o WHERE o.user_id = u.id AND o.amount > 100
);
```

### 5.8 聚合查询

```sql
SELECT
  user_id,
  COUNT(*)              AS order_count,
  SUM(amount)           AS total_amount,
  AVG(amount)           AS avg_amount,
  MAX(amount)           AS max_amount,
  MIN(amount)           AS min_amount
FROM order
WHERE created_at >= '2025-01-01'
GROUP BY user_id
HAVING order_count > 5
ORDER BY total_amount DESC
LIMIT 20;
```

**聚合函数 + DISTINCT：**
```sql
SELECT COUNT(DISTINCT user_id) FROM order;
```

## 6. 工程中的典型实现

### 6.1 数据库连接池

- HikariCP（Spring Boot 默认）：高性能，轻量。
- 配置关键参数：`maximumPoolSize`、`minimumIdle`、`connectionTimeout`、`idleTimeout`、`maxLifetime`。

### 6.2 ORM 框架

```java
// MyBatis-Plus 示例
@TableName("user")
public class User {
    private Long id;
    private String username;
    private String email;
    private Integer status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

// Service 层
List<User> users = userService.lambdaQuery()
    .eq(User::getStatus, 1)
    .orderByDesc(User::getCreatedAt)
    .last("LIMIT 20")
    .list();
```

### 6.3 数据迁移与版本管理

- **Flyway**：基于 SQL 脚本版本号的数据库迁移工具。
- **Liquibase**：基于 XML / YAML / JSON 描述变更。

### 6.4 读写分离

```
应用 → 读写分离中间件（ShardingSphere / Atlas / ProxySQL）
       ├── 写操作 → Master 库
       └── 读操作 → Slave 库（可多个）
```

### 6.5 分布式 ID 生成

- **雪花算法（Snowflake）**：64 位 long（1 bit 符号 + 41 bit 时间戳 + 10 bit 机器ID + 12 bit 序列号），单机 QPS 约 409.6w。
- **号段模式**：Leaf、TinyID，预先取一批 ID 到内存，减少 DB 压力。
- **UUID**：简单但无序，影响聚簇索引插入性能。

## 7. 常见失败场景

### 7.1 索引失效

- 对索引列使用函数：`WHERE DATE(created_at) = '2025-01-01'` → 改为 `WHERE created_at >= '2025-01-01' AND created_at < '2025-01-02'`
- 隐式类型转换：`WHERE phone = 138xxxxxxxx`（phone 是 VARCHAR）→ 导致全表扫描
- 前导模糊查询：`WHERE name LIKE '%关键字'` → 无法走索引
- OR 条件中部分列无索引 → 可改为 UNION 或建复合索引
- MySQL 优化器估算全表扫描比走索引更快（数据量少时）

### 7.2 死锁

两个事务互相持有对方需要的锁导致。

```sql
-- 事务 A
BEGIN;
UPDATE t SET x = 1 WHERE id = 1;
UPDATE t SET x = 2 WHERE id = 2;
COMMIT;

-- 事务 B
BEGIN;
UPDATE t SET x = 3 WHERE id = 2;
UPDATE t SET x = 4 WHERE id = 1;
COMMIT;
```

**预防死锁：**
- 多个事务按相同顺序加锁。
- 缩短事务执行时间。
- 使用 `innodb_deadlock_detect`（默认开启），频繁死锁时考虑 `innodb_lock_wait_timeout`。

### 7.3 慢查询

- 全表扫描大表。
- JOIN 时被驱动表无索引。
- 深度分页：`LIMIT 1000000, 20` → 改用游标分页 `WHERE id > 1000000 LIMIT 20`。
- 排序字段无索引导致 using filesort。

### 7.4 主从延迟

- 从库查询读到旧数据。
- **解决方案**：强制走主库读（`@Master` 注解）、缓存中间层、等待半同步复制确认。

### 7.5 连接池打满

- 慢 SQL 占用连接不释放。
- 应用没有正确关闭连接（缺少 `try-with-resources` 或连接泄漏）。
- **解决方案**：监控活跃连接数、设置 `connectionTimeout` 和 `leakDetectionThreshold`。

## 8. 如何调试

### 8.1 EXPLAIN 执行计划

```sql
EXPLAIN SELECT u.* FROM user u LEFT JOIN order o ON o.user_id = u.id WHERE u.status = 1\G
```

**关键字段：**
| 字段 | 说明 |
|------|------|
| `type` | `const > eq_ref > ref > range > index > ALL`（越左性能越好） |
| `possible_keys` | 可能用到的索引 |
| `key` | 实际使用的索引 |
| `rows` | 扫描行数估算值 |
| `Extra` | `Using index`（覆盖索引）、`Using filesort`（需要排序）、`Using temporary`（临时表） |

### 8.2 慢查询日志

```sql
-- 开启慢查询日志
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 1;       -- 超过 1 秒记录
SET GLOBAL log_queries_not_using_indexes = ON;

-- 查看慢查询日志路径
SHOW VARIABLES LIKE 'slow_query_log_file';
```

### 8.3 MySQL 内置诊断

```sql
-- 查看当前事务和锁
SELECT * FROM information_schema.INNODB_TRX;
SELECT * FROM information_schema.PROCESSLIST;
SHOW ENGINE INNODB STATUS;

-- 查看索引使用情况
SHOW INDEX FROM user;
SELECT * FROM information_schema.STATISTICS;
```

### 8.4 常用工具

- **pt-query-digest**（Percona Toolkit）：分析慢查询日志，找出最耗时的 SQL。
- **pt-online-schema-change**（pt-osc）：在线 DDL，不锁表。
- **tcpdump + wireshark**：抓包分析客户端与 MySQL 的交互。
- **sys schema**：MySQL 5.7+ 内置诊断库，提供性能视图。

## 9. 如何测试

### 9.1 单元测试

- 使用 H2 数据库（内存模式）或 Testcontainers 启动真实 MySQL 容器测试 DAO 层。
- 测试前准备数据，测试后回滚事务。

```java
@SpringBootTest
@Transactional  // 自动回滚
class UserMapperTest {
    @Autowired
    private UserMapper userMapper;

    @Test
    void testInsert() {
        User user = new User("test", "test@example.com", "hash");
        int rows = userMapper.insert(user);
        assertThat(rows).isEqualTo(1);
        assertThat(user.getId()).isNotNull();
    }
}
```

### 9.2 性能测试

- **JMeter**：模拟多线程并发执行 SQL 脚本，测试 TPS / QPS。
- **Sysbench**：专为 MySQL 设计的基准测试工具，测试 OLTP 性能。

### 9.3 SQL Review

- 在 CI 中集成 SQL 审核工具（如 **Yearning**、**Archery**、**SQLCheck**），检测无 WHERE 条件的 UPDATE / DELETE、全表扫描等风险 SQL。

## 10. 如何监控

### 10.1 关键指标

| 指标 | 正常范围 | 说明 |
|------|---------|------|
| QPS / TPS | 视硬件而定 | 查询数 / 事务数每秒 |
| 慢查询数 | < 5/min | 超过阈值需及时排查 |
| 活跃连接数 | < max_connections * 80% | 防连接打满 |
| Innodb_rows_read | 稳定 | 过高说明大量回表或全表扫描 |
| 主从延迟（Seconds_Behind_Master） | < 1s | 超过需关注复制链路 |
| 磁盘 IO（iowait） | < 10% | 高 IO 等待考虑 SSD 或优化查询 |
| Buffer Pool 命中率 | > 99% | 低于需增加 innodb_buffer_pool_size |

### 10.2 监控工具

- **Prometheus + mysqld_exporter** + Grafana：开源监控标准方案。
- **PMM（Percona Monitoring and Management）**：Percona 出品的 MySQL 监控面板，开箱即用。
- **Cloud 方案**：阿里云 RDS 自带监控、华为云 DAS。

### 10.3 告警规则

- CPU 使用率 > 90%
- 活跃连接数 > 阈值
- 慢查询 > 阈值
- 主从延迟 > 10s
- Buffer Pool 命中率 < 95%
- Binlog 磁盘剩余空间 < 20%

## 11. 常见面试问题

| 问题 | 核心要点 |
|------|----------|
| InnoDB 和 MyISAM 的区别 | 事务、行锁、外键、MVCC、聚簇索引、崩溃恢复 |
| B+ 树索引和 B 树的区别 | B+ 树非叶子节点不存数据，叶子链表连接，范围查询高效 |
| 什么是覆盖索引 | 索引包含查询所需所有列，无需回表 |
| 最左前缀原则 | 联合索引从最左列开始匹配，跳列无效 |
| 事务隔离级别有哪些 | READ UNCOMMITTED / READ COMMITTED / REPEATABLE READ / SERIALIZABLE |
| MVCC 如何实现可重复读 | Read View + undo log，事务内复用同一个 Read View |
| 行锁和表锁的区别与使用场景 | 行锁并发高，表锁开销低；InnoDB 行锁基于索引实现 |
| 乐观锁和悲观锁的应用场景 | 乐观锁适合读多写少，悲观锁适合写多冲突大 |
| 主从复制有哪几种模式 | 异步、半同步、同步 |
| 分库分表后怎么处理跨节点查询 | 应用层归并、中间件聚合、宽表冗余 |
| 什么是幻读，MySQL 如何解决 | RR 级别下 Next-Key Lock 防止 Phantom Row |
| INT(10) 和 VARCHAR(255) 的含义 | INT(10) 是显示宽度，不限制存储范围；VARCHAR(255) 是最大字符数 |
| 为什么不要用 UUID 做主键 | 无序、长度大、影响聚簇索引插入性能 |
| 什么情况下索引会失效 | 函数操作、隐式转换、前导模糊、OR 条件 |
| 如何排查一条慢 SQL | EXPLAIN → 慢查询日志 → 索引优化 → 改写 SQL → 分库分表 |

## 12. 在我的项目中如何使用

### 12.1 项目类型定位

当前项目为后端服务，使用 **Spring Boot + MyBatis-Plus + MySQL 8.0**。

### 12.2 表设计规范

- 每张表必须有 `id`（BIGINT UNSIGNED AUTO_INCREMENT）作为主键。
- 一律使用 `utf8mb4` 字符集（emoji 支持）。
- 每张表必须有 `created_at` 和 `updated_at` 时间字段。
- 逻辑删除字段 `deleted_at`（NULL 为未删除）。
- 字段以业务意义命名，加 `COMMENT` 注释。

### 12.3 索引使用规范

- 单表索引数量不超过 5 个。
- 选择性高的列建索引（区分度 > 20%）。
- 避免冗余索引（`idx_a` 与 `idx_a_b` 中前者冗余）。
- 联合索引将等值查询列放前面，范围查询列放后面。

### 12.4 SQL 规范

- 禁止在 WHERE 条件中对列使用函数。
- 禁止使用 `SELECT *`。
- 大表禁止 `LIMIT M, N` 深度分页，改用游标（`WHERE id > ? LIMIT N`）。
- INSERT 必须指定列名。
- 事务尽量短，不要跨 RPC 调用。
- 批量操作控制单批数量不超过 1000 条。

### 12.5 读写分离与分库分表

- 读多写少场景可考虑部署一主多从，通过 ShardingSphere 配置读写分离。
- 单表预估数据量超过 1000 万时，提前设计分片方案（水平分表，按 user_id 哈希分 16 表）。

### 12.6 监控方案

- 使用 Prometheus + mysqld_exporter 采集 MySQL 指标。
- Grafana 面板展示 QPS、慢查询、活跃连接数、Buffer Pool 命中率。
- 钉钉 / 飞书 webhook 告警连接数和主从延迟。

### 12.7 备份策略

| 备份类型 | 频率 | 说明 |
|----------|------|------|
| 全量备份 | 每天凌晨 3:00 | 使用 XtraBackup，保留最近 7 天 |
| 增量备份 | 每 1 小时 | 基于 binlog，保留最近 24 小时 |
| 逻辑备份 | 每周 | mysqldump 全量，用于表结构恢复 |
| 备份验证 | 每天 | 恢复备份到测试库验证完整性 |
