---
name: personal-agent-memory
description: 使用 Personal Agent Memory 为 Claude Code、Codex、OpenClaw、Hermes 等编码 Agent 配置同一份本地长期记忆。适用于用户要求记住、保存、召回、搜索、安装或审计 Agent 记忆、hooks、MCP memory、加密密钥、Basic Memory 集成、跨工具项目上下文的场景。
---

# Personal Agent Memory

当用户需要给 AI 编码 Agent 建立可持续、本地优先、跨工具共享的长期记忆时，使用这个技能。

Personal Agent Memory 不是“只有一个 Skill”。它由两层组成：

- Skill 层：告诉 Agent 什么时候该记、怎么记、什么时候不该记。
- Runtime 层：由 CLI、MCP、hooks、Markdown 文件和加密 secrets 存储真正完成持久化。

## 核心模型

- Skill：Agent 行为协议和安装指引。
- CLI：写入可读 Markdown、脱敏 secrets、加密完整密钥、搜索本地记忆。
- MCP：让 Agent 在会话中调用 `memory_status`、`memory_save`、`memory_search`。
- Hooks：在会话开始、结束或定时任务中自动沉淀重要记忆。
- Basic Memory：可选搭配，用来索引 `~/.agent-memory/human` 里的可读 Markdown。

## 首先检查

保存或召回记忆前，先确认 CLI 是否已经安装：

```bash
command -v agent-memory
agent-memory status
```

如果没有安装：

```bash
npm install -g personal-agent-memory
agent-memory init
```

如果正在这个仓库里开发：

```bash
npm install
npm link
agent-memory init
```

## 保存记忆

保存稳定、长期有用的信息：项目事实、决策、工作流、偏好、已脱敏的凭据信息。

```bash
agent-memory save "用户偏好：代码 review 先列风险和问题，再给总结。" --project current-project
```

具体项目、产品、客户或工作流都应该带上 `--project`。优先保存短小、可复用的 durable memory，不要保存整段聊天原文。

应该保存：

- 用户明确说“记住”“记一下”“save this”“remember this”
- 做出了稳定的项目决策
- 出现了可复用的工作流、命令、部署规则、接口规则或集成细节
- 用户表达了长期偏好
- 出现了 secret，但非 secret 的上下文对未来有用

不要保存：

- 临时想法、一次性草稿、无长期价值的信息
- 用户明确说不要记
- 会把私人内容暴露到公开仓库的内容
- 不经过 CLI/MCP save path 就写入完整密钥、token、密码或 bearer token

## 召回记忆

会话开始、接手项目、部署、排查问题或做跨项目决策前，先搜索已有记忆：

```bash
agent-memory search "current project"
agent-memory search "deployment workflow"
```

必要时直接读取可读总账：

```bash
sed -n '1,200p' ~/.agent-memory/human/00-now.md
sed -n '1,200p' ~/.agent-memory/human/01-projects.md
```

## Secret 规则

不要把完整 API key、token、password、bearer token、SSH key 或其他私密凭据直接写进可读 Markdown 或聊天回复。

始终通过 `agent-memory save` 或 MCP save 工具保存。CLI 会把疑似 secret 在 `human/` 里脱敏，并把完整值加密存入：

```text
~/.agent-memory/private/secrets.md.enc
```

如果用户要求发布仓库或同步记忆文件，必须确认没有真实记忆库、`private/`、`events/`、`sources/`、`.env`、`.key`、`.pem` 或临时加密文件被提交。

## MCP

支持 MCP 的 Agent 可以使用：

```bash
agent-memory mcp
```

可用工具：

- `memory_status`
- `memory_save`
- `memory_search`

也可以让 Basic Memory 索引可读记忆：

```bash
basic-memory project add agent-memory ~/.agent-memory/human --local --default
basic-memory reindex --project agent-memory
```

不要让 Basic Memory 索引 `~/.agent-memory/private`。

## Hooks

用 hooks 让记忆自动化：

- Session start：召回 `human/00-now.md` 和相关项目笔记。
- During session：用户明确要求记忆时，立即保存。
- Session stop：只总结长期有用的信息并保存。
- Daily：可选运行导入、同步或整理任务。

Hook 命令应该调用 `agent-memory save`，不要绕过 CLI 直接写文件。

## 回复用户时

报告记忆相关工作时：

- 说明保存了什么、搜索了什么、安装了什么
- 有必要时给出本地路径
- 不要打印完整 secret
- 清楚区分“可读记忆”和“加密 secret 存储”

