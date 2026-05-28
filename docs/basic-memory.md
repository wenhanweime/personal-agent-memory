# Basic Memory Integration

Basic Memory is a strong companion for Personal Agent Memory.

Recommended split:

- Personal Agent Memory is the local governance layer: extraction, redaction, encrypted secrets, readable project ledger.
- Basic Memory is the Markdown/MCP knowledge layer: editing, linking, and recall.

Install Basic Memory separately, then point it at the readable memory folder:

```bash
basic-memory project add agent-memory ~/.agent-memory/human
basic-memory mcp
```

For Claude Code, Basic Memory documents this pattern:

```bash
claude mcp add basic-memory basic-memory mcp
```

For Codex, add an MCP server entry in `~/.codex/config.toml`:

```toml
[mcp_servers.basic-memory]
command = "basic-memory"
args = ["mcp"]
```

Do not index `~/.agent-memory/private`.
