# Linux、容器与部署

## 1. 它是什么

Linux、容器与部署是现代后端工程的核心基础设施栈，涵盖了从操作系统环境到应用交付的全链路。

- **Linux**：服务器端最主流的操作系统，提供进程管理、文件系统、网络栈、权限控制等底层能力。几乎所有的后端服务最终都运行在 Linux 上。
- **容器（Container）**：基于 Linux 内核的 cgroups（资源隔离）和 Namespace（命名空间隔离）技术实现的轻量级虚拟化方案。Docker 是最流行的容器引擎，Kubernetes 则是容器编排的事实标准。
- **部署（Deployment）**：将构建好的应用发布到目标环境的过程。现代部署流程通常包含 CI/CD 流水线，实现从代码提交到生产上线的自动化。

整个技术栈的典型层次：

| 层次 | 技术选型 |
|------|----------|
| 操作系统 | Linux (CentOS / Ubuntu / Alpine) |
| 应用服务器 | Nginx |
| 容器化 | Docker / containerd |
| 容器编排 | Docker Compose / Kubernetes |
| 持续集成/持续部署 | GitLab CI / Jenkins / GitHub Actions / ArgoCD |

---

## 2. 为什么需要它

### 环境一致性
开发、测试、生产环境之间的差异是导致线上故障的首要原因。容器将应用程序及其所有依赖打包在一起，确保"在我机器上能跑"变为"在任何地方都能跑"。

### 资源利用率
传统虚拟机需要完整的 Guest OS，启动分钟级，资源开销大。容器共享宿主机内核，启动毫秒级，一台物理机可以运行成百上千个容器。

### 弹性伸缩
业务流量波动的场景下，手工扩缩容不可行。Kubernetes 可以根据 CPU / 内存 / 自定义指标自动调整副本数，做到随流量变化秒级响应。

### 故障自愈
单个容器或节点崩溃时，Kubernetes 会自动重新调度，保证服务的期望副本数不降级。配合健康检查，可以拦截不健康的实例，不让流量进入。

### 标准化交付
CI/CD 流水线将代码构建为 Docker 镜像，镜像成为标准交付产物。部署时不再手动执行脚本，而是声明式地描述期望状态（YAML），系统自动完成差异调和。

---

## 3. 它解决什么问题

| 问题 | 解决方案 |
|------|----------|
| 环境不一致导致"我的机器能跑" | Docker 镜像打包完整运行时 |
| 服务器资源利用率低 | 容器共享内核，一台宿主机跑多实例 |
| 部署步骤多、易出错 | Docker Compose / K8s 声明式部署 |
| 流量波动时无法快速扩缩容 | K8s HPA 自动扩缩容 |
| 单点故障影响可用性 | K8s Deployment 自动恢复副本 |
| 配置散落在各服务器 | ConfigMap / Secret 统一管理 |
| 上线过程需要停机 | 滚动更新 + 健康检查，零停机发布 |

---

## 4. 核心原理

### 4.1 Linux 核心机制

#### 进程与文件
- Linux 一切皆文件。进程通过文件描述符（fd）操作资源。
- `/proc` 伪文件系统暴露内核数据结构，`/proc/[pid]/` 下可以看到每个进程的内存映射、打开的文件、环境变量等。

#### 用户与权限
- 用户 UID 和组 GID 控制文件访问权限（rwx-rwx-rwx）。
- 超级用户 root 的 UID 为 0，可以绕过所有权限检查。
- sudo 机制允许普通用户临时提升权限。

#### cgroups（Control Groups）
- 资源隔离的基础。Docker 为每个容器创建独立的 cgroup，限制 CPU、内存、磁盘 IO、网络带宽。
- 三个子系统常用：`cpu`（CPU 时间片）、`memory`（内存上限）、`blkio`（块设备 IO）。

#### Namespace
- 进程视角的隔离。一个 Namespace 内的进程只能看到同 Namespace 内的资源。
- 7 种 Namespace：PID（进程号）、Net（网络栈）、Mount（挂载点）、UTS（主机名）、IPC（进程间通信）、User（用户）、Cgroup。

#### 联合文件系统（UnionFS）
- OverlayFS 是 Docker 镜像分层的基础。每一层 Layer 只记录差异，多个只读层叠加后在上层挂载一个可写层（容器层）。
- 镜像构建时每条 RUN 指令生成一个新层，层可复用，节省存储和传输。

### 4.2 Docker 核心原理

#### 镜像（Image）与容器（Container）
- 镜像是只读模板，容器是镜像的运行实例。
- 容器在镜像层之上添加一个可写层（容器层），容器删除时该层丢失（除非 commit 为新镜像）。

#### Dockerfile 构建过程
每条指令生成一个中间层，利用缓存机制：如果之前的层和构建上下文没有变化，则复用缓存层。

#### 网络模式
| 模式 | 原理 | 使用场景 |
|------|------|----------|
| bridge | Docker 创建虚拟网桥 docker0，容器通过 NAT 上网 | 默认模式，单机容器通信 |
| host | 直接使用宿主机网络栈，性能最佳 | 对网络性能要求极高的场景 |
| none | 容器无网络 | 纯计算任务 |
| overlay | 跨宿主机容器网络，通过 VXLAN 隧道 | Swarm / K8s 多机通信 |

#### Volume 与数据持久化
- Volume 由 Docker 管理，存放在 `/var/lib/docker/volumes/`，性能好，推荐使用。
- Bind mount 将宿主机目录映射到容器，方便开发调试，但存在权限风险。

### 4.3 Kubernetes 核心原理

#### 控制平面与工作节点
- API Server：所有操作的入口，提供 RESTful API。
- Scheduler：监控未调度的 Pod，根据资源需求和约束选择合适的 Node。
- Controller Manager：运行各种控制器（Deployment Controller、ReplicaSet Controller 等），不断将实际状态调和为期望状态。
- etcd：分布式键值存储，保存集群所有状态。
- Kubelet：每个 Node 上的代理，负责管理 Pod 的生命周期。
- Kube-proxy：维护节点上的网络规则，实现 Service 的负载均衡。

#### 控制器模式
K8s 的核心思想是声明式 API + 控制器循环。用户声明"我想要 3 个副本"，控制器持续监控，发现当前只有 2 个就创建 1 个，发现有 4 个就删除 1 个。这个循环永不停止。

#### Pod
- K8s 最小的调度单元，包含一个或多个容器。
- 同一个 Pod 内的容器共享 Network Namespace（localhost 互通）和 Volume。
- Sidecar 模式：在主容器旁边运行辅助容器（日志收集、反向代理）。

#### Deployment
- 管理 Pod 的声明式更新。支持滚动更新、回滚、副本扩缩。
- 内部通过 ReplicaSet 控制 Pod 数量。每次更新创建一个新 RS，逐步替换旧 RS。

#### Service
- 为一组 Pod 提供稳定的访问入口（Cluster IP + DNS）。
- iptables 模式：每个 Node 上的 kube-proxy 在 iptables 中写入 DNAT 规则，随机选择一个后端 Pod。
- IPVS 模式：使用 Linux IPVS 模块，支持更多负载均衡算法。

#### Ingress
- 七层负载均衡器，将外部 HTTP/HTTPS 请求路由到内部 Service。
- 需要 Ingress Controller（如 Nginx Ingress Controller、Traefik）才能工作。

---

## 5. 基本使用方法

### 5.1 Linux 常用命令

#### 文件和目录操作
```bash
# 查找大文件
find / -type f -size +100M -exec ls -lh {} \;

# 统计目录大小
du -sh /var/log
du -sh --max-depth=1 /home

# 软链接
ln -s /data/app /app
```

#### 用户与权限
```bash
# 创建用户并添加 sudo
useradd -m deploy
passwd deploy
usermod -aG wheel deploy  # CentOS
usermod -aG sudo deploy   # Ubuntu

# 文件权限
chmod 755 script.sh
chown deploy:deploy /app
chattr +i /etc/hosts  # 加锁，防止修改
```

#### 进程管理
```bash
# 查看进程树
pstree -p

# 结束进程组
kill -TERM -PID   # 负 PID 表示发送给进程组
kill -9 PID       # SIGKILL，无法捕获

# nohup 后台运行
nohup java -jar app.jar > app.log 2>&1 &
```

#### 网络命令
```bash
# 监听端口
ss -tlnp   # 替代 netstat
netstat -tlnp

# 查看连接状态统计
ss -s

# 路由跟踪
traceroute -n 8.8.8.8
mtr 8.8.8.8    # 结合 ping + traceroute

# DNS 排查
dig +trace example.com
nslookup example.com
host example.com
```

#### 磁盘与内存
```bash
# IO 性能
iostat -x 1      # 查看 %util、await、svctm
iotop            # 查看每个进程的 IO

# 内存详情
cat /proc/meminfo
free -h
vmstat 1

# 磁盘空间
df -h
lsblk
fdisk -l
```

#### systemd
```bash
# 创建服务
cat > /etc/systemd/system/myapp.service << 'EOF'
[Unit]
Description=My App
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/app
ExecStart=/usr/bin/java -jar /app/app.jar
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable myapp
systemctl start myapp
systemctl status myapp
journalctl -u myapp -f
```

#### 日志查看
```bash
journalctl -u nginx --since "1 hour ago"
journalctl -u nginx -p err    # 只查看错误级别

# 日志轮转配置 /etc/logrotate.d/nginx
/var/log/nginx/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

#### grep/awk/sed 三板斧
```bash
# grep - 搜索
grep -r "ERROR" /var/log/app/ --include="*.log"
grep -rl "timeout" /app/config/   # 只输出文件名
grep -A5 -B5 "OutOfMemoryError" hs_err_pid*.log

# awk - 列处理
awk '{print $1, $NF}' access.log   # 打印第一列和最后一列
awk '$9 >= 500 {print $1, $7, $9}' access.log  # 5xx 错误
awk '{count[$1]++} END {for(ip in count) print ip, count[ip]}' access.log

# sed - 流编辑
sed -i 's/old_host/new_host/g' config.yml
sed -i '/^#/d' config.yml       # 删除注释行
sed -n '10,20p' file.txt        # 打印 10-20 行
```

#### top / ps / lsof
```bash
# top 交互命令
top -H -p PID    # 查看进程内的线程
# 交互键: 1(看CPU核), M(按内存排序), P(按CPU排序), c(显示完整命令), H(切换线程视图)

# ps
ps aux --sort=-%mem | head -10   # 内存前10
ps -eo pid,ppid,cmd,%cpu,%mem --sort=-%cpu | head

# lsof
lsof -i :8080               # 谁在占用端口
lsof -p PID                 # 进程打开了哪些文件
lsof +D /var/log/           # 目录下哪些文件被打开
```

### 5.2 Shell 脚本基础

```bash
#!/bin/bash
set -euo pipefail  # 安全选项：出错即停、未定义变量报错、管道错误传递

# 变量
APP_HOME="/opt/myapp"
LOG_FILE="${APP_HOME}/logs/deploy.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 条件
if [[ -f "${APP_HOME}/app.jar" ]]; then
    log "JAR 文件存在"
else
    log "ERROR: JAR 文件不存在"
    exit 1
fi

# 循环
for node in node01 node02 node03; do
    ssh deploy@"$node" "systemctl restart myapp"
done
```

#### curl 常用参数
```bash
curl -v https://api.example.com          # 详细交互过程
curl -i https://api.example.com          # 包含响应头
curl -X POST -H "Content-Type: application/json" \
     -d '{"name":"test"}' https://api.example.com
curl -w "http_code:%{http_code}\ntime:%{time_total}s\n" -o /dev/null -s https://api.example.com
curl --connect-timeout 5 --max-time 10 https://api.example.com
```

#### SSH 常用操作
```bash
# 密钥对
ssh-keygen -t ed25519 -C "deploy@company.com"
ssh-copy-id deploy@192.168.1.100

# 配置 ~/.ssh/config
Host jumpbox
    HostName jump.example.com
    User deploy
    Port 22
    IdentityFile ~/.ssh/company_ed25519

Host prod-*
    ProxyJump jumpbox
    User deploy

# 隧道转发
ssh -L 8080:localhost:8080 jumpbox    # 本地端口转发
ssh -R 8080:localhost:8080 jumpbox    # 远程端口转发
ssh -D 1080 jumpbox                   # SOCKS 代理

# 安全连接测试
ssh -vT git@github.com
```

### 5.3 Nginx

```nginx
# 基础配置
upstream backend {
    server 10.0.0.1:8080 weight=3;
    server 10.0.0.2:8080 weight=1;
    keepalive 64;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    # 安全头
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # 反向代理
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时配置
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;

        # 缓冲
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 32k;
    }

    # 静态文件
    location /static/ {
        root /var/www/html;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 限流
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        limit_req_status 429;
    }

    # 健康检查
    location /health {
        access_log off;
        return 200 "OK";
    }
}

# 限流区域定义
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
```

### 5.4 Docker

#### Dockerfile 最佳实践

```dockerfile
# 多阶段构建
FROM maven:3.8-eclipse-temurin-17 AS builder
WORKDIR /build
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -B

FROM eclipse-temurin:17-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

# 只复制构建产物
COPY --from=builder /build/target/app.jar app.jar

# 非 root 运行
USER app
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:8080/health || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

#### 镜像优化
```dockerfile
# 减少层数：合并 RUN
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# 使用 .dockerignore 排除不必要的文件
# .dockerignore 内容
.git
node_modules
target/
*.md
Dockerfile
```

#### 常用 Docker 命令
```bash
# 构建与运行
docker build -t myapp:latest .
docker run -d --name myapp -p 8080:8080 \
    -v /data/logs:/app/logs \
    -e SPRING_PROFILES_ACTIVE=prod \
    --restart unless-stopped \
    --memory="512m" --cpus="0.5" \
    myapp:latest

# 调试
docker logs -f myapp
docker exec -it myapp sh
docker inspect myapp | jq '.[0].NetworkSettings.IPAddress'
docker stats myapp

# 清理
docker system prune -af --volumes
```

### 5.5 Docker Compose

```yaml
# docker-compose.yml
version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - DB_URL=jdbc:postgresql://db:5432/myapp
      - REDIS_HOST=redis
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:8080/health"]
      interval: 30s
      timeout: 3s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 256M

  db:
    image: postgres:15-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myapp"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      app:
        condition: service_healthy

volumes:
  pgdata:
  redis_data:

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

### 5.6 Kubernetes 核心资源

#### Pod
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
  labels:
    app: myapp
spec:
  containers:
    - name: myapp
      image: myapp:latest
      ports:
        - containerPort: 8080
      resources:
        requests:
          cpu: 100m
          memory: 256Mi
        limits:
          cpu: 500m
          memory: 512Mi
      livenessProbe:
        httpGet:
          path: /health
          port: 8080
        initialDelaySeconds: 30
        periodSeconds: 10
      readinessProbe:
        httpGet:
          path: /ready
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 5
```

#### Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  labels:
    app: myapp
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1         # 最多超过期望副本数 1 个
      maxUnavailable: 0   # 更新期间不允许不可用
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myapp:latest
          ports:
            - containerPort: 8080
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: "prod"
            - name: DB_URL
              valueFrom:
                configMapKeyRef:
                  name: myapp-config
                  key: db_url
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: myapp-secret
                  key: db_password
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: 1
              memory: 1Gi
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 15
            failureThreshold: 3
          volumeMounts:
            - name: logs
              mountPath: /app/logs
      volumes:
        - name: logs
          emptyDir: {}
```

#### Service
```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
  selector:
    app: myapp
---
# NodePort 类型（外部访问，仅测试用）
apiVersion: v1
kind: Service
metadata:
  name: myapp-nodeport
spec:
  type: NodePort
  ports:
    - port: 80
      targetPort: 8080
      nodePort: 30080
  selector:
    app: myapp
```

#### Ingress
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/limit-rps: "100"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.example.com
      secretName: tls-secret
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: myapp-service
                port:
                  number: 80
```

#### ConfigMap & Secret
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
data:
  app.yml: |
    server:
      port: 8080
    spring:
      datasource:
        url: jdbc:postgresql://postgres-service:5432/myapp
  app.env: |
    LOG_LEVEL=INFO
    CACHE_TTL=300
---
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secret
type: Opaque
stringData:
  db_password: "P@ssw0rd!2024"
  redis_password: "RedisP@ss"
  jwt_secret: "my-super-secret-key-change-in-production"
```

#### StatefulSet（有状态服务）
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres-headless
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:15-alpine
          env:
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 20Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-headless
spec:
  clusterIP: None
  selector:
    app: postgres
```

#### Job & CronJob
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
spec:
  ttlSecondsAfterFinished: 86400  # 执行完成后保留 24h
  backoffLimit: 3                 # 最多重试 3 次
  activeDeadlineSeconds: 300     # 超时 5 分钟
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migration
          image: myapp:latest
          command: ["java", "-jar", "/app/app.jar", "--spring.profiles.active=prod", "--run.migration=true"]
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup
spec:
  schedule: "0 3 * * *"          # 每天凌晨 3 点
  concurrencyPolicy: Forbid       # 不允许并发
  startingDeadlineSeconds: 300
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: postgres:15-alpine
              command:
                - /bin/sh
                - -c
                - pg_dump -h postgres-headless -U myapp myapp | gzip > /backup/db_$(date +%Y%m%d).sql.gz
          restartPolicy: OnFailure
```

#### 水平自动扩缩容（HPA）
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

---

## 6. 工程中的典型实现

### 6.1 完整 CI/CD 流水线（GitLab CI + K8s）

```yaml
# .gitlab-ci.yml
stages:
  - lint
  - test
  - build
  - image
  - deploy

variables:
  IMAGE_TAG: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
  K8S_NAMESPACE: production

lint:
  stage: lint
  image: maven:3.8-eclipse-temurin-17
  script:
    - mvn checkstyle:check

test:
  stage: test
  image: maven:3.8-eclipse-temurin-17
  services:
    - postgres:15-alpine
    - redis:7-alpine
  script:
    - mvn test -B
    - mvn jacoco:report
  artifacts:
    reports:
      junit: target/surefire-reports/*.xml
    paths:
      - target/site/jacoco/

build:
  stage: build
  image: maven:3.8-eclipse-temurin-17
  script:
    - mvn package -DskipTests -B
  artifacts:
    paths:
      - target/*.jar

image:
  stage: image
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -t $IMAGE_TAG .
    - docker push $IMAGE_TAG
  only:
    - main

deploy:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - sed -i "s|IMAGE_PLACEHOLDER|$IMAGE_TAG|g" k8s/deployment.yaml
    - kubectl apply -f k8s/ --namespace=$K8S_NAMESPACE
    - kubectl rollout status deployment/myapp --namespace=$K8S_NAMESPACE --timeout=5m
  only:
    - main
```

### 6.2 容器安全实践

```dockerfile
# 安全加固 Dockerfile
FROM eclipse-temurin:17-jre-alpine

# 非 root 用户
RUN addgroup -S app && adduser -S app -G app

# 最小化依赖
RUN apk add --no-cache curl=8.5.0-r0 && \
    apk del --no-cache

# 只读根文件系统
COPY --chown=app:app app.jar /app/

USER app
WORKDIR /app

# 不使用 --privileged
# 限制 capabilities
```

```bash
# Docker 安全扫描
trivy image myapp:latest --severity HIGH,CRITICAL
docker scout cves myapp:latest

# 运行时安全
docker run --read-only \
    --cap-drop=ALL \
    --cap-add=NET_BIND_SERVICE \
    --security-opt=no-new-privileges:true \
    myapp:latest
```

### 6.3 K8s 生产配置建议

```yaml
# PodDisruptionBudget - 防止自愿中断导致全部不可用
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: myapp-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: myapp
---
# NetworkPolicy - 限制网络通信
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: myapp-network-policy
spec:
  podSelector:
    matchLabels:
      app: myapp
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: nginx
      ports:
        - port: 8080
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - port: 5432
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - port: 6379
---
# ResourceQuota - 命名空间资源限制
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    limits.cpu: "40"
    limits.memory: 80Gi
    persistentvolumeclaims: "10"
    count/services: "20"
```

---

## 7. 常见失败场景

### 7.1 Linux 相关

| 场景 | 现象 | 原因 | 解决 |
|------|------|------|------|
| 端口被占用 | 服务启动报 `Address already in use` | 前进程未正常退出或端口冲突 | `ss -tlnp \| grep <port>` 找到进程并 kill |
| 磁盘写满 | 日志报 `No space left on device` | 日志未轮转或大文件未清理 | `du -sh /*` 定位大目录，清理或扩容 |
| inode 耗尽 | `No space left on device` 但 `df -h` 正常 | 小文件太多吃光 inode | `df -i` 查看，`find . -type f \| wc -l` 统计 |
| OOM 被杀 | dmesg 显示 `Out of memory: Kill process` | 内存超配，触发 OOM Killer | 增加内存或优化内存使用，配置 swap 或 cgroup 限制 |
| ulimit 不足 | `Too many open files` | 进程打开文件数超出系统限制 | `/etc/security/limits.conf` 调大 `nofile` |
| TCP 端口耗尽 | 连接报错，`netstat` 大量 TIME_WAIT | 短连接过多，端口未及时回收 | 启用 `tcp_tw_reuse`，改用长连接或连接池 |
| SSH 连接慢 | `ssh` 卡住数秒后连接 | DNS 反向解析超时 | `/etc/ssh/sshd_config` 中 `UseDNS no` |

### 7.2 Docker 相关

| 场景 | 现象 | 原因 | 解决 |
|------|------|------|------|
| 镜像构建慢 | 每次构建都重新下载依赖 | 未合理利用缓存或层顺序不当 | 先 COPY pom.xml 再 COPY src |
| 容器重启循环 | `CrashLoopBackOff` | 应用启动失败被 Docker 自动重启 | `docker logs` 查看错误，修复后重新部署 |
| 镜像体积大 | 镜像 GB 级 | 构建产物包含编译工具 | 使用多阶段构建，仅复制运行所需 |
| 容器磁盘持续增长 | 容器磁盘占满 | 日志写到容器层 | 使用 Volume 持久化日志，启用日志轮转 |
| 网络性能差 | bridge 模式延迟高 | NAT 转发开销 | 使用 host 网络或 macvlan |
| 时间不同步 | 容器内时间与宿主机不一致 | 容器不共享宿主机的 time Namespace | 挂载 `/etc/localtime`，或使用 `TZ` 环境变量 |

### 7.3 Kubernetes 相关

| 场景 | 现象 | 原因 | 解决 |
|------|------|------|------|
| Pod 一直是 Pending | `kubectl get pods` 显示 Pending | 资源不足、PVC 未绑定、节点选择器不匹配 | `kubectl describe pod` 查看 Events |
| Pod 反复重启 | CrashLoopBackOff | 应用崩溃或健康检查失败 | `kubectl logs --previous` 查看上次日志 |
| 镜像拉取失败 | ImagePullBackOff | 镜像名错误、认证失败、镜像不存在 | `kubectl describe pod` 查看，`docker pull` 手动测试 |
| 服务不通 | 访问 Service ClusterIP 超时 | Pod 未就绪、kube-proxy 规则未更新 | `kubectl get endpoints` 检查后端是否在线 |
| Ingress 不生效 | 访问域名报 404/503 | Ingress Controller 未部署或配置错误 | 检查 Ingress Controller 日志，确认 Annotation 正确 |
| HPA 不扩缩 | CPU 高但副本数不变 | metrics-server 未部署或 metric 延迟 | `kubectl top pods` 确认指标是否正常 |
| 滚动更新卡住 | 新 Pod 一直没 Ready | readinessProbe 配置错误 | `kubectl rollout status` 查看状态，调整 probe 参数 |
| 集群节点 NotReady | Node 状态 NotReady | kubelet 故障或网络问题 | `journalctl -u kubelet` 查看错误 |

### 7.4 Nginx 相关

| 场景 | 原因 | 解决方法 |
|------|------|----------|
| 502 Bad Gateway | 上游服务挂了或连接超时 | 检查上游健康状态，增大 `proxy_read_timeout` |
| 504 Gateway Timeout | 上游响应超时 | 增大 `proxy_read_timeout`，排查上游慢查询 |
| 413 Request Entity Too Large | 请求体超过 `client_max_body_size` | 增大配置值 |
| SSL 证书过期 | 浏览器报安全警告 | 使用 certbot 自动续期 |

---

## 8. 如何调试

### 8.1 Linux 调试三板斧

```bash
# 1. 看资源
top -H                # 看哪个线程耗 CPU
free -h               # 内存剩余
iostat -x 1           # 磁盘 IO
ss -s                 # 网络连接概况

# 2. 看日志
journalctl -u myapp -f --since "5 min ago"
tail -f /var/log/myapp/app.log

# 3. 看进程
strace -p PID -f -e trace=network -T   # 跟踪系统调用
perf top -p PID                        # 性能采样
gdb -p PID                             # 调试进程（需符号）
```

### 8.2 Docker 调试

```bash
# 查看容器资源占用
docker stats --no-stream $(docker ps -q)

# 检查容器内进程
docker top myapp
docker exec -it myapp ps aux

# 查看容器配置
docker inspect myapp | jq '.[0].HostConfig'

# 复制文件出来
docker cp myapp:/app/logs/app.log ./app.log

# 导出容器层差异
docker diff myapp

# 进入容器调试网络
docker exec -it myapp ip addr
docker exec -it myapp curl localhost:8080/health
docker exec -it myapp ping db

# 启动临时调试容器
docker run --rm -it --network container:myapp nicolaka/netshoot
```

### 8.3 Kubernetes 调试

```bash
# 查看 Pod 详细信息
kubectl describe pod myapp-7d4f8b9c6c-abc12

# 查看日志（含上一次崩溃的）
kubectl logs myapp-7d4f8b9c6c-abc12 --previous
kubectl logs -l app=myapp --tail=100 -f

# 端口转发到本地
kubectl port-forward pod/myapp-7d4f8b9c6c-abc12 8080:8080

# 启动调试容器
kubectl run debug --rm -it --image=nicolaka/netshoot -- /bin/bash

# 在 Pod 所在节点上调试
kubectl debug node/node01 -it --image=ubuntu

# 临时加入 Sidecar
kubectl debug myapp-7d4f8b9c6c-abc12 -it \
    --image=nicolaka/netshoot \
    --copy-to=myapp-debug

# 查看集群事件
kubectl get events --sort-by='.lastTimestamp' | tail -20

# 检查资源使用
kubectl top pods -n production
kubectl top nodes

# 查看 API 资源
kubectl api-resources
kubectl explain deployment.spec
```

---

## 9. 如何测试

### 9.1 Linux 脚本测试

```bash
# 使用 shellcheck 静态分析
shellcheck deploy.sh

# 异常测试：磁盘满时脚本行为
dd if=/dev/zero of=/tmp/test.img bs=1M count=100
./deploy.sh; echo "Exit code: $?"

# 权限测试
sudo -u nobody ./deploy.sh
```

### 9.2 Docker 测试

```bash
# 构建检查
docker build --no-cache -t myapp:test .
docker run --rm myapp:test java -version

# 安全扫描
trivy image myapp:latest

# 镜像尺寸检查
docker images | grep myapp

# 功能测试
docker run -d --name test -p 8080:8080 myapp:test
sleep 10
curl -sf http://localhost:8080/health
docker rm -f test
```

### 9.3 K8s 测试

```bash
# 配置验证（dry-run）
kubectl apply -f k8s/ --dry-run=client -o yaml

# 模拟调度
kubectl create deployment test --image=myapp:test --dry-run=client -o yaml

# 集成测试（使用 kind / minikube）
kind create cluster
kubectl apply -f k8s/
kubectl wait --for=condition=available --timeout=60s deployment/myapp

# 网络测试
kubectl run test-pod --rm -it --image=curlimages/curl -- sh
curl http://myapp-service/health

# 扩缩容测试
kubectl scale deployment myapp --replicas=5
kubectl get pods -w
```

### 9.4 CI 集成测试示例

```yaml
# docker-compose.test.yml
version: "3.8"
services:
  app:
    build: .
    environment:
      - SPRING_PROFILES_ACTIVE=test
      - DB_URL=jdbc:postgresql://db:5432/test
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:8080/health"]

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
```

```bash
# CI 测试脚本
docker compose -f docker-compose.test.yml up -d
docker compose -f docker-compose.test.yml run --rm \
    --entrypoint="curl -sf http://app:8080/health" app
docker compose -f docker-compose.test.yml down -v
```

---

## 10. 如何监控

### 10.1 Linux 监控

| 指标 | 命令/工具 | 说明 |
|------|-----------|------|
| CPU 使用率 | `top`, `htop`, `mpstat -P ALL 1` | 用户态、系统态、IOWait |
| 内存 | `free -h`, `vmstat 1` | 总内存、已用、缓存、Swap |
| 磁盘 | `iostat -x 1`, `df -h` | IOPS、吞吐率、%util、空间 |
| 网络 | `sar -n DEV 1`, `iftop` | 带宽、丢包、重传率 |
| 进程 | `ps aux`, `pidstat` | 各进程资源消耗 |
| 系统日志 | `journalctl`, `/var/log/messages` | 内核和系统服务的日志 |

### 10.2 Docker 监控

```bash
# 实时监控
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# 日志监控
docker logs --tail=100 -f myapp | grep -i error

# Prometheus 集成
docker run -d --name=cadvisor \
    --volume=/:/rootfs:ro \
    --volume=/var/run:/var/run:ro \
    --volume=/sys:/sys:ro \
    --volume=/var/lib/docker/:/var/lib/docker:ro \
    --publish=8080:8080 \
    gcr.io/cadvisor/cadvisor
```

### 10.3 Kubernetes 监控

#### 基础监控：kubectl top
```bash
kubectl top nodes
kubectl top pods -n production
```

#### Prometheus + Grafana 生态
```yaml
# Prometheus 采集配置示例
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp-monitor
spec:
  selector:
    matchLabels:
      app: myapp
  endpoints:
    - port: metrics
      interval: 15s
      path: /actuator/prometheus
```

#### 关键监控指标

| 层面 | 指标 | 说明 |
|------|------|------|
| Pod | container_cpu_usage_seconds_total | CPU 使用量 |
| Pod | container_memory_working_set_bytes | 内存使用量 |
| 集群 | kube_node_status_condition | 节点健康状态 |
| 应用 | http_requests_total | 请求量 |
| 应用 | http_request_duration_seconds | 延迟（P50/P95/P99） |
| 应用 | http_requests_total{status=~"5.."} | 错误率 |
| 部署 | kube_deployment_status_replicas | 期望/当前/可用副本数 |
| 应用 | up | 应用存活性 |

#### 告警规则示例
```yaml
groups:
  - name: myapp-alerts
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{job="myapp",status=~"5.."}[5m]))
          /
          sum(rate(http_requests_total{job="myapp"}[5m]))
          > 0.01
        for: 5m
        annotations:
          summary: "Error rate > 1% for 5 minutes"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.99,
            rate(http_request_duration_seconds_bucket{job="myapp"}[5m])
          ) > 2
        for: 5m
        annotations:
          summary: "P99 latency > 2s"

      - alert: PodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total[15m]) > 0
        for: 5m
        labels:
          severity: critical
```

---

## 11. 常见面试问题

### Linux 基础
1. Linux 启动过程是怎样的？（BIOS → Bootloader → Kernel → init → 服务）
2. 硬链接和软链接的区别是什么？
3. 如何排查 CPU 负载高的问题？
4. `kill` 和 `kill -9` 的区别，SIGTERM 和 SIGKILL 的适用场景？
5. Linux 文件权限中的 SUID、SGID、Sticky Bit 分别是什么？
6. 进程和线程的区别？如何查看线程？
7. `/proc` 文件系统的作用？如何通过 `/proc` 调优内核参数？
8. OOM Killer 的工作原理？如何避免关键进程被 kill？
9. Swap 分区的作用？生产环境该不该用 Swap？
10. Linux 网络数据包从应用到网卡的完整路径是怎样的？

### Shell 脚本
1. `set -e` / `set -u` / `set -o pipefail` 的作用？
2. 如何安全处理 Shell 脚本中的变量扩展？
3. 如何并行执行多个后台进程并等待全部完成？
4. `$@` 和 `$*` 区别？
5. shellcheck 的使用经验？

### Nginx
1. Nginx 如何处理请求（Worker 进程模型）？
2. 什么是 C10K 问题？Nginx 如何解决？
3. Nginx 的负载均衡策略有哪些？
4. 如何配置 WebSocket 反向代理？
5. 如何实现蓝绿部署？

### Docker
1. 镜像层和容器的关系？写时复制（Copy-on-Write）原理？
2. Docker 的网络模式有哪些？原理是什么？
3. Docker Volume 和 Bind Mount 的区别和选择依据？
4. 如何优化 Docker 镜像体积？
5. 多阶段构建的原理和优势？
6. docker build 缓存失效的原因？
7. 如何调试一个不启动的容器？
8. Docker 安全方面需要注意哪些？

### Docker Compose
1. depends_on 的 condition 有哪些？各有什么用途？
2. 如何管理多环境配置（dev/staging/prod）？
3. Compose 文件中的 volumes 和 secrets 有什么区别？

### CI/CD
1. CI 和 CD 的区别？
2. 如何保证部署过程中的零停机？
3. 回滚策略有哪些？（快速回滚、渐进式回滚）
4. 蓝绿部署、滚动部署、金丝雀部署的区别和选择？
5. 构建产物应该是什么？如何保证构建的不可变性和可追溯性？
6. GitOps 的核心思想是什么？

### Kubernetes
1. Pod 的工作原理？Pod 与容器的关系？
2. Deployment 的滚动更新策略参数（maxSurge/maxUnavailable）的含义？
3. Service 的 ClusterIP、NodePort、LoadBalancer 的区别？
4. Service 的 iptables 和 IPVS 模式区别？
5. Ingress 和 Service 的关系？
6. ConfigMap 和 Secret 的使用方式？Secret 的安全性如何？
7. StatefulSet 和 Deployment 的区别？什么场景使用 StatefulSet？
8. 如何实现灰度发布（Canary Deployment）？
9. HPA 的扩缩容策略？stabilizationWindowSeconds 的作用？
10. 健康检查 Probe 的三种类型（liveness/readiness/startup）的区别和配置建议？
11. Pod 的调度过程是怎样的？
12. 如何排查 Pod 一直 Pending 的问题？
13. etcd 的架构和角色？为什么 K8s 使用 etcd 而不是数据库？
14. K8s 的控制器模式是什么？事件驱动的控制循环如何工作？
15. 什么是 Operator？与 Helm 的区别？
16. Namespace 的作用？如何用 RBAC + NetworkPolicy 实现多租户隔离？

---

## 12. 在我的项目中如何使用

### 本地开发环境

项目根目录下使用 `docker-compose.yml` 一键启动所有依赖（数据库、缓存、消息队列）和后端应用：

```bash
# 开发环境
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 查看日志
docker compose logs -f app
```

### CI 流水线（GitLab CI / GitHub Actions）

每次提交自动执行：
1. 代码检查与单元测试
2. 构建 JAR 包
3. 构建 Docker 镜像并推送到镜像仓库
4. 自动部署到开发/测试环境
5. 集成测试
6. 手动确认后部署到预发布环境

### 生产部署

```bash
# 标准部署流程
# 1. 检查 current 版本
kubectl rollout status deployment/myapp -n production

# 2. 更新镜像
kubectl set image deployment/myapp myapp=registry.example.com/myapp:${TAG}
kubectl rollout status deployment/myapp -n production --timeout=5m

# 3. 如果失败，回滚
kubectl rollout undo deployment/myapp -n production

# 4. 验证
kubectl get pods -n production -l app=myapp
```

### 监控与告警

- 使用 Prometheus + Grafana 监控集群和应用
- 关键指标：请求量、P99 延迟、错误率、CPU/内存使用率
- 告警通知到企业微信 / Slack / PagerDuty
- 定期检查镜像安全漏洞（Trivy 扫描）
- 日志集中到 ELK / Loki + Grafana

### 基础设施即代码

- 所有 K8s 资源 YAML 保存在项目代码仓库中
- 使用 Helm 管理应用 Chart（可选）
- 使用 ArgoCD 实现 GitOps 部署（可选）
- 环境差异通过 Kustomize overlay 或 Helm values 管理

### 团队规范

| 规范 | 要求 |
|------|------|
| 镜像 tag | 使用 Git commit SHA，禁止使用 `latest` |
| 资源限制 | 所有容器必须配置 `requests` 和 `limits` |
| 健康检查 | 每个服务必须实现 `/health` 和 `/ready` |
| 日志 | 输出到 stdout/stderr，避免写到容器内文件 |
| 优雅关闭 | 注册 SIGTERM 处理，完成正在处理的请求后再退出 |
| 配置分离 | 硬编码值必须提取到 ConfigMap / Secret |
| 安全 | 禁止使用 root 运行容器，最小化镜像层 |
