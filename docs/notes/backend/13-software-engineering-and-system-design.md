# 软件工程与系统设计

## 1. 它是什么

软件工程与系统设计是一套指导软件项目从需求分析、架构设计、开发实现到长期维护的方法论和最佳实践集合。它不仅关注代码怎么写，更关注代码**怎么组织、怎么演进、怎么协作**。

涵盖的核心领域包括：

| 领域 | 说明 |
|------|------|
| 版本控制 | Git 分支策略、提交规范、Code Review |
| 构建工具 | Maven多模块、依赖管理、构建生命周期 |
| 代码质量 | 代码规范、静态分析、设计模式、SOLID |
| 架构设计 | 分层架构、六边形架构、Clean Architecture、DDD |
| 部署策略 | CI/CD、灰度发布、蓝绿部署、配置管理 |
| 服务形态 | 单体架构、模块化单体、微服务架构 |

## 2. 为什么需要它

- **可维护性**：软件生命周期中 80% 以上的成本发生在维护阶段，而非最初的开发阶段
- **可扩展性**：业务在变，团队在涨，架构需要能跟着走
- **协作效率**：多人或多团队并行开发时，没有工程规范会导致冲突不断
- **降低风险**：好的工程实践能减少线上故障、回滚难度和发布风险
- **技术债务控制**：没有工程约束，短期"快"会变成长期的"慢"

## 3. 它解决什么问题

| 问题 | 表现 | 解决方式 |
|------|------|----------|
| 代码耦合严重 | 改一处崩一片 | 高内聚低耦合、依赖倒置 |
| 分支冲突频繁 | 合并代码需要半天 | Git 分支管理规范 |
| 构建混乱 | 依赖冲突、版本地狱 | Maven多模块、BOM管理 |
| 代码风格各异 | 每人一套写法，阅读困难 | 代码规范 + Checkstyle/Spotless |
| 业务模型混乱 | 业务逻辑散落在各处 | DDD + 分层架构 |
| 上线提心吊胆 | 每次发布都像在赌博 | CI/CD + 灰度发布 + 蓝绿部署 |
| 数据库变更失控 | 字段改了忘记脚本 | Flyway / Liquibase 版本管理 |

## 4. 核心原理

### 4.1 SOLID 原则

| 缩写 | 原则 | 通俗理解 |
|------|------|----------|
| S | 单一职责原则 | 一个类只做一件事 |
| O | 开闭原则 | 对扩展开放，对修改关闭 |
| L | 里氏替换原则 | 子类可替换父类 |
| I | 接口隔离原则 | 接口要小而专，不要大而全 |
| D | 依赖倒置原则 | 依赖抽象，不要依赖具体实现 |

### 4.2 高内聚 & 低耦合

- **高内聚**：一个模块内部的元素（类、方法）应该紧密关联，共同完成一个明确职责
- **低耦合**：模块之间的依赖应该尽量少且清晰，减少修改时的连锁反应

衡量方式：
- 耦合度：一个模块对另一个模块的了解程度（知道的越少越好）
- 内聚度：模块内部元素之间的关联程度（关联越强越好）

### 4.3 依赖倒置（DIP）

```
具体实现 → 抽象接口 → 具体实现
     ▲                    │
     └──── 依赖方向 ──────┘
```

- 高层模块不应该依赖低层模块，二者都应依赖抽象
- 抽象不应该依赖细节，细节应依赖抽象
- 实现方式：依赖注入（DI）、控制反转（IoC）容器

### 4.4 领域驱动设计（DDD）

> DDD 可放在项目后期引入，不需要一开始就设计复杂的领域模型。

核心概念：

| 概念 | 说明 |
|------|------|
| 实体（Entity） | 有唯一标识，生命周期可追踪 |
| 值对象（Value Object） | 无标识，由属性值定义相等性 |
| 聚合（Aggregate） | 一组相关对象的集合，有聚合根 |
| 领域服务（Domain Service） | 无状态的业务逻辑 |
| 仓库（Repository） | 聚合的持久化接口 |
| 领域事件（Domain Event） | 领域中发生的重要事件 |
| 限界上下文（Bounded Context） | 划分领域边界的单位 |

战略设计步骤：
1. 统一语言（Ubiquitous Language）
2. 划分限界上下文
3. 识别核心域、支撑域、通用域
4. 上下文映射（Context Map）

战术设计步骤：
1. 识别聚合与聚合根
2. 设计实体与值对象
3. 实现领域服务
4. 定义仓储接口

### 4.5 Git 分支管理模型

**Git Flow**（适合有固定发布周期的项目）：

```
master ───── release ── feature
    │            │          │
    └──── hotfix ─┘          │
              └──────────────┘
```

- `main/master`：生产就绪代码
- `develop`：开发集成分支
- `feature/*`：功能开发分支
- `release/*`：发布准备分支
- `hotfix/*`：紧急修复分支

**Trunk Based Development**（适合 CI/CD 快速迭代）：
- 所有开发者在主干（trunk/main）上开发
- 短命特性分支（不超过 1-2 天）
- 配合特性开关控制发布

### 4.6 架构模式

**分层架构（Layered Architecture）**：

```
Controller  →  Service  →  Repository  →  Database
    │             │              │
    └── DTO ──────┘
```

**六边形架构（Ports & Adapters）**：

```
                   ┌───────────┐
  ┌─── Adapter ───→   Port    │
  │                │  (in)    │
  │   ┌────────────┤          │
  │   │  Domain    │  Port    ├── Adapter ──→ DB
  │   │  (核心)    │  (out)   │
  │   └────────────┤          │
  │                │          ├── Adapter ──→ Queue
  └─── Adapter ───→          │
                   └───────────┘
```

**Clean Architecture（Bob大叔）**：

- 依赖方向从外向内，内层不知道外层的存在
- 实体 → 用例 → 接口适配器 → 框架/驱动
- 核心业务逻辑零依赖框架

**模块化单体（Modular Monolith）**：
- 代码以模块组织，每个模块有清晰边界
- 模块间通过接口通信（而不是类直接引用）
- 部署时作为一个单体，但代码组织上为微服务做准备

### 4.7 部署策略

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| 滚动更新 | 逐步替换旧实例 | 常规发布 |
| 蓝绿部署 | 两套环境切换 | 需要零停机 |
| 灰度发布 | 按比例/规则放量 | 风险控制 |
| 金丝雀发布 | 先小范围验证后全量 | 降低风险 |

## 5. 基本使用方法

### 5.1 Git 分支管理

```bash
# 创建 feature 分支
git checkout -b feature/user-login develop

# 开发完成后合并回 develop
git checkout develop
git merge --no-ff feature/user-login

# 创建 release 分支
git checkout -b release/1.2.0 develop

# 修复 bug 后合并到 master 和 develop
git checkout master
git merge --no-ff release/1.2.0
git tag -a v1.2.0 -m "Release 1.2.0"
git checkout develop
git merge --no-ff release/1.2.0
```

### 5.2 Maven 多模块

```xml
<!-- 父 POM -->
<groupId>com.example</groupId>
<artifactId>my-project</artifactId>
<version>1.0.0</version>
<packaging>pom</packaging>
<modules>
    <module>my-common</module>
    <module>my-domain</module>
    <module>my-infrastructure</module>
    <module>my-web</module>
</modules>
```

模块划分建议：

```
my-project/
├── my-common/          # 工具类、常量
├── my-domain/          # 领域模型、接口定义
├── my-infrastructure/  # 数据库、消息队列实现
├── my-web/             # Controller、DTO
```

### 5.3 代码规范落地

```xml
<!-- pom.xml 中引入 Spotless -->
<plugin>
    <groupId>com.diffplug.spotless</groupId>
    <artifactId>spotless-maven-plugin</artifactId>
    <configuration>
        <java>
            <eclipse>
                <file>eclipse-format.xml</file>
            </eclipse>
            <importOrder>
                <order>java,javax,org,com</order>
            </importOrder>
        </java>
    </configuration>
</plugin>
```

配合 CI 检查：

```yaml
# .github/workflows/checkstyle.yml
- name: Check code style
  run: mvn spotless:check
```

### 5.4 数据库版本管理（Flyway）

```bash
# 目录结构
src/main/resources/db/migration/
├── V1__create_user_table.sql
├── V1.1__add_email_column.sql
├── V2__create_order_table.sql
└── V3__unique_index_user_email.sql
```

```sql
-- V1__create_user_table.sql
CREATE TABLE `user` (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

```java
@Configuration
public class FlywayConfig {
    @Bean
    public Flyway flyway(DataSource dataSource) {
        return Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .load();
    }
}
```

### 5.5 配置管理

**多环境配置**：

```
application.yml              # 公共配置
application-dev.yml          # 开发环境
application-test.yml         # 测试环境
application-prod.yml         # 生产环境
```

结合配置中心（Nacos / Apollo）：

```yaml
spring:
  cloud:
    nacos:
      config:
        server-addr: ${NACOS_ADDR}
        namespace: ${NACOS_NAMESPACE}
        group: ${APP_GROUP}
        file-extension: yaml
```

### 5.6 CI/CD

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - name: Build and test
        run: mvn clean verify
      - name: Check style
        run: mvn spotless:check
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: app.jar
          path: target/*.jar
```

```yaml
# .github/workflows/cd.yml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: mvn clean package -DskipTests
      - name: Build Docker image
        run: docker build -t myapp:${{ github.ref_name }} .
      - name: Push to registry
        run: docker push registry.example.com/myapp:${{ github.ref_name }}
      - name: Deploy (蓝绿部署)
        run: |
          kubectl set image deployment/myapp-green myapp=${{ github.ref_name }}
          kubectl rollout status deployment/myapp-green
          kubectl set image deployment/myapp-blue myapp=${{ github.ref_name }}
```

## 6. 工程中的典型实现

### 6.1 分层架构示例

```java
// Controller 层
@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserApplicationService userService;

    @PostMapping
    public ResponseEntity<UserDTO> create(@RequestBody @Valid CreateUserRequest request) {
        UserDTO user = userService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }
}

// Service 层（应用服务）
@Service
@Transactional
public class UserApplicationService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper userMapper;

    public UserDTO createUser(CreateUserRequest request) {
        // 校验唯一性
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException("用户名已存在");
        }
        // 构建领域对象
        User user = User.create(request.getUsername(),
                                passwordEncoder.encode(request.getPassword()));
        // 持久化
        userRepository.save(user);
        // 发布领域事件
        user.publishEvents(new UserCreatedEvent(user.getId(), user.getUsername()));
        // 返回 DTO
        return userMapper.toDTO(user);
    }
}

// Repository 层
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    boolean existsByUsername(String username);
    Optional<User> findByUsername(String username);
}
```

### 6.2 六边形架构示例

```java
// 领域层（核心）
public class Order {
    private OrderId orderId;
    private Money totalAmount;
    private OrderStatus status;

    public void pay(Money amount) {
        if (this.status != OrderStatus.PENDING) {
            throw new IllegalStateException("订单状态不允许支付");
        }
        if (!this.totalAmount.equals(amount)) {
            throw new IllegalArgumentException("支付金额不匹配");
        }
        this.status = OrderStatus.PAID;
        DomainEventPublisher.publish(new OrderPaidEvent(this.orderId));
    }
}

// Port 接口（输出适配器）
public interface OrderRepository {
    void save(Order order);
    Optional<Order> findById(OrderId orderId);
}

// Port 接口（输入适配器）
public interface PaymentService {
    PaymentResult charge(OrderId orderId, Money amount);
}

// Adapter 实现
@Component
public class OrderJpaRepository implements OrderRepository {
    private final JpaOrderRepository delegate;
    private final OrderMapper mapper;

    @Override
    public void save(Order order) {
        delegate.save(mapper.toEntity(order));
    }

    @Override
    public Optional<Order> findById(OrderId orderId) {
        return delegate.findById(orderId.getValue())
                .map(mapper::toDomain);
    }
}
```

### 6.3 API 版本管理

```java
// URL Path 版本
@RestController
@RequestMapping("/api/v1/users")
public class UserV1Controller { }

@RestController
@RequestMapping("/api/v2/users")
public class UserV2Controller { }
```

```yaml
# 通过请求头版本
X-API-Version: 2024-01-01
```

```java
// 通过 Content-Type 版本
@PostMapping(produces = "application/vnd.myapp.v2+json")
public ResponseEntity<UserDTOV2> createUserV2(@RequestBody CreateUserRequestV2 request) {
    return ResponseEntity.ok(userService.createUserV2(request));
}
```

**版本策略建议**：

| 方式 | 优点 | 缺点 |
|------|------|------|
| URL Path (`/v1/`) | 直观、路由清晰 | 版本多了 URL 冗长 |
| Request Header | 符合 RESTful 规范 | 调试不方便 |
| Content-Type | 适合媒体类型版本化 | 客户端支持要求高 |

### 6.4 配置管理示例

```yaml
# 灰度发布配置
app:
  gray:
    enabled: true
    version: 2.0.0
    # 灰度规则：按用户ID取模
    rule: ${user.id} % 100 < 5
    # 灰度名单
    whitelist:
      - internal-tester-01
      - admin
```

```java
@Component
public class GrayReleaseFilter implements Filter {
    @Value("${app.gray.enabled:false}")
    private boolean grayEnabled;

    @Value("${app.gray.version:}")
    private String grayVersion;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) {
        if (!grayEnabled) {
            chain.doFilter(request, response);
            return;
        }
        // 判断当前请求是否命中灰度
        if (isInGrayRange(request)) {
            GrayContext.setVersion(grayVersion);
        }
        chain.doFilter(request, response);
    }
}
```

## 7. 常见失败场景

### 7.1 过早抽象

**表现**：项目刚开始就设计复杂的 DDD 模型，导致开发效率低下，模型与实际业务脱节。

**教训**：DDD 应在业务复杂度足够高时引入。先 CRUD 快速验证，再逐步引入领域模型。参考原文：DDD 可以放在后面，不需要一开始就设计复杂的领域模型。

### 7.2 过度设计

**表现**：明明只需单体就能满足，硬上微服务，导致分布式事务、网络延迟、运维复杂度剧增。

**教训**：优先考虑模块化单体，当模块间真的需要独立扩缩容、独立部署时再拆分微服务。

### 7.3 Git 分支混乱

**表现**：
- 多人同时在 `main` 上开发，没有分支管理
- 长期存在的 feature 分支（超过一周），合并时冲突爆炸
- 没有 Code Review，直接合并

**教训**：约定分支策略（Git Flow / Trunk Based），短命分支，强制 PR + Code Review。

### 7.4 数据库迁移无人维护

**表现**：
- 开发环境改了表结构，忘了提交 SQL 脚本
- 生产环境手动执行 SQL，导致环境间不一致
- 迁移脚本不可回滚

**教训**：使用 Flyway / Liquibase，脚本纳入版本控制，每次变更写回滚脚本。

### 7.5 没有 CI/CD

**表现**：
- 每次上线手动打包、手动上传、手动执行脚本
- 测试环境与生产环境配置不一致
- 上线前才发现代码编译不过

**教训**：哪怕只有一个人开发，也要跑 CI。至少保证提交代码后自动编译+跑测试。

### 7.6 配置硬编码

**表现**：
- 数据库连接、API Key 直接写在代码里
- 不同环境使用不同的分支/不同的 jar

**教训**：配置与代码分离，使用 `application-{profile}.yml` + 配置中心。

## 8. 如何调试

### 8.1 架构问题调试

- **依赖关系可视化**：使用 `jdeps` 或 IntelliJ 的 Dependency Analyzer 查看模块间依赖
- **循环依赖检测**：Maven 自带循环依赖检测，Spring Boot 启动时会检测 bean 循环依赖
- **ArchUnit**：编写架构测试，自动校验分层依赖规则

```java
// ArchUnit 示例
@Test
void domainLayerShouldNotDependOnInfrastructure() {
    JavaClasses importedClasses = new ClassFileImporter()
            .importPackages("com.example");

    ArchRule rule = layeredArchitecture()
            .consideringAllDependencies()
            .layer("Controller").definedBy("..controller..")
            .layer("Service").definedBy("..service..")
            .layer("Repository").definedBy("..repository..")
            .whereLayer("Controller").mayNotBeAccessedByAnyLayer()
            .whereLayer("Repository").mayOnlyBeAccessedByLayers("Service");

    rule.check(importedClasses);
}
```

### 8.2 构建问题调试

```bash
# 查看依赖树，排查冲突
mvn dependency:tree -Dverbose

# 查看特定模块的依赖
mvn dependency:tree -pl my-module

# 排除冲突依赖
mvn dependency:tree -Dincludes=com.fasterxml.jackson
```

### 8.3 配置问题调试

```bash
# Spring Boot 查看生效配置
curl http://localhost:8080/actuator/config

# 查看配置来源
curl http://localhost:8080/actuator/env
```

### 8.4 Git 问题调试

```bash
# 查看冲突文件
git status

# 查看合并来源
git log --oneline --graph --all

# 找是谁改了某行
git blame src/main/java/com/example/Order.java

# 二分查找引入 bug 的提交
git bisect start
git bisect bad v2.0
git bisect good v1.0
```

### 8.5 Flyway 问题调试

```bash
# 查看迁移状态
mvn flyway:info

# 修复校验失败（手动修复后）
mvn flyway:repair

# 指定版本迁移
mvn flyway:migrate -Dflyway.target=3.0
```

## 9. 如何测试

### 9.1 架构测试

```java
@AnalyzeClasses(packages = "com.example")
public class ArchitectureTest {

    @ArchTest
    static final ArchRule serviceShouldNotDependOnController =
            classes().that().resideInAPackage("..service..")
                    .should().onlyDependOnClassesThat()
                    .resideInAnyPackage("..domain..", "..common..", "java..");

    @ArchTest
    static final ArchRule domainShouldNotAccessInfrastructure =
            layeredArchitecture()
                    .layer("Domain").definedBy("..domain..")
                    .layer("Infrastructure").definedBy("..infrastructure..")
                    .whereLayer("Domain").mayOnlyBeAccessedByLayers("Infrastructure", "Service");
}
```

### 9.2 领域模型测试

```java
class OrderTest {
    @Test
    void shouldTransitionToPaidWhenPayCorrectAmount() {
        Order order = Order.create(new OrderId("123"), Money.of(100));
        order.pay(Money.of(100));
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PAID);
    }

    @Test
    void shouldThrowWhenPayIncorrectAmount() {
        Order order = Order.create(new OrderId("123"), Money.of(100));
        assertThrows(IllegalArgumentException.class, () -> order.pay(Money.of(50)));
    }
}
```

### 9.3 分层集成测试

```java
@SpringBootTest
@AutoConfigureMockMvc
class UserControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldCreateUserSuccessfully() throws Exception {
        String json = """
                {
                    "username": "alice",
                    "password": "P@ssw0rd"
                }
                """;
        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("alice"));
    }
}
```

### 9.4 数据库迁移测试

```java
@Testcontainers
@SpringBootTest
class FlywayMigrationTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Test
    void shouldApplyAllMigrationsSuccessfully() {
        // Flyway 会自动在启动时执行迁移
        // 如果迁移脚本失败，应用上下文都启动不起来
        assertThat(true).isTrue();
    }
}
```

## 10. 如何监控

### 10.1 架构健康度监控

| 指标 | 监控方式 |
|------|----------|
| 模块间依赖数 | ArchUnit 测试定期扫描，超阈值告警 |
| 循环依赖 | CI 中运行依赖检查 |
| 代码规范违规数 | Spotless + Checkstyle 报告 |

### 10.2 CI/CD 流程监控

```yaml
# 在 CI/CD 中集成告警
- name: Notify on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "CI failed on ${{ github.ref }}: ${{ github.run_url }}"
      }
```

### 10.3 发布过程监控

```bash
# 蓝绿部署切换后，自动验证
curl -f http://green-service:8080/actuator/health
if [ $? -eq 0 ]; then
    echo "Green health check passed"
    # 切换流量
    kubectl patch service myapp -p '{"spec":{"selector":{"version":"green"}}}'
else
    echo "Rolling back..."
    # 回滚
fi
```

### 10.4 灰度发布监控

```yaml
# Prometheus + Grafana 监控灰度指标
metrics:
  - name: gray_request_total
    labels: [version, status]
  - name: gray_error_rate
    labels: [version]
```

```java
@Component
public class GrayMetrics {
    private final MeterRegistry meterRegistry;

    public void recordRequest(String version, String status) {
        meterRegistry.counter("gray_request_total",
                        "version", version,
                        "status", status)
                .increment();
    }

    public void recordError(String version) {
        meterRegistry.counter("gray_error_rate", "version", version).increment();
    }
}
```

灰度决策依据：如果灰度的错误率 > 1%，自动全量回滚。

## 11. 常见面试问题

### 基础

1. **谈谈你对 SOLID 的理解，举例说明**
2. **什么是依赖倒置？它与控制反转（IoC）和依赖注入（DI）的关系是什么？**
3. **Git Flow 和 Trunk Based Development 的优缺点对比**
4. **Maven 多模块如何解决依赖冲突？依赖仲裁规则是什么？**
5. **Flyway 的工作原理是什么？如何处理迁移脚本的版本冲突？**

### 进阶

6. **DDD 中 Entity 和 Value Object 的区别是什么？何时选择 Value Object？**
7. **六边形架构与分层架构的区别是什么？什么场景下适合用六边形架构？**
8. **模块化单体相比微服务的优势在哪里？什么情况下应该从单体拆分为微服务？**
9. **API 版本管理的几种策略，你推荐哪种，为什么？**
10. **蓝绿部署和灰度发布的区别？如何实现自动回滚？**

### 实战

11. **你负责的项目曾遇到过最严重的架构问题是什么？如何解决的？**
12. **如何保证数据库迁移脚本在多人协作时不冲突？**
13. **你们项目如何管理配置？敏感信息如何处理？**
14. **CI/CD 流水线中你做过哪些质量门禁？**
15. **如果一个旧项目没有单元测试、没有 CI、代码耦合严重，你会怎么改造？**

## 12. 在我的项目中如何使用

### 12.1 起步阶段（MVP）

1. **Git**：简单的分支策略，`main` + 短命 feature 分支
2. **Maven**：单模块起步，快速验证
3. **代码规范**：引入 Spotless + Checkstyle
4. **分层**：Controller → Service → Repository 三层结构
5. **数据库**：Flyway 初始化（即使只有一个表）

### 12.2 成长阶段

1. **拆多模块**：`common` → `domain` → `infrastructure` → `web`
2. **Git 规范**：引入 Git Flow 或 GitLab Flow
3. **CI/CD**：搭建 GitHub Actions / GitLab CI
4. **API 版本**：URL Path 方式 `/api/v1/`
5. **配置管理**：`application-{profile}.yml` + 本地配置中心

### 12.3 成熟阶段

1. **架构升级**：考虑六边形架构或 Clean Architecture
2. **DDD**：对核心业务域引入领域模型
3. **模块化单体**：将模块接口化，为微服务拆分做准备
4. **灰度发布**：引入灰度路由 + 监控大盘
5. **蓝绿部署**：Kubernetes + Service Mesh 实现

### 12.4 具体行动清单

```markdown
- [ ] 初始化 Git 仓库，配置 .gitignore
- [ ] 创建 Maven 父 POM，引入常用 BOM（Spring Boot、Cloud）
- [ ] 配置 Spotless 并集成到 build 生命周期
- [ ] 添加 Flyway 依赖，创建 V1 初始化脚本
- [ ] 划分包结构：controller / service / repository / domain / dto
- [ ] 配置多环境 application.yml
- [ ] 搭建 GitHub Actions CI（编译 + 测试 + 代码检查）
- [ ] 当模块超过 3 个时，拆分 Maven 多模块
- [ ] 当核心业务逻辑变复杂时，引入 DDD
- [ ] 当需要独立部署时，拆分为模块化单体
- [ ] 当模块化单体不够用时，再考虑微服务
```

> **核心原则：分期治理，不要一步到位。好的架构不是设计出来的，是演进出来的。**
