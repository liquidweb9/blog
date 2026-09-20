---
title: Docker 部署与 Dockerfile：从源码到可重复运行的服务
date: 2026-09-18
tags:
  - Docker
  - 后端工程
  - 工程实践
description: 用一个最小 FastAPI 服务串起 Dockerfile、镜像构建、容器运行和 Compose 部署，说明构建缓存、端口、健康检查、数据持久化与版本回滚。
---

# Docker 部署与 Dockerfile：从源码到可重复运行的服务

## 一句话结论

**Dockerfile 描述如何构建镜像，镜像封装应用及其运行依赖，部署配置决定镜像在什么环境中运行。** Docker 部署的关键，是把构建产物、运行配置和持久化数据分开，让同一个可追溯的镜像可以被验证、发布和回滚。

## 1. 先分清四个概念

“本地能跑，服务器不能跑”通常与解释器版本、系统库、环境变量、启动命令或文件路径有关。Docker 将其中的应用运行环境收敛为镜像，但不会自动处理外部数据库、网络和业务配置。

| 概念 | 职责 | 例子 |
| --- | --- | --- |
| Dockerfile | 构建镜像的配方 | 基础镜像、安装依赖、复制代码、默认命令 |
| Image（镜像） | 可分发的只读文件层与配置 | `daily-api:2026-09-18` |
| Container（容器） | 镜像启动后的进程与可写层 | 正在监听 8000 端口的 API |
| Compose | 多容器应用的运行配置 | 镜像、端口、环境变量、网络、卷 |

```text
源码 + 依赖文件 + Dockerfile
          ↓ docker build
         镜像
          ↓ 推送镜像仓库 / 服务器拉取
   运行配置 + 镜像 + 持久化存储
          ↓ docker compose up
         容器
```

容器不是完整虚拟机。Linux 容器共享所在 Linux 环境的内核；在 Windows 或 macOS 上，Docker Desktop 通常通过 Linux 虚拟化环境运行它们。目标操作系统和 CPU 架构仍需与镜像匹配。

## 2. 用一个最小 API 理解 Dockerfile

下面的示例假设使用 Linux 容器模式，目录为：

```text
daily-api/
├── app.py
├── requirements.txt
├── Dockerfile
├── .dockerignore
└── compose.yaml
```

`app.py`：

```python
import os

from fastapi import FastAPI

app = FastAPI()


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/")
def index():
    return {"message": "hello", "environment": os.getenv("APP_ENV", "development")}
```

`requirements.txt` 使用一组固定的示例版本：

```text
fastapi==0.115.0
uvicorn==0.30.6
```

这里仅固定直接依赖用于演示。实际项目应使用经过测试的版本，并通过锁文件固定传递依赖；只写两个版本号还不足以保证完整的可重复构建。

`Dockerfile`：

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home app

COPY --chown=app:app app.py ./

USER app
EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

逐条理解：

- **`FROM`**：选择基础运行环境。示例为 Python 3.12 的精简 Linux 镜像；发布流水线可固定 Digest，并定期更新验证。
- **`WORKDIR`**：设置后续构建指令和进程运行的工作目录。
- **`COPY` / `RUN`**：前者将构建上下文中的文件复制进去，后者在构建时执行命令。这里先装依赖，再复制业务代码。
- **缓存挂载**：BuildKit 缓存 pip 下载内容，加速依赖层重建；缓存目录不会作为这一层的内容写入最终镜像。
- **`USER`**：应用以普通用户运行，应用需要写入的目录或挂载卷应另行配置权限。
- **`EXPOSE`**：声明应用使用的端口，**不会自动发布宿主机端口**。
- **`CMD`**：指定容器默认启动命令。Exec 数组形式减少额外 Shell，使主进程直接接收停止信号。

这里的 `0.0.0.0` 是**容器内部**的监听地址。如果应用只监听容器里的 `127.0.0.1`，宿主机端口映射通常无法访问它。

## 3. 构建上下文与缓存为什么重要？

在示例目录执行：

```bash
docker build -t daily-api:2026-09-18 .
```

最后的 `.` 指定**构建上下文**，`COPY` 的源路径通常相对于它解析，而不是任意读取宿主机文件。上下文应尽量小，并通过 `.dockerignore` 排除无关内容：

```text
.git
.venv
__pycache__
*.pyc
.env
.env.*
!.env.example
```

先复制 `requirements.txt` 的原因是构建缓存：修改业务代码时，依赖文件没有变，通常就能复用安装依赖的镜像层。如果先 `COPY . .` 再安装，每次代码变化都可能让后面的依赖安装层失效。

构建时所需的私有仓库凭据应使用 BuildKit Secret 挂载，而不是写进 `ARG`、`ENV` 或先复制再删除的文件中；旧镜像层可能仍保留已删除的内容。

对于 Go、Java 或需要编译前端资源的项目，可以使用多阶段构建：第一阶段包含编译器和构建依赖，最终阶段只复制二进制、JAR 或静态资源。多阶段构建用于分离构建环境与运行环境，是否需要它取决于实际产物。

## 4. 先运行，再用 Compose 固化部署

先启动一个临时容器验证镜像：

```bash
docker run --rm --name daily-api -p 127.0.0.1:8000:8000 -e APP_ENV=production daily-api:2026-09-18
```

此时访问 `http://localhost:8000/healthz`。端口映射是“宿主机地址:宿主机端口:容器端口”；这里仅发布到本机回环地址。按 `Ctrl+C` 停止后，`--rm` 会移除这个临时容器。

将长期运行配置写进 `compose.yaml`：

```yaml
services:
  api:
    image: ${API_IMAGE:-daily-api:2026-09-18}
    ports:
      - "127.0.0.1:8000:8000"
    environment:
      APP_ENV: production
    restart: unless-stopped
    stop_grace_period: 30s
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2)"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

使用支持 `--wait` 的 Docker Compose v2：

```bash
docker compose config
docker compose up -d --wait
docker compose ps
docker compose logs --tail=100 api
```

`config` 检查变量展开和配置结构，`up --wait` 等待服务运行或健康，`logs` 查看标准输出。配置本身不包含构建步骤，所以本机需要先完成 `docker build`，服务器则需要先拉取发布的镜像。

这个例子仅供本机或宿主机反向代理访问。对外提供服务时，可让反向代理负责域名和 TLS；如果代理也在 Compose 中，应通过同一网络里的 `api:8000` 访问，而不是代理容器自己的 `localhost`。

## 5. 容器运行了，不等于部署完成

### 健康检查与重启是两件事

容器处于 `running` 只说明主进程还活着。示例 `/healthz` 证明 HTTP 进程可以响应；如果接入数据库，还应按业务需要区分存活检查与就绪检查。

Docker 的 `HEALTHCHECK` 或 Compose `healthcheck` 会标记健康状态，**单机 Docker 不会仅因为 `unhealthy` 就自动重启容器**。`restart: unless-stopped` 主要针对进程退出和 Docker 重启后的恢复；流量摘除与更完整的自愈需要代理、编排器或额外机制。

### 数据要有独立生命周期

容器的可写层在停止后仍存在，但删除并重建容器后不会自动保留。数据库文件和用户上传内容应写入命名卷、绑定挂载或外部存储。

例如添加 Postgres 时，可以把命名卷挂载到数据库的数据目录；应用通过服务名 `db` 连接数据库。卷能帮助数据跨容器重建保留，却不能代替备份、恢复演练或数据库迁移。日常停止也要区分 `docker compose down` 与会删除声明的命名卷的 `docker compose down -v`。

### 配置与密钥在运行时注入

环境差异通过 Compose 配置或配置系统传入，密钥使用运行时 Secret 或受控挂载。Compose 的 `.env` 默认用于变量插值，并不会把所有变量自动传进容器；需要显式使用 `environment` 或 `env_file`。

## 6. 怎样让发布可追溯、可回滚？

本机构建的镜像不会自动出现在服务器。实际发布链路通常是：

```text
CI 检出确定的 Commit
  → 安装锁定依赖、构建与验证镜像
  → 推送镜像仓库
  → 记录镜像 Digest
  → 服务器拉取同一镜像
  → 更新容器并检查健康状态
```

Compose 示例保留了 `API_IMAGE` 入口。服务器可以在 `.env` 中将它设置为镜像仓库中的完整引用，推荐使用不可变 Digest，然后执行：

```bash
docker compose pull api
docker compose up -d --wait api
```

Tag 是可以被重新指向的名字，Digest 标识具体镜像内容。发布记录应关联 **Git Commit、镜像 Digest、运行配置版本和数据库迁移版本**。

回滚时将 `API_IMAGE` 改回上一份已验证的镜像引用，再拉取和启动。单副本 Compose 替换容器可能造成短暂中断；回滚应用镜像也不会自动回滚数据库结构，迁移需要提前考虑兼容性。

## 实践建议

- 先用 `docker run` 验证镜像，再用 Compose 保存可重复执行的部署配置。
- 将依赖安装放在业务代码复制之前，控制上下文大小，并固定完整依赖和发布产物。
- 排查“服务无法访问”时，依次检查进程日志、容器监听地址、端口映射、网络与代理。
- 发布前明确健康检查、持久化目录、配置来源和回滚目标，避免把“进程启动成功”当成“服务交付成功”。

## 延伸阅读

- [Docker：Dockerfile reference](https://docs.docker.com/reference/dockerfile/)
- [Docker：Building best practices](https://docs.docker.com/build/building/best-practices/)
- [Docker：Compose file reference](https://docs.docker.com/reference/compose-file/)
- [后端工程：Linux、容器与部署](/notes/backend/12-linux-containers-and-deployment)
