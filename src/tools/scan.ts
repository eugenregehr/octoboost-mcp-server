import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest } from "../client.js";

interface ScanResponse {
  success: boolean;
  data: { urls: string[]; totalFound: number };
  message: string;
  cost: number;
  remaining_credits: number;
}

const inputSchema = {
  domain: z.string().describe("Domain or URL to scan (e.g. 'example.com' or 'https://example.com')"),
  maxPages: z.number().int().positive().optional().describe("Maximum pages to crawl (server default applies; capped at the batch analysis limit)"),
  excludePatterns: z.array(z.string()).optional().default([]).describe("URL patterns to exclude from crawling"),
  respectRobotsTxt: z.boolean().optional().default(true).describe("Whether to respect robots.txt (default: true)"),
  defaultLanguageOnly: z.boolean().optional().default(true).describe("Only return pages in the site's default language (default: true)"),
};

export function registerScanDomain(server: McpServer): void {
  server.registerTool(
    "scan_domain",
    {
      description: "Crawl a domain and return all SEO-relevant page URLs. Use this to discover pages before running analysis.",
      inputSchema,
    },
    async (args) => {
      const data = await apiRequest<ScanResponse>("/api/seo/scan/domain", {
        method: "POST",
        body: {
          domain: args.domain,
          maxPages: args.maxPages,
          excludePatterns: args.excludePatterns,
          respectRobotsTxt: args.respectRobotsTxt,
          defaultLanguageOnly: args.defaultLanguageOnly,
        },
      });

      const lines: string[] = [
        data.message,
        `Credits used: ${data.cost} | Remaining: ${data.remaining_credits}`,
        "",
        "URLs:",
        ...data.data.urls.map((url) => `  ${url}`),
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
