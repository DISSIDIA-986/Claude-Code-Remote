# TaskPing 邮件回复功能使用指南

[English](./HOW_TO_USE_EMAIL_REPLY.md) | **中文**

## 📋 完整使用流程

### 步骤 1：启动邮件监听服务

在终端 1 中运行：

```bash
cd /Users/jessytsui/dev/TaskPing
npm run relay:pty
```

这会启动邮件监听服务，监听 `noreply@example.com` 收到的回复邮件。

### 步骤 2：启动 Claude Code 并集成 TaskPing

在终端 2 中运行：

```bash
# 启动Claude Code
claude

# 在Claude Code中使用TaskPing发送邮件通知
# 例如：当任务完成时会自动发送邮件
```

### 步骤 3：配置 Claude Code 钩子（如果还没配置）

在 Claude Code 中运行：

```bash
# 查看当前钩子配置
cat ~/.config/claude-code/settings/hooks.json

# 如果没有配置，需要设置TaskPing钩子
# 复制TaskPing的钩子配置文件
```

## 📧 邮件回复测试流程

### 方法 1：手动测试发送邮件

```bash
# 在TaskPing目录中运行
node test-smtp-token.js
```

这会发送一封测试邮件到 `user@example.com`，邮件主题包含 Token 格式：
`[TaskPing #XXXXXXXX] Claude Code 任务完成 - TaskPing-Token-Test`

### 方法 2：实际集成测试

1. 在 Claude Code 中执行一个任务
2. 任务完成后，TaskPing 会自动发送邮件通知
3. 邮件会发送到配置的邮箱（`user@example.com`）

## 💌 如何回复邮件发送命令

### 收到邮件后：

1. 在 `user@example.com` 收到邮件，主题如：

   ```
   [TaskPing #A53PXR7F] Claude Code 任务完成 - 项目名
   ```

2. **直接回复邮件**，在正文中输入命令：

   ```
   继续优化代码
   ```

   或

   ```
   生成单元测试
   ```

   或

   ```
   解释这个函数的作用
   ```

3. 发送回复后，邮件监听服务会：
   - 收到回复邮件
   - 提取 Token（A53PXR7F）
   - 找到对应的 PTY 会话
   - 将命令注入到 Claude Code CLI

## 🔧 配置文件说明

### .env 配置

```env
# 发件配置（飞书邮箱）
SMTP_HOST=smtp.feishu.cn
SMTP_USER=noreply@example.com
SMTP_PASS=kKgS3tNReRTL3RQC

# 收件配置（飞书邮箱）
IMAP_HOST=imap.feishu.cn
IMAP_USER=noreply@example.com
IMAP_PASS=kKgS3tNReRTL3RQC

# 用户通知邮箱
EMAIL_TO=user@example.com

# 允许发送命令的邮箱（安全白名单）
ALLOWED_SENDERS=user@example.com
```

## 🐛 故障排除

### 1. 收不到邮件回复

检查：

- 邮件监听服务是否正在运行（`npm run relay:pty`）
- 是否从白名单邮箱（`user@example.com`）发送回复
- 邮件主题是否包含正确的 Token 格式

### 2. 命令没有注入到 Claude Code

检查：

- Claude Code 是否还在运行
- PTY 会话是否还有效（Token 未过期）
- 检查服务日志输出

### 3. 查看调试日志

```bash
# 查看详细的邮件监听日志
DEBUG=true npm run relay:pty
```

## 📱 支持的邮件客户端

用户可以从任意邮箱回复到 `noreply@example.com`：

- ✅ Gmail 网页版/客户端
- ✅ 手机 Gmail APP
- ✅ Apple Mail
- ✅ Outlook
- ✅ QQ 邮箱
- ✅ 163 邮箱
- ✅ 任何支持 SMTP 的邮箱

## 🔒 安全特性

1. **Token 验证**：每个会话有唯一 Token，防止误操作
2. **发件人白名单**：只有授权邮箱可以发送命令
3. **会话过期**：Token 有 24 小时有效期
4. **命令过滤**：自动过滤潜在危险命令

## 🎯 实际使用场景

### 场景 1：长时间构建

```
1. 在Claude Code中启动项目构建
2. 离开电脑，在手机收到构建完成邮件
3. 手机直接回复："继续部署到生产环境"
4. 回到电脑时部署已完成
```

### 场景 2：代码审查

```
1. Claude Code完成代码生成
2. 收到邮件通知
3. 回复："请添加单元测试和文档"
4. Claude自动生成测试和文档
```

这样就可以实现真正的远程控制 Claude Code 了！
