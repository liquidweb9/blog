# Web框架与项目分层

## 1. 它是什么

Web框架（Web Framework）是构建Web应用程序的基础设施软件，它提供了一套标准化的架构和工具，帮助开发者快速、稳定地构建Web服务。Spring Boot是目前Java生态中最主流的Web框架，它基于Spring Framework，通过自动配置（Auto-Configuration）和起步依赖（Starter）大幅简化了Spring应用的搭建和开发过程。

项目分层（Layered Architecture）是一种软件架构模式，将应用程序按照职责划分为多个层次，每一层有明确的边界和职责。一个规范的Spring Boot项目通常包含以下层次和包结构：

| 层次/包名 | 职责 |
|---|---|
| `controller` | 接收HTTP请求，调用Service层，返回响应 |
| `application` | 应用层入口，启动类、应用配置等 |
| `domain` | 领域模型，核心业务逻辑（DDD风格） |
| `service` | 业务逻辑处理层，编排领域对象和基础设施 |
| `repository` | 数据访问抽象层，定义接口 |
| `mapper` | MyBatis映射接口，定义SQL映射方法 |
| `entity/do` | 数据实体，与数据库表一一对应 |
| `dto` | 数据传输对象，用于接收参数或跨层传输 |
| `vo` | 视图对象，封装返回给前端的数据 |
| `config` | 配置类，各种Bean定义和第三方集成配置 |
| `exception` | 自定义异常类及全局异常处理 |
| `security` | 安全相关逻辑，认证、授权、鉴权 |
| `common` | 通用工具类、常量、统一返回结构、基础枚举 |
| `enums` | 枚举定义 |

### 不同对象的区别与使用场景

| 对象类型 | 全称 | 定义 | 使用场景 | 与数据库关系 |
|---|---|---|---|---|
| **Entity / DO** | Entity / Data Object | 与数据库表结构完全对应的Java类，每个字段映射到表的一列 | ORM框架（MyBatis、JPA）的数据载体，直接用于数据库读写操作 | 强关联，字段、类型、关系一一对应 |
| **DTO** | Data Transfer Object | 用于在不同层之间传输数据的对象，封装了需要传递的参数 | Controller接收请求参数、Service之间传递数据、远程调用参数 | 无关，仅按需定义字段 |
| **VO** | View Object | 封装返回给前端展示的数据的对象 | Controller返回给前端的响应数据 | 无关，按前端展示需求定义字段 |
| **BO** | Business Object | 封装业务逻辑处理过程中的数据和行为的对象 | Service层内部使用，组合多个Entity或DTO的数据进行业务处理 | 部分关联，可能组合多个表的数据 |
| **POJO** | Plain Old Java Object | 普通Java对象的统称，没有任何特殊约束 | 泛指上述所有对象，或简单的数据载体 | 视具体用途而定 |

**设计原则：** 各层之间通过DTO传递数据，避免直接暴露Entity给外部；VO仅包含前端需要的字段，不泄露内部数据结构；BO承载业务逻辑，不参与网络传输。

## 2. 为什么需要它

### 为什么需要Web框架

- **避免重复造轮子：** HTTP协议解析、请求路由、参数绑定、会话管理、安全防护等通用功能无需重复实现。
- **规范开发流程：** 提供统一的开发模式和约定，降低团队协作成本。
- **生态整合：** 框架集成了大量第三方库（数据库、缓存、消息队列等）的适配，开箱即用。
- **性能与安全：** 框架通常经过大规模验证，内置了对常见攻击（SQL注入、XSS、CSRF）的防护。

### 为什么需要项目分层

- **关注点分离（Separation of Concerns）：** 每层只关心自己的职责，降低代码耦合度。
- **可维护性：** 修改某一层的实现不影响其他层（如替换数据库ORM不影响上层业务逻辑）。
- **可测试性：** 每层可以独立进行单元测试，Mock依赖层即可。
- **可扩展性：** 清晰的边界使得新增功能更容易，也便于分团队并行开发。
- **复用性：** 通用的逻辑（如参数校验、异常处理、日志）可以集中管理，避免散落在各处。

## 3. 它解决什么问题

| 问题 | 解决方案 |
|---|---|
| HTTP请求处理繁琐 | Spring MVC自动将请求映射到Controller方法，自动解析参数、绑定POJO |
| 对象间依赖管理混乱 | Spring IoC容器接管对象创建和依赖注入，由容器管理Bean的生命周期 |
| 数据库操作代码冗余 | MyBatis / MyBatis-Plus通过Mapper接口映射SQL，减少JDBC样板代码 |
| 异常处理重复 | `@ControllerAdvice` + `@ExceptionHandler` 统一处理全局异常 |
| 参数校验代码散落 | `@Valid` / `@Validated` + 校验注解声明式校验参数 |
| 事务管理复杂 | `@Transactional` 声明式事务管理，无需手动开启/提交/回滚事务 |
| 配置管理混乱 | `application.yml` + `@ConfigurationProperties` 集中管理配置，支持多环境 |
| 跨层数据混乱 | 通过Entity/DTO/VO/BO的分层隔离，避免内部结构泄露和循环依赖 |

## 4. 核心原理

### 4.1 Spring IoC（控制反转）与依赖注入（DI）

IoC（Inversion of Control）是一种设计原则，将对象的创建和管理权交给容器。Spring IoC容器负责实例化、配置和组装Bean。

**DI（Dependency Injection）** 是IoC的具体实现方式，主要有三种注入方式：

```java
// 1. 构造器注入（推荐，保证依赖不可变）
@Component
public class UserService {
    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
}

// 2. Setter注入
@Component
public class UserService {
    private UserRepository userRepository;

    @Autowired
    public void setUserRepository(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
}

// 3. 字段注入（不推荐，不利于测试和不可变性）
@Component
public class UserService {
    @Autowired
    private UserRepository userRepository;
}
```

**容器工作原理：**
1. 扫描指定包路径下的类，筛选出带有 `@Component` 及其派生注解的类
2. 解析Bean定义，包括作用域（singleton/prototype）、生命周期回调、初始化方法等
3. 通过反射实例化Bean，并解析依赖关系进行注入
4. 执行BeanPostProcessor进行后置处理（如AOP代理的创建）
5. 将就绪的Bean保存在容器中（默认单例）

### 4.2 Spring AOP（面向切面编程）

AOP（Aspect-Oriented Programming）通过预编译方式和运行期动态代理，在不修改源代码的情况下给程序动态添加功能。

**核心概念：**
- **JoinPoint：** 程序执行的某个点（如方法调用、异常抛出）
- **Pointcut：** 切点，定义在哪些JoinPoint上应用通知
- **Advice：** 通知，在切点上执行的具体逻辑（Before/After/AfterReturning/AfterThrowing/Around）
- **Aspect：** 切面，Pointcut + Advice的组合
- **Weaving：** 将切面应用到目标对象的过程（Spring在运行时通过动态代理实现）

```java
@Aspect
@Component
public class LoggingAspect {

    // 定义切点：匹配service包下所有类的所有方法
    @Pointcut("execution(* com.example.service.*.*(..))")
    public void serviceLayer() {}

    // 环绕通知
    @Around("serviceLayer()")
    public Object logExecutionTime(ProceedingJoinPoint joinPoint) throws Throwable {
        long start = System.currentTimeMillis();
        Object result = joinPoint.proceed();
        long elapsed = System.currentTimeMillis() - start;
        log.info("{} executed in {} ms", joinPoint.getSignature(), elapsed);
        return result;
    }
}
```

**实现机制：**
- 当目标类实现了接口，Spring使用JDK动态代理
- 当目标类没有实现接口，Spring使用CGLIB字节码增强生成子类代理

### 4.3 Spring Bean生命周期

Spring Bean的生命周期由容器管理，大致分为以下几个阶段：

```
实例化 → 属性赋值 → 初始化前 → 初始化 → 初始化后 → 使用 → 销毁
```

1. **实例化：** 容器通过反射创建Bean实例（调用构造器）
2. **属性赋值：** 注入Bean的依赖属性（如 `@Autowired`、`@Value`）
3. **初始化前：** 执行 `BeanPostProcessor.postProcessBeforeInitialization()`
4. **初始化：** 执行 `@PostConstruct` 注解方法或 `InitializingBean.afterPropertiesSet()` 或自定义 `init-method`
5. **初始化后：** 执行 `BeanPostProcessor.postProcessAfterInitialization()` — 这里通常是AOP创建代理对象的时机
6. **使用：** Bean就绪，被注入到其他Bean或客户端代码使用
7. **销毁：** 执行 `@PreDestroy` 注解方法或 `DisposableBean.destroy()` 或自定义 `destroy-method`

### 4.4 Spring MVC 请求流程

```
用户请求 → DispatcherServlet → HandlerMapping → HandlerAdapter → Controller → Service → DAO → DB
                                                                          ↓
用户响应 ← DispatcherServlet ← ViewResolver ← ModelAndView ← 处理后返回
```

**详细步骤：**

1. **DispatcherServlet（前端控制器）：** 接收所有HTTP请求，是整个流程的入口
2. **HandlerMapping：** 根据请求URL查找对应的Controller方法（Handler），返回HandlerExecutionChain（包含Handler和拦截器链）
3. **HandlerAdapter：** 调用Handler的实际执行器，负责参数解析、数据绑定、校验等
4. **拦截器（Interceptor）：** 在Handler执行前后执行横切逻辑（如权限检查、日志记录）
5. **Controller：** 执行业务逻辑，返回ModelAndView（视图+模型数据）或 `@ResponseBody` 数据
6. **异常处理：** 如果执行过程中抛出异常，由HandlerExceptionResolver处理
7. **ViewResolver：** 解析视图名称（如 `user/list` → `/WEB-INF/views/user/list.jsp`）
8. **渲染视图：** 将模型数据填充到视图中，生成HTML返回客户端

> 注：当前后端分离项目中（RESTful API），Controller通常使用 `@RestController`，直接返回JSON数据，跳过ViewResolver和视图渲染。

### 4.5 MyBatis 核心原理

- **SqlSessionFactory：** 基于配置文件构建，是MyBatis的核心工厂
- **SqlSession：** 数据库会话，提供增删改查操作
- **Mapper：** 接口代理，MyBatis通过JDK动态代理为Mapper接口生成实现类，将方法调用转换为SQL执行
- **动态SQL：** MyBatis通过OGNL表达式，在XML中提供 `<if>`、`<choose>`、`<foreach>` 等标签实现动态SQL拼接

### 4.6 SQL注入防护

- **#{}（预编译）：** MyBatis使用 `PreparedStatement` 的参数占位符 `?`，参数值由JDBC驱动转义，可有效防止SQL注入
- **${}（字符串拼接）：** 直接拼接SQL字符串，存在SQL注入风险，仅在表名、列名等元数据动态传入时使用，且必须手动校验过滤

```sql
-- 安全：使用 #{} 预编译
SELECT * FROM user WHERE id = #{id}

-- 危险：使用 ${} 拼接，会导致SQL注入
SELECT * FROM user WHERE name = '${name}'
```

## 5. 基本使用方法

### 5.1 Spring Boot 项目基础结构

```xml
<!-- pom.xml 关键依赖 -->
<dependencies>
    <!-- Web起步依赖 -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <!-- MyBatis-Plus -->
    <dependency>
        <groupId>com.baomidou</groupId>
        <artifactId>mybatis-plus-boot-starter</artifactId>
        <version>3.5.5</version>
    </dependency>
    <!-- 参数校验 -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <!-- MySQL驱动 -->
    <dependency>
        <groupId>com.mysql</groupId>
        <artifactId>mysql-connector-j</artifactId>
        <scope>runtime</scope>
    </dependency>
    <!-- Lombok -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>
</dependencies>
```

### 5.2 配置文件管理

```yaml
# application.yml — 主配置文件
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/demo?useUnicode=true&characterEncoding=UTF-8&useSSL=false
    username: root
    password: 123456
    driver-class-name: com.mysql.cj.jdbc.Driver

server:
  port: 8080

mybatis-plus:
  mapper-locations: classpath:/mapper/*.xml
  type-aliases-package: com.example.entity
  configuration:
    map-underscore-to-camel-case: true
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
```

```yaml
# application-dev.yml — 开发环境
server:
  port: 8081

spring:
  datasource:
    url: jdbc:mysql://localhost:3306/demo_dev
```

```yaml
# application-prod.yml — 生产环境
server:
  port: 80

spring:
  datasource:
    url: jdbc:mysql://prod-host:3306/demo_prod
```

**激活方式：** `spring.profiles.active=dev`（通过命令行参数 `--spring.profiles.active=dev` 或 `application.yml` 中配置）

### 5.3 统一返回结构

```java
// common/Result.java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> {
    private Integer code;
    private String message;
    private T data;
    private Long timestamp;

    public static <T> Result<T> success(T data) {
        return new Result<>(200, "success", data, System.currentTimeMillis());
    }

    public static <T> Result<T> success() {
        return success(null);
    }

    public static <T> Result<T> error(Integer code, String message) {
        return new Result<>(code, message, null, System.currentTimeMillis());
    }

    public static <T> Result<T> error(String message) {
        return error(500, message);
    }
}
```

### 5.4 全局异常处理

```java
// exception/GlobalExceptionHandler.java
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 参数校验异常
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return Result.error(400, msg);
    }

    // 业务异常
    @ExceptionHandler(BusinessException.class)
    public Result<Void> handleBusiness(BusinessException e) {
        return Result.error(e.getCode(), e.getMessage());
    }

    // 其他未捕获异常
    @ExceptionHandler(Exception.class)
    public Result<Void> handleUnknown(Exception e) {
        log.error("unexpected error", e);
        return Result.error(500, "服务器内部错误");
    }
}
```

### 5.5 参数校验

```java
// dto/CreateUserDTO.java
@Data
public class CreateUserDTO {

    @NotBlank(message = "用户名不能为空")
    @Size(min = 2, max = 20, message = "用户名长度必须在2-20之间")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$",
             message = "密码必须包含大小写字母和数字，长度至少8位")
    private String password;

    @Email(message = "邮箱格式不正确")
    private String email;

    @Min(value = 1, message = "年龄必须大于0")
    @Max(value = 150, message = "年龄必须小于150")
    private Integer age;

    @NotNull(message = "性别不能为空")
    private Integer gender;
}

// 分组校验
public interface CreateGroup {}
public interface UpdateGroup {}

// 使用分组
@NotNull(groups = UpdateGroup.class, message = "ID不能为空")
private Long id;

// Controller中使用
@PostMapping("/users")
public Result<UserVO> create(@Validated(CreateGroup.class) @RequestBody CreateUserDTO dto) { ... }
```

### 5.6 MyBatis-Plus 基本使用

```java
// entity/UserDO.java
@Data
@TableName("user")
public class UserDO {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;
    private String password;
    private String email;
    private Integer age;
    private Integer gender;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}

// mapper/UserMapper.java
@Mapper
public interface UserMapper extends BaseMapper<UserDO> {
    // 继承BaseMapper即可获得基本CRUD方法
}

// service/UserService.java
public interface UserService extends IService<UserDO> {
    Page<UserDO> searchUsers(String keyword, Integer page, Integer size);
}

// service/impl/UserServiceImpl.java
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, UserDO> implements UserService {

    @Override
    public Page<UserDO> searchUsers(String keyword, Integer page, Integer size) {
        LambdaQueryWrapper<UserDO> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(StringUtils.isNotBlank(keyword), UserDO::getUsername, keyword)
               .or()
               .like(StringUtils.isNotBlank(keyword), UserDO::getEmail, keyword);
        return page(new Page<>(page, size), wrapper);
    }
}
```

### 5.7 分页操作

```java
// 1. MyBatis-Plus 分页配置
@Configuration
public class MyBatisPlusConfig {
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }
}

// 2. 分页查询
public Result<PageResult<UserVO>> listUsers(int page, int size) {
    Page<UserDO> pageResult = userService.page(new Page<>(page, size));
    List<UserVO> voList = pageResult.getRecords().stream()
            .map(userDO -> {
                UserVO vo = new UserVO();
                BeanUtils.copyProperties(userDO, vo);
                return vo;
            })
            .collect(Collectors.toList());
    return Result.success(new PageResult<>(voList, pageResult.getTotal()));
}
```

### 5.8 批量操作

```java
// 批量插入（MyBatis-Plus）
public void batchInsert(List<UserDO> userList) {
    userService.saveBatch(userList, 1000); // 每批次1000条
}

// 批量更新
public void batchUpdate(List<UserDO> userList) {
    userService.updateBatchById(userList, 500);
}

// 批量删除
public void batchDelete(List<Long> ids) {
    userService.removeByIds(ids);
}

// MyBatis XML 批量插入（性能最优）
<insert id="batchInsert" parameterType="list">
    INSERT INTO user (username, password, email, age, gender)
    VALUES
    <foreach collection="list" item="item" separator=",">
        (#{item.username}, #{item.password}, #{item.email}, #{item.age}, #{item.gender})
    </foreach>
</insert>
```

### 5.9 动态SQL

```xml
<select id="selectByCondition" resultType="com.example.entity.UserDO">
    SELECT * FROM user
    <where>
        <if test="username != null and username != ''">
            AND username LIKE CONCAT('%', #{username}, '%')
        </if>
        <if test="email != null and email != ''">
            AND email = #{email}
        </if>
        <if test="ageMin != null">
            AND age >= #{ageMin}
        </if>
        <if test="ageMax != null">
            AND age &lt;= #{ageMax}
        </if>
        <if test="gender != null">
            AND gender = #{gender}
        </if>
    </where>
    ORDER BY id DESC
</select>
```

### 5.10 日志管理

```yaml
# application.yml 日志配置
logging:
  level:
    root: INFO
    com.example: DEBUG
    com.baomidou.mybatisplus: DEBUG
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n"
    file: "%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n"
  file:
    name: logs/app.log
    max-size: 100MB
    max-history: 30
```

```xml
<!-- logback-spring.xml 更精细的日志配置 -->
<configuration>
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%thread] %highlight(%-5level) %cyan(%logger{36}) - %msg%n</pattern>
        </encoder>
    </appender>

    <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>logs/app.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>logs/app.%d{yyyy-MM-dd}.%i.log</fileNamePattern>
            <maxHistory>30</maxHistory>
            <timeBasedFileNamingAndTriggeringPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedFNATP">
                <maxFileSize>100MB</maxFileSize>
            </timeBasedFileNamingAndTriggeringPolicy>
        </rollingPolicy>
        <encoder>
            <pattern>%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <!-- 生产环境异步输出 -->
    <appender name="ASYNC" class="ch.qos.logback.classic.AsyncAppender">
        <appender-ref ref="FILE"/>
        <queueSize>512</queueSize>
        <discardingThreshold>0</discardingThreshold>
    </appender>

    <root level="INFO">
        <appender-ref ref="CONSOLE"/>
        <appender-ref ref="ASYNC"/>
    </root>
</configuration>
```

在代码中使用日志：

```java
@Slf4j
@Service
public class UserServiceImpl implements UserService {
    public UserVO getUserById(Long id) {
        log.info("query user by id: {}", id);
        // 业务逻辑...
        log.debug("query result: {}", result);
        return result;
    }
}
```

### 5.11 Spring 事务管理

```java
// 声明式事务（推荐）
@Service
public class OrderService {

    @Transactional(rollbackFor = Exception.class)
    public void createOrder(CreateOrderDTO dto) {
        // 1. 创建订单
        orderMapper.insert(orderDO);
        // 2. 扣减库存
        inventoryMapper.decreaseStock(dto.getProductId(), dto.getQuantity());
        // 3. 记录日志
        logMapper.insert(logDO);
        // 整个过程任何一步失败都会回滚所有操作
    }

    // 事务传播行为示例
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logOperation(String operation) {
        // 独立事务，不受外部事务影响
    }

    // 事务隔离级别
    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public List<OrderDO> queryOrders() { ... }
}
```

**事务传播行为：**

| 传播行为 | 描述 |
|---|---|
| `REQUIRED`（默认） | 当前有事务则加入，没有则新建 |
| `SUPPORTS` | 当前有事务则加入，没有则以非事务方式执行 |
| `MANDATORY` | 必须在事务中执行，否则抛异常 |
| `REQUIRES_NEW` | 总是新建事务，暂停当前事务 |
| `NOT_SUPPORTED` | 以非事务方式执行，暂停当前事务 |
| `NEVER` | 以非事务方式执行，有事务则抛异常 |
| `NESTED` | 嵌套事务（JDBC Savepoint机制） |

**注意事项：**
- `@Transactional` 默认只回滚 `RuntimeException` 和 `Error`，`rollbackFor = Exception.class` 可覆盖所有异常
- 同一个类内部的非事务方法调用事务方法，事务会失效（因为Spring AOP代理机制，内部调用不经过代理）
- `@Transactional` 方法必须是 `public` 的

## 6. 工程中的典型实现

### 6.1 完整的分层代码示例

```
com.example
├── common
│   ├── Result.java                  // 统一返回结构
│   ├── PageResult.java              // 分页返回结构
│   └── BaseEnum.java                // 枚举接口
├── config
│   ├── MyBatisPlusConfig.java       // MyBatis-Plus分页插件
│   ├── JacksonConfig.java           // JSON序列化配置
│   └── CorsConfig.java              // 跨域配置
├── controller
│   └── UserController.java          // 用户接口
├── dto
│   ├── request
│   │   ├── CreateUserDTO.java       // 创建用户请求
│   │   └── LoginDTO.java            // 登录请求
│   └── response
│       └── UserVO.java              // 用户视图对象
├── entity
│   └── UserDO.java                  // 用户数据实体
├── enums
│   └── UserStatusEnum.java          // 用户状态枚举
├── exception
│   ├── BusinessException.java       // 业务异常
│   ├── ErrorCode.java               // 错误码枚举
│   └── GlobalExceptionHandler.java  // 全局异常处理器
├── mapper
│   └── UserMapper.java              // MyBatis映射接口
├── service
│   ├── UserService.java             // 用户服务接口
│   └── impl
│       └── UserServiceImpl.java     // 用户服务实现
└── Application.java                 // 启动类
```

```java
// controller/UserController.java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping
    public Result<UserVO> create(@Validated @RequestBody CreateUserDTO dto) {
        UserVO vo = userService.createUser(dto);
        return Result.success(vo);
    }

    @GetMapping("/{id}")
    public Result<UserVO> getById(@PathVariable Long id) {
        return Result.success(userService.getUserById(id));
    }

    @GetMapping
    public Result<PageResult<UserVO>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword) {
        return Result.success(userService.listUsers(keyword, page, size));
    }

    @PutMapping("/{id}")
    public Result<UserVO> update(@PathVariable Long id,
                                  @Validated(UpdateGroup.class) @RequestBody CreateUserDTO dto) {
        return Result.success(userService.updateUser(id, dto));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        userService.deleteUser(id);
        return Result.success();
    }
}

// service/impl/UserServiceImpl.java
@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserVO createUser(CreateUserDTO dto) {
        // 1. 校验用户名唯一性
        Long count = userMapper.selectCount(
                new LambdaQueryWrapper<UserDO>()
                        .eq(UserDO::getUsername, dto.getUsername()));
        if (count > 0) {
            throw new BusinessException(ErrorCode.USERNAME_EXISTS);
        }

        // 2. DTO → DO 转换
        UserDO userDO = new UserDO();
        BeanUtils.copyProperties(dto, userDO);
        userDO.setPassword(passwordEncoder(dto.getPassword()));
        userDO.setStatus(UserStatusEnum.ACTIVE.getCode());

        // 3. 插入数据库
        userMapper.insert(userDO);

        // 4. DO → VO 返回
        UserVO vo = new UserVO();
        BeanUtils.copyProperties(userDO, vo);
        log.info("user created: {}", vo.getUsername());
        return vo;
    }

    @Override
    public UserVO getUserById(Long id) {
        UserDO userDO = userMapper.selectById(id);
        if (userDO == null) {
            throw new BusinessException(ErrorCode.USER_NOT_FOUND);
        }
        UserVO vo = new UserVO();
        BeanUtils.copyProperties(userDO, vo);
        return vo;
    }

    @Override
    public PageResult<UserVO> listUsers(String keyword, int page, int size) {
        Page<UserDO> pageResult = userMapper.selectPage(
                new Page<>(page, size),
                new LambdaQueryWrapper<UserDO>()
                        .like(StringUtils.isNotBlank(keyword), UserDO::getUsername, keyword)
                        .orderByDesc(UserDO::getId));

        List<UserVO> voList = pageResult.getRecords().stream()
                .map(do_ -> {
                    UserVO vo = new UserVO();
                    BeanUtils.copyProperties(do_, vo);
                    return vo;
                })
                .collect(Collectors.toList());

        return new PageResult<>(voList, pageResult.getTotal());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserVO updateUser(Long id, CreateUserDTO dto) {
        UserDO userDO = userMapper.selectById(id);
        if (userDO == null) {
            throw new BusinessException(ErrorCode.USER_NOT_FOUND);
        }
        BeanUtils.copyProperties(dto, userDO, "password");
        if (StringUtils.isNotBlank(dto.getPassword())) {
            userDO.setPassword(passwordEncoder(dto.getPassword()));
        }
        userMapper.updateById(userDO);

        UserVO vo = new UserVO();
        BeanUtils.copyProperties(userDO, vo);
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteUser(Long id) {
        UserDO userDO = userMapper.selectById(id);
        if (userDO == null) {
            throw new BusinessException(ErrorCode.USER_NOT_FOUND);
        }
        userMapper.deleteById(id);
        log.warn("user deleted: id={}", id);
    }
}

// config/CorsConfig.java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}

// exception/ErrorCode.java
@Getter
@AllArgsConstructor
public enum ErrorCode {
    USERNAME_EXISTS(4001, "用户名已存在"),
    USER_NOT_FOUND(4002, "用户不存在"),
    PASSWORD_ERROR(4003, "密码错误"),
    INVALID_PARAM(4004, "参数错误");

    private final int code;
    private final String message;
}

// exception/BusinessException.java
@Getter
public class BusinessException extends RuntimeException {
    private final int code;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.code = errorCode.getCode();
    }

    public BusinessException(ErrorCode errorCode, String message) {
        super(message);
        this.code = errorCode.getCode();
    }

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }
}
```

### 6.2 枚举定义

```java
// enums/UserStatusEnum.java
public enum UserStatusEnum implements BaseEnum<Integer> {
    ACTIVE(1, "正常"),
    INACTIVE(0, "禁用"),
    DELETED(-1, "已删除");

    private final int code;
    private final String desc;

    UserStatusEnum(int code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    @Override
    public Integer getCode() {
        return code;
    }

    @Override
    public String getDesc() {
        return desc;
    }
}
```

### 6.3 多环境配置实战

```yaml
# application.yml
spring:
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:dev}   # 默认激活dev环境

---
# application-dev.yml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/demo_dev
    username: root
    password: 123456

---
# application-prod.yml
spring:
  datasource:
    url: jdbc:mysql://prod-db:3306/demo
    username: admin
    password: ${DB_PASSWORD}       # 生产密码通过环境变量注入
```

### 6.4 自定义配置映射

```java
// config/properties/AppProperties.java
@Data
@ConfigurationProperties(prefix = "app")
@Component
public class AppProperties {
    private String name;
    private String version;
    private Upload upload = new Upload();
    private Jwt jwt = new Jwt();

    @Data
    public static class Upload {
        private String path;
        private long maxSize;
        private List<String> allowedTypes;
    }

    @Data
    public static class Jwt {
        private String secret;
        private long expiration;
    }
}

// application.yml
app:
  name: demo-app
  version: 1.0.0
  upload:
    path: /data/uploads
    max-size: 10485760
    allowed-types:
      - image/jpeg
      - image/png
      - application/pdf
  jwt:
    secret: ${JWT_SECRET}
    expiration: 86400000
```

## 7. 常见失败场景

### 7.1 MyBatis-Plus分页失效

**现象：** 分页查询返回所有数据，未正确分页。

**原因：** 没有配置 `PaginationInnerInterceptor`。

**解决：**

```java
@Configuration
public class MyBatisPlusConfig {
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }
}
```

### 7.2 事务失效

**现象：** 方法抛出异常但数据没有回滚。

**常见原因与解决方案：**

| 原因 | 解决方案 |
|---|---|
| 同类内部方法调用，不走代理 | 注入自身代理（`@Autowired` + `@Lazy`），或将方法拆分到不同类 |
| 方法不是 `public` | 将方法改为 `public` |
| 异常被 `try-catch` 吞掉 | 不要吞异常，或手动 `TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()` |
| 异常类型不匹配（非RuntimeException） | 指定 `rollbackFor = Exception.class` |
| 数据库引擎不支持事务（如MyISAM） | 改用InnoDB引擎 |

### 7.3 循环依赖

**现象：** 启动报错 `BeanCurrentlyInCreationException`。

**原因：** Bean A 依赖 Bean B，Bean B 依赖 Bean A。

**解决方案：**
- 使用 `@Lazy` 延迟加载
- 改用 Setter 注入而非构造器注入（不推荐）
- 重构设计，消除相互依赖（推荐）

### 7.4 大事务问题

**现象：** 事务执行时间过长，导致数据库连接长时间占用、锁竞争、死锁。

**解决方案：**
- 将大事务拆分为多个小事务
- 事务内只做核心写操作，查询放到事务外
- 使用 `@Transactional(timeout = 30)` 设置超时时间
- 批量操作控制每批次大小

**反例：**

```java
@Transactional
public void processBatch() {
    // 1. 查询所有数据（大量数据）
    List<Data> list = mapper.selectAll();  // 在事务内做查询，无意义
    for (Data data : list) {
        // 2. 调用远程RPC接口
        String result = rpcClient.call(data);  // 远程调用放在事务内
        // 3. 更新数据库
        data.setResult(result);
        mapper.updateById(data);
    }
}

// 正例
public void processBatch() {
    // 1. 查询放在事务外
    List<Data> list = mapper.selectAll();
    for (Data data : list) {
        // 2. RPC调用放在事务外
        String result = rpcClient.call(data);
        // 3. 写操作放在事务内
        updateData(data.getId(), result);
    }
}

@Transactional
public void updateData(Long id, String result) {
    Data data = mapper.selectById(id);
    data.setResult(result);
    mapper.updateById(data);
}
```

### 7.5 参数校验不生效

**现象：** `@Valid` 或 `@Validated` 不生效，请求参数未校验。

**解决方案：**
- 确保引入了 `spring-boot-starter-validation`
- Controller类上需要 `@RestController` 或 `@Controller` + `@ResponseBody`
- `@RequestBody` 参数上加上 `@Valid` 或 `@Validated`
- GET请求的 `@RequestParam` 参数可以在类级别使用 `@Validated` 配合方法参数上的校验注解

### 7.6 批量操作性能问题

**现象：** 批量插入/更新1000条数据耗时数秒。

**原因：** 逐条执行SQL，产生大量数据库连接往返。

**优化：**
- MyBatis-Plus `saveBatch()` 底层实际上是逐条执行（虽然按批次提交），大数量时建议用XML foreach批处理
- JDBC连接参数增加 `rewriteBatchedStatements=true`
- 批量更新可以使用 `CASE WHEN` 语法

## 8. 如何调试

### 8.1 查看Spring Boot启动日志

```bash
# 开启DEBUG日志
logging.level.org.springframework=DEBUG
logging.level.com.example=DEBUG
```

### 8.2 查看HTTP请求/响应

```yaml
# 开启Spring MVC请求日志
logging.level.org.springframework.web.servlet=DEBUG
# 或开启所有请求日志
logging.level.org.apache.tomcat=DEBUG
```

### 8.3 查看MyBatis SQL日志

```yaml
# application.yml
mybatis-plus:
  configuration:
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl

# 或更细粒度控制
logging.level.com.example.mapper=DEBUG
```

输出示例：
```
==>  Preparing: SELECT * FROM user WHERE id = ?
==> Parameters: 1(Long)
<==    Columns: id, username, password, email, age, gender, create_time, update_time
<==        Row: 1, admin, ****, admin@example.com, 25, 1, 2024-01-01 10:00:00, 2024-01-01 10:00:00
<==      Total: 1
```

### 8.4 查看事务执行情况

```yaml
logging.level.org.springframework.transaction=TRACE
logging.level.org.springframework.jdbc.datasource.DataSourceTransactionManager=TRACE
```

### 8.5 使用Actuator端点

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

```yaml
# 暴露所有端点
management:
  endpoints:
    web:
      exposure:
        include: "*"
  endpoint:
    beans:
      enabled: true
    health:
      show-details: always
```

访问 `http://localhost:8080/actuator/beans` 查看所有Bean的详细信息，用于排查Bean注入问题。

### 8.6 常见调试技巧

```java
// 1. 获取当前是否在事务中
TransactionSynchronizationManager.isActualTransactionActive()

// 2. 获取当前事务名称
TransactionSynchronizationManager.getCurrentTransactionName()

// 3. 查看Bean的代理类型
System.out.println(AopUtils.isAopProxy(userService));       // JDK动态代理
System.out.println(AopUtils.isCglibProxy(userService));     // CGLIB代理
```

## 9. 如何测试

### 9.1 依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>test</scope>
</dependency>
```

### 9.2 单元测试（Service层）

```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserMapper userMapper;

    @InjectMocks
    private UserServiceImpl userService;

    @Test
    void getUserById_ShouldReturnUser_WhenUserExists() {
        // Arrange
        Long id = 1L;
        UserDO mockUser = new UserDO();
        mockUser.setId(id);
        mockUser.setUsername("test");
        mockUser.setEmail("test@example.com");
        when(userMapper.selectById(id)).thenReturn(mockUser);

        // Act
        UserVO result = userService.getUserById(id);

        // Assert
        assertNotNull(result);
        assertEquals("test", result.getUsername());
        verify(userMapper, times(1)).selectById(id);
    }

    @Test
    void getUserById_ShouldThrowException_WhenUserNotFound() {
        // Arrange
        when(userMapper.selectById(anyLong())).thenReturn(null);

        // Act & Assert
        assertThrows(BusinessException.class,
                () -> userService.getUserById(999L));
    }
}
```

### 9.3 集成测试（Controller层）

```java
@SpringBootTest
@AutoConfigureMockMvc
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserMapper userMapper;

    @BeforeEach
    void setUp() {
        userMapper.delete(null); // 清理测试数据
    }

    @Test
    void createUser_ShouldReturnSuccess() throws Exception {
        String requestBody = """
                {
                    "username": "testuser",
                    "password": "Test1234",
                    "email": "test@example.com",
                    "age": 25,
                    "gender": 1
                }
                """;

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.username").value("testuser"));
    }

    @Test
    void createUser_ShouldReturn400_WhenValidationFails() throws Exception {
        String requestBody = """
                {
                    "username": "",
                    "password": "123",
                    "email": "invalid-email"
                }
                """;

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())  // 统一返回200，内部code异常
                .andExpect(jsonPath("$.code").value(400));
    }
}
```

### 9.4 测试分层原则

| 测试层次 | 测试目标 | Mock范围 | 执行速度 |
|---|---|---|---|
| 单元测试 | Service层核心业务逻辑 | 全部外部依赖（DAO、RPC） | 毫秒级 |
| 集成测试 | Controller层接口行为 | DAO使用真实数据库（H2/测试库） | 秒级 |
| 端到端测试 | 完整业务流程 | 不Mock | 分钟级 |

## 10. 如何监控

### 10.1 Spring Boot Actuator 健康检查

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,env,loggers
  endpoint:
    health:
      show-details: when-authorized
```

```java
// 自定义健康指示器
@Component
public class DatabaseHealthIndicator implements HealthIndicator {
    @Autowired
    private DataSource dataSource;

    @Override
    public Health health() {
        try (Connection conn = dataSource.getConnection()) {
            if (conn.isValid(1000)) {
                return Health.up().withDetail("database", "reachable").build();
            } else {
                return Health.down().withDetail("database", "unreachable").build();
            }
        } catch (Exception e) {
            return Health.down(e).build();
        }
    }
}
```

### 10.2 SQL性能监控

```yaml
# 开启慢SQL监控（Druid）
spring:
  datasource:
    druid:
      filter:
        stat:
          enabled: true
          log-slow-sql: true
          slow-sql-millis: 1000

# MyBatis-Plus SQL分析打印
mybatis-plus:
  configuration:
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
```

### 10.3 请求监控

```java
// AOP实现接口耗时监控
@Aspect
@Component
public class ApiMonitorAspect {

    @Pointcut("execution(* com.example.controller.*.*(..))")
    public void apiEndpoint() {}

    @Around("apiEndpoint()")
    public Object monitor(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.currentTimeMillis();
        String method = pjp.getSignature().toShortString();

        try {
            Object result = pjp.proceed();
            long elapsed = System.currentTimeMillis() - start;
            log.info("[MONITOR] {} → success, {}ms", method, elapsed);
            if (elapsed > 1000) {
                log.warn("[SLOW-API] {} took {}ms", method, elapsed);
            }
            return result;
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[MONITOR] {} → error, {}ms: {}", method, elapsed, e.getMessage());
            throw e;
        }
    }
}
```

### 10.4 自定义指标（Micrometer）

```java
@Component
public class UserMetrics {
    private final Counter userCreateCounter;
    private final Timer userQueryTimer;

    public UserMetrics(MeterRegistry registry) {
        this.userCreateCounter = registry.counter("user.create.count");
        this.userQueryTimer = registry.timer("user.query.time");
    }

    public void recordUserCreated() {
        userCreateCounter.increment();
    }

    public <T> T recordUserQuery(Supplier<T> supplier) {
        return userQueryTimer.record(supplier);
    }
}
```

### 10.5 日志聚合与告警

通过ELK（Elasticsearch + Logstash + Kibana）或Loki + Grafana将应用日志集中管理，配置关键告警规则：

| 告警规则 | 阈值 | 通知渠道 |
|---|---|---|
| 接口5xx错误率 | > 1% in 5min | 钉钉/企业微信 |
| 接口响应时间P99 | > 2000ms | 邮件 |
| SQL慢查询 | > 10次/min | 消息推送 |
| 数据库连接池耗尽 | 活跃连接 > 80% | 电话/短信 |

## 11. 常见面试问题

### Q1: Spring IoC和DI的区别和联系？

**IoC（控制反转）** 是一种设计思想，将对象的创建和依赖关系的管理从程序代码中反转给容器。**DI（依赖注入）** 是IoC的具体实现方式，容器在创建Bean时自动将其依赖的其他Bean注入进去。IoC是目标，DI是手段。

### Q2: Spring AOP的实现原理是什么？

Spring AOP基于**动态代理**实现。如果目标类实现了接口，使用JDK动态代理（基于接口）；如果目标类没有实现接口，使用CGLIB（基于子类继承，通过字节码增强生成子类代理）。Spring Boot 2.x+默认使用CGLIB代理（`spring.aop.proxy-target-class=true`）。

### Q3: `@Autowired` 和 `@Resource` 的区别？

| 对比维度 | @Autowired | @Resource |
|---|---|---|
| 来源 | Spring | JSR-250（JDK） |
| 匹配方式 | 按类型注入（ByType），多个类型匹配时按名称 | 先按名称（ByName），再按类型 |
| 指定名称 | `@Qualifier` | `name`属性 |
| 构造器注入 | 支持 | 不支持 |

### Q4: `#{}` 和 `${}` 的区别，如何防止SQL注入？

- `#{}`：**预编译**参数占位符，MyBatis会将其替换为 `?`，参数值通过JDBC `PreparedStatement` 的 `setXxx()` 方法设置，由JDBC驱动进行转义，**安全**。
- `${}`：**字符串拼接**，MyBatis直接将参数值拼接到SQL中，**不安全**，存在SQL注入风险。
- **防护原则：** 默认使用 `#{}`；仅表名、列名、ORDER BY字段等元数据用 `${}`，且必须做白名单校验。

### Q5: `@Transactional` 事务失效的场景有哪些？

1. 同类内部方法调用，不经过代理对象
2. 方法不是 `public` 的
3. 异常被 `try-catch` 捕获未抛出
4. 异常类型不是 `RuntimeException` 且未配置 `rollbackFor`
5. 数据库引擎不支持事务（如MyISAM）
6. Spring事务管理器未正确配置

### Q6: 什么是循环依赖？Spring如何解决构造器注入的循环依赖？

**循环依赖**指A依赖B，B依赖A导致创建失败。Spring通过**三级缓存**解决**Setter注入**的循环依赖：
- 一级缓存：singletonObjects（完整Bean）
- 二级缓存：earlySingletonObjects（提前暴露的半成品Bean）
- 三级缓存：singletonFactories（Bean工厂，用于生成AOP代理）

**构造器注入的循环依赖无法解决**，会直接报错，因此推荐使用构造器注入可以提前暴露循环依赖问题。

### Q7: MyBatis-Plus 和 MyBatis 的区别？

| 对比维度 | MyBatis | MyBatis-Plus |
|---|---|---|
| 代码量 | 需要手写全部Mapper XML | 继承 `BaseMapper` 即可获得基础CRUD |
| 分页 | 手写分页SQL或使用PageHelper | 内置分页插件 |
| 条件构造 | 手动拼接SQL | LambdaQueryWrapper链式调用 |
| 自动填充 | 需自定义拦截器 | `@TableField(fill = ...)` 注解 |
| 逻辑删除 | 需手写逻辑 | `@TableLogic` 注解 |
| 性能损耗 | 无额外损耗 | 小小的解析损耗（可忽略） |

### Q8: Controller是单例还是多例？线程安全吗？

Controller默认是**单例**（`@Scope("singleton")`），多个请求共用一个Controller实例。因此**不能**在Controller中定义有状态的成员变量（如 `private int count`），否则会出现线程安全问题。局部变量和方法参数是线程安全的。

### Q9: 为什么要分层？VO和DTO可以合并吗？

分层将不同职责的代码隔离，便于维护、测试和团队协作。

VO和DTO不建议合并，原因：
1. VO只包含**前端需要**展示的字段，DTO可能包含更多字段（如密码、内部ID）
2. 前端展示需求变化时，修改VO不影响接口参数
3. 安全性：避免将内部字段（如密码hash、内部状态码）泄露给前端

### Q10: 统一返回结构有什么好处？

1. 前端可以统一解析响应格式，不用为每个接口单独处理
2. 全局异常处理可以统一包装错误信息
3. 统一code/msg结构便于前后端约定，也便于接入网关统一处理
4. 方便在所有接口调用链路上加入统一日志、监控

## 12. 在我的项目中如何使用

### 12.1 项目搭建步骤

1. **创建Spring Boot项目：** 使用Spring Initializr（https://start.spring.io/）生成项目骨架，选择以下依赖：
   - Spring Web
   - MyBatis Framework / MyBatis-Plus
   - MySQL Driver
   - Validation
   - Lombok
   - Spring Boot Actuator

2. **包结构创建：** 按第6节所示创建包结构。

3. **配置文件：** 创建 `application.yml`、`application-dev.yml`、`application-prod.yml`，配置数据库连接、端口、日志等。

4. **编写通用组件：**
   - `Result.java` — 统一返回结构
   - `GlobalExceptionHandler.java` — 全局异常处理
   - `BusinessException.java` — 业务异常
   - `MyBatisPlusConfig.java` — 分页插件配置

5. **按业务模块开发：**
   - 数据库设计 → 创建 `Entity` 类
   - 编写 `Mapper` 接口和 XML（或使用MyBatis-Plus自动映射）
   - 编写 `Service` 接口和实现
   - 编写 `Controller` 接口
   - 定义 `DTO` 和 `VO`

### 12.2 开发规范

```java
// 1. 分层调用链：Controller → Service(接口) → ServiceImpl → Mapper
//    Controller只做参数校验和路由，不包含业务逻辑

// 2. 依赖注入使用构造器方式（final + @RequiredArgsConstructor）
@RestController
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
}

// 3. 数据库操作异常由全局异常处理器统一处理
// 4. 所有接口返回 Result 统一结构
// 5. 敏感操作需要事务保护
```

### 12.3 最佳实践清单

| 项目 | 推荐实践 |
|---|---|
| 包命名 | `com.{公司}.{项目}.{模块}.{分层}` |
| Controller | 类上标注 `@RestController` + `@RequestMapping` |
| Service | 接口 + 实现分离 |
| 事务 | `@Transactional(rollbackFor = Exception.class)` |
| 校验 | `@Validated` + 分组校验 |
| 日志 | `@Slf4j`，使用 `{}` 占位符 |
| 分页 | MyBatis-Plus `Page` + `LambdaQueryWrapper` |
| 批量操作 | XML `<foreach>` 批量SQL |
| 枚举 | 实现 `BaseEnum` 接口，使用 `@JsonValue` |
| 配置 | `@ConfigurationProperties` 类型安全配置 |

### 12.4 典型业务处理流程

```
客户端请求
    ↓
【Controller】
  - 接收参数，@Validated校验
  - 调用Service
    ↓
【DTO】(请求参数)
    ↓
【Service】
  - 业务逻辑处理
  - DTO → DO 转换（参数校验、数据组装）
  - 调用Mapper操作数据库
  - DO → VO 转换
    ↓
【VO】(返回给前端的数据)
    ↓
【Controller】
  - 返回 Result.success(vo)
    ↓
客户端接收统一格式的JSON响应
```
