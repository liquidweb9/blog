---
title: Alembic：如何让 SQLAlchemy 的表结构变更安全上线
date: 2026-07-31
tags:
  - Python
  - 数据库
  - 工程实践
description: Alembic 用版本化迁移脚本管理 SQLAlchemy 数据库结构变更，让建表、改列和回滚过程可审查、可重复执行。
---

# Alembic：如何让 SQLAlchemy 的表结构变更安全上线

## 一句话结论

Alembic 是 SQLAlchemy 生态的数据库迁移工具：它将每一次表结构变化记录为有序、可提交到 Git 的迁移脚本，并通过 `upgrade` 和 `downgrade` 让开发、测试和生产环境演进到一致的 Schema 版本。

不要在生产环境直接执行 `Base.metadata.create_all()` 或手工修改表结构。前者只能创建缺失的表，不能可靠地描述修改和删除；后者没有版本记录，也无法在其他环境复现。

## 问题与场景

一个项目刚开始时，数据库表通常由 SQLAlchemy 模型自动创建：

```python
Base.metadata.create_all(engine)
```

当 `User` 表需要增加 `avatar_url` 字段时，只修改 Python 模型并重新运行这行代码并不会更新已有表。开发者可能在本地手工执行 `ALTER TABLE`，但测试和生产环境仍然缺少该列；多人并行开发时，执行顺序不同还会造成 Schema 不一致。

数据库结构和应用代码一样需要版本控制。一次迁移应明确说明：

- 从哪个版本开始变更
- 执行升级时要做什么
- 发生故障时如何回退
- 是否需要处理已有数据或分阶段发布

Alembic 维护这些版本关系，并将真实执行过的版本写入数据库的 `alembic_version` 表。应用启动时不需要猜测数据库结构；部署流程只需把数据库升级到项目声明的最新 revision。

## 一个具体例子

假设已有 SQLAlchemy 模型：

```python
from sqlalchemy import String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
```

现在要为用户增加一个可选头像地址。先修改模型：

```python
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
```

### 1. 初始化并连接模型元数据

首次在项目中使用 Alembic：

```bash
pip install alembic
alembic init migrations
```

命令会创建 `alembic.ini`、`migrations/env.py` 和 `migrations/versions/`。在 `env.py` 中导入项目的 `Base`，并将 `target_metadata` 指向它，自动生成才能比较模型和当前数据库：

```python
from app.models import Base

target_metadata = Base.metadata
```

数据库连接地址通常由环境变量或应用配置传入，避免把生产密码提交到 `alembic.ini`。

### 2. 生成并审查迁移

执行：

```bash
alembic revision --autogenerate -m "add avatar url to users"
```

Alembic 会比较 `target_metadata` 与数据库现有 Schema，并在 `migrations/versions/` 下生成类似脚本。自动生成只是候选方案，必须人工审查：它不了解业务数据、重命名意图和生产锁表风险。

```python
from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
```

每个 revision 包含唯一的 `revision` 标识和其父节点 `down_revision`。因此 Alembic 可以从当前版本沿迁移链执行到目标版本：

```text
数据库：a1b2c3 -> 最新：d4e5f6
                     ↑
              add avatar_url
```

将生成脚本与模型改动一起提交到 Git。代码评审不仅要看字段类型，也要检查 `nullable`、默认值、索引、外键以及降级是否会丢失数据。

### 3. 在部署中执行迁移

本地、CI 或发布任务中执行：

```bash
alembic upgrade head
```

`head` 表示当前迁移链的最新 revision。成功后，Alembic 在同一数据库中更新 `alembic_version`，重复执行不会再次添加该字段。需要验证回滚路径时，可以在临时数据库中执行：

```bash
alembic downgrade -1
alembic upgrade head
```

`downgrade -1` 会回退一个 revision。它适合测试和紧急回退演练，但如果迁移已经删除或不可逆地转换了生产数据，脚本不能凭空恢复数据。

## 实践建议

1. **把迁移视为代码的一部分。** 每次模型结构变更都应同时提交 Alembic revision；不要依赖开发者手工执行 SQL。
2. **始终审查 `--autogenerate` 输出。** 自动生成通常无法识别列重命名，可能把“重命名”错误地写成“删除旧列并新建列”，导致数据丢失。此时应手工使用 `op.alter_column()` 或数据库对应的重命名操作。
3. **为已有数据设计安全默认值。** 新增 `NOT NULL` 列时，先以可空列或服务端默认值上线，回填旧数据后再加非空约束，避免一次 DDL 使旧记录无法满足约束。
4. **迁移先于依赖新结构的应用代码。** 推荐兼容性发布：先新增表或列，发布能同时兼容新旧结构的应用，完成数据回填后再删除旧字段。不要在同一发布中立刻删除仍可能被旧实例读取的列。
5. **在与生产同类型的数据库验证。** SQLite、MySQL、PostgreSQL 对 `ALTER TABLE` 和事务 DDL 的能力不同。针对生产数据库运行一次 `upgrade head`、核心查询和必要的 `downgrade` 演练。
6. **处理分支合并产生的多头版本。** 两个分支同时创建迁移后会出现多个 head。合并代码时使用 `alembic heads` 检查，并通过 `alembic merge` 创建合并 revision；不要随意修改已被其他环境执行的 revision ID。

一个常见误区是把 Alembic 当作“模型自动同步器”。它的核心产物是经过审查的迁移脚本，而不是每次启动应用时自动修改生产数据库。自动生成负责发现差异，迁移脚本与发布流程负责控制风险。

## 延伸阅读

- [Alembic 官方教程](https://alembic.sqlalchemy.org/en/latest/tutorial.html)
- [Alembic 自动生成迁移文档](https://alembic.sqlalchemy.org/en/latest/autogenerate.html)
- [SQLAlchemy ORM Quick Start](https://docs.sqlalchemy.org/en/20/orm/quickstart.html)
