---
title: MySQL 的 redo log、undo log、binlog 到底分别干什么？
date: 2026-08-17
tags:
  - MySQL
  - 数据库
  - 事务
description: redo log 保证崩溃恢复、undo log 保证回滚和 MVCC、binlog 负责数据恢复与主从复制。三者分工不同，缺一不可。
---

# MySQL 的 redo log、undo log、binlog 到底分别干什么？

## 一句话结论

MySQL 的三种日志分工完全不同：**redo log 保证「已提交的数据不丢」（崩溃恢复）**，**undo log 保证「没提交的数据能回滚」并支撑 MVCC**，**binlog 负责「逻辑级的数据备份与主从复制」**。redo log 在事务执行中同步落盘，binlog 在提交时落盘，二者通过两阶段提交保持一致性。

## 1. 从一个 UPDATE 说起

假设执行一条最简单的更新语句：

```sql
UPDATE user SET age = 30 WHERE id = 1001;
```

这条语句执行时，MySQL 内部至少会发生这些事情：

```text
执行器 → InnoDB 读 age=25（内存）
          ↓
      在内存中改为 30
          ↓
   ① 写 redo log（追加，很快）
   ② 写 undo log（保存旧值 25，用于回滚）
   ③ 提交事务，binlog 落盘
```

为什么不能只改内存、只写数据库文件？

```text
内存：改完立即生效，但一断电就丢
磁盘：最可靠，但随机写太慢
```

所以 InnoDB 的做法是：**先在内存里改，同时把改动追加到 redo log 这种「顺序写」的日志里**，磁盘文件稍后再刷。这是 MySQL 保证性能的关键设计。

## 2. redo log：保证「提交了就不丢」

### 2.1 它解决什么问题

redo log（重做日志）解决的是：

> **事务提交成功但还没把数据页刷回磁盘，此时数据库宕机，数据会丢吗？**

不会。因为事务提交前，redo log 已经记录了这次改动。

### 2.2 核心原理：WAL

redo log 的写入遵循 WAL（Write-Ahead Logging，预写日志）原则：

```text
先把改动记到日志（顺序写，快）
    ↓
再在合适时机把数据页刷回磁盘（随机写，慢）
```

```text
优点：
  顺序写磁盘 ≈ 机械硬盘随机写的数十倍
  所以「先记日志、再刷数据」比「每次都刷数据页」快得多
```

### 2.3 它是物理日志

redo log 记录的是物理层面的改动，例如：

```text
"把数据页 5 的第 1024 字节，从 0x01 改成 0x02"
```

记录的是「改成了什么」，而不是「执行了什么 SQL」，因此恢复时可以直接重放，速度极快。

### 2.4 循环写入

redo log 是固定大小的循环写日志：

```text
┌─────────────────────────────────────┐
│  write pos ────────→ checkpoint pos │
└─────────────────────────────────────┘
        ←     可写入区域      →

write pos：当前写入位置（写入即推进）
checkpoint：已刷回磁盘的位置（刷盘后推进）
```

当 `write pos` 追上前方的 `checkpoint` 时，InnoDB 会强制把数据页刷回磁盘、推进 checkpoint，腾出空间继续写。

```text
因此：
  redo log 满了 → 必须等刷盘 → 表现为「暂时写不动」
  这也是缓冲池（Buffer Pool）使用率高时，UPDATE 变慢的常见原因之一
```

## 3. undo log：保证「没提交的能回滚」

### 3.1 它解决什么问题

undo log（回滚日志）解决的是：

> **事务执行到一半，用户回滚，或者系统判断执行失败，怎么把数据恢复原状？**

```text
UPDATE user SET age = 30 WHERE id = 1001
         ↓
InnoDB 先在 undo log 里记录：id=1001 的 age 原来是 25
         ↓
ROLLBACK 时，把 age 从 30 改回 25
```

### 3.2 它是逻辑日志

undo log 记录的是「怎么改回去」的逻辑信息。它记录的是旧值、旧记录位置等，回滚时按逻辑反向恢复。

```text
INSERT → undo 记录主键，回滚时 DELETE 掉
DELETE → undo 记录整行旧数据，回滚时重新 INSERT
UPDATE → undo 记录修改前的旧值，回滚时改回去
```

### 3.3 还有第二个作用：MVCC

undo log 不只是用来回滚，它还是 **MVCC（多版本并发控制）** 的基础：

```text
同一行数据，通过 undo log 可以找到它之前的各个版本
         ↓
SELECT 根据事务隔离级别 + Read View，决定读哪个版本
```

因此 `undo log` 在「读已提交」「可重复读」下，解决了「读操作不阻塞写操作、写操作不阻塞读操作」的问题。

## 4. binlog：负责备份与主从复制

### 4.1 它解决什么问题

binlog（二进制日志）解决的是：

> **数据库怎么备份、怎么恢复到任意时间点、主从怎么同步？**

binlog 属于 **Server 层**，和存储引擎无关，redo/undo log 属于 InnoDB 存储引擎层。

### 4.2 记录的是 SQL 逻辑

binlog 记录的是逻辑操作（statement 格式下是原始 SQL，row 格式下是行变更），例如：

```text
UPDATE user SET age = 30 WHERE id = 1001
```

它是追加写的，内容会一直保留（根据过期策略），因此可以：

```text
全量备份 + binlog 增量
    ↓
恢复到任意时间点
```

### 4.3 主从复制的核心

```text
Master：
  执行事务
    ↓
  写入 binlog
    ↓
  dump 线程把 binlog 发给 Slave

Slave：
  IO 线程拉取 binlog 写入 relay log
    ↓
  SQL 线程回放 relay log
    ↓
  数据同步完成
```

## 5. 三者如何协作：两阶段提交

redo log 和 binlog 是两套独立的日志，如果提交时一个写了、一个没写，恢复时数据就会不一致。

因此 InnoDB 采用**两阶段提交（2PC）**：

```text
① prepare 阶段：
   写 redo log，状态置为 prepare，落盘
    ↓
② 写 binlog 并落盘
    ↓
③ commit 阶段：
   把 redo log 状态置为 commit
```

```text
崩溃后如何判定：
  redo = prepare 且 binlog 已写 → 事务补提交（保持一致）
  redo = prepare 且 binlog 未写 → 事务回滚（保持一致）
  redo = commit               → 事务已提交
```

这样一来，无论崩溃发生在哪个节点，redo log 与 binlog 最终都能对齐。

## 6. 一张表分清三者的区别

| 对比项        | redo log       | undo log       | binlog            |
| --------- | -------------- | -------------- | ----------------- |
| 所属层      | InnoDB 存储引擎   | InnoDB 存储引擎   | MySQL Server 层     |
| 日志类型    | 物理日志（改了什么）   | 逻辑日志（怎么改回）    | 逻辑日志（执行了什么 SQL）  |
| 主要作用    | 崩溃恢复 / 数据不丢   | 事务回滚 / MVCC    | 备份 / 恢复 / 主从复制    |
| 写入时机    | 事务执行中同步落盘     | 事务执行中记录       | 事务提交时落盘          |
| 写入方式    | 循环写、可覆盖       | 依赖 purge 清理    | 追加写、可长期保留        |
| 事务提交     | 提交前写入，保证不丢    | 与提交无关          | 提交时写入            |

## 7. 面试常问的几个点

### 7.1 redo log 和 binlog 都记录「写」，为什么要两份？

```text
redo log：InnoDB 层的物理日志，循环写，只用于崩溃恢复，崩溃后无需 binlog
binlog：Server 层的逻辑日志，追加写，用于备份恢复、主从复制，不需要 redo log

两者用途完全不同，互为补充，缺一不可。
```

### 7.2 为什么是两阶段提交？

因为 redo log 与 binlog 独立写入，直接写会导致崩溃后二者不一致（主从数据与主库恢复结果对不上）。两阶段提交保证了二者的原子性。

### 7.3 undo log 一直存在吗？

不会。已经没有事务需要它（旧版本数据没人读了、事务全部提交或回滚）之后，purge 线程会把它清理掉。

### 7.4 UPDATE 会不会同时写三种日志？

会。一条 UPDATE 的完整路径大致是：

```text
更新内存中的缓冲池
    ↓
写 undo log（记录旧值）
    ↓
写 redo log（记录本次改动，prepare）
    ↓
提交时写 binlog
    ↓
redo log 置为 commit
    ↓
后台线程择机把数据页刷回磁盘
```

### 7.5 redo log 是什么时候落盘的？

由参数 `innodb_flush_log_at_trx_commit` 控制，典型取值：

| 取值 | 行为 | 数据安全 | 性能 |
| ---- | ---- | ---- | ---- |
| 0 | 每秒刷一次，提交时不刷 | 丢最近 1 秒数据 | 最快 |
| 1 | 每次提交都刷盘 | 不丢数据 | 最慢 |
| 2 | 每次提交写入 OS 缓存，每秒刷盘 | OS 崩溃丢 1 秒，MySQL 崩溃不丢 | 较快 |

```text
生产环境一般用 1
配合「双 1」：sync_binlog = 1 时 binlog 也每次提交刷盘
```

### 7.6 binlog 有哪几种格式？有什么区别？

```text
STATEMENT   → 记录原始 SQL，日志小，但某些函数/非确定操作在主从复制时结果可能不一致
ROW         → 记录每行数据的变更，日志大，但复制最精确，还能用于闪回（binlog2sql）
MIXED       → 默认用 STATEMENT，遇到非安全语句自动切换为 ROW
```

生产环境更推荐 `ROW` 格式。

### 7.7 崩溃恢复时 MySQL 是怎么恢复的？

分三步：

```text
① 从 redo log 重放：所有 redo 中已 commit 的事务重新应用
   → 已提交的数据不丢（保证持久性）

② 回滚未提交事务：redo 为 prepare 且 binlog 未写的事务
   → 相当于回滚，保证一致性

③ 通过 undo log 回滚：恢复时未提交事务的数据改动被撤销
```

```text
关键点：
  redo log 保证「提交了」的数据不丢
  undo log 保证「没提交」的数据被回滚
```

### 7.8 主从复制延迟可能由什么引起？

```text
主库压力大 / 大事务（一次改几百万行）
从库单线程 SQL 回放（新版本已有并行复制）
binlog 在 ROW 格式下日志量暴增
网络带宽瓶颈
```

```text
排查思路：
  看从库 Seconds_Behind_Master
  大事务拆小、优化慢 SQL
  开启并行复制（replica_parallel_workers）
```

### 7.9 长事务为什么危险？

```text
① undo log 无法及时 purge → 回滚段膨胀，占用大量磁盘
② 影响 MVCC：旧版本一直被长事务引用，其他读操作需要回看很多版本，性能变差
③ 持有锁不释放 → 阻塞其他事务，甚至拖垮整个实例
```

```text
所以线上要控制事务大小、避免在事务里做耗时操作（远程调用、大量计算等）。
```

### 7.10 为什么不能用 binlog 直接做崩溃恢复？

```text
redo log：物理日志，记录「哪个页、哪个偏移改成了什么」，重放只针对崩溃前未落盘的数据页，速度快
binlog：逻辑日志，记录「执行了什么操作」，重放要重新执行全部事务，还要再解析、再回放，恢复时间长

而且 binlog 是追加写，崩溃时未必包含所有未落盘事务；
redo log 是随事务提交同步写入的，才能保证「提交即不丢」。
```

## 8. 总结

```text
redo log：让 MySQL 在「性能」与「不丢数据」之间兼得
undo log：让事务「能回滚」，让并发「能读旧版本」
binlog：让数据「能备份、能恢复、能同步到从库」
```

三者各司其职，共同构成了 MySQL 事务的可靠性与高性能底座。

理解它们，是理解 InnoDB 事务、崩溃恢复、主从复制的一把钥匙。

## 延伸阅读

- 官方文档：[MySQL Reference Manual：InnoDB Redo Log](https://dev.mysql.com/doc/refman/8.0/en/innodb-redo-log.html)
- 官方文档：[MySQL Reference Manual：InnoDB Undo Logs](https://dev.mysql.com/doc/refman/8.0/en/innodb-undo-logs.html)
- 官方文档：[MySQL Reference Manual：The Binary Log](https://dev.mysql.com/doc/refman/8.0/en/binary-log.html)
- [MySQL 官方博客：How to Perform Point-in-Time Recovery](https://dev.mysql.com/doc/refman/8.0/en/point-in-time-recovery.html)
- 官方文档：[MySQL Reference Manual：InnoDB Multi-Versioning](https://dev.mysql.com/doc/refman/8.0/en/innodb-multi-versioning.html)
- 笔记：[后端工程：MySQL](/notes/backend/05-database-mysql)
- 笔记：[后端工程：分布式系统与可靠性](/notes/backend/08-distributed-systems-and-reliability)
- 每日技术：[事务性发件箱（Transactional Outbox）——保证业务与消息投递的最终一致](/daily/2026/08/2026-08-06-daily-transactional-outbox)
