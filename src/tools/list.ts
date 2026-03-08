import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiRequest } from "../client.js";

interface AnalyzersResponse {
  analyzers: Array<{ key: string; categories: string[]; weight: number }>;
  categories: string[];
}

export function registerListAnalyzers(server: McpServer): void {
  server.registerTool(
    "list_analyzers",
    {
      description:
        "List all available SEO analyzers with their keys, categories, and weights. Call this first to discover what analyzers and categories are available before running an analysis.",
    },
    async () => {
      const data = await apiRequest<AnalyzersResponse>("/api/seo/analyzers");

      const lines: string[] = [
        `Found ${data.analyzers.length} analyzers across ${data.categories.length} categories.`,
        "",
        `Categories: ${data.categories.join(", ")}`,
        "",
        "Analyzers:",
      ];

      for (const a of data.analyzers) {
        lines.push(`  ${a.key} (categories: ${a.categories.join(", ")}, weight: ${a.weight})`);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
