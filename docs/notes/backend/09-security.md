# 安全

---

## 1. 它是什么

Web安全（Web Security）是保护Web应用程序免受各种攻击和威胁的实践集合，涵盖认证、授权、数据传输安全、输入输出过滤、配置防护等多个方面。后端安全不是单一技术，而是一整套纵深防御（Defense in Depth）体系，每一层都承担着不同的防护职责。

| 安全领域 | 涵盖内容 | 防护目标 |
|---|---|---|
| 认证与授权 | Session、JWT、OAuth 2.0、OIDC | 确认身份、控制访问权限 |
| 权限模型 | RBAC、ABAC | 精细化资源访问控制 |
| 数据加密 | 密码哈希、传输加密、存储加密 | 保护数据机密性 |
| Web攻击防护 | CSRF、XSS、CORS、SQL注入 | 防止常见Web攻击 |
| 输入安全 | 文件上传校验、路径穿越防护 | 防止恶意输入 |
| 接口安全 | 接口签名、防重放 | 保证接口调用合法 |
| 基础设施 | 密钥管理、脱敏、多租户隔离 | 保证环境与数据安全 |

## 2. 为什么需要它

- **数据泄露风险：** 一次安全漏洞可能导致用户密码、身份证、银行卡等敏感数据被窃取，造成不可挽回的声誉和经济损失。
- **合规要求：** 各类监管对数据安全有明确要求，如《网络安全法》《数据安全法》《个人信息保护法》、GDPR、PCI-DSS 等，不合规将面临巨额罚款。
- **业务连续性：** 攻击（如DDoS、勒索软件）可能导致服务瘫痪，影响用户使用和公司营收。
- **信任基础：** 安全是用户信任的基石，频繁的安全事件会使用户流失。
- **开发成本：** 安全设计应在架构阶段就纳入考虑，事后修补的成本远高于前置设计。

## 3. 它解决什么问题

| 问题 | 安全措施 | 说明 |
|---|---|---|
| 用户身份如何确认 | Session认证 / JWT | 验证用户身份，防止伪造登录 |
| 用户能做什么操作 | RBAC / ABAC | 基于角色或属性控制资源访问 |
| 密码泄露怎么办 | 密码哈希（bcrypt/Argon2） | 即使数据库泄露，也无法还原密码 |
| 网络传输被窃听 | HTTPS / TLS | 加密传输通道，防止中间人攻击 |
| 跨站请求伪造 | CSRF Token / SameSite Cookie | 防止第三方网站冒充用户发起请求 |
| 跨站脚本攻击 | XSS过滤 / CSP | 防止恶意脚本在用户浏览器中执行 |
| SQL注入 | 预编译参数 / ORM | 防止拼接SQL导致数据泄露或篡改 |
| 文件上传后门 | 类型校验 / 内容检测 | 防止上传可执行文件或webshell |
| 接口被重放攻击 | 时间戳 + Nonce + 签名 | 保证请求的一次性和合法性 |
| 多租户数据互访 | 租户ID隔离 / 行级安全策略 | 确保租户之间数据不可见 |

## 4. 核心原理

### 4.1 认证（Authentication）与授权（Authorization）

**认证（AuthN）** 确认"你是谁"，**授权（AuthZ）** 确认"你能做什么"。两者虽然相关但职责完全不同。

#### 4.1.1 Session认证

基于服务端存储的会话机制：

```
1. 用户提交用户名密码
2. 服务端验证成功，创建 Session，将 Session ID 返回给客户端（通常写入 Cookie）
3. 客户端后续请求携带 Cookie（Session ID）
4. 服务端根据 Session ID 查找对应的会话数据，判断用户身份
```

**特点：**
- **有状态：** 服务端维护 Session 存储（内存/Redis/数据库），集群环境下需要会话共享（如 Spring Session + Redis）
- **安全性：** Session ID 应随机且不可预测，设置 HttpOnly、Secure、SameSite 属性
- **适用场景：** 传统 Web 应用、服务端渲染（SSR）

```java
// Spring Session + Redis 配置
@Configuration
@EnableRedisHttpSession(maxInactiveIntervalInSeconds = 3600)
public class SessionConfig {
}
```

#### 4.1.2 JWT（JSON Web Token）

无状态的令牌机制，用户信息编码在 Token 中，服务端不需要存储会话：

```
Header: { "alg": "HS256", "typ": "JWT" }
Payload: { "sub": "user123", "name": "张三", "iat": 1516239022, "exp": 1516242622 }
Signature: HMACSHA256(base64UrlEncode(header) + "." + base64UrlEncode(payload), secret)
```

**JWT 结构：** `header.payload.signature`

**特点：**
- **无状态：** 服务端不需要存储 Session，天然适合分布式、微服务场景
- **不可篡改：** Signature 由密钥签名，任何修改都会导致验签失败
- **可自包含：** Payload 中可包含用户信息、权限等，减少数据库查询
- **缺点：** Token 一旦签发无法撤销（除非维护黑名单）、Payload 仅 Base64 编码（非加密，不要放敏感信息）

```java
// JWT 生成与验证（使用 jjwt 库）
public class JwtUtil {
    private static final String SECRET = "your-256-bit-secret";
    private static final long EXPIRATION = 3600_000L; // 1小时

    public static String generateToken(String userId, String role) {
        return Jwts.builder()
                .setSubject(userId)
                .claim("role", role)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION))
                .signWith(SignatureAlgorithm.HS256, SECRET)
                .compact();
    }

    public static Claims parseToken(String token) {
        return Jwts.parser()
                .setSigningKey(SECRET)
                .parseClaimsJws(token)
                .getBody();
    }
}
```

**JWT vs Session：**

| 对比维度 | Session | JWT |
|---|---|---|
| 存储位置 | 服务端 | 客户端 |
| 状态 | 有状态 | 无状态 |
| 扩展性 | 需共享 Session（Redis） | 天然支持分布式 |
| 撤销能力 | 直接删除 Session | 需黑名单，否则有效期前无法撤销 |
| 大小 | Session ID 很小 | 较大（含 Payload） |
| 适用场景 | 传统 Web | REST API、微服务、移动端 |

#### 4.1.3 OAuth 2.0

OAuth 2.0 是一个**授权框架**，允许第三方应用在用户授权的前提下访问用户在服务商上的资源，而不需要泄露用户密码。

**核心角色：**
- **Resource Owner（资源所有者）：** 用户
- **Client（客户端）：** 第三方应用
- **Authorization Server（授权服务器）：** 认证和颁发令牌的服务
- **Resource Server（资源服务器）：** 存储用户资源的服务

**四种授权模式：**

| 模式 | 适用场景 | 流程简述 |
|---|---|---|
| 授权码模式（Authorization Code） | 服务端应用 | 用户授权 → 返回授权码 → 后端换 Token → 访问资源 |
| 隐式模式（Implicit，已弃用） | 纯前端（SPA） | 直接返回 Access Token（不安全，不再推荐） |
| 密码模式（Resource Owner Password） | 高度信任的第一方应用 | 直接使用用户名密码换 Token |
| 客户端凭证模式（Client Credentials） | 服务间调用 | 使用 client_id + client_secret 获取 Token |

**授权码模式（最常用）流程：**

```
1. 用户访问第三方应用 → 跳转到授权服务器登录页
2. 用户登录并授权 → 授权服务器返回 Authorization Code（回调URL）
3. 第三方应用后端用 Authorization Code + client_secret 换取 Access Token
4. 后续携带 Access Token 访问资源服务器
```

#### 4.1.4 OpenID Connect（OIDC）

OIDC 在 OAuth 2.0 之上增加了**身份认证**层，OAuth 2.0 只负责授权（颁发 Token），不负责认证（你是谁）。OIDC 通过 ID Token（JWT 格式）来传递用户身份信息。

```
OAuth 2.0: "你授权了这个应用访问你的数据"
OIDC:      "你的身份已确认，这是你的身份信息"
```

**ID Token 典型内容：**
```json
{
  "iss": "https://accounts.google.com",
  "sub": "110169484474386276334",
  "aud": "your-client-id",
  "exp": 1516242622,
  "iat": 1516239022,
  "name": "张三",
  "email": "zhangsan@example.com"
}
```

**常见 OIDC 流程：**
1. 客户端发起认证请求到 OpenID Provider（OP）
2. 用户登录并授权
3. OP 返回 ID Token（身份信息）+ Access Token（访问资源）
4. 客户端验签 ID Token 确认用户身份

### 4.2 权限模型

#### 4.2.1 RBAC（Role-Based Access Control）

基于角色的访问控制，权限不直接分配给用户，而是分配给角色，用户通过角色继承权限。

```
用户 → 角色 → 权限
```

**核心要素：**
- **用户（User）：** 系统使用者
- **角色（Role）：** 权限的集合，如 "管理员"、"普通用户"、"访客"
- **权限（Permission）：** 具体的操作，如 "创建订单"、"删除用户"

```sql
-- 核心表结构
CREATE TABLE user (
    id BIGINT PRIMARY KEY,
    username VARCHAR(50)
);

CREATE TABLE role (
    id BIGINT PRIMARY KEY,
    name VARCHAR(50) -- 'ADMIN', 'USER', 'GUEST'
);

CREATE TABLE permission (
    id BIGINT PRIMARY KEY,
    code VARCHAR(100) -- 'order:create', 'user:delete'
);

-- 关联表
CREATE TABLE user_role (
    user_id BIGINT,
    role_id BIGINT
);

CREATE TABLE role_permission (
    role_id BIGINT,
    permission_id BIGINT
);
```

**权限控制实现：**

```java
// Spring Security 方法级权限控制
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @PreAuthorize("hasPermission('order:create')")
    @PostMapping
    public Result<OrderVO> createOrder(@RequestBody CreateOrderDTO dto) {
        return Result.success(orderService.create(dto));
    }

    @PreAuthorize("hasPermission('order:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> deleteOrder(@PathVariable Long id) {
        orderService.delete(id);
        return Result.success();
    }
}
```

**RBAC 优点：** 模型简单直观，管理方便，适合大部分企业应用。
**RBAC 缺点：** 当权限维度复杂（如"部门A的经理可以查看本部门所有员工的工资，但不能查看部门B的"）时，RBAC 的粒度不够，需要引入 ABAC。

#### 4.2.2 ABAC（Attribute-Based Access Control）

基于属性的访问控制，根据**主体（用户）**、**资源（被访问对象）**、**环境（上下文）** 的属性动态计算权限。

```
决策 = f(用户属性, 资源属性, 环境属性)
```

**属性示例：**
- **用户属性：** 部门、职级、地理位置、安全等级
- **资源属性：** 资源类型、所属部门、密级
- **环境属性：** 时间、IP地址、设备类型

```java
// ABAC 核心接口
public interface PolicyEvaluator {
    boolean evaluate(
        Map<String, Object> userAttributes,
        Map<String, Object> resourceAttributes,
        Map<String, Object> environment
    );
}

// 示例：部门经理只能查看本部门员工的工资
public class SalaryPolicy implements PolicyEvaluator {
    @Override
    public boolean evaluate(Map<String, Object> user, 
                           Map<String, Object> resource,
                           Map<String, Object> env) {
        String userDept = (String) user.get("department");
        String userRole = (String) user.get("role");
        String resourceDept = (String) resource.get("ownerDepartment");

        // 部门经理 + 同部门 + 工作时间 = 允许
        return "MANAGER".equals(userRole)
            && userDept.equals(resourceDept)
            && isWorkingHours((Date) env.get("currentTime"));
    }
}
```

**ABAC 优点：** 灵活精细，支持动态策略，适合复杂业务场景。
**ABAC 缺点：** 策略管理复杂，性能开销较大（每次访问都需要计算），需要策略引擎支持。

### 4.3 密码哈希（Password Hashing）

密码**绝不能**明文存储。哈希是单向函数，不可逆（理论上）。但简单的哈希（如 MD5、SHA-1）已经被彩虹表攻破，必须使用**慢哈希算法**。

**推荐的密码哈希算法：**

| 算法 | 特点 | 推荐程度 |
|---|---|---|
| bcrypt | 内置盐值，可调工作因子（cost），最常用 | ★★★★★ |
| Argon2 | 内存硬算法，抵御 GPU 并行攻击，2015年密码哈希竞赛冠军 | ★★★★★ |
| scrypt | 内存硬算法，类似 Argon2 | ★★★★ |
| PBKDF2 | 标准算法，可加盐，但缺乏内存硬性 | ★★★ |

```java
// Spring Security BCrypt 使用
public class PasswordUtil {
    // 加密（每次结果不同，内置盐值）
    public static String hash(String password) {
        return BCrypt.hashpw(password, BCrypt.gensalt(12)); // cost=12
    }

    // 验证
    public static boolean verify(String password, String hashed) {
        return BCrypt.checkpw(password, hashed);
    }
}
```

```python
# Python bcrypt 示例
import bcrypt

salt = bcrypt.gensalt(rounds=12)
hashed = bcrypt.hashpw(b"my_password", salt)
bcrypt.checkpw(b"my_password", hashed)  # True
```

**关键原则：**
- 永远使用**加盐哈希**（Salt），防止彩虹表攻击
- 工作因子（Cost Factor）要足够高（bcrypt cost=10~14），使暴力破解的时间代价足够大
- 使用专门的密码哈希算法（bcrypt/Argon2），而不是通用哈希（MD5/SHA-256）

### 4.4 数据加密

数据加密分为传输加密和存储加密：

**传输加密：**
- **HTTPS/TLS：** 加密网络传输，防止中间人攻击（详见 4.5）
- **双向 TLS（mTLS）：** 服务间通信时，双方都出示证书进行身份验证

**存储加密：**
- **对称加密：** 加密和解密使用同一个密钥，速度快，适用于大量数据（AES-256-GCM 是推荐方案）
- **非对称加密：** 公钥加密、私钥解密，适用于密钥交换、数字签名（RSA、ECC）
- **字段级加密：** 对敏感字段（身份证号、手机号）单独加密，即使数据库泄露也无法解密

```java
// AES-256-GCM 加密示例
public class AesEncryptor {
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int IV_LENGTH = 12;

    public static byte[] encrypt(byte[] plaintext, SecretKey key) throws Exception {
        byte[] iv = new byte[IV_LENGTH];
        SecureRandom.getInstanceStrong().nextBytes(iv);
        GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        Cipher cipher = Cipher.getInstance(ALGORITHM);
        cipher.init(Cipher.ENCRYPT_MODE, key, spec);
        byte[] ciphertext = cipher.doFinal(plaintext);
        // 返回 IV + 密文（IV 不需要保密）
        return ByteBuffer.allocate(iv.length + ciphertext.length)
                .put(iv).put(ciphertext).array();
    }

    public static byte[] decrypt(byte[] encrypted, SecretKey key) throws Exception {
        ByteBuffer buffer = ByteBuffer.wrap(encrypted);
        byte[] iv = new byte[IV_LENGTH];
        buffer.get(iv);
        byte[] ciphertext = new byte[buffer.remaining()];
        buffer.get(ciphertext);
        GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        Cipher cipher = Cipher.getInstance(ALGORITHM);
        cipher.init(Cipher.DECRYPT_MODE, key, spec);
        return cipher.doFinal(ciphertext);
    }
}
```

### 4.5 HTTPS 与 TLS

HTTPS = HTTP + TLS（传输层安全协议），通过证书体系保证三个安全目标：

- **机密性：** 数据加密传输，中间人无法读取
- **完整性：** 数据在传输过程中未被篡改
- **身份认证：** 客户端确认服务器身份（通过CA签发的证书）

**TLS 握手流程（简化）：**

```
1. Client Hello：客户端发送支持的 TLS 版本、加密套件列表
2. Server Hello：服务端选择加密套件，发送证书（含公钥）
3. 证书验证：客户端验证证书是否可信（CA 链）
4. 密钥交换：客户端生成 Pre-Master Secret，用服务端公钥加密后发送
5. 会话密钥：双方使用 Pre-Master Secret 衍生出对称加密密钥
6. 加密通信：使用对称密钥加密应用数据
```

**后端配置 HTTPS：**

```yaml
# application.yml Spring Boot HTTPS 配置
server:
  port: 443
  ssl:
    enabled: true
    key-store: classpath:keystore.p12
    key-store-password: ${SSL_KEY_PASSWORD}
    key-store-type: PKCS12
    key-alias: tomcat
```

### 4.6 CORS（跨域资源共享）

浏览器的**同源策略（Same-Origin Policy）** 默认阻止来自不同源的页面读取当前源的资源。CORS 是一种机制，允许服务端声明哪些源可以访问其资源。

**请求流程：**
- **简单请求：** 浏览器直接发送跨域请求，检查响应头 `Access-Control-Allow-Origin`
- **预检请求（Preflight）：** 对非简单请求（如 PUT、DELETE、Content-Type: application/json），浏览器先发一个 OPTIONS 请求，确认服务端允许后再发真实请求

```java
// Spring Boot CORS 配置
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("*") // 生产环境应限制具体域名
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
```

**安全建议：**
- `Access-Control-Allow-Origin` 不要设置为 `*`（通配符），除非接口完全公开
- `allowCredentials(true)` 时不能使用 `*`，必须指定具体域名
- 预检请求 `OPTIONS` 不应该包含认证信息

### 4.7 CSRF（跨站请求伪造）

攻击者诱导用户访问恶意页面，该页面利用用户已登录的身份，向目标网站**伪造请求**执行非预期操作。

**攻击条件：**
1. 用户已登录目标网站（Cookie 自动携带）
2. 目标网站没有 CSRF 防护
3. 用户访问了恶意页面

**防护方案：**

| 方案 | 说明 | 优缺点 |
|---|---|---|
| CSRF Token | 表单中嵌入随机 Token，请求时校验 | 需服务端维护 Token 状态，影响性能 |
| SameSite Cookie | 设置 Cookie 的 SameSite 属性 | 浏览器原生支持，简单有效 |
| 自定义请求头 | 要求请求携带自定义 Header（如 X-Requested-With） | 通过 JavaScript 添加，跨域请求天然无法设置 |
| 验证码 | 关键操作要求输入验证码 | 用户体验较差 |

```java
// Spring Security CSRF 配置
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
            );
        return http.build();
    }
}
```

```java
// 前后端分离项目中，前端在请求头携带 CSRF Token
// 服务端返回 XSRF-TOKEN Cookie（HttpOnly=false 以便 JS 读取）
// 前端在每个请求中读取并设置 X-XSRF-TOKEN 请求头
```

**SameSite Cookie 最佳实践：**
```java
// 设置 SameSite 属性
@Configuration
public class SameSiteConfig {
    @Bean
    public CookieSerializer cookieSerializer() {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setSameSite("Lax"); // "Strict" 或 "Lax"
        return serializer;
    }
}
```

| SameSite 值 | 行为 |
|---|---|
| Strict | 完全禁止第三方 Cookie，安全性最高，但用户体验可能受影响 |
| Lax（推荐） | GET 请求（导航、点击链接）允许携带，POST/表单提交不允许 |
| None | 允许第三方 Cookie，必须配合 Secure 属性（仅 HTTPS） |

### 4.8 XSS（跨站脚本攻击）

攻击者将恶意脚本注入到网页中，当其他用户浏览该页面时，脚本在用户浏览器中执行。

**三种类型：**

| 类型 | 说明 | 示例 |
|---|---|---|
| 反射型 XSS | 恶意脚本在 URL 参数中，服务端未转义直接返回 | `https://example.com/search?q=<script>alert(1)</script>` |
| 存储型 XSS | 恶意脚本存入数据库，其他用户访问时被执行 | 评论区发布 `<script>stealCookie()</script>` |
| DOM 型 XSS | 前端 JavaScript 直接将用户输入当作 HTML 执行 | `innerHTML = userInput` |

**防护方案：**

1. **输出编码（转义）：** 对用户输入的内容进行 HTML 实体编码
   ```java
   // 使用 HtmlUtils（Spring）
   String safe = HtmlUtils.htmlEscape(userInput);
   // < 转义为 &lt; > 转义为 &gt; & 转义为 &amp;
   ```

2. **CSP（内容安全策略）：** 通过 HTTP 头限制页面可以加载的资源
   ```http
   Content-Security-Policy: default-src 'self'; script-src 'self' https://trusted.cdn.com
   ```

3. **设置 Cookie HttpOnly：** JavaScript 无法读取 HttpOnly 的 Cookie
   ```java
   Cookie cookie = new Cookie("sessionId", sessionId);
   cookie.setHttpOnly(true);
   cookie.setSecure(true);
   ```

4. **输入校验：** 对用户输入进行白名单校验，拒绝/过滤危险字符

### 4.9 SQL注入

攻击者在输入中嵌入 SQL 代码，使服务端执行非预期的 SQL 语句。

**根本原因：** 用户输入被当作 SQL 代码拼接，而非作为参数传递。

```sql
-- 危险示例
SELECT * FROM user WHERE username = '${username}' AND password = '${password}'
-- 输入: username = admin' -- 
-- 实际执行: SELECT * FROM user WHERE username = 'admin' -- ' AND password = '...'
-- -- 注释掉了密码检查，直接登录成功

-- 更严重：
SELECT * FROM user WHERE id = ${id}
-- 输入: id = 1; DROP TABLE user; --
-- 可能导致整张表被删除
```

**防护方案（优先顺序）：**

| 方案 | 说明 | 示例 |
|---|---|---|
| 预编译语句（PreparedStatement） | 参数通过占位符传递，由数据库驱动转义 | `#{}`（MyBatis）、`?`（JDBC） |
| ORM 框架 | 使用 ORM 的查询构造器 | JPA Criteria、MyBatis-Plus LambdaQueryWrapper |
| 输入校验 | 对输入进行类型校验、白名单检查 | 数字类型强转为 Long |
| 最小权限 | 数据库用户只授予必要权限 | 只读用户、只写用户分开 |

```java
// 安全：MyBatis #{} 预编译
@Select("SELECT * FROM user WHERE id = #{id}")
UserDO findById(Long id);

// 危险：MyBatis ${} 字符串拼接
@Select("SELECT * FROM user WHERE id = ${id}")
UserDO findByIdUnsafe(String id); // 嵌入 SQL 注入风险
```

### 4.10 命令注入

攻击者在输入中注入操作系统命令，使服务端执行非预期的系统命令。

```java
// 危险示例
String cmd = "ping " + userInput;
Runtime.getRuntime().exec(cmd);
// 输入: 8.8.8.8; rm -rf /
// 实际执行: ping 8.8.8.8; rm -rf /
```

**防护方案：**
- 尽量避免在应用层直接调用系统命令
- 如果必须调用，使用参数化方式而非字符串拼接
- 对输入做严格的白名单校验

### 4.11 路径穿越（Path Traversal）

攻击者使用 `../` 等路径符号，突破限制访问非授权目录或文件。

```java
// 危险示例
String path = "/data/uploads/" + fileName;
File file = new File(path);
// 输入: ../../etc/passwd
// 实际访问: /data/uploads/../../etc/passwd → /etc/passwd
```

**防护方案：**
```java
// 1. 规范化路径并校验前缀
public boolean isPathSafe(String baseDir, String fileName) {
    Path base = Paths.get(baseDir).normalize().toAbsolutePath();
    Path resolved = base.resolve(fileName).normalize().toAbsolutePath();
    return resolved.startsWith(base);
}

// 2. 拒绝包含 ../ 或 ..\ 的路径
if (fileName.contains("..")) {
    throw new SecurityException("非法路径");
}

// 3. 只允许指定文件名，拒绝用户直接传路径
```

### 4.12 SSRF（服务端请求伪造）

攻击者让服务端向攻击者指定的内网地址发起请求，从而绕过防火墙访问内部系统。

```
攻击者 → 服务端 → 内网 Redis（未授权访问）→ 写入公钥 → 获取服务器权限
```

**常见攻击目标：**
- 云服务元数据（AWS `169.254.169.254`、阿里云 `100.100.100.204`）
- 内部服务（未认证的 Redis、MySQL、ES）
- 内网文件读取（`file:///etc/passwd`）

**防护方案：**
```java
// 1. URL 白名单
public boolean isAllowedUrl(String url) {
    try {
        URI uri = new URI(url);
        String host = uri.getHost();
        // 仅允许调用规定的域名
        return ALLOWED_HOSTS.contains(host);
    } catch (Exception e) {
        return false;
    }
}

// 2. 禁止内网地址
public boolean isInternalIp(String host) {
    InetAddress addr = InetAddress.getByName(host);
    return addr.isSiteLocalAddress()  // 10.x, 172.16-31.x, 192.168.x
        || addr.isLoopbackAddress()   // 127.0.0.1
        || addr.isLinkLocalAddress();  // 169.254.x.x
}

// 3. 禁用重定向跟随（防止绕过白名单）
// 4. 限制请求协议，禁止 file://, gopher:// 等协议
```

### 4.13 文件上传安全

文件上传是攻击者最喜欢的目标之一，常用于上传 webshell、钓鱼页面等。

**核心防护策略：**

```java
// 文件上传校验完整示例
public class FileUploadValidator {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
        "jpg", "jpeg", "png", "gif", "pdf", "doc", "docx"
    );
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    public void validate(MultipartFile file) {
        // 1. 检查文件大小
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new FileUploadException("文件大小超过限制");
        }

        // 2. 检查文件扩展名（基于原始文件名，不要用 Content-Type）
        String originalName = file.getOriginalFilename();
        String ext = originalName.substring(originalName.lastIndexOf(".") + 1).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new FileUploadException("不允许的文件类型");
        }

        // 3. 检查 MIME 类型（服务端检测，不要信任客户端传来的 Content-Type）
        String mimeType = Files.probeContentType(Paths.get(originalName));
        if (mimeType == null || !mimeType.startsWith("image/")) {
            throw new FileUploadException("文件类型校验不通过");
        }

        // 4. 重命名文件（防止路径穿越）
        String storedName = UUID.randomUUID().toString() + "." + ext;

        // 5. 文件内容检测（图片重编码、病毒扫描）
        // 图片上传：可以尝试重新编码图片，去除可能的恶意代码
    }
}
```

**完整防护清单：**

| 措施 | 说明 |
|---|---|
| 文件大小限制 | 设置合理的最大文件大小 |
| 扩展名白名单 | 只允许特定扩展名（`.jpg`、`.png`、`.pdf`），拒绝 `.jsp`、`.php`、`.exe` |
| MIME 类型校验 | 服务端检测真实 MIME 类型，不信任客户端提交 |
| 文件名重命名 | 使用 UUID 重命名，避免原始文件名带路径穿越 |
| 存储目录 | 文件存储在 Web 可访问目录之外 |
| 内容检测 | 图片重新编码、扫描病毒 |
| CDN/OSS 存储 | 生产环境建议使用对象存储（OSS、S3），天然具备安全防护 |

### 4.14 接口签名与防重放攻击

#### 接口签名

接口签名保证请求的**完整性**和**真实性**，防止请求被篡改：

```
sign = HMACSHA256(
    method + path + timestamp + nonce + body,
    secretKey
)
```

**典型签名流程：**

```java
// 客户端生成签名
public class SignatureGenerator {
    public static String generate(HttpMethod method, String path, 
                                   String body, String timestamp, 
                                   String nonce, String secret) {
        String content = method + "\n"
                       + path + "\n"
                       + timestamp + "\n"
                       + nonce + "\n"
                       + body;
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(keySpec);
        byte[] hash = mac.doFinal(content.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(hash);
    }
}
```

```java
// 服务端验证签名
@Component
public class SignatureInterceptor implements HandlerInterceptor {

    private static final long MAX_TIME_DIFF = 60_000L; // 允许时间差 60秒

    @Override
    public boolean preHandle(HttpServletRequest request, 
                            HttpServletResponse response, Object handler) throws Exception {
        String timestamp = request.getHeader("X-Timestamp");
        String nonce = request.getHeader("X-Nonce");
        String sign = request.getHeader("X-Sign");

        // 1. 校验必填参数
        if (timestamp == null || nonce == null || sign == null) {
            throw new SecurityException("缺少签名参数");
        }

        // 2. 校验时间戳（防重放）
        long ts = Long.parseLong(timestamp);
        if (Math.abs(System.currentTimeMillis() - ts) > MAX_TIME_DIFF) {
            throw new SecurityException("请求已过期");
        }

        // 3. 校验 Nonce 唯一性（防重放）
        if (nonceService.isUsed(nonce)) {
            throw new SecurityException("Nonce 已使用");
        }
        nonceService.markUsed(nonce, timestamp);

        // 4. 校验签名
        String body = getBody(request);
        String expected = SignatureGenerator.generate(
            HttpMethod.valueOf(request.getMethod()),
            request.getRequestURI(),
            body, timestamp, nonce, getSecretKey(request)
        );
        if (!expected.equals(sign)) {
            throw new SecurityException("签名验证失败");
        }

        return true;
    }
}
```

#### 防重放攻击

重放攻击指攻击者截获合法请求后，再次发送该请求以执行相同的操作。

**防重放三重保障：**

| 机制 | 说明 |
|---|---|
| 时间戳（Timestamp） | 拒绝过期请求（如超过 60 秒的请求），减少 Nonce 存储压力 |
| 随机数（Nonce） | 每个请求携带唯一 Nonce，服务端记录已使用的 Nonce，确保一次一密 |
| 序列号（Sequence） | 递增序列号，保证请求的顺序性和唯一性 |

### 4.15 密钥管理

密钥管理是整个安全体系的根基——加密算法再强，密钥泄露就全部失效。

**基本原则：**
- **密钥与数据分离：** 密钥不能硬编码在代码或配置文件中
- **最小权限：** 每个服务只拥有需要的密钥
- **定期轮换：** 密钥应有有效期，到期自动轮换
- **审计：** 密钥的创建、使用、销毁都应记录日志

**密钥管理方案对比：**

| 方案 | 适用场景 | 安全等级 |
|---|---|---|
| 环境变量 | 开发/测试环境 | 低 |
| 配置中心（Nacos/APOLLO） | 配合加密存储 | 中 |
| 密钥管理服务（AWS KMS / 阿里云 KMS） | 生产环境 | 高 |
| HashiCorp Vault | 企业级密钥管理 | 高 |

```yaml
# 不要这样
jwt:
  secret: my-hardcoded-secret-123456

# 应该这样
jwt:
  secret: ${JWT_SECRET}
```

```java
// 使用环境变量 + 默认值
@Value("${JWT_SECRET:}")
private String jwtSecret;

// 启动时校验
@PostConstruct
public void init() {
    if (StringUtils.isBlank(jwtSecret)) {
        throw new IllegalStateException("JWT_SECRET 未配置");
    }
}
```

### 4.16 敏感信息脱敏

对敏感数据（手机号、身份证、银行卡号、密码）进行脱敏处理后再展示或存储。

**脱敏策略：**

| 数据类型 | 脱敏规则 | 示例 |
|---|---|---|
| 手机号 | 中间四位隐藏 | `138****1234` |
| 身份证 | 前六后四，中间隐藏 | `110101****1234` |
| 银行卡号 | 前四后四，中间隐藏 | `6222****1234` |
| 邮箱 | 用户名部分隐藏 | `z***@example.com` |
| 密码 | 永远不可逆，存哈希 | `********` |

```java
// 脱敏工具类
public class DesensitizeUtil {

    public static String phone(String phone) {
        if (phone == null || phone.length() != 11) return phone;
        return phone.replaceAll("(\\d{3})\\d{4}(\\d{4})", "$1****$2");
    }

    public static String idCard(String idCard) {
        if (idCard == null || idCard.length() < 10) return idCard;
        return idCard.replaceAll("(\\d{6})\\d{8,10}(\\w{4})", "$1********$2");
    }

    public static String email(String email) {
        if (email == null) return null;
        int atIndex = email.indexOf("@");
        if (atIndex <= 1) return email;
        return email.substring(0, 1) + "***" + email.substring(atIndex);
    }
}
```

```java
// Jackson 序列化脱敏
@JsonSerialize(using = PhoneDesensitizeSerializer.class)
private String phone;

public class PhoneDesensitizeSerializer extends JsonSerializer<String> {
    @Override
    public void serialize(String value, JsonGenerator gen, 
                         SerializerProvider provider) throws IOException {
        gen.writeString(DesensitizeUtil.phone(value));
    }
}
```

**日志脱敏：**
```java
// 日志中使用占位符，不要直接打印敏感信息
log.info("用户登录成功: {}", user.getUsername()); // OK
log.info("用户手机号: {}", user.getPhone()); // 危险！
log.info("用户手机号: {}", DesensitizeUtil.phone(user.getPhone())); // OK
```

### 4.17 多租户数据隔离

SaaS 应用中，多个租户（客户）共享同一套系统，必须保证租户之间的数据完全隔离。

**三种隔离模式对比：**

| 模式 | 描述 | 隔离等级 | 成本 | 适用场景 |
|---|---|---|---|---|
| 独立数据库 | 每个租户一个独立数据库 | ★★★★★ | 高 | 大客户、金融医疗等强合规 |
| 独立 Schema | 每个租户一个 Schema（表空间） | ★★★★ | 中 | 中等规模客户 |
| 共享表 + 租户ID | 同一张表中通过租户 ID 区分 | ★★★ | 低 | 中小型 SaaS（最常见） |

**共享表方案（最常见）的关键实现：**

```sql
-- 每条数据必须带 tenant_id
CREATE TABLE order (
    id BIGINT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,    -- 租户 ID
    order_no VARCHAR(64),
    amount DECIMAL(10,2),
    created_at DATETIME
);

-- 所有查询必须加 tenant_id 过滤
SELECT * FROM order WHERE tenant_id = 1001 AND id = 123;
```

```java
// MyBatis-Plus 多租户插件（自动注入租户 ID）
@Configuration
public class MyBatisPlusConfig {
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new TenantLineInnerInterceptor(
            new TenantLineHandler() {
                @Override
                public String getTenantIdColumn() {
                    return "tenant_id";
                }

                @Override
                public Expression getTenantId() {
                    Long tenantId = SecurityContextHolder.getContext()
                            .getAuthentication()
                            .getTenantId();
                    return new LongValue(tenantId);
                }

                // 某些表不需要多租户（如字典表）
                @Override
                public boolean ignoreTable(String tableName) {
                    return "dict".equals(tableName);
                }
            }
        ));
        return interceptor;
    }
}

// 自动生成的 SQL：
// SELECT * FROM order WHERE tenant_id = 1001
```

**关键注意点：**
- tenant_id 必须从认证上下文中获取（从 JWT 或 Session 解析），不能接受客户端传入
- 所有 SQL 查询都需保证带上 tenant_id 过滤（MyBatis-Plus 插件可自动注入）
- 接口层需校验当前用户是否有权访问该租户的数据

## 5. 基本使用方法

### 5.1 Spring Security 集成（基础）

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity // 启用方法级安全注解
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // 关闭 CSRF（前后端分离 + JWT 的场景）
            .csrf(AbstractHttpConfigurer::disable)
            // 会话管理：无状态（使用 JWT）
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // 路由权限
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()       // 登录注册接口不需要认证
                .requestMatchers("/api/admin/**").hasRole("ADMIN") // 管理接口需要 ADMIN 角色
                .anyRequest().authenticated())                      // 其他接口需要认证
            // JWT 认证过滤器
            .addFilterBefore(jwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class)
            // 异常处理
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setContentType("application/json");
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.getWriter().write("{\"code\":401,\"message\":\"未认证\"}");
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setContentType("application/json");
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.getWriter().write("{\"code\":403,\"message\":\"无权限\"}");
                }));

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
```

### 5.2 JWT 认证过滤器

```java
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                   HttpServletResponse response,
                                   FilterChain filterChain) throws ServletException, IOException {
        String token = extractToken(request);
        if (token != null) {
            try {
                Claims claims = JwtUtil.parseToken(token);
                // 从 JWT 解析用户信息并设置到 SecurityContext
                UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(
                        claims.getSubject(), null, extractAuthorities(claims));
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception e) {
                // Token 无效或过期
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
```

### 5.3 RBAC 权限注解使用

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping
    @PreAuthorize("hasAuthority('user:list')")
    public Result<PageResult<UserVO>> listUsers(@RequestParam int page, @RequestParam int size) {
        return Result.success(userService.listUsers(page, size));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('user:delete')")
    public Result<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return Result.success();
    }

    // SpEL 表达式支持复杂条件
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('user:view') and #id == authentication.principal.id")
    public Result<UserVO> getUser(@PathVariable Long id) {
        return Result.success(userService.getUserById(id));
    }
}
```

### 5.4 统一参数校验

```java
@Data
public class RegisterDTO {

    @NotBlank(message = "用户名不能为空")
    @Size(min = 3, max = 32, message = "用户名长度3-32")
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "用户名只能包含字母、数字和下划线")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 64, message = "密码长度8-64")
    @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$",
             message = "密码需包含大小写字母和数字")
    private String password;

    @NotBlank(message = "手机号不能为空")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;

    @Email(message = "邮箱格式不正确")
    private String email;
}
```

## 6. 工程中的典型实现

### 6.1 完整的安全分层架构

```
安全相关组件分布：
├── config
│   ├── SecurityConfig.java          // Spring Security 配置
│   ├── CorsConfig.java              // CORS 配置
│   └── MyBatisPlusConfig.java       // 多租户插件
├── security
│   ├── JwtUtil.java                 // JWT 工具类
│   ├── JwtAuthenticationFilter.java // JWT 认证过滤器
│   ├── PasswordUtil.java            // 密码哈希工具
│   ├── SignatureInterceptor.java    // 接口签名拦截器
│   ├── RateLimitInterceptor.java    // 限流拦截器
│   └── CurrentUser.java             // 当前用户注解
├── common
│   ├── SensitiveDataUtil.java       // 脱敏工具
│   ├── AesEncryptor.java            // 加密工具
│   └── XssFilter.java               // XSS 过滤
└── aspect
    └── SecurityAuditAspect.java     // 安全审计切面
```

### 6.2 安全审计切面

记录所有敏感操作的日志，确保可追溯：

```java
@Aspect
@Component
public class SecurityAuditAspect {

    @Around("@annotation(securityAudit)")
    public Object audit(ProceedingJoinPoint pjp, SecurityAudit securityAudit) throws Throwable {
        String operation = securityAudit.value();
        String user = SecurityContextHolder.getContext().getAuthentication().getName();
        String params = Arrays.toString(pjp.getArgs());

        try {
            Object result = pjp.proceed();
            log.info("[AUDIT] user={}, action={}, params={}, result=success",
                     user, operation, DesensitizeUtil.sensitive(params));
            return result;
        } catch (Exception e) {
            log.warn("[AUDIT] user={}, action={}, params={}, result=fail: {}",
                     user, operation, DesensitizeUtil.sensitive(params), e.getMessage());
            throw e;
        }
    }
}

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface SecurityAudit {
    String value();
}

// 使用
@SecurityAudit("删除用户")
@PreAuthorize("hasAuthority('user:delete')")
@DeleteMapping("/{id}")
public Result<Void> deleteUser(@PathVariable Long id) {
    userService.deleteUser(id);
    return Result.success();
}
```

### 6.3 接口签名验证拦截器

```java
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(signatureInterceptor())
                .addPathPatterns("/api/open/**") // 对外暴露的接口
                .excludePathPatterns("/api/auth/**");
    }
}
```

### 6.4 限流防护

```java
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private final RedisTemplate<String, String> redisTemplate;
    private static final int MAX_REQUESTS = 100;
    private static final int WINDOW_SECONDS = 60;

    @Override
    public boolean preHandle(HttpServletRequest request,
                           HttpServletResponse response,
                           Object handler) throws Exception {
        String key = "rate:limit:" + getClientIp(request);
        Long count = redisTemplate.opsForValue().increment(key);
        if (count == 1) {
            redisTemplate.expire(key, WINDOW_SECONDS, TimeUnit.SECONDS);
        }
        if (count > MAX_REQUESTS) {
            response.setStatus(429);
            response.getWriter().write("{\"code\":429,\"message\":\"请求过于频繁\"}");
            return false;
        }
        return true;
    }
}
```

## 7. 常见失败场景

### 7.1 JWT 密钥泄露

**现象：** 攻击者获得了 JWT 签名密钥，可以伪造任意用户的 Token。

**原因：**
- 密钥硬编码在代码中或提交到 Git 仓库
- 密钥管理不当（明文存储在配置文件中）

**解决方案：**
- 密钥通过环境变量或密钥管理服务（KMS/Vault）注入
- 定期轮换密钥
- 使用 JWKS（JSON Web Key Set）支持密钥动态切换

### 7.2 CORS 配置过于宽松

**现象：** 设置了 `Access-Control-Allow-Origin: *` 导致任意网站都可以跨域调用接口。

**解决方案：** 限制具体的源域名，不要使用通配符：
```java
.allowedOriginPatterns("https://*.example.com")
```

### 7.3 文件上传漏洞

**现象：** 攻击者上传了 JSP 文件获取了服务器权限。

**常见原因：**
- 只校验了 Content-Type（客户端可伪造）
- 扩展名校验不严格（如 `.jpg.jsp`、`webshell.php.jpg`）
- 文件存储在 Web 可访问目录下

**解决方案：** 见 4.13 文件上传安全章节。

### 7.4 多租户数据泄露

**现象：** 租户 A 的用户查到了租户 B 的数据。

**常见原因：**
- SQL 查询遗漏了 `tenant_id` 条件
- 使用了缓存但没有区分租户
- 接口层面没有做租户校验

**解决方案：**
- 使用 MyBatis-Plus 多租户插件自动注入（推荐）
- 所有 Service 方法强制走多租户过滤器
- 缓存 key 中加入 tenant_id 前缀

### 7.5 密码哈希成本太低

**现象：** bcrypt cost 设置为 4，攻击者可以快速暴力破解。

```java
// 太慢（cost=4）：速度太快，不安全
BCrypt.gensalt(4)

// 太慢（cost=16）：用户登录需要 5 秒，体验极差
BCrypt.gensalt(16)

// 推荐（cost=10~14）：安全性和性能的平衡
BCrypt.gensalt(12)
```

### 7.6 日志泄露敏感信息

```java
// 危险：打印了用户密码和 Token
log.error("创建用户失败: {}", userDTO);
log.info("用户登录成功, token={}", token);

// 正确：脱敏后再记录
log.error("创建用户失败: username={}", userDTO.getUsername());
log.info("用户登录成功, userId={}", userId);
```

## 8. 如何调试

### 8.1 调试认证流程

```yaml
# 开启 Spring Security DEBUG 日志
logging:
  level:
    org.springframework.security: DEBUG
    org.springframework.web: DEBUG
```

输出示例：
```
2024-01-01 10:00:00 DEBUG o.s.security.web.FilterChainProxy - /api/users at position 1 of 12
2024-01-01 10:00:00 DEBUG o.s.s.w.a.AnonymousAuthenticationFilter - Set SecurityContextHolder to anonymous
2024-01-01 10:00:00 DEBUG o.s.s.w.a.ExceptionTranslationFilter - Access is denied (user is anonymous)
```

### 8.2 调试 JWT Token

```java
// 在线调试工具：https://jwt.io
// 本地解析 Token 内容
public void debugToken(String token) {
    String[] parts = token.split("\\.");
    String header = new String(Base64.getUrlDecoder().decode(parts[0]));
    String payload = new String(Base64.getUrlDecoder().decode(parts[1]));
    System.out.println("Header: " + header);
    System.out.println("Payload: " + payload);
}
```

### 8.3 调试 CORS 问题

```bash
# 模拟预检请求
curl -X OPTIONS \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -v https://api.example.com/api/users

# 查看响应头中是否有 Access-Control-Allow-Origin
```

### 8.4 调试 SQL 注入

```yaml
# 开启 MyBatis SQL 日志，检查 SQL 语句中是否拼接了参数
logging:
  level:
    com.example.mapper: DEBUG
```

查看日志确认参数是通过 `?` 占位符传递还是直接拼接。

### 8.5 HTTPS 调试

```bash
# 检查证书信息
curl -vI https://example.com

# 使用 openssl 查看证书详情
openssl s_client -connect example.com:443 -servername example.com
```

## 9. 如何测试

### 9.1 认证授权测试

```java
@SpringBootTest
@AutoConfigureMockMvc
class SecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void 未登录访问受限接口_应返回401() throws Exception {
        mockMvc.perform(get("/api/users"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 使用有效Token访问_应返回200() throws Exception {
        String token = JwtUtil.generateToken("user123", "USER");

        mockMvc.perform(get("/api/users")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void 普通用户访问管理员接口_应返回403() throws Exception {
        String token = JwtUtil.generateToken("user123", "USER");

        mockMvc.perform(delete("/api/users/1")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void 使用过期Token_应返回401() throws Exception {
        String token = JwtUtil.generateToken("user123", "USER");
        // 模拟 Token 过期
        Thread.sleep(100);

        mockMvc.perform(get("/api/users")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }
}
```

### 9.2 SQL 注入测试

```java
@SpringBootTest
@AutoConfigureMockMvc
class SqlInjectionTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void SQL注入尝试_应返回错误而不是数据泄露() throws Exception {
        // 尝试经典的 SQL 注入
        mockMvc.perform(get("/api/users")
                        .param("id", "1 OR 1=1"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void 单引号注入_应安全处理() throws Exception {
        mockMvc.perform(get("/api/users")
                        .param("username", "admin'--"))
                .andExpect(status().isOk()); // 正常返回，不会查询所有用户
    }
}
```

### 9.3 XSS 测试

```java
@SpringBootTest
@AutoConfigureMockMvc
class XssTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void XSS脚本注入_应被转义() throws Exception {
        String result = mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"username": "<script>alert('xss')</script>", "password": "Test1234"}
                            """))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        // 确认脚本被转义
        assertThat(result).doesNotContain("<script>");
    }
}
```

### 9.4 文件上传安全测试

```java
@SpringBootTest
@AutoConfigureMockMvc
class FileUploadSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void 上传JSP文件_应被拒绝() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "shell.jsp", "application/octet-stream",
                "<%@page import=\"java.io.*\"%>".getBytes());

        mockMvc.perform(multipart("/api/upload")
                        .file(file))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 上传可执行文件_应被拒绝() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "malware.exe", "application/x-msdownload",
                "MZ".getBytes());

        mockMvc.perform(multipart("/api/upload")
                        .file(file))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 路径穿越尝试_应被拒绝() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "../../etc/passwd.jpg", "image/jpeg",
                "fake-image-data".getBytes());

        mockMvc.perform(multipart("/api/upload")
                        .file(file))
                .andExpect(status().isBadRequest());
    }
}
```

### 9.5 多租户隔离测试

```java
@SpringBootTest
class TenantIsolationTest {

    @Autowired
    private UserService userService;

    @Test
    void 租户A只能查询到自己租户的数据() {
        // 设置当前线程为租户A
        SecurityContextHolder.setTenantId(1001L);
        List<UserDO> usersA = userService.listUsers();

        // 设置当前线程为租户B
        SecurityContextHolder.setTenantId(1002L);
        List<UserDO> usersB = userService.listUsers();

        // 两个租户的数据不应该有交集
        Set<Long> idsA = usersA.stream().map(UserDO::getId).collect(Collectors.toSet());
        Set<Long> idsB = usersB.stream().map(UserDO::getId).collect(Collectors.toSet());
        assertTrue(Collections.disjoint(idsA, idsB));
    }

    @Test
    void 未设置租户ID_应抛出异常() {
        SecurityContextHolder.clear();
        assertThrows(TenantNotSetException.class, () -> {
            userService.listUsers();
        });
    }
}
```

## 10. 如何监控

### 10.1 安全事件监控指标

| 指标 | 说明 | 告警阈值 |
|---|---|---|
| `security.auth.failure.count` | 认证失败次数 | > 10次/分钟（暴力破解） |
| `security.csrf.invalid.count` | CSRF Token 校验失败次数 | > 0（可能被攻击） |
| `security.xss.detected.count` | XSS 攻击拦截次数 | > 0 |
| `security.sql_injection.blocked` | SQL注入拦截次数 | > 0 |
| `security.rate_limit.exceeded` | 超限流请求次数 | > 100次/分钟（DDoS） |
| `security.file_upload.rejected` | 文件上传被拒绝次数 | > 5次/分钟（恶意上传） |

```java
// 使用 Micrometer 记录安全指标
@Component
public class SecurityMetrics {
    private final Counter authFailureCounter;
    private final Counter csrfBlockCounter;
    private final Counter xssBlockCounter;
    private final Counter sqlInjectionBlockCounter;
    private final Counter rateLimitBlockCounter;

    public SecurityMetrics(MeterRegistry registry) {
        this.authFailureCounter = registry.counter("security.auth.failure.count");
        this.csrfBlockCounter = registry.counter("security.csrf.invalid.count");
        this.xssBlockCounter = registry.counter("security.xss.detected.count");
        this.sqlInjectionBlockCounter = registry.counter("security.sql_injection.blocked");
        this.rateLimitBlockCounter = registry.counter("security.rate_limit.exceeded");
    }

    public void recordAuthFailure() { authFailureCounter.increment(); }
    public void recordCsrfBlock() { csrfBlockCounter.increment(); }
    public void recordXssBlock() { xssBlockCounter.increment(); }
    public void recordSqlInjection() { sqlInjectionBlockCounter.increment(); }
    public void recordRateLimit() { rateLimitBlockCounter.increment(); }
}
```

### 10.2 安全审计日志

```java
// Elasticsearch 索引结构（用于日志分析）
{
  "index": "security-audit-2024.01.01",
  "body": {
    "timestamp": "2024-01-01T10:00:00Z",
    "userId": "user123",
    "action": "DELETE_USER",
    "resource": "/api/users/42",
    "method": "DELETE",
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "status": "SUCCESS",
    "detail": "删除用户信息"
  }
}
```

### 10.3 安全扫描和渗透测试

| 工具 | 用途 | 使用时机 |
|---|---|---|
| OWASP ZAP | 自动化安全扫描（Web漏洞扫描） | CI/CD 集成 |
| SonarQube | 代码静态安全分析 | 每次提交 |
| Trivy / Snyk | 依赖库漏洞扫描 | 每次构建 |
| nmap | 端口扫描、服务发现 | 部署前 |
| sqlmap | SQL注入自动化检测 | 手动安全测试 |
| Burp Suite | 专业渗透测试工具 | 上线前安全评审 |

### 10.4 安全告警配置

```yaml
# Prometheus 告警规则
groups:
  - name: security-alerts
    rules:
      - alert: 暴力破解检测
        expr: rate(security_auth_failure_count_total[5m]) > 10
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "检测到暴力破解行为"
          description: "认证失败次数达到 {{ $value }}/分钟"

      - alert: SQL注入攻击
        expr: rate(security_sql_injection_blocked_total[5m]) > 0
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "检测到SQL注入攻击"
          description: "已拦截 {{ $value }} 次SQL注入尝试"
```

## 11. 常见面试问题

### Q1: Session 认证和 JWT 认证的区别？各自适用什么场景？

**Session 认证：** 有状态，服务端存储会话信息，集群需要 Session 共享（Redis）。适合传统 Web 应用、服务端渲染场景。优点是可主动撤销。

**JWT 认证：** 无状态，Token 中携带用户信息，天然支持分布式。适合 REST API、微服务、移动端。缺点是已签发的 Token 不能撤销，Payload 中的信息不加密（不能放敏感信息）。

### Q2: OAuth 2.0 的四种授权模式分别是什么？授权码模式为什么是最安全的？

| 模式 | 安全等级 | 说明 |
|---|---|---|
| 授权码模式 | ★★★★★ | 授权码 + 后端换 Token，凭证不经过用户代理 |
| 隐式模式（已弃用） | ★★ | Access Token 直接通过前端返回，容易泄露 |
| 密码模式 | ★★★ | 用户密码直接交给第三方，仅在高度信任场景使用 |
| 客户端凭证模式 | ★★★★ | 用于服务间通信，不涉及用户 |

授权码模式最安全的原因是：用户授权后只拿到一次性的授权码（Authorization Code），Access Token 由后端使用 code + client_secret 交换得到，client_secret 不会暴露给浏览器或移动端。

### Q3: RBAC 和 ABAC 的区别？什么场景下应该用 ABAC？

**RBAC** 基于角色分配权限，简单直观，适合权限粒度较粗、角色固定的场景（如 CMS 后台管理、企业 OA）。

**ABAC** 基于属性动态计算权限，支持更细粒度的控制（如"部门经理在工作时间可以查看本部门的工资单"）。适合权限规则复杂、多维度控制场景（如金融系统、医疗系统）。

### Q4: 什么是 CSRF？前后端分离项目还需要 CSRF 防护吗？

CSRF 利用用户已登录的身份伪造请求。防护方案有 CSRF Token、SameSite Cookie、自定义请求头。

前后端分离项目通常使用 **JWT**（放在 Authorization Header）而非 Cookie 进行认证，所以不存在浏览器自动携带凭证的问题，通常可以关闭 CSRF 防护。但如果仍然使用 Cookie 传递 Session 或 JWT，则仍需 CSRF 防护。

### Q5: 如何防止 SQL 注入？MyBatis 中 `#{}` 和 `${}` 的区别？

**核心方案：** 使用预编译语句（PreparedStatement），参数通过占位符传递。

`#{}`：参数占位符，MyBatis 将其替换为 `?`，由 JDBC 驱动转义，安全。
`${}`：字符串直接拼接，存在 SQL 注入风险，仅表名/列名等动态元数据时使用，且需白名单校验。

### Q6: 什么是 XSS？如何防御？

XSS（跨站脚本攻击）是攻击者将恶意脚本注入页面，在用户浏览器中执行。分为反射型、存储型、DOM 型。

防御：输出编码（HTML Entity）、CSP（内容安全策略）、Cookie HttpOnly、输入白名单校验。

### Q7: HTTPS 的 TLS 握手过程是怎样的？

1. Client Hello（客户端发送支持的 TLS 版本和加密套件）
2. Server Hello（服务端选择加密套件，发送证书）
3. 客户端验证证书（CA 链），提取公钥
4. 密钥交换（客户端生成 Pre-Master Secret，用公钥加密发送）
5. 双方使用 Pre-Master Secret 衍生会话密钥
6. 开始对称加密通信

### Q8: 接口防重放攻击怎么实现？

三重保障：**时间戳**（拒绝过期请求，如超过 60 秒的请求失效）、**Nonce 随机数**（每个请求携带唯一 Nonce，服务端记录已用 Nonce）、**签名**（使用 HMAC 对请求内容 + 时间戳 + Nonce 计算签名，防止篡改）。

### Q9: 多租户系统如何保证数据隔离？

三种模式：独立数据库（最高隔离）、独立 Schema、共享表 + tenant_id 字段。

共享表方案最常用，通过 MyBatis-Plus 多租户插件自动注入 tenant_id 条件，确保所有 SQL 都带有租户过滤。关键点：tenant_id 必须从认证上下文获取，不能由客户端传入。

### Q10: 密码存储为什么不能用 MD5？bcrypt 相比 MD5 好在哪？

MD5 是快速哈希（1ns 可计算数十万次），彩虹表可以快速还原常见密码。bcrypt 是慢哈希（内置盐值，可调工作因子），单次计算需要数百毫秒，暴力破解的代价极高。Argon2 更进一步，是内存硬算法，能有效抵御 GPU 并行攻击。

## 12. 在我的项目中如何使用

### 12.1 安全实践清单

| 阶段 | 事项 | 优先级 |
|---|---|---|
| 需求阶段 | 识别敏感数据字段、权限需求、合规要求 | ★★★★★ |
| 设计阶段 | 确定认证方案（JWT vs Session）、权限模型（RBAC/ABAC）、多租户方案 | ★★★★★ |
| 开发阶段 | 密码哈希（bcrypt）、预编译 SQL、输入校验、输出编码、CSRF 防护 | ★★★★★ |
| 开发阶段 | 接口签名、防重放、文件上传校验、日志脱敏 | ★★★★ |
| 开发阶段 | 密钥管理（环境变量/KMS）、HTTPS 配置 | ★★★★★ |
| 测试阶段 | SQL注入测试、XSS测试、CSRF测试、文件上传测试、认证测试 | ★★★★★ |
| 测试阶段 | 渗透测试、依赖漏洞扫描（Snyk/Trivy） | ★★★★ |
| 部署阶段 | HTTPS 证书配置、密钥注入、CORS 限制、WAF 配置 | ★★★★★ |
| 运维阶段 | 安全监控指标、告警规则、日志审计 | ★★★★ |

### 12.2 项目安全配置参考

```yaml
# application-prod.yml 生产环境安全配置
server:
  ssl:
    enabled: true
    key-store: /etc/ssl/keystore.p12
    key-store-password: ${SSL_KEY_PASSWORD}

spring:
  # Session 超时（若使用 Session）
  session:
    timeout: 1800

# JWT
jwt:
  secret: ${JWT_SECRET}
  expiration: 3600000 # 1小时

# 文件上传限制
spring:
  servlet:
    multipart:
      enabled: true
      max-file-size: 10MB
      max-request-size: 10MB

# 密码加密强度
security:
  password:
    bcrypt-cost: 12
```

### 12.3 依赖安全更新规范

```xml
<!-- 定期使用 OWASP Dependency-Check 扫描依赖 -->
<plugin>
    <groupId>org.owasp</groupId>
    <artifactId>dependency-check-maven</artifactId>
    <version>9.0.0</version>
    <configuration>
        <failBuildOnCVSS>7</failBuildOnCVSS> <!-- CVSS 7分以上构建失败 -->
        <suppressionFile>dependency-check-suppressions.xml</suppressionFile>
    </configuration>
</plugin>
```

```bash
# 定期执行依赖安全检查
mvn org.owasp:dependency-check-maven:check

# 检查已知漏洞库
npm audit          # Node.js
pip-audit          # Python
cargo audit        # Rust
```

### 12.4 安全上线检查清单

- [ ] HTTPS 已配置且证书有效
- [ ] 密码全部使用 bcrypt/Argon2 哈希
- [ ] 所有 SQL 使用预编译（`#{}`），无 `${}` 拼接用户输入
- [ ] 用户输入已做 XSS 转义处理
- [ ] CORS 配置了具体域名，未使用 `*`
- [ ] 文件上传做了类型校验、大小限制、重命名
- [ ] 敏感接口已配置 CSRF 防护或使用 JWT
- [ ] 日志中不包含密码、Token、身份证、手机号
- [ ] 密钥通过环境变量或 KMS 注入，未硬编码
- [ ] 存在防暴力破解的限流机制
- [ ] 多租户系统已验证数据隔离
- [ ] 已集成依赖漏洞扫描（Snyk/Trivy/OWASP DC）
- [ ] 权限控制已覆盖所有接口（不要遗漏新加的接口）
- [ ] 默认配置无安全风险（如 Actuator 端点未暴露到公网）
