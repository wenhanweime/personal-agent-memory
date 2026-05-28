#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import childProcess from "node:child_process";
import path from "node:path";

const cli = path.resolve(new URL("./agent-memory.mjs", import.meta.url).pathname);
const home = process.env.AGENT_MEMORY_HOME;

function run(args) {
  const fullArgs = [cli, ...args];
  if (home) fullArgs.push("--home", home);
  return childProcess.execFileSync(process.execPath, fullArgs, { encoding: "utf8", timeout: 15000 });
}

const server = new McpServer({ name: "personal-agent-memory", version: "0.1.0" });

server.registerTool(
  "memory_status",
  {
    title: "Memory Status",
    description: "Show local memory home and basic health.",
    inputSchema: {}
  },
  async () => ({ content: [{ type: "text", text: run(["status"]) }] })
);

server.registerTool(
  "memory_save",
  {
    title: "Save Memory",
    description: "Save a durable local memory. Complete secrets are encrypted; readable files are redacted.",
    inputSchema: {
      text: z.string(),
      project: z.string().optional()
    }
  },
  async ({ text, project }) => ({
    content: [{ type: "text", text: run(["save", text, ...(project ? ["--project", project] : [])]) }]
  })
);

server.registerTool(
  "memory_search",
  {
    title: "Search Memory",
    description: "Search human-readable local memory files.",
    inputSchema: {
      query: z.string()
    }
  },
  async ({ query }) => ({ content: [{ type: "text", text: run(["search", query]) }] })
);

await server.connect(new StdioServerTransport());
