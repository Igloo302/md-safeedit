# @igloo302/mcp

MD SafeEdit Model Context Protocol (MCP) Server.

This package exposes MD SafeEdit as an MCP server, allowing AI coding assistants (like Cursor, Claude Desktop, Windsurf, etc.) to safely read and edit Markdown files using the signature-guarded CAS (Compare-and-Swap) patch protocol.

## Features

Exposes the 4 core MD SafeEdit services as MCP tools:
1. **`inspect`**: Inspects a Markdown file's outline, line endings, size, and current revision.
2. **`search`**: Searches for text patterns within structural nodes or section paths.
3. **`read`**: Reads target node contents and acquires signed, opaque `anchor_token`s.
4. **`patch`**: Safely performs edits (replace, delete, insert) using issued anchor tokens with relocation and concurrency protection.

## Installation

### Local Setup
Ensure you have built the monorepo packages first:
```bash
npm run build
```

The executable script will be located at:
`[workspace-root]/packages/mcp/dist/index.js`

---

## Configuration

You can configure the MCP server in your favorite editor/client.

### 1. Claude Desktop
Add the following to your Claude Desktop configuration file (typically located at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "md-safeedit": {
      "command": "node",
      "args": [
        "/Users/jyshen/Projects/md-safeedit/packages/mcp/dist/index.js"
      ],
      "env": {
        "MDSE_ALLOWED_ROOTS": "/Users/jyshen/Projects/md-safeedit"
      }
    }
  }
}
```

> [!IMPORTANT]
> - Replace `/Users/jyshen/Projects/md-safeedit` with your actual workspace path.
> - `MDSE_ALLOWED_ROOTS` is required to restrict the files the server is authorized to read or write, preventing directory traversal.

### 2. Cursor
To configure the server in Cursor:
1. Open Cursor Settings -> **Features** -> **MCP**.
2. Click **+ Add New MCP Server**.
3. Fill in the form:
   - **Name**: `md-safeedit`
   - **Type**: `stdio`
   - **Command**: `node /Users/jyshen/Projects/md-safeedit/packages/mcp/dist/index.js`
4. Set the environment variable `MDSE_ALLOWED_ROOTS` if needed, or it will default to the current working directory of the process.

---

## Security

- **Path Restriction**: The server resolves all paths to their canonical form (resolving symlinks) and rejects any path outside the `MDSE_ALLOWED_ROOTS` environment variable (defaults to the current working directory).
- **Token Integrity**: Anchor tokens are HMAC-signed using a random machine-local key (stored securely in `~/.md-safeedit-secret.key`). If an LLM or process attempts to bypass authorization or manually forge/edit the token, signature checks fail immediately.
- **Untrusted Input**: Markdown and replacement content are treated strictly as raw text data. No code block execution or markdown rendering occurs.
