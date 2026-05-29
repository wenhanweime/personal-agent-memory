#!/usr/bin/env bash
set -euo pipefail

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to install personal-agent-memory." >&2
  exit 1
fi

if npm view personal-agent-memory version >/dev/null 2>&1; then
  npm install -g personal-agent-memory
else
  npm install -g github:wenhanweime/personal-agent-memory
fi

agent-memory init

cat <<'MSG'

Personal Agent Memory is installed.

Next:
  agent-memory status
  agent-memory save "A durable fact to remember" --project demo

For MCP:
  agent-memory mcp

MSG
