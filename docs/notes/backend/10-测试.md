# 测试

后端不仅要"能运行"，还要能证明它稳定可靠。

---

## 1. 它是什么

**测试** 是一套自动化或手动的验证手段，通过检查系统在给定输入下的行为是否符合预期，来保证代码的正确性、稳定性与质量。

按范围与目的可分为多个层次（测试金字塔）：

| 层次 | 名称 | 粒度 | 执行速度 | 依赖 |
|------|------|------|----------|------|
| 底层 | 单元测试 (Unit Test) | 单个函数/类 | 毫秒级 | 无外部依赖 |
| 中间 | 集成测试 (Integration Test) | 模块间交互 | 秒级 | DB、网络等 |
| 上层 | 接口测试 (API/E2E Test) | 完整请求链路 | 秒到分钟级 | 完整环境 |

此外还有数据库测试、契约测试、性能测试、压力测试、故障注入、回归测试等专项领域。

---

## 2. 为什么需要它

- **防止回归**：修改代码后，确保已有功能不被破坏。
- **文档即用例**：测试代码直观描述了模块的预期行为。
- **快速反馈**：在 CI 阶段自动运行，分钟级告知引入的缺陷。
- **保障重构**：有充分测试时，重构风险大幅降低。
- **质量门禁**：测试覆盖率、通过率作为代码合入的质量红线。
- **业务信任**：金融、医疗等场景，无测试覆盖代码无法通过合规审计。

---

## 3. 它解决什么问题

| 问题 | 测试类型 | 说明 |
|------|----------|------|
| 方法逻辑错误 | 单元测试 | 边界条件、分支逻辑未覆盖导致返回错误结果 |
| 模块协作失效 | 集成测试 | 模块间数据格式、调用顺序不匹配 |
| API 协议不匹配 | 接口测试 | 请求/响应字段、状态码、鉴权不符合约定 |
| 数据库查询/写入错误 | 数据库测试 | SQL 语法正确但语义错误，事务未正确处理 |
| 外部服务不可控 | Mock / Test Container | 第三方 API 或中间件不稳定导致测试不可复现 |
| 服务间接口不兼容 | 契约测试 | 消费者与提供者对同一接口的理解不一致 |
| 性能瓶颈 | 性能/压力测试 | QPS、TP99、CPU/内存泄露未提前发现 |
| 系统容错能力不足 | 故障注入 | 网络分区、磁盘满、进程 OOM 时系统能否自愈 |
| 新 bug 反复出现 | 回归测试 | 缺乏自动化回归用例，每个版本手动回归遗漏 |

---

## 4. 核心原理

### 4.1 断言 (Assertion)
测试的核心是 —— 执行一个操作，然后断言结果符合预期。

```
Given（前置条件） → When（执行动作） → Then（验证结果）
```

### 4.2 隔离 (Isolation)
- **单元测试**：mock 所有外部依赖，被测类为最小单元。
- **集成测试**：使用真实或容器化的依赖，但每个测试独立清理数据。
- **并行安全**：测试之间不应有共享状态，否则 flaky。

### 4.3 覆盖率 (Coverage)
衡量测试对代码的覆盖程度，常用指标：

| 指标 | 含义 |
|------|------|
| 行覆盖 | 代码行被执行的比例 |
| 分支覆盖 | 每个 `if/else` 两个分支是否都覆盖 |
| 条件覆盖 | 每个布尔子表达式是否都覆盖到 true/false |
| 路径覆盖 | 所有可能的执行路径（成本极高） |

### 4.4 测试替身 (Test Double)

| 类型 | 说明 |
|------|------|
| Dummy | 占位对象，从不被真实使用 |
| Fake | 有简化实现（如内存数据库） |
| Stub | 返回固定数据 |
| Spy | 记录调用信息 |
| Mock | 预编程期望的交互验证 |

### 4.5 FIRST 原则
- **Fast** — 快速（毫秒级）
- **Isolated** — 隔离
- **Repeatable** — 可重复（环境无关）
- **Self-validating** — 自验证（自动断言）
- **Timely** — 及时（生产代码之前或同步编写）

---

## 5. 基本使用方法

### 5.1 Java — JUnit 5 + Mockito

```java
// 1. 单元测试：Service 层
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    @Test
    void shouldCreateUserSuccessfully() {
        // Given
        CreateUserRequest request = new CreateUserRequest("alice", "alice@example.com");
        User savedUser = User.builder().id(1L).name("alice").email("alice@example.com").build();
        when(userRepository.save(any(User.class))).thenReturn(savedUser);

        // When
        User result = userService.createUser(request);

        // Then
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getName()).isEqualTo("alice");
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    void shouldThrowExceptionWhenEmailDuplicated() {
        // Given
        CreateUserRequest request = new CreateUserRequest("alice", "alice@example.com");
        when(userRepository.existsByEmail(anyString())).thenReturn(true);

        // When & Then
        assertThrows(DuplicateEmailException.class, () -> userService.createUser(request));
    }
}

// 2. MockMvc — Controller 层测试
@WebMvcTest(UserController.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Test
    void shouldReturn201WhenCreateUser() throws Exception {
        CreateUserRequest request = new CreateUserRequest("alice", "alice@example.com");
        when(userService.createUser(any())).thenReturn(new User(1L, "alice", "alice@example.com"));

        mockMvc.perform(post("/api/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"alice\",\"email\":\"alice@example.com\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("alice"));
    }
}
```

### 5.2 Java — Spring Boot 集成测试

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class UserIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void shouldSaveAndReturnUser() {
        // Given
        User user = new User(null, "bob", "bob@example.com");

        // When
        ResponseEntity<User> response = restTemplate.postForEntity("/api/users", user, User.class);

        // Then
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().getId()).isNotNull();
    }
}
```

### 5.3 Java — DataJpaTest

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    void shouldFindUserByEmail() {
        User user = new User(null, "alice", "alice@example.com");
        userRepository.save(user);

        Optional<User> found = userRepository.findByEmail("alice@example.com");

        assertThat(found).isPresent();
        assertThat(found.get().getName()).isEqualTo("alice");
    }
}
```

### 5.4 Python — pytest + FastAPI TestClient

```python
# 1. 单元测试
import pytest
from unittest.mock import Mock, patch
from app.services.user_service import UserService

def test_create_user_success():
    # Given
    repo = Mock()
    repo.save.return_value = {"id": 1, "name": "alice", "email": "alice@example.com"}
    service = UserService(repo)

    # When
    result = service.create_user({"name": "alice", "email": "alice@example.com"})

    # Then
    assert result["id"] == 1
    repo.save.assert_called_once()

# 2. FastAPI TestClient
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_user_api():
    response = client.post("/api/users", json={"name": "alice", "email": "alice@example.com"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "alice"
```

### 5.5 Python — pytest 异步测试

```python
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_async_get_user():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/users/1")
    assert response.status_code == 200

# 或使用内置 AsyncClient
@pytest.mark.anyio
async def test_async_service():
    result = await my_async_service.do_something()
    assert result is True
```

### 5.6 Python — Mock 与 patch

```python
from unittest.mock import patch

@patch("app.services.user_service.send_email")
def test_create_user_sends_email(mock_send_email):
    service = UserService(Mock())
    service.create_user({"name": "alice", "email": "alice@example.com"})
    mock_send_email.assert_called_once_with("alice@example.com", "Welcome!")

# 上下文管理器方式
def test_external_api():
    with patch("app.services.user_service.requests.post") as mock_post:
        mock_post.return_value.status_code = 200
        result = my_service.call_external_api()
        assert result is True
```

---

## 6. 工程中的典型实现

### 6.1 单元测试 (Unit Test)

**目标**：验证单一类或函数在各种输入下的行为。

**典型实现**：

```
src/
├── main/java/com/example/user/
│   ├── UserService.java
│   └── UserRepository.java
└── test/java/com/example/user/
    ├── UserServiceTest.java        ← 单元测试
    └── UserRepositoryTest.java     ← 数据库测试
```

**关键点**：
- Mock 所有外部依赖。
- 覆盖正常路径、边界条件、异常路径。
- 每个 case 独立，不共享可变状态。
- 命名规范：`should_<预期行为>_when_<条件>`。

### 6.2 集成测试 (Integration Test)

**目标**：验证多个模块协作的正确性。

**典型实现**：
- Spring Boot: `@SpringBootTest` + `TestRestTemplate / WebTestClient`
- Python: `pytest` + `TestClient` + 测试数据库

**关键点**：
- 使用真实数据库（内存或 Test Container）。
- 每个测试结束后清理数据（`@Transactional` / 手动 truncate）。
- 不 mock 少量可信组件（如框架核心），但 mock 不稳定外部服务。

### 6.3 接口测试 (API / E2E Test)

**目标**：验证完整的 HTTP 请求 → 响应链路。

**典型实现**：

Java — RestAssured：

```java
@Test
void testFullUserLifecycle() {
    // Create
    String userId = given()
        .contentType(JSON)
        .body("""{"name":"alice","email":"a@b.com"}""")
    .when()
        .post("/api/users")
    .then()
        .statusCode(201)
        .extract().path("id").toString();

    // Read
    given()
    .when()
        .get("/api/users/{id}", userId)
    .then()
        .statusCode(200)
        .body("name", equalTo("alice"));
}
```

Python：

```python
def test_user_lifecycle():
    # Create
    resp = client.post("/api/users", json={"name": "alice", "email": "a@b.com"})
    assert resp.status_code == 201
    user_id = resp.json()["id"]

    # Read
    resp = client.get(f"/api/users/{user_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "alice"

    # Delete
    resp = client.delete(f"/api/users/{user_id}")
    assert resp.status_code == 204
```

### 6.4 数据库测试 (Database Test)

**目标**：验证 SQL 查询正确性、事务隔离级别、迁移脚本。

| 技术 | Java | Python |
|------|------|--------|
| 内存数据库 | `@DataJpaTest` + H2 | `pytest` + SQLite in-memory |
| 真实数据库 | Testcontainers + `@DynamicPropertySource` | Testcontainers + `pytest-postgresql` |
| 迁移测试 | Flyway / Liquibase 回滚测试 | Alembic downgrade 验证 |

Testcontainers 示例（Java）：

```java
@Testcontainers
@SpringBootTest
class UserRepositoryTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15")
        .withDatabaseName("testdb")
        .withUsername("test")
        .withPassword("test");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private UserRepository userRepository;

    @Test
    void shouldSaveAndFind() {
        // 使用真实 PostgreSQL 验证 SQL 兼容性
    }
}
```

Testcontainers 示例（Python）：

```python
import pytest
from testcontainers.postgres import PostgresContainer

@pytest.fixture(scope="module")
def postgres():
    with PostgresContainer("postgres:15") as pg:
        yield pg

def test_with_real_db(postgres):
    conn = psycopg2.connect(
        host=postgres.get_container_host_ip(),
        port=postgres.get_exposed_port(5432),
        user=postgres.USERNAME,
        password=postgres.PASSWORD,
        dbname=postgres.DBNAME,
    )
    # 执行真实 SQL 验证语法与性能
```

### 6.5 Mock

**目标**：隔离外部依赖，使测试快速、可重复、不受环境干扰。

**Mock 使用原则**：
1. Mock **你自己的接口**（如 Repository、RPC Client），不 mock 第三方库内部。
2. Mock 外部服务（支付网关、邮件服务、消息队列）。
3. 不要过度 mock —— 过多 mock 让测试失去意义（只测了 mock 框架）。
4. 使用 `verify` 验证交互次数和参数。

### 6.6 Test Container

**目标**：在测试中启动真实中间件容器，消除环境差异。

| 场景 | 容器 |
|------|------|
| 数据库 | PostgreSQL, MySQL, MongoDB |
| 消息队列 | Kafka, RabbitMQ, Pulsar |
| 缓存 | Redis |
| 搜索引擎 | Elasticsearch |
| 浏览器 | Chrome (WebDriver) |

**最佳实践**：
- 使用 `Ryuk` 容器自动清理资源（Testcontainers 默认启用）。
- 单 Module 级别共享容器，避免每个测试启动销毁。
- 将连接信息通过 `@DynamicPropertySource` 注入 Spring 上下文。

### 6.7 契约测试 (Contract Test)

**目标**：验证服务间 API 协议（请求/响应格式、状态码）的一致性，防止消费者与提供者之间出现不兼容变更。

| 工具 | 语言 | 特点 |
|------|------|------|
| **Pact** | Java / Python / JS | 消费者驱动契约，支持 CDC (Consumer-Driven Contracts) |
| **Spring Cloud Contract** | Java | 提供者端生成验证，与 Spring Boot 深度集成 |
| **Pact Python** | Python | `pact-python`，消费者端编写契约，提供者端验证 |

**Pact 工作流**（Java 示例）：

消费者端：

```java
@ExtendWith(PactConsumerTestExt.class)
@PactTestFor(providerName = "user-service", port = "8080")
class UserServiceClientPactTest {

    @Pact(consumer = "order-service")
    public V4Pact createPact(PactDslWithProvider builder) {
        return builder
            .given("用户 alice 存在")
            .uponReceiving("获取用户信息")
            .path("/api/users/alice")
            .method("GET")
            .willRespondWith()
            .status(200)
            .headers(Map.of("Content-Type", "application/json"))
            .body(new PactDslJsonBody()
                .stringType("name", "alice")
                .stringType("email", "alice@example.com"))
            .toPact(V4Pact.class);
    }

    @Test
    @PactTestFor(pactMethod = "createPact")
    void testGetUser(MockServer mockServer) {
        UserServiceClient client = new UserServiceClient(mockServer.getUrl());
        User user = client.getUser("alice");
        assertThat(user.getName()).isEqualTo("alice");
    }
}
```

提供者端验证：

```java
@Provider("user-service")
@PactBroker(url = "${pact.broker.url}")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class UserServiceProviderPactTest {

    @LocalServerPort
    private int port;

    @BeforeEach
    void setup() {
        RestAssured.baseURI = "http://localhost:" + port;
    }

    @TestTemplate
    @ExtendWith(PactVerificationInvocationContextProvider.class)
    void pactVerificationTestTemplate(PactVerificationContext context) {
        context.verifyInteraction();
    }

    @State("用户 alice 存在")
    void userAliceExists() {
        // 准备测试数据
        userRepository.save(new User("alice", "alice@example.com"));
    }
}
```

**Pact Broker**：用于存储和共享契约文件，CI 中消费者先发布契约，提供者再验证并上报结果。

### 6.8 性能测试 / 压力测试 / 并发测试

**目标**：验证系统的吞吐量、响应时间、资源消耗与并发正确性。

#### 性能测试 (Performance Test)
测量系统在正常负载下的响应时间与吞吐量。

| 工具 | 语言 | 说明 |
|------|------|------|
| **JMeter** | Java | GUI 编排，分布式压测 |
| **Gatling** | Scala | 代码化场景，高并发，Akka 驱动 |
| **k6** | Go/JS | 脚本化，轻量，CI 友好 |
| **Locust** | Python | Python 定义用户行为 |

**Gatling 示例**：

```scala
class UserSimulation extends Simulation {

  val httpProtocol = http.baseUrl("http://localhost:8080")

  val scn = scenario("Get User")
    .repeat(100) {
      exec(http("GET /api/users/1").get("/api/users/1"))
    }

  setUp(scn.inject(atOnceUsers(50)).protocols(httpProtocol))
}
```

**Locust 示例**：

```python
from locust import HttpUser, task, between

class WebsiteUser(HttpUser):
    wait_time = between(0.5, 2)

    @task
    def get_user(self):
        self.client.get("/api/users/1")

    @task(3)
    def create_user(self):
        self.client.post("/api/users", json={"name": "alice", "email": "a@b.com"})
```

#### 压力测试 (Stress Test)
将系统推到极限（超过预期峰值），观察行为：

- 是否优雅降级？
- 是否 OOM / 崩溃？
- 恢复速度如何？

**常用策略**：
- 步进式增压：每 10s 增加 10 并发，直到出现 5xx。
- 峰值保持：在目标 QPS 下持续 30 分钟。
- 突发测试：瞬间将并发从 0 提升到 10 倍峰值。

#### 并发测试 (Concurrency Test)
验证多线程/多协程下的数据竞争与死锁。

Java：

```java
@Test
void testConcurrentCreateUser() throws InterruptedException {
    int threadCount = 10;
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);
    CountDownLatch latch = new CountDownLatch(1);
    AtomicInteger successCount = new AtomicInteger();

    for (int i = 0; i < threadCount; i++) {
        executor.submit(() -> {
            try {
                latch.await(); // 所有线程同时开始
                userService.createUser(new CreateUserRequest("alice", "a@b.com"));
                successCount.incrementAndGet();
            } catch (Exception ignored) {}
        });
    }

    latch.countDown();
    executor.shutdown();
    executor.awaitTermination(5, TimeUnit.SECONDS);

    // 预期只有一个成功（唯一约束）
    assertThat(successCount.get()).isEqualTo(1);
}
```

Python：

```python
import asyncio
import pytest

@pytest.mark.asyncio
async def test_concurrent_create_user():
    results = []
    async def create():
        try:
            result = await service.create_user({"name": "alice", "email": "a@b.com"})
            results.append(("ok", result))
        except Exception as e:
            results.append(("error", e))

    tasks = [create() for _ in range(10)]
    await asyncio.gather(*tasks)

    success_count = sum(1 for r in results if r[0] == "ok")
    assert success_count == 1  # 唯一约束
```

### 6.9 故障注入 (Fault Injection)

**目标**：验证系统在面对外部故障时的行为（熔断、降级、重试）。

| 层次 | 注入手段 | 工具 |
|------|----------|------|
| 网络 | 延迟、丢包、分区 | Chaos Mesh, Toxiproxy, iptables |
| 磁盘 | IO 错误、空间满 | Chaos Monkey, custom agent |
| 进程 | OOM、崩溃、hang | Chaos Blaze, Gremlin |
| 依赖 | 返回 500、超时 | Mock / WireMock 注入 |

**Toxiproxy 示例**：

```java
@Test
void testCircuitBreakerWhenRedisTimeout() {
    ToxiproxiClient toxiClient = new ToxiproxiClient("localhost", 8474);
    Toxic redisToxic = toxiClient.getProxy("redis")
        .toxic().latency("redis-latency", ToxicDirection.DOWNSTREAM, 5000);

    // When — Redis 响应延迟 5s
    assertThrows(TimeoutException.class, () -> userService.getUser(1L));

    // Then — 熔断器应该打开
    redisToxic.remove();
    // 等待熔断恢复
    User user = userService.getUser(1L);
    assertThat(user).isNotNull();
}
```

**Python 使用 chaoshttp 示例**：

```python
def test_service_handles_timeout():
    with chaoshttp.delay("api/users", latency=10):
        with pytest.raises(requests.Timeout):
            client.get("/api/users/1")
```

### 6.10 回归测试 (Regression Test)

**目标**：确保已有功能在新版本中不被破坏。

**策略**：
1. **全量自动化回归**：CI 中每次合入前运行所有自动化用例（单元 + 集成 + 接口）。
2. **差异回归**：只运行受变更影响模块的测试（通过依赖图分析，如 `pytest --co` 或 `gradle test --changed`）。
3. **冒烟测试**：部署后运行最关键路径的测试（健康检查、核心业务流程）。
4. **SnapShot 回归**：比较输出快照的变化（如 `Jest Snapshot`、API 响应结构）。

**SnapShot 回归示例（Java JSONassert）**：

```java
@Test
void apiResponseSnapshot() throws Exception {
    String expected = Files.readString(Paths.get("src/test/resources/snapshots/user.json"));
    MvcResult result = mockMvc.perform(get("/api/users/1")).andReturn();
    JSONAssert.assertEquals(expected, result.getResponse().getContentAsString(), JSONCompareMode.NON_EXTENSIBLE);
}
```

---

## 7. 常见失败场景

| 场景 | 原因 | 解决方案 |
|------|------|----------|
| **Flaky Test** | 依赖时间、随机数、线程调度 | mock 时间，固定种子，使用 `awaitility` 或重试 |
| **测试间共享状态** | 静态变量、数据库残留 | `@BeforeEach` 清理，使用事务回滚 |
| **Mock 过于脆弱** | 验证了内部实现细节而非行为 | 只 mock 接口边界，不 verify 内部调用顺序 |
| **过度 Mock** | 大量 mock 导致测试与生产行为不一致 | 使用集成测试验证真实组件交互 |
| **生产环境 SQL 差异** | H2 内存库 SQL 方言与生产不一致 | 使用 Testcontainer 跑真实数据库 |
| **异步测试超时** | 异步操作未正确 await/join | 使用 `CompletableFuture` + `awaitility` / `asyncio.run` |
| **并发测试不确定** | 竞态条件在不同线程调度下表现不同 | 使用 `stress test` + `ThreadSanitizer` 反复跑 |
| **测试数据硬编码** | 测试依赖固定 ID/时间，数据变更后失败 | 使用随机数据生成（`TestFactory` / `factory_boy`） |
| **CI 环境差异** | 本地通过 CI 失败 | 本地 Docker 模拟 CI 环境，或 CI 使用 `act` |
| **契约过期** | 提供者更新了 API 但消费者未同步 | CI 中自动运行契约验证，Pact Broker 记录兼容矩阵 |

---

## 8. 如何调试

### 8.1 Java

| 场景 | 调试手段 |
|------|----------|
| 测试快速失败 | IDE debug 模式运行单个测试，在可疑行打断点 |
| Mock 未生效 | 检查注解是否启用（`@ExtendWith(MockitoExtension.class)`），确认注入对象类型匹配 |
| `MockMvc` 返回 400 | 打印 `andDo(print())`，查看请求与响应详情 |
| 集成测试数据残留 | 打开 `spring.jpa.show-sql=true`，检查每个测试的事务边界 |
| 性能测试瓶颈 | 启用 `async-profiler` 生成火焰图，定位热点方法 |

```java
mockMvc.perform(post("/api/users")
        .contentType(MediaType.APPLICATION_JSON)
        .content("..."))
    .andDo(MockMvcResultHandlers.print())  // ← 打印完整请求响应
    .andExpect(status().isOk());
```

### 8.2 Python

| 场景 | 调试手段 |
|------|----------|
| 断言失败 | `pytest -v --tb=long` 查看详细 traceback |
| Mock 未调用 | `pytest --mock-verbose` 或打印 `mock.call_args_list` |
| 异步测试挂起 | 设置 `pytest-timeout` 插件，`@pytest.mark.timeout(5)` |
| 性能测试 | `cProfile` 或 `py-spy` 实时采样 |
| SQL 问题 | `pytest --log-cli-level=DEBUG` 查看 SQL 日志 |

```python
def test_debug_mock():
    mock_repo = Mock()
    service = UserService(mock_repo)
    service.create_user({"name": "alice"})
    print(mock_repo.method_calls)      # 查看所有调用
    print(mock_repo.save.call_args)    # 查看 save 的参数
```

### 8.3 通用调试技巧

1. **最小化复现**：注释掉无关测试逻辑，只保留触发失败的代码路径。
2. **增加日志**：在怀疑点临时加入详细日志，确认执行路径。
3. **隔离环境**：在 Docker 中跑测试，消除环境差异。
4. **固定种子**：对涉及随机数的测试固定 `Random` 种子，确保可复现。
5. **使用 `git bisect`**：定位引入 bug 的 commit。

---

## 9. 如何测试（测试策略本身如何保证质量）

测试本身也是代码，需要确保其质量与可信度。以下是从"元测试"视角来"测试测试"：

### 9.1 Mutation Testing（变异测试）

**原理**：对被测代码做微小的语义变更（变异），如果测试没有失败，说明这些变异没有被现有测试捕获。

| 工具 | 语言 |
|------|------|
| **PITest** | Java |
| **Mutmut / Cosmic Ray** | Python |

```bash
# Java PITest
mvn org.pitest:pitest-maven:mutationCoverage
# 报告在 target/pit-reports/
```

```bash
# Python mutmut
mutmut run --paths-to-mutate src/
mutmut results
```

**指标**：测试充分性 = 被杀死变异 / 总变异。目标 > 80%。

### 9.2 覆盖率基线

设置低置信度不允许合入的门禁：

```
单元测试行覆盖 >= 80%
分支覆盖     >= 70%
新代码覆盖   >= 90%
```

### 9.3 Fuzzing（模糊测试）

自动生成大量随机/半随机输入，探测隐藏的边界条件与安全漏洞。

| 工具 | 语言 |
|------|------|
| **JUnit QuickCheck / jqwik** | Java 属性基测试 |
| **Hypothesis** | Python 属性基测试 |

```python
from hypothesis import given, strategies as st

@given(st.integers(), st.integers())
def test_division(a, b):
    if b == 0:
        with pytest.raises(ZeroDivisionError):
            a / b
    else:
        assert (a / b) * b == a  # 除法逆运算性质
```

### 9.4 测试可维护性

- **不要测试私有方法**：通过公有接口间接测试，否则重构时测试代码会大量变更。
- **避免过度 Mock**：Mock 链超过 3 层时，考虑增加集成测试。
- **测试命名清晰**：`shouldReturnEmptyListWhenNoUserFound` 比 `testUser1` 好 100 倍。
- **Review 测试代码**：Code Review 时要求 reviewer 也检查测试。

### 9.5 CI 测试门禁流水线

```
Push → Lint → Unit Test → Integration Test → 覆盖率检查 → Mutation Score → Contract Verify → Deploy
```

每一步失败都会阻断后续流程，确保只有高质量代码进入生产。

---

## 10. 如何监控

### 10.1 测试报告可视化

| 工具 | 用途 |
|------|------|
| **JaCoCo / Cobertura** | Java 覆盖率报告 |
| **pytest-cov** | Python 覆盖率报告 |
| **Allure** | 美观的测试报告（支持 Java / Python） |
| **Gatling / k6 Dashboard** | 性能测试实时图表 |

### 10.2 CI 集成

- **Jenkins / GitLab CI / GitHub Actions** 中发布测试报告。
- 覆盖率低于阈值自动失败。
- 性能测试结果与基线对比，TP99 超过 500ms 告警。

### 10.3 生产监控配合

测试不能覆盖所有生产场景，需要生产环境监控补位：

| 生产信号 | 监控手段 |
|----------|----------|
| 错误率上升 | 4xx/5xx 比例监控，PagerDuty 告警 |
| 响应变慢 | Prometheus + Grafana TP50/TP90/TP99 |
| 功能影响 | 全链路追踪（Jaeger / Zipkin） |
| 回归 | 金丝雀发布 + A/B 对比 |
| 用户投诉 | 日志审计 + 根因分析 |

### 10.4 Flaky 测试管理

- **Quarantine 机制**：将 flaky 测试从阻塞流水线中移出，单独追踪。
- **自动重试**：失败后自动重试 2 次（仅限 flaky 可能性大的集成测试）。
- **Flaky 率报告**：每周统计 flaky 率，要求团队降到 1% 以下。

---

## 11. 常见面试问题

### 11.1 基础概念

1. **什么是测试金字塔？你如何分配各层测试的比例？**
   - 单元占 70%、集成占 20%、E2E 占 10%；业务核心逻辑加大集成比例。
2. **单元测试和集成测试的核心区别是什么？**
   - 单元测试隔离单模块、毫秒级；集成测试验证组件协作、秒级。
3. **Mock 和 Stub 的区别是什么？**
   - Mock 有交互验证（是否调用、调用次数），Stub 只返回预设值。

### 11.2 Java 场景

4. **`@MockBean` 和 `@Mock` 的区别？**
   - `@Mock` 是 Mockito 原生，`@MockBean` 将 mock 注入 Spring 上下文，替换原有 Bean。
5. **`@DataJpaTest` 和 `@SpringBootTest` 的区别？**
   - `@DataJpaTest` 只加载 JPA 相关组件，不启动完整上下文，更快。
6. **如何测试 Feign 或 RestTemplate 调用？**
   - 使用 `WireMock` 或 `MockRestServiceServer` mock HTTP 端点。

### 11.3 Python 场景

7. **pytest 的 fixture 作用域有哪些？**
   - `function` / `class` / `module` / `package` / `session`。
8. **`unittest.mock.patch` 与 `pytest-mock` 的 mocker 参数有何不同？**
   - 功能相同，`pytest-mock` 自动管理清理，避免残留。
9. **如何测试 FastAPI 的依赖注入项？**
   - `app.dependency_overrides[my_dep] = mock_dep` 覆盖依赖。

### 11.4 进阶场景

10. **什么是契约测试？在微服务架构中它解决了什么问题？**
    - 防止消费者和提供者之间的 API 不兼容；在没有 E2E 环境的微服务架构中尤为重要。
11. **性能测试中 TP50、TP90、TP99 分别代表什么？**
    - 50%/90%/99% 请求在多少毫秒内完成，TP99 比平均耗时更能反映尾部延迟。
12. **如何设计一个压力测试场景？**
    - 确定峰值 QPS、步进增压、监控资源阈值、设置熔断指标。
13. **你如何保证测试不会成为维护负担？**
    - 只测行为不测实现、使用 fixture 共享数据、避免硬编码值、定期清理废弃测试。
14. **测试覆盖率 100% 有意义吗？**
    - 不一定，100% 不能保证无 bug；更重要的是测试覆盖了所有关键路径与异常分支。

---

## 12. 在我的项目中如何使用

### 12.1 项目技术栈

- **后端框架**：Spring Boot 3.x（Java 17+）或 FastAPI（Python 3.11+）
- **构建工具**：Maven / Gradle（Java）或 Poetry / PDM（Python）
- **数据库**：PostgreSQL + Flyway / Alembic 迁移
- **消息队列**：Kafka / RabbitMQ
- **缓存**：Redis
- **CI**：GitHub Actions / GitLab CI

### 12.2 分层测试策略

```
┌─────────────────────────────────────────────┐
│           E2E (3-5 条核心流程)               │
│   Postman / k6 / playwright                  │
├─────────────────────────────────────────────┤
│       集成测试 (核心业务模块)                 │
│   @SpringBootTest + Testcontainers            │
│   pytest + TestClient + Testcontainers        │
├─────────────────────────────────────────────┤
│       单元测试 (所有 Service + Util)          │
│   JUnit 5 + Mockito / pytest + mock           │
├─────────────────────────────────────────────┤
│       数据库测试 (Repository / DAO)           │
│   @DataJpaTest + Testcontainers / pytest-db   │
└─────────────────────────────────────────────┘
```

### 12.3 实践规范

**命名规范**：
- Java: `{ClassName}Test.java`，方法名 `should{Expected}_when{Condition}`
- Python: `test_{module}.py`，函数名 `test_{action}_{expected}`

**目录结构**：

```
Java:
src/test/java/com/example/
├── controller/          ← MockMvc / WebTestClient 接口测试
├── service/             ← 纯单元测试
├── repository/          ← @DataJpaTest 数据库测试
└── integration/         ← @SpringBootTest 集成测试

Python:
tests/
├── unit/
│   └── test_service.py
├── integration/
│   ├── test_api.py
│   └── conftest.py      ← TestClient / 数据库 fixture
└── e2e/
    └── test_workflow.py
```

**覆盖率目标**：
- 新功能：行覆盖 >= 90%，分支覆盖 >= 80%
- 整体项目：行覆盖 >= 75%
- 核心 service 层：行覆盖 >= 95%

**CI 门禁**：
1. `mvn clean verify` 或 `pytest --cov` 全部通过。
2. 覆盖率不达标 → 构建失败。
3. 契约测试不通过 → 阻塞合入。
4. 性能测试 TP99 比基线恶化超过 10% → 告警但不阻塞。

### 12.4 测试启动命令

```bash
# Java — 全量测试
./mvnw clean verify

# Java — 跳过集成测试（仅单元）
./mvnw clean test

# Java — 运行指定测试
./mvnw test -Dtest=UserServiceTest

# Python — 全量测试
pytest --cov=src/ --cov-report=html

# Python — 仅单元测试
pytest tests/unit/

# Python — 仅集成测试
pytest tests/integration/

# Python — 带性能标记
pytest -m performance
```

### 12.5 常见配置参考

**Java — `pom.xml` 测试依赖**：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>testcontainers-bom</artifactId>
    <version>1.19.3</version>
    <type>pom</type>
    <scope>import</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>postgresql</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.pitest</groupId>
    <artifactId>pitest-maven</artifactId>
    <version>1.15.0</version>
    <scope>test</scope>
</dependency>
```

**Python — `pyproject.toml` 测试配置**：

```toml
[tool.pytest.ini_options]
minversion = "7.0"
testpaths = ["tests"]
python_files = ["test_*.py"]
asyncio_mode = "auto"
markers = [
    "unit: 单元测试",
    "integration: 集成测试",
    "performance: 性能测试",
    "slow: 慢测试，默认跳过",
]

[tool.coverage.run]
source = ["src"]
omit = ["src/main.py", "**/__init__.py"]
```

### 12.6 实际实施计划

| 阶段 | 内容 | 交付物 |
|------|------|--------|
| **第一周** | 配置测试框架 + CI 流水线 | CI 跑通 `mvn test` |
| **第二周** | 核心 Service 层单元测试 | 覆盖核心业务 > 90% |
| **第三周** | Controller 层接口测试 + 数据库测试 | `@WebMvcTest` + `@DataJpaTest` / pytest |
| **第四周** | 集成测试 + Testcontainers | 关键流程集成测试 |
| **第五周** | 契约测试 + Pact Broker | 服务间契约验证 |
| **第六周** | 性能测试 + 压力测试基线 | Gatling / k6 基线报告 |
| **持续** | Mutation Testing 质量门禁 | PITest / mutmut 覆盖率 > 80% |
| **每季度** | 故障注入混沌实验 | Chaos Mesh / Toxiproxy 演练 |

---

> **总结**：测试不是"写完了代码之后附加的工作"，它是工程质量的基石。  
> 好的测试策略 = 快速反馈 + 高置信度 + 低维护成本。  
> 按金字塔分层投入，优先保障核心业务逻辑的测试覆盖率，善用 Mock 和 Testcontainer 平衡速度与真实性，通过契约测试和性能基线守住服务间边界与系统容量。
