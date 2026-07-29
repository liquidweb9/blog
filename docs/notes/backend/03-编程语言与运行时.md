# 编程语言与运行时

> Java 是主力开发语言，Python 能独立开发 AI 服务。

---

## 1. 它是什么

编程语言是人与计算机之间交流的正式语言，用于编写程序指令；运行时（Runtime）是程序执行时所依赖的底层环境，负责内存管理、类型检查、垃圾回收、并发调度等基础设施。

**Java** 是一门静态强类型、基于 JVM 的面向对象语言，核心运行时是 **JVM（Java Virtual Machine）**，提供跨平台能力、自动内存管理与即时编译（JIT）。

**Python** 是一门动态强类型、解释型语言，核心运行时是 **CPython**（官方实现），提供交互式编程体验与丰富的标准库，在 AI/ML 领域占据主导地位。

---

## 2. 为什么需要它

### Java
- **跨平台**：Write Once, Run Anywhere，一次编译到处运行。
- **生态成熟**：Spring、Netty、Kafka 等企业级框架围绕 JVM 构建。
- **高性能**：JIT 编译将热点代码编译为本地机器码，性能接近 C++。
- **强类型安全**：编译器在早期捕获类型错误，降低线上故障率。
- **大厂主流**：后端服务、分布式系统、大数据场景首选语言。

### Python
- **开发效率高**：语法简洁，动态特性灵活，适合快速迭代。
- **AI/ML 生态**：PyTorch、TensorFlow、scikit-learn、LangChain 等全部以 Python 为第一公民。
- **胶水语言**：可轻松调用 C/C++ 扩展（numpy、pandas 底层）。
- **自动内存管理**：引用计数 + 分代 GC，开发者无需手动管理内存。
- **社区活跃**：PyPI 上有超过 40 万个包，几乎覆盖所有领域。

---

## 3. 它解决什么问题

| 问题领域 | Java 解决方式 | Python 解决方式 |
|----------|---------------|-----------------|
| 跨平台部署 | JVM 字节码 + 统一运行时 | 解释器 + 虚拟环境 |
| 并发编程 | `java.util.concurrent` 包 + 多线程 | `asyncio` / `multiprocessing` |
| 类型安全 | 编译时泛型 + 静态类型 | `typing` 模块 + mypy / Pyright |
| 内存泄漏 | GC + 强/软/弱/虚引用 | 引用计数 + 循环检测 GC |
| 微服务通信 | Spring Boot / gRPC / Dubbo | FastAPI / gRPC |
| AI 服务推理 | Deep Java Library (DJL) | PyTorch / ONNX Runtime |

---

## 4. 核心原理

### 4.1 Java 核心原理

#### JVM 内存模型（JMM）

```
┌─────────────────────────────────────────┐
│             堆 (Heap)                     │
│  ┌───────┐ ┌───────┐ ┌───────┐         │
│  │ Young  │ │  Old  │ │ Meta  │         │
│  │ Gen    │ │  Gen  │ │ Space │         │
│  └───────┘ └───────┘ └───────┘         │
├─────────────────────────────────────────┤
│             栈 (Stack)                   │
│  ┌─────┐ ┌─────┐ ┌─────┐               │
│  │Frame │ │Frame │ │Frame │             │
│  └─────┘ └─────┘ └─────┘               │
├─────────────────────────────────────────┤
│    程序计数器 (PC) / 本地方法栈          │
│    元空间 (Metaspace) / 直接内存         │
└─────────────────────────────────────────┘
```

- **堆**：所有对象实例分配在此，GC 管理区域。
- **栈**：每个线程私有，存储局部变量、操作数栈、动态链接。
- **元空间**：JDK 8+ 取代永久代，存储类元数据，使用本地内存。
- **直接内存**：NIO 使用的堆外内存，避免 JVM 堆与 OS 之间的拷贝。

#### 类加载机制

```
加载 → 验证 → 准备 → 解析 → 初始化 → 使用 → 卸载
```

- **双亲委派模型**：自底向上检查类是否已加载，自顶向下尝试加载类。
- 打破双亲委派：自定义 ClassLoader 重写 `loadClass()`（如 Tomcat、Spring Boot DevTools）。
- **SPI 机制**：`ServiceLoader` 通过线程上下文类加载器打破双亲委派。

#### 垃圾回收（GC）

| GC 名称 | 适用场景 | 特点 |
|---------|----------|------|
| Serial GC | 单线程、小堆 | 简单、停顿时间长 |
| Parallel GC | 多线程、吞吐优先 | 高吞吐、暂停较长 |
| CMS | 低延迟响应 | 并发标记-清除、碎片化 |
| G1 | 大堆、平衡吞吐与延迟 | 分区式、可预测停顿 |
| ZGC | 超大堆、亚毫秒停顿 | 染色指针、并发整理 |
| Shenandoah | 超大堆、低停顿 | 并发整理、与 ZGC 竞争 |

#### 字节码与 JIT

Java 源码 → `javac` → `.class` 字节码 → JVM 解释执行 → **热点代码** → C1/C2/Graal JIT 编译器 → 本地机器码。

- **C1 (Client Compiler)**：快速编译，适用于启动阶段。
- **C2 (Server Compiler)**：深度优化，适用于长期运行的服务。
- **Graal JIT**：新一代 JIT，支持 Ahead-of-Time (AOT) 编译。

### 4.2 Python 核心原理

#### CPython 运行时

```
Python 源码 → 解析器 → AST → 编译器 → 字节码 (.pyc) → 虚拟机执行
```

- **字节码**：存储在 `__pycache__/` 目录，扩展名 `.pyc`。
- **PyObject**：所有 Python 对象的基础结构体，包含引用计数和类型指针。
- **全局解释器锁（GIL）**：CPython 中的互斥锁，确保同一时刻只有一个线程执行 Python 字节码。

#### GIL 的工作原理

```
线程 A 持有 GIL  →  执行字节码  →  释放 GIL（I/O、ticks、或主动释放）
                                                        ↓
线程 B 等待 GIL  ←  获得 GIL  ←  被唤醒
```

- GIL 通过 `sys.setswitchinterval()` 控制线程切换频率（默认 5ms）。
- 释放 GIL 的场景：I/O 操作、C 扩展调用（如 `numpy`、`pandas`）、`time.sleep()`。

#### 垃圾回收

- **引用计数**（主要）：`PyObject` 中的 `ob_refcnt`，为 0 时立即回收。
- **循环检测 GC**（辅助）：`gc` 模块处理引用循环（如双向链表）。
- **分代回收**：0 代（年轻）、1 代、2 代，越老的对象回收频率越低。

---

## 5. 基本使用方法

### 5.1 Java

#### 集合框架

```java
// List
List<String> list = new ArrayList<>();   // 数组实现，随机访问快
List<String> linked = new LinkedList<>(); // 链表实现，插入删除快

// Set
Set<String> set = new HashSet<>();         // 无序，O(1)
Set<String> treeSet = new TreeSet<>();     // 有序，红黑树

// Map
Map<String, Integer> map = new HashMap<>();    // 无序，O(1)
Map<String, Integer> linkedMap = new LinkedHashMap<>(); // 插入顺序
Map<String, Integer> treeMap = new TreeMap<>(); // 自然顺序
```

#### 泛型

```java
// 泛型类
public class Box<T> {
    private T value;
    public T get() { return value; }
    public void set(T value) { this.value = value; }
}

// 通配符
List<? extends Number> reader = new ArrayList<Integer>(); // 上界，读安全
List<? super Integer> writer = new ArrayList<Number>();   // 下界，写安全

// 类型擦除：编译后泛型信息被擦除，运行时无泛型类型
```

#### Lambda 与 Stream

```java
// Lambda
list.stream()
    .filter(s -> s.startsWith("A"))
    .map(String::toUpperCase)
    .sorted()
    .collect(Collectors.toList());

// 并行流
list.parallelStream()
    .filter(s -> expensiveCheck(s))
    .collect(Collectors.toList());
```

#### I/O 与 NIO

```java
// BIO
try (BufferedReader reader = new BufferedReader(new FileReader("file.txt"))) {
    String line;
    while ((line = reader.readLine()) != null) {
        System.out.println(line);
    }
}

// NIO
try (FileChannel channel = FileChannel.open(Paths.get("file.txt"), StandardOpenOption.READ)) {
    ByteBuffer buffer = ByteBuffer.allocate(1024);
    while (channel.read(buffer) > 0) {
        buffer.flip();
        while (buffer.hasRemaining()) {
            System.out.print((char) buffer.get());
        }
        buffer.clear();
    }
}
```

#### 注解与反射

```java
// 定义注解
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface JsonField {
    String value() default "";
}

// 使用反射
for (Field field : obj.getClass().getDeclaredFields()) {
    JsonField annotation = field.getAnnotation(JsonField.class);
    if (annotation != null) {
        field.setAccessible(true);
        String jsonValue = field.get(obj).toString();
        // 序列化逻辑
    }
}
```

### 5.2 Python

#### 类型系统

```python
# 基本类型注解
name: str = "Python"
count: int = 42
rate: float = 3.14
active: bool = True

# 容器类型
from typing import List, Dict, Optional, Union, Any
users: List[str] = ["alice", "bob"]
scores: Dict[str, int] = {"alice": 95}
maybe: Optional[str] = None  # str | None
uid: Union[int, str] = "42"  # int | str

# 类型别名
UserId = int
UserMap = Dict[UserId, str]
```

#### 装饰器

```python
from functools import wraps
import time

def timer(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.3f}s")
        return result
    return wrapper

@timer
def slow_function():
    time.sleep(1)
```

#### 生成器

```python
def read_large_file(filepath: str):
    """逐行读取大文件，内存友好"""
    with open(filepath) as f:
        for line in f:
            yield line.strip()

# 生成器表达式
squares = (x * x for x in range(10_000_000))
```

#### 上下文管理器

```python
# 自定义上下文管理器
class DatabaseConnection:
    def __enter__(self):
        self.conn = connect("...")
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.conn.close()

# 使用 contextlib
from contextlib import contextmanager

@contextmanager
def transaction(session):
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
```

#### asyncio 协程

```python
import asyncio
import aiohttp

async def fetch(url: str) -> str:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.text()

async def main():
    urls = ["https://api.example.com/a", "https://api.example.com/b"]
    tasks = [fetch(url) for url in urls]
    results = await asyncio.gather(*tasks)
    print(results)

asyncio.run(main())
```

#### 异常处理

```python
class BusinessError(Exception):
    """业务异常基类"""
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(f"[{code}] {message}")

def process(data: dict) -> str:
    try:
        value = data["key"]
        return validate(value)
    except KeyError as e:
        raise BusinessError(400, f"缺少字段: {e}") from e
    except ValueError as e:
        raise BusinessError(422, f"字段无效: {e}") from e
```

#### 数据校验（Pydantic）

```python
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    age: int = Field(ge=0, le=150)
    created_at: Optional[datetime] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("无效的邮箱地址")
        return v.lower()

# 使用
user = UserCreate(username="alice", email="ALICE@Example.com", age=30)
print(user.model_dump())  # age=30, email="alice@example.com"
```

---

## 6. 工程中的典型实现

### 6.1 Java 项目结构（Spring Boot + Maven/Gradle）

```
my-service/
├── src/
│   ├── main/java/com/example/
│   │   ├── config/           # 配置类
│   │   ├── controller/       # REST 控制器
│   │   ├── service/          # 业务逻辑
│   │   ├── repository/       # 数据访问（MyBatis / JPA）
│   │   ├── model/            # 实体 / DTO
│   │   ├── infra/            # 基础设施（缓存、MQ、RPC 客户端）
│   │   └── Application.java  # 启动类
│   ├── main/resources/
│   │   ├── application.yml
│   │   └── mapper/           # MyBatis XML
│   └── test/java/
├── pom.xml  /  build.gradle
├── Dockerfile
└── .github/workflows/ci.yml
```

#### Maven（pom.xml）

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.0</version>
</parent>

<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.mybatis.spring.boot</groupId>
        <artifactId>mybatis-spring-boot-starter</artifactId>
    </dependency>
</dependencies>
```

#### Gradle（build.gradle.kts）

```kotlin
plugins {
    id("org.springframework.boot") version "3.2.0"
    id("io.spring.dependency-management") version "1.1.4"
    kotlin("jvm") version "1.9.20"
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.mybatis.spring.boot:mybatis-spring-boot-starter:3.0.3")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
```

### 6.2 Python 项目结构（FastAPI + AI 服务）

```
ai-service/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 入口
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       └── inference.py  # AI 推理接口
│   ├── core/
│   │   ├── config.py         # Pydantic Settings
│   │   └── logging.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── schemas.py        # Pydantic 请求/响应模型
│   │   └── huggingface.py    # 模型加载 & 推理
│   └── infra/
│       ├── redis_client.py
│       └── metrics.py
├── tests/
├── pyproject.toml
├── Dockerfile
└── README.md
```

#### 虚拟环境与依赖

```bash
# 创建虚拟环境
python -m venv .venv

# 激活（Windows PowerShell）
.venv\Scripts\Activate.ps1

# 安装依赖
pip install -r requirements.txt

# 或者使用 Poetry
poetry new ai-service
poetry add fastapi uvicorn pydantic-settings
poetry add --group dev pytest pytest-cov mypy

# 导出 requirements.txt
poetry export -f requirements.txt --output requirements.txt
```

---

## 7. 常见失败场景

### 7.1 Java 失败场景

| 场景 | 原因 | 解决 |
|------|------|------|
| **OOM: Java heap space** | 堆内存泄漏或配置不足 | dump 分析 + `-Xmx` 调整 |
| **OOM: Metaspace** | 类加载过多（热部署/动态代理） | 检查 ClassLoader 泄漏 |
| **OOM: Direct buffer memory** | NIO DirectByteBuffer 未释放 | 使用 `-XX:MaxDirectMemorySize` 限制 |
| **StackOverflowError** | 递归过深或线程栈太小 | 检查递归 + `-Xss` 调整 |
| **ConcurrentModificationException** | 遍历集合时修改 | 使用 `CopyOnWriteArrayList` 或迭代器 `remove` |
| **NoClassDefFoundError** | 类路径缺失或静态初始化失败 | 检查依赖冲突 + `-verbose:class` |
| **OutOfMemoryError: GC overhead limit** | GC 占用 98%+ 时间但回收 < 2% 堆 | dump 分析，更换 GC 算法 |
| **java.lang.UnsupportedOperationException** | `Arrays.asList()` 返回固定长度 List | 用 `new ArrayList<>(Arrays.asList(...))` |

### 7.2 Python 失败场景

| 场景 | 原因 | 解决 |
|------|------|------|
| **GIL 导致 CPU 密集型性能差** | 多线程无法并行利用多核 | 改用 `multiprocessing` 或 C 扩展 |
| **RecursionError** | 递归深度超过默认限制（1000） | `sys.setrecursionlimit()` 或改用迭代 |
| **ImportError / ModuleNotFoundError** | 虚拟环境未激活或路径问题 | `pip list` 检查 + `sys.path` 调试 |
| **Event loop closed** | asyncio 事件循环管理不当 | 使用 `asyncio.run()` 确保正确清理 |
| **Pydantic ValidationError** | 入参校验失败 | 自定义 `@field_validator` + 友好错误提示 |
| **TypeError: 'NoneType' object is not callable** | 装饰器未正确使用 `@wraps` | 检查装饰器返回值是否丢失 |
| **MemoryError** | 大对象加载到内存（如整个文件） | 使用生成器 / mmap 流式处理 |
| **RuntimeError: asyncio.run() cannot be called from a running event loop** | 嵌套事件循环 | 使用 `nest_asyncio` 或重构代码 |

---

## 8. 如何调试

### 8.1 Java 调试

#### JDK 内置工具

```bash
# 查看 JVM 进程
jps -l

# 堆转储
jmap -dump:live,format=b,file=heap.hprof <pid>

# 线程栈
jstack <pid> > thread.dump

# GC 日志 (JDK 8)
-XX:+PrintGCDetails -XX:+PrintGCDateStamps -Xloggc:gc.log

# GC 日志 (JDK 11+) - 统一日志
-Xlog:gc*:file=gc.log:time,uptime,level,tags
```

#### 远程调试

```bash
# JVM 参数
-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005
```

#### Arthas（阿里开源诊断工具）

```bash
# 线上诊断
java -jar arthas-boot.jar

# 观察方法调用
watch com.example.service.UserService getUser '{params, returnObj, throwExp}' -x 3

# 火焰图
profiler start
profiler stop --format html
```

### 8.2 Python 调试

#### 基础调试

```python
import pdb; pdb.set_trace()  # 断点

# Python 3.7+ (breakpoint 内置)
breakpoint()
```

#### PDB 命令

| 命令 | 说明 |
|------|------|
| `n` (next) | 下一步 |
| `s` (step) | 进入函数 |
| `c` (continue) | 继续执行 |
| `p var` | 打印变量 |
| `l` (list) | 查看当前代码 |
| `q` (quit) | 退出 |

#### 高级调试

```bash
# 使用 ipdb 增强调试
pip install ipdb
# 代码中: import ipdb; ipdb.set_trace()

# 使用 PyCharm 远程调试
# Run → Edit Configurations → Python Remote Debug

# 调试 asyncio
python -m asyncio debug_script.py
```

#### 性能分析

```bash
# cProfile 分析
python -m cProfile -o output.prof my_script.py
python -m pstats output.prof  # 交互式分析

# py-spy（无需修改代码，采样分析）
py-spy record -o profile.svg --pid <pid>  # 火焰图
py-spy top --pid <pid>                    # 实时热点
```

---

## 9. 如何测试

### 9.1 Java 测试

```java
// JUnit 5 + Mockito
@SpringBootTest
@AutoConfigureMockMvc
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Test
    void shouldReturnUserWhenExists() throws Exception {
        // given
        var user = new UserResponse(1L, "alice", "alice@example.com");
        given(userService.getUser(1L)).willReturn(user);

        // when & then
        mockMvc.perform(get("/api/v1/users/1"))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$.username").value("alice"));
    }

    @Test
    void shouldThrowWhenUserNotFound() {
        given(userService.getUser(999L)).willThrow(new UserNotFoundException(999L));

        assertThrows(UserNotFoundException.class, () -> userService.getUser(999L));
    }
}
```

```java
// 参数化测试
@ParameterizedTest
@ValueSource(strings = {"racecar", "radar", "level"})
void shouldDetectPalindromes(String candidate) {
    assertTrue(PalindromeChecker.isPalindrome(candidate));
}
```

### 9.2 Python 测试

```python
# pytest + pytest-asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_inference_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/inference", json={
            "text": "Hello, world!",
            "language": "en"
        })
    assert response.status_code == 200
    data = response.json()
    assert "result" in data

# 使用 pytest fixture
@pytest.fixture
def mock_redis(mocker):
    return mocker.patch("app.infra.redis_client.get_redis")

def test_cache_hit(mock_redis):
    mock_redis.return_value = {"cached": True}
    # ... 测试逻辑
```

```bash
# 运行测试
pytest tests/ -v --cov=app --cov-report=term-missing

# mypy 类型检查
mypy app/ --strict

# ruff 代码检查
ruff check app/ tests/
```

### 测试金字塔策略

```
         /\
        /  \        UI / E2E 测试（少量）
       /    \
      /      \     集成测试（中间层）
     /        \
    /__________\   单元测试（大量，核心）
```

---

## 10. 如何监控

### 10.1 JVM 监控

#### 关键指标

| 指标 | 说明 | 获取方式 |
|------|------|----------|
| Heap Used / Max | 堆使用率 | JMX `java.lang:type=Memory` |
| GC Count / Pause | GC 次数与停顿 | JMX `GarbageCollectorMXBean` |
| Thread Count | 活动线程数 | JMX `ThreadingMXBean` |
| CPU / Load | JVM CPU 使用率 | OS API / `OperatingSystemMXBean` |
| Class Loading | 加载/卸载类数量 | JMX `ClassLoadingMXBean` |

#### Spring Boot Actuator + Micrometer

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus
  metrics:
    export:
      prometheus:
        enabled: true
```

```java
// 自定义指标
@Bean
public MeterRegistryCustomizer<MeterRegistry> metricsCommonTags() {
    return registry -> registry.config().commonTags("application", "my-service");
}

// 使用 Micrometer Counter
Counter requestCounter = Counter.builder("api.requests")
    .tag("endpoint", "/users")
    .register(registry);
```

#### 推荐监控方案

```
JVM → Micrometer → Prometheus → Grafana
                            ↓
                      Alertmanager → 钉钉/飞书/邮件
```

### 10.2 Python 监控

#### 关键工具

```python
# prometheus_client
from prometheus_client import Counter, Histogram, generate_latest, REGISTRY
from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
import time

app = FastAPI()

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"]
)

REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration",
    ["method", "endpoint"]
)

class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()
        REQUEST_DURATION.labels(
            method=request.method,
            endpoint=request.url.path
        ).observe(duration)
        return response

@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(REGISTRY), media_type="text/plain")
```

#### 结构化日志

```python
# structlog + JSON 日志
import structlog

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger()
logger.info("user_registered", user_id=42, email="alice@example.com")
```

---

## 11. 常见面试问题

### 11.1 Java

| 问题 | 核心要点 |
|------|----------|
| HashMap 实现原理 | 数组 + 链表 + 红黑树，扩容因子 0.75，put 流程 |
| ConcurrentHashMap 分段锁 vs CAS | JDK 7 分段锁 → JDK 8 synchronized + CAS |
| volatile 关键字 | 可见性（MESI）+ 禁止指令重排（内存屏障） |
| synchronized 原理 | 偏向锁 → 轻量锁 → 重量锁（锁升级） |
| ThreadLocal 内存泄漏 | Entry 的 key 是 WeakReference，需手动 remove |
| AQS 原理 | CLH 队列 + state + 独占/共享模式 |
| Spring 循环依赖 | 三级缓存（singletonObjects / earlySingletonObjects / singletonFactories） |
| MyBatis 一级缓存 vs 二级缓存 | SqlSession 级别 vs Mapper namespace 级别 |
| 强引用/软引用/弱引用/虚引用 | GC 回收策略差异，WeakHashMap 应用 |
| CMS 与 G1 区别 | 并发标记 vs 分区式，停顿时间可控 |

### 11.2 Python

| 问题 | 核心要点 |
|------|----------|
| GIL 如何影响性能 | CPU 密集无法并行，I/O 密集不受影响 |
| 浅拷贝 vs 深拷贝 | `copy.copy` vs `copy.deepcopy`，递归复制 vs 引用复制 |
| `__init__` vs `__new__` | `__new__` 创建实例，`__init__` 初始化实例（单例模式） |
| 元类（Metaclass） | `type` 的子类，控制类的创建行为（ORM 模型） |
| 协程 vs 线程 | 协程用户态切换，线程内核态切换，协程无锁竞争 |
| `async/await` 实现原理 | 基于生成器的协程 → 原生协程（`__await__` 协议） |
| `__slots__` | 减少实例内存占用，禁止动态添加属性 |
| Python 参数传递 | 对象引用传递（可变对象 vs 不可变对象） |
| MRO 与 C3 线性化 | `super()` 方法解析顺序，钻石继承避免重复调用 |
| WSGI vs ASGI | WSGI 同步，ASGI 异步（FastAPI / Starlette） |

---

## 12. 在我的项目中如何使用

### 12.1 Java 后端服务

- **主力语言**：所有核心后端服务使用 Java 17/21，Spring Boot 3.x，基于微服务架构。
- **集合/Stream**：日常 CRUD 业务大量使用 Stream API 处理集合数据，配合 `Optional` 避免 NPE。
- **Lambda + 函数式**：在事件处理、策略模式、回调场景中使用 Lambda 简化代码。
- **并发编程**：使用 `ThreadPoolExecutor` + `CompletableFuture` 处理异步任务；使用 `ConcurrentHashMap` 缓存热点数据。
- **I/O 密集**：Netty/Reactor 构建高吞吐网关，NIO `FileChannel` 处理大文件传输。
- **JVM 调优**：生产环境使用 G1 GC，堆大小根据服务规格配置（4C8G → `-Xms4g -Xmx4g`），GC 日志接入 ELK。
- **问题排查**：线上故障使用 Arthas 热诊断 + heap dump 分析（Eclipse MAT）。
- **构建工具**：统一使用 Maven（老项目）和 Gradle（新项目，Kotlin DSL）。

### 12.2 Python AI 服务

- **AI 推理服务**：FastAPI + Pydantic 构建模型推理接口，支持 PyTorch / ONNX 运行时。
- **数据管线**：使用 Pydantic 做数据校验与序列化，确保模型输入输出的正确性。
- **异步并发**：asyncio + `httpx` 处理高并发推理请求，避免 GIL 阻塞。
- **多进程**：CPU 密集型预处理使用 `multiprocessing.Pool` + `concurrent.futures`。
- **依赖管理**：Poetry 管理依赖 + 虚拟环境隔离，`pyproject.toml` 统一项目配置。
- **类型检查**：mypy strict 模式 + Pydantic 运行时校验双重保障。
- **日志与监控**：structlog 结构化日志 + Prometheus client 指标暴露 + Grafana 看板。
- **虚拟环境**：Docker 容器内使用 `python -m venv` 创建隔离环境，多阶段构建减少镜像体积。

### 12.3 技术选型决策矩阵

| 需求场景 | 推荐语言 | 关键依赖/框架 |
|----------|----------|--------------|
| 高并发 Web API | Java | Spring WebFlux / Netty |
| AI 模型推理服务 | Python | FastAPI + PyTorch / ONNX |
| 批处理 / ETL | Java / Python | Spring Batch / Apache Beam / Pandas |
| 实时流计算 | Java | Flink / Kafka Streams |
| 数据分析 / 可视化 | Python | Pandas + Matplotlib / Streamlit |
| 基础设施工具 | Python | Click / Typer CLI |
| 高吞吐网关 | Java | Spring Cloud Gateway / Netty |
| 消息队列消费者 | Java | Spring Kafka / RabbitMQ |

---

> **参考资源**
>
> - 《深入理解 Java 虚拟机》（周志明）
> - 《Java 并发编程的艺术》
> - 《Python Cookbook》（David Beazley）
> - CPython 源码分析：https://github.com/python/cpython
> - OpenJDK 源码：https://github.com/openjdk/jdk
