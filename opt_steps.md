# macOS Apple Silicon 用户专属：Claude Code Remote 部署与使用指南

---

## 📋 目录

1. [🎯 第一步：核心概念与准备工作](#🎯-第一步核心概念与准备工作)
2. [🔧 第二步：生成并存储应用专用密码](#🔧-第二步生成并存储应用专用密码)
3. [🚀 第三步：安装与配置项目](#🚀-第三步安装与配置项目)
4. [🎮 第四步：启动与在手机上使用](#🎮-第四步启动与在手机上使用)
5. [✅ 第五步：端到端测试](#✅-第五步端到端测试验证您的配置)
6. [🔧 故障排除](#🔧-故障排除-troubleshooting)
7. [📋 快速检查清单](#📋-快速检查清单)
8. [🚀 快速启动命令](#🚀-快速启动命令)

---

## 🎯 第一步：核心概念与准备工作

### 重要概念澄清

1.  **第三方工具**：`Claude-Code-Remote` 是一个开源的第三方工具，它通过邮件来远程控制一个在您自己电脑上运行的、名为 `claude` 的命令行工具。
2.  **`claude` CLI**: 您需要首先确保您已经安装并可以运行 `claude` 这个独立的命令行 AI 交互程序。本项目的作用是为这个本地工具增加远程邮件控制的能力。
3.  **工作原理**: 您在 Mac 上通过 `tmux` 让 `claude` 程序在后台持续运行。当 `claude` 完成任务时，它会通过钩子 (Hooks) 触发一个脚本，用您的邮箱给自己发一封通知邮件。您在手机上收到邮件后，直接回复邮件内容（即新的指令），本项目的监听服务会捕获回复，并将指令注入到 `claude` 程序中执行。

### 准备工作 (Prerequisites)

1.  **您的 Mac**: 确保已安装 Homebrew, Node.js, npm, 和 Git。
2.  **一个专用的邮箱账户**: 推荐使用 Gmail。您需要为此邮箱生成一个 **应用专用密码 (App Password)**。

### 前置条件检查

在开始配置前，请先运行以下命令确认所有必需工具已安装：

```bash
# 检查 Node.js 和 npm
node --version && npm --version

# 检查 Git
git --version

# 检查 tmux
tmux -V

# 最重要：检查 claude CLI 是否已安装
claude --version
```

如果任何命令返回 "command not found"，请先安装相应的工具再继续。

---

## 🔧 第二步：安装与配置项目

### 1. 生成应用专用密码 (以 Gmail 为例)

1.  **开启两步验证**: 访问 [Google 账户安全页面](https://myaccount.google.com/security)，确保 **“两步验证” (2-Step Verification)** 已开启。
2.  **创建密码**: 在同一页面，点击 **“应用专用密码” (App Passwords)**。
3.  在 “选择应用” 菜单中，选择 **“其他（自定义名称）”**。
4.  输入一个名称 (例如 `Claude-Code-Remote`) 并点击 **“生成”**。
5.  Google 会生成一个 16 位的密码。**立即复制这个密码**，它只会出现一次。

### 2. 下载并安装

```bash
# 克隆项目代码
git clone https://github.com/JessyTsui/Claude-Code-Remote.git

# 进入项目目录
cd Claude-Code-Remote

# 安装依赖
npm install
```

### 3. 配置环境变量

1.  从模板复制配置文件:

    ```bash
    cp .env.example .env
    ```

2.  使用编辑器打开 `.env` 文件 (`nano .env` 或 `code .env`)。

3.  **仔细填写以下字段**:

    ```ini
    # --- 邮件服务器配置 ---
    # 您的邮箱SMTP和IMAP服务器地址 (例如: smtp.gmail.com, imap.gmail.com)
    SMTP_HOST=smtp.gmail.com
    IMAP_HOST=imap.gmail.com

    # --- 登录凭证 ---
    # 您的邮箱地址
    SMTP_USER=your-email@gmail.com
    IMAP_USER=your-email@gmail.com

    # 您生成的16位应用专用密码
    SMTP_PASS=your-16-digit-app-password
    IMAP_PASS=your-16-digit-app-password

    # --- 通知与安全 ---
    # 您用来接收通知和发送命令的邮箱 (您自己的手机邮箱)
    EMAIL_TO=your-notification-email@gmail.com
    # 授权可以发送命令的邮箱白名单 (为了安全, 建议只填您自己的邮箱)
    ALLOWED_SENDERS=your-notification-email@gmail.com

    # --- 会话路径 (重要!) ---
    # 确保这是正确的绝对路径
    SESSION_MAP_PATH=/Users/niuyp/Documents/github.com/Claude-Code-Remote/src/data/session-map.json
    ```

### 4. 配置 Claude Code 钩子 (Hooks)

找到 `claude` 的配置文件 (通常在 `~/.config/claude-code/settings/hooks.json` 或 `~/.claude/settings.json`)，并添加以下 `hooks` 配置。请确保 `command` 中的路径是您电脑上的**绝对路径**。

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node /Users/niuyp/Documents/github.com/Claude-Code-Remote/claude-remote.js notify --type completed",
            "timeout": 5
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node /Users/niuyp/Documents/github.com/Claude-Code-Remote/claude-remote.js notify --type waiting",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

---

## 🎮 第三步：启动与在手机上使用

您需要**打开两个终端窗口**来运行整个系统。

#### 终端窗口 1：启动邮件监听服务

此服务负责接收和发送邮件，必须保持运行。

```bash
# 进入 Claude-Code-Remote 项目目录
cd /Users/niuyp/Documents/github.com/Claude-Code-Remote

# 启动邮件监听和命令中继服务
npm run relay:pty
```

#### 终端窗口 2：在 TMUX 中启动 Claude 会话 (在您的开发项目中)

这个窗口用于运行 `claude`，它将作为您的 AI 助手。**关键一步**是，您需要先进入到您**实际开发项目**的目录，然后再启动 `claude`，这样它才能正确地访问和管理您的项目文件。

```bash
# 举例：进入你自己的项目目录
cd /path/to/your/actual/project

# 首先检查是否已有会话存在
tmux list-sessions

# 方法1：分步创建会话（推荐，最稳定）
tmux new-session -s claude-session -d
tmux send-keys -t claude-session 'claude' Enter

# 方法2：如果提示会话已存在，连接到现有会话
tmux attach -t claude-session

# 方法3：如果需要重新创建会话
tmux kill-session -t claude-session 2>/dev/null || true
tmux new-session -s claude-session -d
tmux send-keys -t claude-session 'claude' Enter

# ⚠️ 避免使用以下命令（可能导致乱码）
# tmux new-session -s claude-session 'claude'  # 不推荐
```

- **重要提示**: `claude` 的工作目录就是您运行 `tmux` 命令时所在的目录。请确保这个目录是您的目标开发项目。
- **检查会话状态**: 使用 `tmux list-sessions` 确认会话已成功创建。
- **重新连接**: 在任何终端窗口输入 `tmux attach -t claude-session`。

### 在手机上远程控制

1.  **接收通知**: 当 `claude` 完成任务后，您的手机会收到一封通知邮件。
2.  **回复命令**: 打开邮件，直接点击 **回复 (Reply)**，在正文中输入新的指令，然后发送。
3.  **自动执行**: 您 Mac 上的监听服务会自动捕获您的回复，并将其注入到 `claude` 中执行。

---

## ✅ 第四步：端到端测试 (验证您的配置)

完成以上所有步骤后，强烈建议您进行一次完整的端到端测试，以确保所有组件都正常工作。

### 1. 准备测试项目

确保您的开发项目中有一些待提交的更改。如果没有，可以手动修改一个文件。

```bash
# 进入您的开发项目目录 (例如)
cd /path/to/your/actual/project

# 创建一个测试文件或修改现有文件
echo "test" > test.txt

# 将更改添加到暂存区
git add .
```

### 2. 启动服务

按照 **第三步** 的说明，在两个终端窗口中分别启动**邮件监听服务**和 **TMUX 中的 Claude 会话**。

### 3. 触发邮件通知

在 `claude` 的交互界面中 (终端窗口 2)，输入一个简单的命令来触发“等待中”的钩子。

```
ls -F
```

`claude` 执行完后，会触发 `SubagentStop` 钩子。稍等片刻，您应该会收到一封标题为 `[Claude] Waiting for command` 的邮件。

### 4. 通过邮件发送指令

1.  在您的手机或电脑上打开这封通知邮件。
2.  直接 **回复 (Reply)** 该邮件。
3.  在回复正文中输入您的指令，例如：

    > **把所有变更提交了, commit message 写: "Test commit via Claude-Code-Remote"**

4.  发送邮件。

### 5. 验证结果

1.  **观察监听服务**: 在终端窗口 1 中，您应该能看到日志，显示已收到邮件并成功将指令注入 `claude`。
2.  **检查 Git 记录**: 在您的开发项目目录中，运行 `git log` 查看提交历史。

    ```bash
    # 在您的开发项目目录中运行
    git log -n 1
    ```

如果最新的提交记录显示了您刚刚通过邮件发送的 commit message，那么恭喜您！整个远程开发流程已成功打通。

---

## 🔧 故障排除 (Troubleshooting)

### 问题 1：`tmux new-session -s claude-session 'claude'` 立即退出并显示 `[exited]`

**症状**: 执行 tmux 命令后，会话立即退出，可能还会出现终端乱码。

**原因**: `claude` 命令未找到或配置不正确。

**解决方案**:

1. **检查 claude 命令是否存在**:

   ```bash
   which claude
   ```

2. **如果显示 "command not found"**，请确保您已正确安装 claude CLI 工具。

3. **如果 claude 是别名，检查配置**:

   ```bash
   grep "alias claude" ~/.zshrc
   ```

4. **常见配置问题**: 确保您的 `~/.zshrc` 中只有一个 `claude` 别名定义：

   ```bash
   alias claude='~/.claude/local/claude'
   ```

   **注意**: 一些老版本的文档可能提到 `--no-iterm-integration` 参数，但在新版本的 claude (1.0.62+) 中已不再需要此参数。

5. **修复后重新加载配置**:
   ```bash
   source ~/.zshrc
   ```

### 问题 2：钩子 (Hooks) 不工作

**症状**: `claude` 运行正常，但不发送邮件通知。

**解决方案**:

1. **检查 hooks 配置文件路径**:

   ```bash
   ls ~/.config/claude-code/settings/
   ls ~/.claude/
   ```

2. **确保 hooks.json 格式正确**，参考第二步的配置示例。

3. **测试钩子命令**，手动执行：
   ```bash
   node /Users/niuyp/Documents/github.com/Claude-Code-Remote/claude-remote.js notify --type waiting
   ```

### 问题 2.1：钩子配置正确但仍不触发

**症状**: 手动测试钩子命令可以发送邮件，但 Claude 执行命令后不触发钩子。

**诊断步骤**:

1. **验证钩子文件格式**:

   ```bash
   jq . ~/.claude/settings.json
   ```

2. **检查钩子配置路径**:

   ```bash
   cat ~/.claude/settings.json | grep -A 10 hooks
   ```

3. **确认工作目录正确**:
   ```bash
   # 钩子命令中的路径必须是绝对路径
   which node  # 确认 node 路径
   ls /Users/niuyp/Documents/github.com/Claude-Code-Remote/claude-remote.js
   ```

**常见原因及解决方案**:

1. **路径问题**: 确保钩子命令使用绝对路径:

   ```json
   {
     "hooks": {
       "Stop": [
         {
           "matcher": "*",
           "hooks": [
             {
               "type": "command",
               "command": "/usr/local/bin/node /Users/niuyp/Documents/github.com/Claude-Code-Remote/claude-remote.js notify --type completed",
               "timeout": 10
             }
           ]
         }
       ],
       "SubagentStop": [
         {
           "matcher": "*",
           "hooks": [
             {
               "type": "command",
               "command": "/usr/local/bin/node /Users/niuyp/Documents/github.com/Claude-Code-Remote/claude-remote.js notify --type waiting",
               "timeout": 10
             }
           ]
         }
       ]
     }
   }
   ```

2. **增加超时时间**: 将 `timeout` 从 5 增加到 10 秒

3. **使用完整的 node 路径**:

   ```bash
   # 找到 node 的完整路径
   which node
   # 通常是 /usr/local/bin/node 或 /opt/homebrew/bin/node
   ```

4. **重新启动 Claude 会话**以使配置生效:

   ```bash
   tmux kill-session -t claude-session
   tmux new-session -s claude-session -d
   tmux send-keys -t claude-session 'claude' Enter
   ```

5. **验证钩子是否被识别**:
   ```bash
   # 在 Claude 中查看配置
   tmux send-keys -t claude-session '/help' Enter
   ```

### 问题 3：tmux 会话创建失败

**症状**: tmux 命令执行后显示 "no server running" 或会话立即消失。

**解决方案**:

1. **使用分步方式创建会话**:

   ```bash
   # 先创建会话
   tmux new-session -s claude-session -d

   # 然后在会话中运行 claude
   tmux send-keys -t claude-session 'claude' Enter
   ```

2. **或者使用前台模式创建**:

   ```bash
   # 创建前台会话
   tmux new-session -s claude-session

   # 在 tmux 内部运行：claude
   # 然后按 Ctrl+b, d 分离会话
   ```

3. **检查现有会话**:

   ```bash
   tmux list-sessions
   ```

4. **连接到现有会话**:
   ```bash
   tmux attach -t claude-session
   ```

### 问题 3.1：会话名称冲突 - `duplicate session: claude-session`

**症状**: 执行 tmux 创建命令时提示 "duplicate session: claude-session"。

**原因**: 已经存在同名的 tmux 会话。

**解决方案**:

1. **查看现有会话**:

   ```bash
   tmux list-sessions
   ```

2. **连接到现有会话（推荐）**:

   ```bash
   tmux attach -t claude-session
   ```

3. **或者删除现有会话后重新创建**:

   ```bash
   # 强制删除现有会话
   tmux kill-session -t claude-session

   # 重新创建会话
   tmux new-session -s claude-session -d
   tmux send-keys -t claude-session 'claude' Enter
   ```

4. **或者使用不同的会话名称**:
   ```bash
   # 使用时间戳创建唯一会话名
   tmux new-session -s claude-session-$(date +%H%M) -d
   tmux send-keys -t claude-session-$(date +%H%M) 'claude' Enter
   ```

### 问题 3.2：终端乱码 - 显示类似 `64;1;2;4;6;17;18;21;22c64` 的内容

**症状**: 执行 tmux 命令后出现大量乱码，终端显示异常。

**原因**: 使用 `tmux new-session -s session 'command'` 语法时，如果命令立即退出，会导致终端状态混乱。

**解决方案**:

1. **立即清理终端状态**:

   ```bash
   reset
   ```

2. **使用推荐的分步创建方法**:

   ```bash
   # 正确方法
   tmux new-session -s claude-session -d
   tmux send-keys -t claude-session 'claude' Enter

   # 避免使用这种方法（可能导致乱码）
   # tmux new-session -s claude-session 'claude'
   ```

3. **检查 claude 运行状态**:
   ```bash
   tmux capture-pane -t claude-session -p
   ```

### 问题 3.3：tmux 会话不停打印空行，无法关闭

**症状**: 执行 `tmux attach -t session-name` 后，终端不停打印空行或重复信息，无法正常使用。

**原因**: 会话中的程序陷入循环输出状态，可能是 Claude 或其他程序出现故障。

**解决方案**:

1. **不要直接附加到有问题的会话**，先检查会话内容:

   ```bash
   tmux capture-pane -t session-name -p
   ```

2. **尝试发送中断信号**:

   ```bash
   tmux send-keys -t session-name C-c
   ```

3. **如果中断无效，直接终止会话**:

   ```bash
   tmux kill-session -t session-name
   ```

4. **重新创建正常的会话**:

   ```bash
   tmux new-session -s claude-session -d
   tmux send-keys -t claude-session 'claude' Enter
   ```

5. **预防措施**: 始终使用分步创建方法避免此类问题:

   ```bash
   # 推荐的安全方法
   tmux new-session -s session-name -d
   tmux send-keys -t session-name 'your-command' Enter

   # 检查状态后再附加
   tmux capture-pane -t session-name -p
   tmux attach -t session-name  # 确认正常后再附加
   ```

### 问题 3.4：Claude 界面正常但输入无响应

**症状**: `tmux attach -t claude-session` 后能看到 claude 界面，但在输入框中输入命令后按 Enter 无反应。

**可能原因**:

1. Claude 进程可能处于等待状态或挂起
2. 终端输入缓冲区问题
3. Claude 内部状态异常

**诊断步骤**:

1. **检查 claude 进程状态**:

   ```bash
   # 在另一个终端检查
   tmux capture-pane -t claude-session -p | tail -10
   ```

2. **尝试发送特殊命令**:

   ```bash
   # 从外部发送命令测试
   tmux send-keys -t claude-session '/help' Enter
   tmux capture-pane -t claude-session -p
   ```

3. **检查是否有输入焦点问题**:
   ```bash
   # 尝试发送 Ctrl+C 中断
   tmux send-keys -t claude-session C-c
   # 然后重新发送命令
   tmux send-keys -t claude-session 'ls -F' Enter
   ```

**解决方案**:

1. **方法 1: 重置 Claude 状态**:

   ```bash
   # 在 claude 会话中按 Ctrl+C 中断当前状态
   tmux send-keys -t claude-session C-c
   # 稍等片刻后发送新命令
   tmux send-keys -t claude-session 'pwd' Enter
   ```

2. **方法 2: 完全重启 Claude 会话**:

   ```bash
   # 彻底重新创建会话
   tmux kill-session -t claude-session
   cd /path/to/your/project  # 切换到项目目录
   tmux new-session -s claude-session -d
   tmux send-keys -t claude-session 'claude' Enter

   # 等待 claude 启动完成后再连接
   sleep 3
   tmux attach -t claude-session
   ```

3. **方法 3: 使用外部命令注入** (推荐用于远程控制):

   ```bash
   # 不进入会话，直接从外部发送命令
   tmux send-keys -t claude-session 'ls -F' Enter

   # 检查执行结果
   tmux capture-pane -t claude-session -p
   ```

4. **方法 4: 检查键盘映射和终端设置**:
   ```bash
   # 在 tmux 会话内检查终端状态
   tmux send-keys -t claude-session 'echo $TERM' Enter
   tmux send-keys -t claude-session 'stty -a' Enter
   ```

**最佳实践**: 对于 Claude Code Remote 系统，推荐使用 `tmux send-keys` 方式而不是直接 attach，这样可以避免交互问题：

```bash
# 推荐的使用方式
tmux send-keys -t claude-session 'your-command-here' Enter

# 检查结果
tmux capture-pane -t claude-session -p

# 只在需要调试时才 attach
tmux attach -t claude-session
```

### 问题 4：邮件服务配置问题

**症状**: 邮件监听服务启动失败或无法发送/接收邮件。

**解决方案**:

1. **检查 .env 文件配置**:

   ```bash
   cat .env | grep -E "SMTP|IMAP|EMAIL"
   ```

2. **验证应用专用密码**:

   - 确保使用的是 16 位应用专用密码，不是普通密码
   - 密码中不应包含空格或特殊字符

3. **测试邮件连接**:
   ```bash
   npm run test:smtp
   ```

### 问题 5：权限问题

**症状**: 脚本执行时提示权限不足。

**解决方案**:

1. **确保脚本有执行权限**:

   ```bash
   chmod +x /Users/niuyp/Documents/github.com/Claude-Code-Remote/*.sh
   ```

2. **检查文件路径权限**:
   ```bash
   ls -la /Users/niuyp/Documents/github.com/Claude-Code-Remote/src/data/
   ```

---

## 📋 快速检查清单

在开始使用前，请确认以下项目都已完成：

- [ ] ✅ `claude` 命令可以正常执行 (`claude --version`)
- [ ] ✅ `~/.zshrc` 中只有一个正确的 claude 别名定义
- [ ] ✅ 已生成 Gmail 应用专用密码
- [ ] ✅ `.env` 文件已正确配置所有必要字段
- [ ] ✅ `hooks.json` 文件已正确配置钩子
- [ ] ✅ tmux 会话可以成功创建并运行 claude
- [ ] ✅ 邮件监听服务可以正常启动
- [ ] ✅ 已在开发项目目录中测试完整流程

---

## 🚀 快速启动命令

完成所有配置后，您可以使用以下命令快速启动整个系统：

### 终端 1：启动邮件监听服务

```bash
cd /Users/niuyp/Documents/github.com/Claude-Code-Remote && npm run relay:pty
```

### 终端 2：启动 Claude 会话

```bash
# 进入您的开发项目目录
cd /path/to/your/project

# 检查现有会话
tmux list-sessions

# 推荐方法：分步创建会话
tmux new-session -s claude-session -d
tmux send-keys -t claude-session 'claude' Enter

# 如果会话已存在，安全地连接到现有会话
if tmux has-session -t claude-session 2>/dev/null; then
    tmux attach -t claude-session
else
    echo "Session claude-session not found"
fi

# 或者强制重新创建会话
# tmux kill-session -t claude-session 2>/dev/null || true
# tmux new-session -s claude-session -d
# tmux send-keys -t claude-session 'claude' Enter

# 检查会话状态
tmux list-sessions

# 查看 claude 运行状态（不进入会话）
tmux capture-pane -t claude-session -p
```

---

## 📞 获取帮助

如果遇到本文档未涵盖的问题，您可以：

1. **查看项目 GitHub Issues**: [Claude-Code-Remote Issues](https://github.com/JessyTsui/Claude-Code-Remote/issues)
2. **检查日志文件**: 查看邮件监听服务的输出日志
3. **验证系统状态**: 使用上述故障排除步骤逐一检查各组件状态
