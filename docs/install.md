# MD SafeEdit — Installation Guide

## For Humans / 面向用户

将以下指令复制给您的 AI 编程 Agent（例如 Claude Code、Cursor Agent 等），它将自动阅读本指南并为您完成一键配置：

```text
帮我安装并配置 MD SafeEdit：https://raw.githubusercontent.com/Igloo302/md-safeedit/main/docs/install.md
```

---

## For AI Agents / 面向 AI Agent

### 目标 (Goal)
在当前项目工作区或系统全局安装并配置 **MD SafeEdit**（包括 CLI 引擎、Agent Skill 模板和 MCP 服务），使该 Agent 在后续的 Markdown 文档编辑中自动遵循 Compare-and-Swap (CAS) 安全校验流。

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
| Agent 技能集 (Skill) | 目标项目根目录 `.agents/skills/md-safeedit/` | `SKILL.md`, `references/workflow.md` |
| 持久包装器/可执行命令 | `~/.local/bin/` | `~/.local/bin/mdse` |
| 临时缓存/预检文件 | `/tmp/` | `/tmp/.tmp-write.md` |

---

### 🛠️ 步骤 1：全局或本地安装 CLI 引擎

优先推荐在用户系统上安装全局 CLI 软链接（若无权限，后续运行流程会退化为通过 `npx -y @md-safeedit/cli@dev` 按需调用）：

```bash
# 全局安装 CLI 与 MCP 适配器 (指定使用开发预览 tag)
npm install -g @md-safeedit/cli@dev @md-safeedit/mcp@dev
```

#### 权限不足时的 Fallback 机制：
如果由于全局安装目录权限限制导致安装失败，**请勿使用 `sudo`**，应自动执行以下步骤在持久的用户目录下创建命令包装器：
1. 确保用户可执行目录已创建：`mkdir -p ~/.local/bin`
2. 在该目录下写入一个软链接或包装器脚本（例如将 `npx @md-safeedit/cli@dev "$@"` 写入 `~/.local/bin/mdse` 并赋予执行权限 `chmod +x ~/.local/bin/mdse`）。
3. 检查系统环境变量 `PATH`，如果未包含 `~/.local/bin`，请在汇报时提示用户将其加入 shell 配置。

运行以下命令校验安装是否成功，并获取当前版本：
```bash
mdse --version
```

---

### 📂 步骤 2：在当前项目工作区初始化 Agent Skill

为了让后续接手的 AI Agent 能够自动发现并遵循安全编辑协议，您（当前的 Agent）必须将 MD SafeEdit 的 Skill 规则文件写入到当前项目的技能集目录中。

请在项目根目录创建并写入以下文件结构：
- **技能文件路径**：`.agents/skills/md-safeedit/SKILL.md`
- **参考文件路径**：
  - `.agents/skills/md-safeedit/references/workflow.md`
  - `.agents/skills/md-safeedit/references/error-recovery.md`
  - `.agents/skills/md-safeedit/references/supported-markdown.md`

你可以直接使用当前项目自带的 `.agents/skills/md-safeedit/` 目录中的模板文件。如果目标项目没有集成，请创建目录并从本项目拷贝以下文件：
* `SKILL.md` 模板：[.agents/skills/md-safeedit/SKILL.md](file:///.agents/skills/md-safeedit/SKILL.md)

---

### 🔌 步骤 3：自动配置 IDE 的 MCP 适配器

如果用户当前运行在 **Claude Desktop** 或 **Cursor** 环境中，请协助他们一键注入 MCP 配置。

#### A. 自动检测并写入 Claude Desktop 配置文件
1. 检查当前操作系统（macOS / Windows / Linux）。
2. 定位配置文件路径：
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
3. 读取该 JSON 文件（如不存在则创建一个空的对象 `{}`），并合并写入 `mcpServers.md-safeedit` 配置项：

* **注意**：优先配置使用发布的 NPM 托管方式。如果您是开发者且需要用本地构建进行调试，可以将 `command` 改为 `"node"`，并将 `args` 设为指向您本地仓库的 `/packages/mcp/dist/index.js` 绝对路径。

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
> 2. **Agent Skill** 规则已配置到当前工作区的 `.agents/skills/md-safeedit/` 目录中。后续其他 Agent 进入该工作区时会自动加载并执行该安全修改流。
> 3. **MCP 适配器** 已配置完成（如果您是在 Claude Desktop 下，服务已自动启动；如果是 Cursor，请确认已按照指引手动添加）。
> 
> 从现在开始，所有对 Markdown 文件的修改将自动接受 Compare-and-Swap (CAS) 防覆盖保护！
