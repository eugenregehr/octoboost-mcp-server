#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerListAnalyzers } from "./tools/list.js";
import { registerScanDomain } from "./tools/scan.js";
import { registerAnalyze } from "./tools/analyze.js";

const server = new McpServer({
  name: "octoboost-seo",
  version: "1.0.0",
});

registerListAnalyzers(server);
registerScanDomain(server);
registerAnalyze(server);

const transport = new StdioServerTransport();
await server.connect(transport);
