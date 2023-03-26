# ArgusDrive-基于HTTPS的安全文件管理系统

## 安全性保证

### 基于HTTPS的中间人攻击防御

本项目使用[Let's Encrypt](https://diamondfsd.com/lets-encrytp-hand-https/)为服务器及域名申请SSL证书，所有网络传输均使用HTTPS进行传输。在通信过程中，HTTPS通过以下流程保证信息的传输不被窃取：

1. 客户端向服务器发起HTTPS请求；
2. 服务器返回证书；
3. 客户端验证证书是否可信；
4. 如果证书可信，则生成随机数并用证书中的公钥进行加密；
5. 服务器用自己的私钥解密出随机数；
6. 双方根据相同的算法生成对称加密所需的密钥；
7. 双方开始使用对称加密算法进行通信

### 基于Cloudflare的DDoS防御

本项目的服务器域名通过Cloudflare平台进行托管及DNS解析，并开启了L7级别的“网站DDoS保护 - Web服务”，通过分析流量，识别和过滤掉恶意流量，同时确保合法流量的性能不受影响。它通过全球285个数据中心智能过滤和分配网络流量，为所有付费计划不限量地吸收OSI模型3、4和7层的流量并缓解DDoS攻击。

### 基于后端加密用户密码的SQL注入防御

项目通过对用户密码的随机加盐加密存储，使得攻击者即使能够访问数据库内容，也难以读取用户的关键信息。项目通过 Bcrypt 使用 Blowfish 加密算法来散列密码，项目启用了eksblowfish最“昂贵”的密钥设置，即使用 128 位盐并加密 192 位的魔法值，这使得攻击者更难使用暴力攻击来猜测密码。

## 系统功能流程图

本项目具有如下功能：

- 用户注册
- 用户登录
- 基于SessionId的身份管理
- 独立用户空间
- 支持分片、断点续传的文件上传
- 支持分片、断点续传的文件下载

本项目的功能流程图如下：

```mermaid
graph TD
    A["路由 '/'"] --> B{注册/登录?};
    B -->|注册| C["路由 '/register'"];
    C --> D(加密密码并将用户名&密码存储到数据库);
    B -->|登录| F["路由 '/login'"];
    F --> G{验证用户名和密码};
    G -->|验证通过| H["分配SessionId并路由到'/filemanage'"];
    H --> J;
    A --> J
    subgraph Verify SessionId on each user request
    J["路由 '/filemanage'"];
    J -->|Upload| K["路由 '/upload'"];
    K --> L(Store uploaded file information in database);
    J -->|Download| M["路由 '/download'"];
    J -->|List| N["路由 '/list'"];
    end
```

## 各协议时序图

### 用户注册

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend("\register")
    User->>Frontend: 输入用户名、邮箱、密码
    Frontend->>Backend("\register"): 发送数据
    Backend("\register")->>Backend("\register"): 随机生成盐
    Backend("\register")->>Backend("\register"): 用盐加密密码
    Backend("\register")->>Backend("\register"): 存入用户数据表
    Backend("\register")->>Backend("\register"): 存入盐数据表
    Backend("\register")->>Frontend: 发送注册结果
    Frontend->>User: 显示结果

```

### 用户登录

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend("\login")
    participant Database

    User->>Frontend: 输入用户名和密码
    Frontend->>Backend("\login"): 发送用户名和密码
    Backend("\login")->>Database: 查询用户名的盐
    Database-->>Backend("\login"): 返回盐
    Backend("\login")->>Backend("\login"): 对密码进行加密
    Backend("\login")->>Database: 查询用户名的加密密码
    Database-->>Backend("\login"): 返回加密密码
    Backend("\login")->>Backend("\login"): 对密码加密结果进行验证
    Backend("\login")->>Backend("\login"): 生成 session
    Backend("\login")->>Database: 存储 session
    Backend("\login")->>Frontend: 返回 session 和登录结果
    Frontend->>User: 显示登录结果
```

### 文件上传

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend("\uploaded")
    participant Backend("\upload_merge")
    participant Backend("\list")
    participant Database
    
    User->>Frontend: 选择文件并点击上传按钮
    Frontend->>Backend("\uploaded"): 发送文件信息并请求是否存在切片
    Backend("\uploaded")->>Database: 查询该用户的文件列表
    Database-->>Backend("\uploaded"): 返回文件列表
    Backend("\uploaded")->>Frontend: 响应结果
    Frontend->>Frontend: 将文件分片
    Frontend->>Frontend: 计算每片大小
    Frontend->>Frontend: 分为不超过20片
    Frontend->>Backend("\upload_chunk"): 对每个文件切片进行上传
    Backend("\upload_chunk")->>Backend("\upload_chunk"): 判断是否已存在文件切片
    Backend("\upload_chunk")->>Frontend: 返回切片的上传结果
    Frontend->>User: 更新进度条
    Frontend->>Backend("\upload_merge"): 请求判断文件切片是否全部上传
    Frontend->>Backend("\upload_chunk"): 对每个文件切片进行上传
    Frontend->>Frontend: ...
    Frontend->>Frontend: 重复，直到所有文件切片上传完毕
    Backend("\upload_merge")->>Backend("\upload_merge"): 判断文件切片是否齐全
    Backend("\upload_merge")->>Backend("\upload_merge"): 将文件切片合并并存入用户独立空间
    Backend("\upload_merge")->>Database: 将文件信息写入数据库
    Backend("\upload_merge")->>Frontend: 响应结果
    Frontend->>User: 显示上传结果
    Frontend->>Backend("\list"): 请求用户当前独立空间文件列表
    Backend("\list")->>Database: 查询用户文件列表
    Database-->>Backend("\list"): 返回用户文件列表
    Backend("\list")->>Frontend: 返回用户文件列表
    Frontend->>User: 向用户展示所有文件
```

每个前端对后端的请求，后端都有中间层处理并验证SessionId，因篇幅限制，已忽略。

### 文件下载

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend("\download")
    
    User->>Frontend: 点击文件下载按钮
    Frontend->>Backend("\download"): 发送文件传输请求
    Backend("\download")->>Backend("\download"): 判断文件是否存在
    Backend("\download")->>Frontend: 返回文件大小
    Frontend->>Frontend: 将文件分片
    Frontend->>Backend("\download"): 请求文件分片的头和尾
    Backend("\download")->>Frontend: 返回文件分片
    Frontend->>Backend("\download"): 请求下一个文件分片的头和尾
    Backend("\download")->>Frontend: 返回下一个文件分片
    Frontend->>Frontend: 重复直到所有文件分片都被返回
    Frontend->>Frontend: 将文件分片链接在一起
    Frontend->>User: 创建下载元素
    User->>User: 点击下载保存文件到本地
```

每个前端对后端的请求，后端都有中间层处理并验证SessionId，因篇幅限制，已忽略。

## 总结

- 实现了一种简单但安全的文件传输协议
- 基于Node.js的并发支持，能多用户并发访问，文件可完整的传输
- 通信全过程可抵御中间人、DDoS、SQL注入等常见攻击

加分功能实现：

- 基于判断服务端文件分片的获得情况，实现了文件的断点续传
- 基于HTTP的SSL加密，实现了对称及非对称的身份验证
- 支持服务端判断用户身份，有根据身份进一步区别处理空间
