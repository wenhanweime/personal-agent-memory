#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import childProcess from "node:child_process";

const DEFAULT_HOME = path.join(os.homedir(), ".agent-memory");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) args[key] = argv[++i];
      else args[key] = true;
    } else args._.push(arg);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0] || "help";
const memoryHome = path.resolve(args.home || process.env.AGENT_MEMORY_HOME || DEFAULT_HOME);

const dirs = {
  human: path.join(memoryHome, "human"),
  private: path.join(memoryHome, "private"),
  sources: path.join(memoryHome, "sources"),
  events: path.join(memoryHome, "events"),
  qmdIndex: path.join(memoryHome, "qmd-index"),
  projects: path.join(memoryHome, "life", "projects"),
};

function nowIso() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDir(dir, mode) {
  fs.mkdirSync(dir, { recursive: true, mode });
  if (mode) {
    try {
      fs.chmodSync(dir, mode);
    } catch {}
  }
}

function write(file, body, mode) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, body, "utf8");
  if (mode) fs.chmodSync(file, mode);
}

function append(file, body, mode) {
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, body, "utf8");
  if (mode) fs.chmodSync(file, mode);
}

function read(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function slug(input) {
  return String(input || "global")
    .replace(os.homedir(), "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "global";
}

function sha(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
  /\bms-[A-Za-z0-9_-]{20,}\b/g,
  /\bcsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  /\b(?:api[_-]?key|token|secret|password|passwd|bearer)\b\s*[:=]\s*["']?([^"'\s,;]{12,})/gi,
  /\bAuthorization:\s*Bearer\s+([A-Za-z0-9._~+\/=-]{20,})/gi
];

function isLikelySecret(value) {
  const v = String(value || "").trim().replace(/^["'`]|["'`]$/g, "");
  if (v.length < 12) return false;
  if (/^sk-/i.test(v) && !/[0-9A-Z_]/.test(v.slice(3))) return false;
  if (/^(?:YOUR_|your-|your_|<your|\$\{|process\.env|os\.environ|getenv|api_key|token|secret)/i.test(v)) return false;
  return true;
}

function extractSecrets(text) {
  const out = [];
  for (const re of secretPatterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const value = (m[1] || m[0]).trim().replace(/^["'`]|["'`]$/g, "");
      if (isLikelySecret(value)) out.push(value);
    }
  }
  return [...new Set(out)];
}

function redact(text, secrets = extractSecrets(text)) {
  let out = text;
  for (const value of secrets) {
    const suffix = value.slice(-6);
    out = out.split(value).join(`[SECRET:${suffix}]`);
  }
  return out;
}

function init() {
  ensureDir(memoryHome);
  ensureDir(dirs.human);
  ensureDir(dirs.private, 0o700);
  ensureDir(dirs.events);
  ensureDir(dirs.sources);
  ensureDir(dirs.qmdIndex);
  ensureDir(dirs.projects);
  write(path.join(memoryHome, ".gitignore"), ["private/", "sources/", "events/", "qmd-index/", "life/projects/*/items.yaml", ""].join("\n"));
  write(path.join(dirs.human, "00-now.md"), "# Now\n\n- Add your current active projects here.\n");
  write(path.join(dirs.human, "01-projects.md"), "# Projects\n\n## Example Project\n\n- Status: active\n- Next: define the next useful action\n");
  write(path.join(dirs.human, "02-decisions.md"), "# Decisions\n\n");
  write(path.join(dirs.human, "03-workflows.md"), "# Workflows\n\n");
  write(path.join(dirs.human, "04-credentials-redacted.md"), "# Credentials Index\n\nFull values are encrypted in `../private/secrets.md.enc`.\n");
  write(path.join(dirs.human, "README.md"), "# Readable Memory\n\nStart with `00-now.md` and `01-projects.md`.\n");
  write(path.join(memoryHome, "AGENTS.md"), [
    "# Agent Memory Protocol",
    "",
    "Use this directory as the local source of truth for durable agent memory.",
    "",
    "- Read `human/00-now.md` at session start.",
    "- Save durable project facts, decisions, workflows, and preferences.",
    "- Never write complete secrets to human-readable files.",
    "- Use `agent-memory save` or the MCP server to add memory.",
    ""
  ].join("\n"));
  regenerateIndex();
  console.log(`Initialized ${memoryHome}`);
}

function classify(text, hasSecret) {
  if (hasSecret) return "credentials";
  if (/hook|cron|launchd|deploy|runbook|workflow|release|恢复|流程|发布/i.test(text)) return "workflows";
  if (/prefer|decision|default|remember|记住|偏好|默认|决定/i.test(text)) return "decisions";
  return "projects";
}

function secretPassphrase() {
  const env = process.env.AGENT_MEMORY_SECRET;
  if (env) return env;
  const service = "personal-agent-memory";
  const account = os.userInfo().username;
  try {
    return childProcess.execFileSync("security", ["find-generic-password", "-a", account, "-s", service, "-w"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {}
  const created = crypto.randomBytes(48).toString("base64url");
  try {
    childProcess.execFileSync("security", ["add-generic-password", "-U", "-a", account, "-s", service, "-w", created], {
      stdio: ["ignore", "ignore", "ignore"]
    });
  } catch {
    throw new Error("Set AGENT_MEMORY_SECRET or run on macOS with Keychain available.");
  }
  return created;
}

function withPassFile(fn) {
  const tmp = path.join(os.tmpdir(), `personal-agent-memory-pass-${process.pid}`);
  fs.writeFileSync(tmp, secretPassphrase(), { encoding: "utf8", mode: 0o600 });
  try {
    return fn(tmp);
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

function decryptSecrets() {
  const enc = path.join(dirs.private, "secrets.md.enc");
  if (!fs.existsSync(enc)) return "";
  const tmp = path.join(os.tmpdir(), `personal-agent-memory-secrets-${process.pid}.md`);
  try {
    withPassFile((passFile) => childProcess.execFileSync("openssl", ["enc", "-d", "-aes-256-cbc", "-pbkdf2", "-in", enc, "-out", tmp, "-pass", `file:${passFile}`]));
    return read(tmp);
  } catch {
    return "";
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

function encryptSecrets(plain) {
  ensureDir(dirs.private, 0o700);
  const enc = path.join(dirs.private, "secrets.md.enc");
  const tmp = path.join(os.tmpdir(), `personal-agent-memory-secrets-${process.pid}.md`);
  const tmpEnc = `${tmp}.enc`;
  fs.writeFileSync(tmp, plain, { encoding: "utf8", mode: 0o600 });
  try {
    withPassFile((passFile) => childProcess.execFileSync("openssl", ["enc", "-aes-256-cbc", "-pbkdf2", "-salt", "-in", tmp, "-out", tmpEnc, "-pass", `file:${passFile}`]));
    fs.copyFileSync(tmpEnc, enc);
    fs.chmodSync(enc, 0o600);
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
    try { fs.unlinkSync(tmpEnc); } catch {}
  }
}

function save() {
  const text = args._.slice(1).join(" ").trim() || args.text || "";
  if (!text) throw new Error("Usage: agent-memory save \"text\" [--project name]");
  ensureDir(memoryHome);
  const project = slug(args.project || "global");
  const secrets = extractSecrets(text);
  const category = classify(text, secrets.length > 0);
  const publicText = redact(text, secrets);
  const id = sha(`${Date.now()}\n${text}`).slice(0, 16);
  const event = { id, at: nowIso(), project, category, text: publicText, secret_count: secrets.length };
  append(path.join(dirs.events, `${today()}.jsonl`), `${JSON.stringify(event)}\n`);
  const projectFile = path.join(dirs.projects, project, "items.md");
  append(projectFile, `\n## ${nowIso()} ${category}\n\n${publicText}\n`);
  if (secrets.length) {
    const prior = decryptSecrets();
    const blocks = secrets.map((value) => `\n## ${nowIso()} ${project}\n<!-- secret-sha256:${sha(value)} -->\n- value: ${value}\n- context: ${text}\n`);
    encryptSecrets(`${prior.replace(/\s*$/, "\n")}${blocks.join("\n")}`);
  }
  regenerateHuman(project, category, publicText);
  regenerateIndex();
  console.log(`Saved ${id} (${category})`);
}

function regenerateHuman(project, category, text) {
  ensureDir(dirs.human);
  if (category === "credentials") {
    append(path.join(dirs.human, "04-credentials-redacted.md"), `\n- **${project}** ${short(text, 280)}\n`);
  } else if (category === "workflows") {
    append(path.join(dirs.human, "03-workflows.md"), `\n- **${project}** ${short(text, 280)}\n`);
  } else if (category === "decisions") {
    append(path.join(dirs.human, "02-decisions.md"), `\n- **${project}** ${short(text, 280)}\n`);
  } else {
    append(path.join(dirs.human, "01-projects.md"), `\n- **${project}** ${short(text, 280)}\n`);
  }
}

function short(text, max) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function regenerateIndex() {
  ensureDir(dirs.qmdIndex);
  for (const file of fs.readdirSync(dirs.qmdIndex, { withFileTypes: true })) {
    if (file.isFile()) fs.unlinkSync(path.join(dirs.qmdIndex, file.name));
  }
  for (const file of fs.readdirSync(dirs.human, { withFileTypes: true })) {
    if (file.isFile() && file.name.endsWith(".md")) {
      fs.copyFileSync(path.join(dirs.human, file.name), path.join(dirs.qmdIndex, file.name));
    }
  }
}

function search() {
  const query = args._.slice(1).join(" ").trim();
  const haystack = [];
  for (const file of fs.readdirSync(dirs.human, { withFileTypes: true })) {
    if (!file.isFile() || !file.name.endsWith(".md")) continue;
    const body = read(path.join(dirs.human, file.name));
    const matches = body.split("\n").filter((line) => line.toLowerCase().includes(query.toLowerCase()));
    if (matches.length) haystack.push(`# ${file.name}\n${matches.slice(0, 8).join("\n")}`);
  }
  console.log(haystack.join("\n\n") || "No local text match.");
}

function status() {
  console.log(JSON.stringify({
    memory_home: memoryHome,
    human_files: fs.existsSync(dirs.human) ? fs.readdirSync(dirs.human).filter((f) => f.endsWith(".md")).length : 0,
    encrypted_secrets: fs.existsSync(path.join(dirs.private, "secrets.md.enc"))
  }, null, 2));
}

function help() {
  console.log(`personal-agent-memory

Usage:
  agent-memory init [--home ~/.agent-memory]
  agent-memory save "durable fact" [--project name]
  agent-memory search "query"
  agent-memory status
  agent-memory mcp
`);
}

if (command === "init") init();
else if (command === "save") save();
else if (command === "search") search();
else if (command === "status") status();
else if (command === "mcp") {
  const mcp = new URL("./agent-memory-mcp.mjs", import.meta.url);
  process.env.AGENT_MEMORY_HOME = memoryHome;
  await import(mcp);
} else help();
