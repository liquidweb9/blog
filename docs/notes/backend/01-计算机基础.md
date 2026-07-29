# 操作系统与并发编程

## 1. 它是什么

**操作系统与并发编程** 是后端工程师最底层、最核心的知识体系。操作系统是管理计算机硬件资源、为应用程序提供运行环境的系统软件；并发编程则是在同一时间段内协调多个执行单元（进程、线程、协程）正确、高效地协同工作。

**操作系统层面：**
- **进程与线程**：进程是资源分配的基本单位，拥有独立的地址空间；线程是 CPU 调度的基本单位，共享所属进程的地址空间。
- **用户态与内核态**：CPU 的两种特权级别。用户态受限访问硬件，内核态拥有全部权限。系统调用是用户态进入内核态的唯一入口。
- **上下文切换**：CPU 从一个进程/线程切换到另一个时，保存当前状态、恢复目标状态的过程。
- **同步与异步**：调用方是否需要等待结果。同步需要等待，异步不需要等待。
- **阻塞与非阻塞**：调用结果就绪前，调用方线程是否被挂起。阻塞会被挂起，非阻塞立即返回。
- **文件描述符**：操作系统用于标识打开文件、Socket 等 I/O 资源的整型句柄。
- **虚拟内存**：为每个进程提供独立的、连续的虚拟地址空间，通过 MMU 映射到物理内存。
- **内存分页**：将虚拟/物理内存划分为固定大小的页（通常 4KB），按需加载和交换。
- **零拷贝**：避免数据在内核态和用户态之间多次拷贝的数据传输技术。
- **I/O 多路复用**：单个线程同时监视多个文件描述符的 I/O 事件就绪状态。
- **select、poll、epoll**：Linux 上 I/O 多路复用的三种系统调用，epoll 是性能最优的方案。

**并发编程层面：**
- **线程安全**：多个线程访问共享数据时，保证数据始终处于正确的状态。
- **竞态条件**：程序执行结果依赖于线程的执行顺序，导致不可预期的结果。
- **临界区**：访问共享资源的代码片段，同一时刻只能被一个线程执行。
- **原子操作**：不可被中断的一个或一系列操作，要么全部执行，要么全部不执行。
- **可见性、有序性、原子性**：并发编程三大问题。可见性指一个线程修改共享变量后其他线程能立即看到；有序性指程序执行顺序符合代码逻辑；原子性指操作不可分割。
- **互斥锁、读写锁、乐观锁、悲观锁**：不同场景下的锁机制。互斥锁只允许一个线程进入临界区；读写锁区分读/写权限；悲观锁假设冲突频繁先加锁；乐观锁假设冲突少提交时检测。
- **死锁、活锁、饥饿**：线程无法继续执行的三种问题。死锁是互相等待对方释放资源；活锁是不断重试但无法推进；饥饿是线程长期得不到所需资源。
- **线程池**：预先创建一组线程复用执行任务的模式。
- **Future、CompletableFuture**：Java 中表示异步计算结果的接口，CompletableFuture 支持链式编排异步任务。
- **Java 并发容器**：`java.util.concurrent` 包中提供的线程安全集合，如 `ConcurrentHashMap`、`CopyOnWriteArrayList`、`BlockingQueue`。
- **Python 多线程、多进程和协程**：Python 的三种并发方案。多线程受 GIL 限制适用于 I/O 密集型；多进程适用于 CPU 密集型；协程基于 `asyncio` 实现高并发 I/O。

---

## 2. 为什么需要它

**操作系统的必要性：**
- 现代计算机是复杂的分层系统，应用程序需要一种统一、安全的方式来使用 CPU、内存、磁盘、网络等硬件资源。
- 没有操作系统，每个程序都必须自行管理硬件，无法多任务运行，也无法隔离故障。
- 操作系统抽象了硬件细节，提供了进程调度、内存管理、文件系统、网络协议栈等核心服务。

**并发编程的必要性：**
- 多核 CPU 成为主流，串行执行无法充分利用硬件算力。
- 后端服务需要同时处理成千上万个客户端请求，串行模型会导致严重的延迟和资源浪费。
- I/O 操作（数据库查询、RPC 调用、文件读写）占用了大部分请求时间，并发可以让 CPU 在等待 I/O 时处理其他任务。
- 现代分布式系统需要异步协作，并发编程是其基础。

---

## 3. 它解决什么问题

**操作系统解决的问题：**

| 问题 | 解决方案 |
|------|----------|
| 多程序同时运行 | 进程调度、时间片轮转 |
| 程序间互相干扰 | 虚拟内存、进程隔离 |
| 直接操作硬件的风险 | 用户态/内核态隔离、系统调用 |
| 内存不足以运行所有程序 | 虚拟内存、页面置换、交换空间 |
| I/O 操作效率低 | 零拷贝、I/O 多路复用、异步 I/O |
| CPU 利用率低 | 多线程、中断处理、上下文切换 |

**并发编程解决的问题：**
- **竞态条件**：通过锁、原子类、同步工具避免数据竞争。
- **可见性问题**：通过 `volatile`、`synchronized`、`Lock` 保证共享变量的可见性。
- **指令重排序**：通过 `happens-before` 规则、内存屏障保证有序性。
- **资源管理**：通过线程池避免频繁创建/销毁线程的开销。
- **异步编排**：通过 `CompletableFuture` 优雅组合多个异步任务。
- **Python GIL 限制**：通过多进程绕过 GIL，通过协程提高 I/O 并发能力。

---

## 4. 核心原理

### 4.1 进程与线程

进程包含 PCB（进程控制块）、地址空间、文件描述符表、信号处理等资源。线程包含 TCB（线程控制块）、栈、寄存器状态，共享进程资源。

**线程模型：**
- **用户级线程**：用户态实现，内核无感知，切换快但无法利用多核（如 Go 协程早期模型）。
- **内核级线程**：由操作系统管理，可运行在多核上，切换开销较大（如 Java 线程）。
- **混合模型**（M:N）：多个用户级线程映射到少量内核线程（如 Go `G-M-P` 模型）。

### 4.2 用户态与内核态

CPU 通过特权级保护关键资源。系统调用流程：

```
用户态调用（如 read()）
  → 触发软中断 / syscall 指令
  → CPU 切换到内核态
  → 内核执行 read 操作
  → 返回结果到用户态
  → CPU 切回用户态
```

每次系统调用都涉及上下文切换，这是性能开销的主要来源。

### 4.3 上下文切换

上下文切换开销包括：
- 保存/恢复寄存器（程序计数器、栈指针、通用寄存器）
- TLB 刷新（进程间切换）
- 缓存缺失导致 Cache Miss
- 调度器执行时间

**测量方法**：`vmstat 1` 查看 `cs`（context switch）列，或使用 `perf stat`。

### 4.4 同步与异步 / 阻塞与非阻塞

这两组概念容易混淆，核心区别：

| | 阻塞 | 非阻塞 |
|--|------|--------|
| **同步** | 调用后等待结果，线程挂起 | 调用后立即返回，轮询结果 |
| **异步** | 信号/回调通知，等待时线程挂起 | 立即返回，结果就绪后回调通知 |

**组合举例：**
- **同步阻塞**：传统 `read()` —— 线程挂起到数据到达。
- **同步非阻塞**：`O_NONBLOCK` 的 `read()` —— 立即返回，无数据则返回 `EAGAIN`。
- **异步阻塞**：极少使用。
- **异步非阻塞**：`IOCP`（Windows）、`io_uring`（Linux）、`epoll` + 回调 —— 事件驱动模型。

### 4.5 文件描述符

在 Linux 中，`/proc/{pid}/fd/` 目录下可以看到进程打开的所有文件描述符。文件描述符本质上是指向内核文件描述表的索引，表项包括文件指针、访问模式、引用计数等。

**限制：**
- 单个进程默认 1024（`ulimit -n` 可修改）
- 系统级别 `fs.file-max`

### 4.6 虚拟内存与内存分页

虚拟地址到物理地址的映射通过页表完成。核心数据结构是多级页表（x86-64 通常 4 级），减少了页表占用内存。

**TLB（Translation Lookaside Buffer）**：页表的硬件缓存，加速地址转换。上下文切换时 TLB flush 是主要开销之一。

**页面大小**：默认 4KB，可使用大页（2MB/1GB）减少 TLB 缺失，适用于数据库和大内存应用。

**页面置换算法**：LRU、Clock、LFU 等，当物理内存不足时将页面换出到交换空间。

### 4.7 零拷贝

传统文件发送流程：

```
磁盘 → 内核缓冲区 (DMA)
内核缓冲区 → 用户缓冲区 (CPU copy)
用户缓冲区 → Socket 内核缓冲区 (CPU copy)
Socket 缓冲区 → 网卡 (DMA)
```

零拷贝方式：

| 技术 | 拷贝次数 | 系统调用 |
|------|---------|----------|
| `sendfile()` | 2 次（DMA + CPU 到 Socket） | 1 次 |
| `mmap` + `write` | 2 次 | 2 次 |
| `splice()` | 2 次（基于管道） | 1 次 |
| `io_uring` | 1 次（仅 DMA） | 0 次（共享队列） |

### 4.8 I/O 多路复用：select、poll、epoll

**select：**
- 监听的文件描述符数量受限（默认 1024，`FD_SETSIZE`）
- 每次调用需要将 fd 集合从用户态拷贝到内核态
- 内核需要线性遍历所有 fd 检查状态
- 返回后用户也需要遍历所有 fd 查找就绪的

**poll：**
- 使用动态数组 `pollfd`，无上限限制
- 其他问题和 select 类似（全量拷贝、全量遍历）

**epoll：**
- `epoll_create` 创建 epoll 实例
- `epoll_ctl` 注册/修改/删除关注的事件（红黑树维护）
- `epoll_wait` 等待事件就绪（返回就绪列表，无需遍历）
- 支持边缘触发（ET）和水平触发（LT）
- 就绪事件通过回调机制添加到就绪链表，无需轮询

```
// epoll 核心流程
int epfd = epoll_create(1);
struct epoll_event ev;
ev.events = EPOLLIN | EPOLLET; // 边缘触发
ev.data.fd = fd;
epoll_ctl(epfd, EPOLL_CTL_ADD, fd, &ev);

while (true) {
    int n = epoll_wait(epfd, events, MAX_EVENTS, -1);
    for (int i = 0; i < n; i++) {
        handle_event(events[i].data.fd);
    }
}
```

### 4.9 并发编程核心原理

**JMM（Java Memory Model）：**
- 每个线程有独立的工作内存（缓存副本）
- 共享变量存储在主内存
- 线程通过 `read/load/use/assign/store/write` 操作与主内存交互
- `happens-before` 规则定义操作间的可见性和有序性

**happens-before 规则：**
- 程序次序规则：在同一个线程中，写在前面的操作 happens-before 后面的
- 管程锁定规则：对一个锁的解锁 happens-before 后续的加锁
- `volatile` 变量规则：对 `volatile` 变量的写 happens-before 后续的读
- 传递性：A happens-before B，B happens-before C ⇒ A happens-before C

**CAS（Compare-And-Swap）：**
- 硬件级别的原子操作，ABA 问题通过版本号解决
- Java 中 `Unsafe.compareAndSwapInt` 实现
- 广泛用于 `AtomicInteger`、`ConcurrentHashMap` 等

**AQS（AbstractQueuedSynchronizer）：**
- Java 同步框架的核心
- 维护一个 `volatile int state` 和一个 CLH 变体等待队列
- `ReentrantLock`、`CountDownLatch`、`Semaphore` 均基于 AQS

---

## 5. 基本使用方法

### 5.1 Java 线程创建

```java
// 方式一：继承 Thread
class MyThread extends Thread {
    public void run() { System.out.println("Thread"); }
}
new MyThread().start();

// 方式二：实现 Runnable（推荐）
new Thread(() -> System.out.println("Runnable")).start();

// 方式三：Callable + FutureTask
FutureTask<Integer> task = new FutureTask<>(() -> 42);
new Thread(task).start();
System.out.println(task.get());

// 方式四：线程池
ExecutorService exec = Executors.newFixedThreadPool(10);
Future<Integer> future = exec.submit(() -> 42);
```

### 5.2 锁的使用

```java
// synchronized 内置锁
public synchronized void increment() { count++; }

// ReentrantLock
Lock lock = new ReentrantLock();
lock.lock();
try {
    // 临界区
} finally {
    lock.unlock();
}

// ReentrantReadWriteLock
ReadWriteLock rw = new ReentrantReadWriteLock();
rw.readLock().lock();   // 多个线程可同时读
rw.writeLock().lock();  // 写时互斥

// StampedLock（Java 8，支持乐观读）
StampedLock sl = new StampedLock();
long stamp = sl.tryOptimisticRead();
// 读操作...
if (!sl.validate(stamp)) {
    stamp = sl.readLock();
    // 重新读...
    sl.unlockRead(stamp);
}
```

### 5.3 线程池

```java
ThreadPoolExecutor executor = new ThreadPoolExecutor(
    2,                // corePoolSize
    5,                // maximumPoolSize
    60L,              // keepAliveTime
    TimeUnit.SECONDS, // 时间单位
    new LinkedBlockingQueue<>(100), // 工作队列
    Executors.defaultThreadFactory(),
    new ThreadPoolExecutor.AbortPolicy() // 拒绝策略
);

// 提交任务
executor.execute(() -> System.out.println("fire and forget"));
Future<String> result = executor.submit(() -> "task result");
```

**拒绝策略：**
- `AbortPolicy`：抛出 `RejectedExecutionException`
- `CallerRunsPolicy`：调用者线程直接执行
- `DiscardPolicy`：静默丢弃
- `DiscardOldestPolicy`：丢弃队列最旧的任务

### 5.4 CompletableFuture

```java
CompletableFuture.supplyAsync(() -> fetchUser(id))
    .thenApply(user -> enrichProfile(user))
    .thenApply(profile -> formatResponse(profile))
    .exceptionally(ex -> fallbackResponse(ex))
    .thenAccept(response -> send(response));

// 组合多个异步任务
CompletableFuture<String> f1 = fetchFromCache(key);
CompletableFuture<String> f2 = fetchFromDB(key);
f1.applyToEither(f2, result -> result); // 哪个先完成用哪个

CompletableFuture.allOf(f1, f2, f3).join(); // 等待所有完成
```

### 5.5 Java 并发容器

```java
// ConcurrentHashMap — 分段锁 → 红黑树 + CAS
Map<String, String> map = new ConcurrentHashMap<>();
map.put("key", "value");
map.computeIfAbsent("key", k -> loadFromDB(k));

// CopyOnWriteArrayList — 写时复制，读无锁
List<String> list = new CopyOnWriteArrayList<>();
// 适用于读多写少的场景

// BlockingQueue — 阻塞队列，常用于生产者-消费者
BlockingQueue<Task> queue = new LinkedBlockingQueue<>(1000);
queue.put(task);    // 队列满时阻塞
Task t = queue.take(); // 队列空时阻塞
```

### 5.6 Python 多线程

```python
import threading

def worker(name):
    print(f"Worker {name}")

threads = []
for i in range(5):
    t = threading.Thread(target=worker, args=(i,))
    t.start()
    threads.append(t)
for t in threads:
    t.join()

# 线程间共享数据（需要锁）
lock = threading.Lock()
counter = 0

def safe_increment():
    global counter
    with lock:
        counter += 1
```

### 5.7 Python 多进程

```python
import multiprocessing

def cpu_intensive(n):
    return sum(i * i for i in range(n))

with multiprocessing.Pool(4) as pool:
    results = pool.map(cpu_intensive, [10**6, 2*10**6, 3*10**6])
    print(results)
```

### 5.8 Python 协程

```python
import asyncio
import aiohttp

async def fetch_url(session, url):
    async with session.get(url) as resp:
        return await resp.text()

async def main():
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_url(session, f"https://api.example.com/data/{i}")
                 for i in range(100)]
        results = await asyncio.gather(*tasks)

asyncio.run(main())
```

---

## 6. 工程中的典型实现

### 6.1 操作系统层

- **Linux CFS 调度器**：完全公平调度，使用红黑树管理可运行进程，按照虚拟运行时间分配 CPU。
- **mmap**：内存映射文件，将文件直接映射到进程地址空间，省去 `read/write` 的拷贝。
- **io_uring**：Linux 5.1 引入的异步 I/O 框架，通过共享提交/完成队列减少系统调用。

### 6.2 Java 并发框架

- **AQS 实现**：`ReentrantLock` 使用 AQS 的独占模式，`CountDownLatch` 使用共享模式。
- **ConcurrentHashMap 演进**：
  - Java 7：分段锁（Segment 继承 ReentrantLock，最多 16 段）
  - Java 8：数组 + 链表/红黑树，使用 `synchronized` + CAS，锁粒度降到桶级别
- **ForkJoinPool**：分治任务执行框架，工作窃取（Work-Stealing）算法提高 CPU 利用率。

### 6.3 网络框架

- **Netty**：基于 NIO + epoll 的异步事件驱动网络框架，零拷贝通过 `CompositeByteBuf`、`FileRegion` 实现。
- **Tomcat NIO**：使用 `Poller` 线程处理 I/O 事件，`Worker` 线程处理业务逻辑。
- **Python asyncio**：事件循环驱动协程调度，底层使用 `epoll`（Linux）/ `kqueue`（macOS）/ `IOCP`（Windows）。

### 6.4 数据库

- **MySQL**：行锁基于 `InnoDB` 存储引擎，锁是加在索引上的，而非数据行。
- **Redis**：单线程事件循环（`aeEventLoop`）处理所有命令，I/O 多路复用使用 epoll/kqueue。

---

## 7. 常见失败场景

### 7.1 操作系统相关

| 场景 | 现象 | 根因 |
|------|------|------|
| 文件描述符耗尽 | `Too many open files` | `ulimit` 限制或应用未及时关闭 fd |
| 上下文切换过高 | CPU `sys` 占用高，吞吐下降 | 线程数过多或锁竞争激烈 |
| 内存溢出 | OOM Killer 杀进程 | 内存泄漏或虚拟内存耗尽 |
| TCP 连接数过高 | 拒绝连接 | `net.core.somaxconn` 或 epoll 限制 |

### 7.2 并发编程相关

**死锁：**

```java
// 经典死锁：两个线程以不同顺序获取锁
// Thread 1: lock A → lock B
// Thread 2: lock B → lock A
```

**排查：** `jstack` 可直接检测死锁。

```bash
jstack <pid> | grep -A 30 "deadlock"
```

**活锁：** 两个线程互相谦让，不断释放锁给对方，导致无法推进。解决方法：引入随机退避。

**饥饿：** 低优先级线程长期得不到 CPU，或读锁频繁导致写锁无法获取。解决方法：使用公平锁。

**线程池耗尽：**
- 任务执行时间太长，核心线程全被占满
- 队列堆积，拒绝新任务
- 解决方案：设置合理超时、使用 `ThreadPoolExecutor` 回调监控

**内存一致性错误：**
- 在 `volatile` 缺失的场景下，一个线程的写入对另一个线程不可见
- 表现为死循环或读到过期的数据

**Python GIL 相关：**
- 多线程计算密集型任务反而比单线程慢
- 误用 `asyncio.run_in_executor` 导致线程池爆炸

---

## 8. 如何调试

### 8.1 操作系统层面

```bash
# CPU 和上下文切换
vmstat 1 10
top -H -p <pid>

# 文件描述符
lsof -p <pid>
ls -la /proc/<pid>/fd/

# 内存
cat /proc/meminfo
pmap -x <pid>

# 系统调用追踪
strace -p <pid> -e trace=read,write,epoll_wait

# 内核事件跟踪
perf top
perf stat -e context-switches,cache-misses ./app
```

### 8.2 Java 并发调试

```bash
# 查看线程堆栈
jstack <pid>

# 堆转储分析
jmap -dump:live,format=b,file=heap.hprof <pid>

# 实时查看线程状态
jconsole
jvisualvm

# 查看 JIT 编译后的汇编
-XX:+UnlockDiagnosticVMOptions -XX:+PrintAssembly
```

**分析工具：**
- `hprof` 文件用 MAT 或 JProfiler 分析
- `arthas`：阿里巴巴开源诊断工具
  ```bash
  # 查看线程池状态
  thread --state WAITING

  # 监控方法调用
  watch com.example.Service process '{params, returnObj, throwExp}' -x 3
  ```

### 8.3 Python 并发调试

```python
import threading
import traceback

# 查看线程栈
for thread_id, stack in threading._active.items():
    print(f"Thread {thread_id}:")
    traceback.print_stack(sys._current_frames()[thread_id])

# 使用 faulthandler
import faulthandler
faulthandler.enable()
faulthandler.dump_traceback()

# 协程调试
import asyncio
asyncio.get_event_loop().set_debug(True)
```

### 8.4 日志辅助

```java
// 记录线程名称方便追踪
Thread.currentThread().getName()

// MDC 传递请求 ID
MDC.put("traceId", UUID.randomUUID().toString());
log.info("处理请求…");
MDC.clear();
```

---

## 9. 如何测试

### 9.1 单元测试并发逻辑

```java
// 使用 CountDownLatch 控制线程同步
@Test
public void testCounter() throws Exception {
    Counter counter = new Counter();
    int threadCount = 100;
    int perThread = 1000;
    CountDownLatch latch = new CountDownLatch(threadCount);
    ExecutorService exec = Executors.newFixedThreadPool(10);

    for (int i = 0; i < threadCount; i++) {
        exec.submit(() -> {
            try {
                for (int j = 0; j < perThread; j++) {
                    counter.increment();
                }
            } finally {
                latch.countDown();
            }
        });
    }
    latch.await();
    assertEquals(threadCount * perThread, counter.getCount());
}
```

### 9.2 死锁测试

```java
// 使用 jstack 验证死锁检测
// 或者编写测试预期死锁时间
@Test(timeout = 5000)
public void testDeadlock() throws Exception {
    // 启动两个线程以不同顺序获取锁
    // 预期在 5 秒内超时而非无限等待
}
```

### 9.3 线程池测试

```java
@Test
public void testThreadPoolRejected() {
    ThreadPoolExecutor exec = new ThreadPoolExecutor(
        1, 1, 0, TimeUnit.SECONDS,
        new SynchronousQueue<>()
    );
    exec.execute(() -> sleep(1000));

    assertThrows(RejectedExecutionException.class, () -> {
        exec.execute(() -> {});
    });
}
```

### 9.4 并发容器测试

```java
@Test
public void testConcurrentHashMap() throws Exception {
    ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();
    // 多线程并发 put，验证不丢数据
    ExecutorService exec = Executors.newFixedThreadPool(10);
    CountDownLatch latch = new CountDownLatch(100);
    for (int i = 0; i < 100; i++) {
        int key = i;
        exec.submit(() -> {
            map.put("key-" + key, key);
            latch.countDown();
        });
    }
    latch.await();
    assertEquals(100, map.size());
}
```

### 9.5 Python 并发测试

```python
import pytest
import threading

def test_counter_concurrency():
    counter = Counter()
    errors = []

    def worker():
        for _ in range(1000):
            with counter.lock:
                counter.value += 1

    threads = [threading.Thread(target=worker) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert counter.value == 10_000
```

### 9.6 压力测试

```java
// 使用 JMH 做微基准测试
@Benchmark
@Threads(4)
public void benchmarkLock() {
    lock.lock();
    try {
        counter++;
    } finally {
        lock.unlock();
    }
}
```

---

## 10. 如何监控

### 10.1 JVM 并发指标

```bash
# 查看线程数
jstack <pid> | grep "java.lang.Thread.State" | sort | uniq -c

# GC 和内存
jstat -gcutil <pid> 1s

# 线程池指标（需暴露）
# 自定义 ThreadPoolExecutor 的 beforeExecute / afterExecute
```

**关键指标：**

| 指标 | 含义 | 告警阈值 |
|------|------|----------|
| 活动线程数 | 当前存活线程 | > 2000 |
| 阻塞线程数 | 等待锁的线程 | > 100 |
| 线程池队列大小 | 积压任务数 | > 队列容量 80% |
| 拒绝任务数 | 被拒绝的任务累计 | > 0 |
| 上下文切换速率 | cs/s | > 50k |
| 文件描述符使用率 | fd 使用量/上限 | > 80% |

### 10.2 Prometheus + Grafana

```java
// Micrometer 集成
MeterRegistry registry = new PrometheusMeterRegistry();
Counter rejectedJobs = Counter.builder("threadpool.rejected")
    .register(registry);

// 在拒绝策略中记录
executor.setRejectedExecutionHandler((r, e) -> {
    rejectedJobs.increment();
    throw new RejectedExecutionException();
});
```

```python
# Python 中使用 prometheus_client
from prometheus_client import Counter, Gauge, start_http_server

active_threads = Gauge('python_active_threads', 'Active threads')
async_tasks_pending = Gauge('asyncio_tasks_pending', 'Pending asyncio tasks')

def monitor_threads():
    active_threads.set(threading.active_count())
```

### 10.3 操作系统指标

```bash
# 上下文切换
cat /proc/stat | grep ctxt

# 文件描述符
cat /proc/sys/fs/file-nr

# 内存压力
cat /proc/vmstat | grep pgscan
```

### 10.4 告警规则示例

```
# Prometheus alert rule
- alert: HighContextSwitching
  expr: rate(node_context_switches_total[1m]) > 50000
  for: 5m
  annotations:
    summary: "高上下文切换率"

- alert: ThreadPoolExhausted
  expr: jvm_thread_pool_queue_size > 1000
  for: 1m
  annotations:
    summary: "线程池队列积压"
```

---

## 11. 常见面试问题

### 11.1 操作系统

1. **进程和线程的区别？** 资源分配 vs 调度单位，独立地址空间 vs 共享，切换开销，通信方式。
2. **用户态和内核态为什么要分开？** 安全和稳定，防止应用程序破坏操作系统。
3. **上下文切换的开销有多大？** 微秒级，主要来自寄存器保存、TLB 刷新、Cache Miss。
4. **虚拟内存有什么用？** 隔离进程、简化内存管理、按需加载、共享内存。
5. **内存分页为什么是 4KB？** 历史原因和性能权衡。小页节省内存但页表大，大页节省 TLB 但浪费空间。现在支持 2MB/1GB 大页。
6. **零拷贝是怎么实现的？** 通过 `sendfile`、`mmap` 等减少用户态/内核态的数据拷贝，利用 DMA 直接传输。
7. **select、poll、epoll 的区别？** 主要从描述符数量、拷贝方式、触发方式、时间复杂度等方面对比。
8. **epoll 的 LT 和 ET 模式区别？** LT 水平触发（不处理会重复通知），ET 边缘触发（只通知一次，需要循环读取）。

### 11.2 并发编程

1. **synchronized 和 ReentrantLock 的区别？** 自动/手动解锁、公平性、可中断、条件变量、性能。
2. **volatile 能保证原子性吗？** 不能，只保证可见性和有序性。`count++` 需要锁或 AtomicInteger。
3. **CAS 的 ABA 问题怎么解决？** 版本号（`AtomicStampedReference`）或时间戳。
4. **ConcurrentHashMap 的 put 流程？** 计算 hash → 判断是否初始化 → 桶为空用 CAS 写入 → 否则 synchronized 锁住桶。
5. **线程池的 corePoolSize 和 maxPoolSize 怎么设置？** CPU 密集型：N+1 或 N*2；I/O 密集型：根据等待时间/计算时间比例估算。
6. **死锁的四个必要条件？** 互斥、持有并等待、不可剥夺、循环等待。
7. **哲学家就餐问题怎么解决？** 资源分级、Chandy-Misra 算法、服务生方案。
8. **Java 内存模型中的 happens-before 规则？** 程序次序、管程锁定、volatile 变量、传递性等。
9. **Python 的 GIL 是什么？** 全局解释器锁，同一时刻只允许一个线程执行 Python 字节码。
10. **asyncio 协程和线程有什么区别？** 协程是用户态调度，切换开销极小（纳秒级），但本质上是单线程。

---

## 12. 在我的项目中如何使用

### 12.1 项目中使用的并发模式

**线程池配置：**

```yaml
# application.yml
thread-pool:
  core-size: 8           # 根据 CPU 核数配置
  max-size: 16
  queue-capacity: 5000
  keep-alive: 60
  thread-name-prefix: "biz-"
  rejected-policy: "caller-runs"
```

```java
@Configuration
public class ThreadPoolConfig {

    @Bean("bizExecutor")
    public ThreadPoolExecutor bizExecutor(
            @Value("${thread-pool.core-size}") int core,
            @Value("${thread-pool.max-size}") int max,
            @Value("${thread-pool.queue-capacity}") int queue,
            @Value("${thread-pool.keep-alive}") long keepAlive,
            @Value("${thread-pool.thread-name-prefix}") String prefix) {
        return new ThreadPoolExecutor(
                core, max, keepAlive, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(queue),
                new ThreadFactoryBuilder().setNameFormat(prefix + "%d").build(),
                new ThreadPoolExecutor.CallerRunsPolicy()
        );
    }
}
```

**监控注册：**

```java
@Component
public class ThreadPoolMonitor {

    @PostConstruct
    public void init() {
        ScheduledExecutorService monitor = Executors.newSingleThreadScheduledExecutor();
        monitor.scheduleAtFixedRate(() -> {
            ThreadPoolExecutor pool = bizExecutor;
            log.info("线程池状态: active={}, queue={}, completed={}, rejected={}",
                    pool.getActiveCount(),
                    pool.getQueue().size(),
                    pool.getCompletedTaskCount(),
                    rejectedCounter.sum());
        }, 0, 30, TimeUnit.SECONDS);
    }
}
```

### 12.2 CompletableFuture 编排异步请求

```java
// 并行调用多个下游服务并聚合结果
public OrderDetail getOrderDetail(Long orderId) {
    CompletableFuture<UserInfo> userFuture =
            CompletableFuture.supplyAsync(() -> userService.getUser(orderId), executor);
    CompletableFuture<List<OrderItem>> itemsFuture =
            CompletableFuture.supplyAsync(() -> orderItemService.getItems(orderId), executor);
    CompletableFuture<PaymentInfo> paymentFuture =
            CompletableFuture.supplyAsync(() -> paymentService.getPayment(orderId), executor);

    return CompletableFuture.allOf(userFuture, itemsFuture, paymentFuture)
            .thenApply(v -> {
                UserInfo user = userFuture.join();
                List<OrderItem> items = itemsFuture.join();
                PaymentInfo payment = paymentFuture.join();
                return OrderDetail.builder()
                        .user(user)
                        .items(items)
                        .payment(payment)
                        .build();
            })
            .orTimeout(5000, TimeUnit.MILLISECONDS)
            .exceptionally(ex -> {
                log.error("获取订单详情失败", ex);
                return OrderDetail.builder().failed(true).build();
            })
            .join();
}
```

### 12.3 文件上传零拷贝

```java
// Spring Boot 中利用零拷贝发送文件
@GetMapping("/download/{id}")
public void download(@PathVariable Long id, HttpServletResponse response) {
    File file = fileService.getFile(id);
    response.setContentType(MediaType.APPLICATION_OCTET_STREAM_VALUE);
    response.setHeader("Content-Disposition", "attachment; filename=" + file.getName());

    // Java NIO FileChannel.transferTo — 底层使用 sendfile
    try (FileChannel channel = FileChannel.open(file.toPath(), StandardOpenOption.READ)) {
        channel.transferTo(0, channel.size(), Channels.newChannel(response.getOutputStream()));
    }
}
```

### 12.4 Python 异步爬虫/API 调用

```python
import asyncio
import aiohttp
from typing import List, Dict

class AsyncApiClient:
    def __init__(self, base_url: str, concurrency: int = 10):
        self.base_url = base_url
        self.semaphore = asyncio.Semaphore(concurrency)

    async def fetch(self, endpoint: str) -> Dict:
        async with self.semaphore:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}{endpoint}") as resp:
                    return await resp.json()

    async def batch_fetch(self, endpoints: List[str]) -> List[Dict]:
        tasks = [self.fetch(ep) for ep in endpoints]
        return await asyncio.gather(*tasks, return_exceptions=True)

# 使用
client = AsyncApiClient("https://api.example.com")
results = asyncio.run(client.batch_fetch(["/data/1", "/data/2", "/data/3"]))
```

### 12.5 使用 I/O 多路复用的场景

项目中的网关层使用 Netty，内部基于 epoll（Linux）或 IOCP（Windows）实现高并发连接管理：

```java
// Netty Server 配置（Spring Boot Actuator + 自定义接入）
EventLoopGroup bossGroup = new EpollEventLoopGroup(1);
EventLoopGroup workerGroup = new EpollEventLoopGroup(Runtime.getRuntime().availableProcessors() * 2);
try {
    ServerBootstrap b = new ServerBootstrap();
    b.group(bossGroup, workerGroup)
     .channel(EpollServerSocketChannel.class)
     .option(ChannelOption.SO_BACKLOG, 1024)
     .childHandler(new ChannelInitializer<SocketChannel>() {
         @Override
         protected void initChannel(SocketChannel ch) {
             ch.pipeline().addLast(new HttpServerCodec());
             ch.pipeline().addLast(new MyBusinessHandler());
         }
     });
    ChannelFuture f = b.bind(8080).sync();
    f.channel().closeFuture().sync();
} finally {
    bossGroup.shutdownGracefully();
    workerGroup.shutdownGracefully();
}
```

### 12.6 分布式锁（Redis 实现）

```java
// 基于 Redis 的分布式锁
public String tryLock(String key, long timeoutMs) {
    String lockId = UUID.randomUUID().toString();
    Boolean success = redisTemplate.opsForValue()
            .setIfAbsent(key, lockId, timeoutMs, TimeUnit.MILLISECONDS);
    return Boolean.TRUE.equals(success) ? lockId : null;
}

public boolean unlock(String key, String lockId) {
    // 使用 Lua 脚本保证原子性
    String script = "if redis.call('get', KEYS[1]) == ARGV[1] " +
                    "then return redis.call('del', KEYS[1]) " +
                    "else return 0 end";
    Long result = redisTemplate.execute(
            new DefaultRedisScript<>(script, Long.class),
            List.of(key), lockId);
    return Long.valueOf(1).equals(result);
}
```

---

> **写作参考**：操作系统与并发编程是后端知识体系的地基。这部分理解得越深，后面学数据库事务隔离、网络框架设计、分布式一致性等问题时就越轻松。建议每半年回头重读一遍，每次都会有新的感悟。
