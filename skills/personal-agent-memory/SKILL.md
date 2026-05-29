---
name: personal-agent-memory
description: Use Personal Agent Memory to give Claude Code, Codex, OpenClaw, Hermes, and other coding agents a shared local memory. Trigger when the user asks to remember, save, recall, search, install, configure, or audit agent memory, hooks, MCP memory, encrypted secrets, Basic Memory integration, or cross-agent project context.
---

# Personal Agent Memory

Use this skill when the user wants durable local memory for AI coding agents.

Personal Agent Memory is not "just a skill". The skill teaches the agent when and how to remember; the CLI/MCP/hook system does the durable storage.

## Mental Model

- Skill: agent behavior protocol and installer guide.
- CLI: writes readable Markdown, redacts secrets, encrypts full secret values, searches memory.
- MCP: lets agents save/search/status memory during a session.
- Hooks: capture durable summaries at session boundaries.
- Basic Memory: optional companion that indexes `~/.agent-memory/human`.

## First Check

Before saving or recalling memory, check whether the CLI is installed:

```bash
command -v agent-memory
agent-memory status
```

If missing, install the package:

```bash
npm install -g personal-agent-memory
agent-memory init
```

If working from this repository:

```bash
npm install
npm link
agent-memory init
```

## Save Memory

Save durable facts, decisions, workflows, preferences, and redacted credential notes:

```bash
agent-memory save "User prefers concise code-review findings first." --project current-project
```

Use `--project` for any specific repo, product, customer, or workflow name. Prefer short durable notes over raw chat transcripts.

Save when:

- the user explicitly says "remember", "记住", "记一下", "save this", or "write this to memory"
- a stable project decision was made
- a reusable workflow, command, endpoint, deployment rule, or integration detail appears
- the user states a durable preference
- a secret is mentioned and the non-secret context is useful

Do not save when:

- the information is a temporary scratch thought
- the user says not to remember it
- the note would expose private content in a public repo
- the content is a full secret value outside the CLI/MCP save path

## Recall Memory

At session start or before project work:

```bash
agent-memory search "current project"
agent-memory search "deployment workflow"
```

Also inspect readable files when useful:

```bash
sed -n '1,200p' ~/.agent-memory/human/00-now.md
sed -n '1,200p' ~/.agent-memory/human/01-projects.md
```

## Secret Rule

Never write full API keys, tokens, passwords, bearer tokens, SSH keys, or private credentials directly into chat-visible Markdown.

Always use `agent-memory save` or the MCP save tool. The CLI redacts likely secrets in `human/` and stores complete values in encrypted `private/secrets.md.enc`.

If a user asks to publish this repository or memory notes, check that no real memory vault, `private/`, `events/`, `sources/`, `.env`, `.key`, `.pem`, or encrypted temporary files are staged.

## MCP

For agents that support MCP, use:

```bash
agent-memory mcp
```

Available tools:

- `memory_status`
- `memory_save`
- `memory_search`

Basic Memory can also index the readable ledger:

```bash
basic-memory project add agent-memory ~/.agent-memory/human --local --default
basic-memory reindex --project agent-memory
```

Never point Basic Memory at `~/.agent-memory/private`.

## Hooks

Use hooks to make memory automatic:

- Session start: recall `human/00-now.md` and relevant project notes.
- During session: save explicit remember requests immediately.
- Session stop: summarize only durable facts and save them.
- Daily: run optional import/sync jobs.

Hook commands should call `agent-memory save` rather than writing files directly.

## Output Style

When reporting memory work to the user:

- say what was saved, searched, or installed
- mention the local path only when useful
- do not print secret values
- distinguish readable memory from encrypted secret storage

