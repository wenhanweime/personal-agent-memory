# Hooks

Hooks are how Personal Agent Memory becomes automatic.

Recommended behavior:

- On session start: read `~/.agent-memory/human/00-now.md` and relevant project notes.
- During a session: save explicit "remember this" requests immediately.
- On session stop: summarize durable facts and write them with `agent-memory save`.
- Daily: run a scheduled sync/importer if you have one.

## Claude Code

Example `Stop` hook:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "agent-memory save \"Session ended; review transcript for durable facts if needed.\" --project claude-code",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

For richer use, replace the command with a transcript-aware importer.

## Codex

Codex can use the same command from its hooks file and can also connect to either:

- `agent-memory mcp`
- `basic-memory mcp` over `~/.agent-memory/human`

## Secret Rule

Hooks must never write complete secrets to `human/`. Use the CLI/MCP save path so secrets are detected, redacted, and encrypted.
