import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest } from "../client.js";

interface ReportsResponse {
  reports: Array<{
    id: string;
    url: string;
    analyzedAt: string;
    statusCode?: number;
    score: {
      percentage: number;
      categories?: Record<string, { percentage: number }>;
    };
    geoScore?: {
      geoScore: number;
      subMetrics: {
        technicalAccess: number;
        contentStructure: number;
        entityClarity: number;
        authoritySignals: number;
      };
      citationLikelihood: number;
      ragReadiness: number;
      llmAssessment: string;
    };
    results: Array<{
      key: string;
      level?: string;
      summary?: string;
    }>;
    createdAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const inputSchema = {
  url: z.string().url().optional().describe("Filter by exact URL (optional)"),
  page: z.number().int().positive().default(1).describe("Page number (default 1, page size 10)"),
  category: z.string().optional().describe("Filter results to a specific category (seo, accessibility, performance, ux, geo)"),
  analyzer: z.string().optional().describe("Filter results to a single analyzer key"),
};

export function registerGetStoredAnalysis(server: McpServer): void {
  server.registerTool(
    "get_stored_analysis",
    {
      description:
        "Retrieve previously stored SEO analysis reports. No credits consumed. Supports filtering by URL, category, or single analyzer key. Returns paginated results (10 per page). Use this to review past analyses without re-crawling.",
      inputSchema,
    },
    async (args) => {
      const { url, page, category, analyzer } = args;

      const qs = new URLSearchParams();
      if (url) qs.set("url", url);
      if (page) qs.set("page", String(page));
      if (category) qs.set("category", category);
      if (analyzer) qs.set("analyzer", analyzer);

      const path = `/api/reports?${qs.toString()}`;
      const data = await apiRequest<ReportsResponse>(path);

      if (data.reports.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: url
                ? `No stored analyses found for URL: ${url}`
                : "No stored analyses found.",
            },
          ],
        };
      }

      const lines: string[] = [
        `Stored analyses: ${data.total} total | Page ${data.page}/${data.totalPages} (${data.pageSize} per page)`,
        "",
      ];

      for (const report of data.reports) {
        lines.push(`ID: ${report.id}`);
        lines.push(`URL: ${report.url}`);
        lines.push(`Analyzed at: ${report.analyzedAt}`);
        if (report.statusCode !== undefined) lines.push(`HTTP status: ${report.statusCode}`);

        const score = report.score as { percentage?: number; categories?: Record<string, { percentage: number }> };
        if (score.percentage !== undefined) lines.push(`Score: ${score.percentage}`);
        if (score.categories) {
          const cats = Object.entries(score.categories)
            .map(([k, v]) => `${k}: ${v.percentage}`)
            .join(", ");
          lines.push(`Category scores: ${cats}`);
        }

        if (report.geoScore) {
          const g = report.geoScore;
          lines.push(`GEO Score: ${g.geoScore}/100`);
          lines.push(`  Technical Access:  ${Math.round(g.subMetrics.technicalAccess * 100)}%`);
          lines.push(`  Content Structure: ${Math.round(g.subMetrics.contentStructure * 100)}%`);
          lines.push(`  Entity Clarity:    ${Math.round(g.subMetrics.entityClarity * 100)}%`);
          lines.push(`  Authority Signals: ${Math.round(g.subMetrics.authoritySignals * 100)}%`);
          lines.push(`  Citation Likelihood: ${Math.round(g.citationLikelihood * 100)}%`);
          lines.push(`  RAG Readiness:       ${Math.round(g.ragReadiness * 100)}%`);
          lines.push(`  Assessment: ${g.llmAssessment}`);
        }

        if (report.results.length > 0) {
          const nonSuccess = report.results.filter((r) => r.level && r.level !== "success");
          if (nonSuccess.length > 0) {
            lines.push(`Issues (${nonSuccess.length}):`);
            for (const r of nonSuccess) {
              lines.push(`  [${r.level}] ${r.key}: ${r.summary ?? ""}`);
            }
          }
        }

        lines.push("");
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
