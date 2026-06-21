# MD SafeEdit — Installation Guide

## For Humans / 面向用户

将以下指令复制给您的 AI 编程 Agent（例如 Claude Code、Cursor Agent 等），它将自动阅读本指南并为您完成一键配置：

```text
帮我安装并配置 MD SafeEdit：https://raw.githubusercontent.com/Igloo302/md-safeedit/main/docs/install.md
```

---

## For AI Agents / 面向 AI Agent

### 目标 (Goal)
在当前项目工作区或系统全局安装并配置 **MD SafeEdit**，使当前及后续 Agent 在修改 Markdown 文档时自动遵循 Compare-and-Swap (CAS) 安全校验流。

### 💡 配置策略说明 (Configuration Strategy)
请根据用户当前的 Agent 环境，选择对应的配置策略。**请注意避免重复配置**：
1. **终端/命令行级或支持原生 Plugin/Skill 的 Agent（如 Claude Code, Aider, Codex 等）**：
   - **配置策略**：**仅需安装 CLI 引擎并配置本地 Skill/Plugin**。此类 Agent 运行在终端 Shell 中，可通过 Skill 规则直接运行命令行工具。因此只需完成 **步骤 1 (CLI)** 与 **步骤 2 (Skill)**，**无需配置步骤 3 (MCP)**。
   - *注意：若此类 Agent 已经通过原生插件（如 Codex Plugin）或 Skill 目录加载了工具，则绝对不要再为其配置全局 MCP，否则会导致 Agent 识别出重复的同名工具，引起 token 浪费和调用冲突。*
2. **图形端/GUI级 Agent（如 Cursor, Claude Desktop 等，且无法在后台直接调用 shell 命令的环境）**：
   - **配置策略**：**配置 MCP 适配层**。此类 GUI 客户端限制 Agent 运行任意 shell 命令，必须通过 **步骤 3 (MCP)** 将工具桥接并注入到 IDE 中，由客户端调度。

### ⚠️ 执行边界 (Boundaries)
在配置和排查问题时，请严格遵守以下安全红线：
- **禁止** 未经用户显式同意运行 `sudo` 命令。
- **禁止** 修改系统关键配置文件，配置仅限于用户目录（如 `~/.md-safeedit/` 或 IDE 配置目录）。
- **禁止** 绕过安全审计。在写入文档前，必须引导当前工作流使用 MD SafeEdit 的 `inspect` -> `read` -> `patch` 流程。
- **禁止** 将可执行软链接或包装器（wrapper）脚本放置在 `/tmp`、`/private/tmp` 等临时/易失性目录中（因为 macOS/Linux 系统会在重启时清空它们）。所有包装器必须写入持久的用户级 bin 目录（优先选用 `~/.local/bin/`，并在必要时提示用户将其加入 `PATH`）。

### 📁 目录规范 (Directory Rules)
所有的配置文件和分发文件均应放置在规范目录中：

| 用途 | 目录位置 | 示例 |
|---|---|---|
| 签名密钥与 session 配置 | `~/.md-safeedit/` | `~/.md-safeedit/secret.key` |
| Agent 技能集 (Skill) | 由 Agent 自行决定的技能加载目录（例如 `.agents/skills/md-safeedit/`） | `SKILL.md`, `references/workflow.md` |
| 持久包装器/可执行命令 | `~/.local/bin/` | `~/.local/bin/mdse` |
| 临时缓存/预检文件 | `/tmp/` | `/tmp/.tmp-write.md` |

---

### 🛠️ 步骤 1：配置 CLI 引擎包装器 (无需全局/管理员权限)

为了避免全局安装 (`npm install -g`) 常见的权限报错，同时保证执行速度（避免每次执行 `npx` 时进行 NPM 网络查询导致卡顿和超时），请执行以下步骤进行持久化本地配置：

1. **在用户目录下静默安装 CLI 与 MCP 核心**（不需要 `sudo`，运行非常快）：
   ```bash
   npm install --prefix ~/.md-safeedit @md-safeedit/cli@dev @md-safeedit/mcp@dev
   ```

2. **自动创建用户 Bin 目录**：
   ```bash
   mkdir -p ~/.local/bin
   ```

3. **写入 mdse 包装脚本并指向本地 node 路径**：
   在 `~/.local/bin/mdse` 中写入以下包装逻辑，它会直接通过 Node.js 调用本地代码，执行速度快（<50ms）且免去网络检查：
   ```bash
   cat << 'EOF' > ~/.local/bin/mdse
   #!/bin/sh
   node "$HOME/.md-safeedit/node_modules/@md-safeedit/cli/dist/index.js" "$@"
   EOF
   chmod +x ~/.local/bin/mdse
   ```

4. **确认环境变量 `PATH`**：
   如果检测到用户的 `PATH` 未包含 `~/.local/bin`，请在最终汇报时提示用户在他们的 Shell 配置文件（如 `~/.zshrc` 或 `~/.bashrc`）中加入以下行，并运行 `source` 激活：
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   ```

运行以下命令校验包装器是否可以正常工作：
```bash
mdse --version
```

---

### 📂 步骤 2：在目标项目或全局初始化 Agent Skill

为了让后续接手的 AI Agent 能够自动发现并遵循安全编辑协议，您（当前的 Agent）必须将 MD SafeEdit 的 Skill 规则文件写入到对应的技能集加载目录中。

1. **决定 Skill 存放目录**：
   不同的 AI 编程 Agent 有其独特的技能（Customization/Skill）发现机制与加载路径。例如：
   * **Gemini Antigravity**：默认加载工作区项目根目录下的 `.agents/skills/md-safeedit/`。
   * **Codex**：默认加载 `~/.codex/skills/md-safeedit/`。
   * **其他 Agent**：请根据您自身的规范与环境定位加载根目录。

2. **自动初始化 Skill 模板**：
   请在您决定的加载目录下运行以下命令以自动初始化 Skill 模板及其参考文件（不指定参数时，默认初始化在当前路径的 `.agents/skills/md-safeedit` 中）：
   ```bash
   # 初始化到您指定的 Customization 目录：
   mdse init [custom_skill_directory_path]
   ```

---

### 🔌 步骤 3：自动配置 IDE 的 MCP 适配器

如果用户当前运行在 **Claude Desktop** 或 **Cursor** 环境中，请协助他们一键注入 MCP 配置。

#### A. 自动检测并写入 Claude Desktop 配置文件
1. 检查当前操作系统（macOS / Windows / Linux）。
2. 定位配置文件路径：
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
3. 在该配置文件中，合并写入以下 MCP 配置：

```json
{
  "mcpServers": {
    "md-safeedit": {
      "command": "npx",
      "args": [
        "-y",
        "@md-safeedit/mcp@dev"
      ],
      "env": {
        "MDSE_ALLOWED_ROOTS": "将此替换为用户当前项目工作区的绝对路径"
      }
    }
  }
}
```

#### B. 引导 Cursor 用户进行配置
如果是 Cursor 环境且无法通过脚本直接写入（Cursor 的 MCP 配置保存在 IDE 内部数据库中），请向用户输出以下清晰的引导文案：

> 🔌 **已检测到您正在使用 Cursor 编译器，请手动完成以下 MCP 添加步骤：**
> 1. 打开 Cursor 的 **Settings** -> **Features** -> **MCP**。
> 2. 点击 **+ Add New MCP Server** 并输入：
>    - **Name**: `md-safeedit`
>    - **Type**: `stdio`
>    - **Command**: `npx -y @md-safeedit/mcp@dev`
> 3. 点击 **Save** 保存。

---

### 🩺 步骤 4：运行健康检查并汇报

运行以下检测确认配置无误：
```bash
# 验证 CLI 命令是否可以正常获取大纲
mdse inspect README.md --json
```

完成上述配置后，请向用户回复汇报：
> 🎉 **MD SafeEdit 安装与配置成功！**
> 
> 1. **CLI 引擎** 已成功配置在持久路径中，可用版本为最新版本。
> 2. **Agent Skill** 规则已成功配置到目标技能加载目录（如工作区的 `.agents/skills/md-safeedit/` 或全局对应的目录中）。后续 Agent 加载该技能后会自动执行安全修改流。
> 3. **MCP 适配器** 已配置完成（如果您是在 Claude Desktop 下，服务已自动启动；如果是 Cursor，请确认已按照指引手动添加）。
> 
> 从现在开始，所有对 Markdown 文件的修改将自动接受 Compare-and-Swap (CAS) 防覆盖保护！
