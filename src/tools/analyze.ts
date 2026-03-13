import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest } from "../client.js";

interface GeoScoreResult {
  geoScore: number;
  subMetrics: {
    technicalAccess: number;
    contentStructure: number;
    entityClarity: number;
    authoritySignals: number;
  };
  citationLikelihood: number;
  ragReadiness: number;
  whyThisMattersForAgents: string;
  llmAssessment: string;
}

interface BatchResponse {
  results: Array<{
    url: string;
    analyzedAt: string;
    error?: string;
    statusCode?: number;
    // Full / category analysis fields
    score?: number;
    scores?: Record<string, number>;
    geoScore?: GeoScoreResult;
    issues?: Array<Record<string, unknown>>;
    passed?: string[];
    // Single analyzer fields
    analyzer?: Record<string, unknown>;
    level?: string;
    summary?: string;
    count?: number;
    examples?: Array<Record<string, unknown>>;
    fix?: string;
  }>;
  total_urls: number;
  successful: number;
  failed: number;
  total_cost: number;
  remaining_credits: number;
}

const inputSchema = {
  urls: z.array(z.string().url()).min(1).describe("List of URLs to analyze"),
  mode: z.enum(["full", "analyzer", "category"]).describe(
    "'full' runs all analyzers, 'analyzer' runs a single named analyzer, 'category' runs all analyzers in a category"
  ),
  analyzer: z.string().optional().describe("Analyzer key to use (required when mode is 'analyzer')"),
  category: z.string().optional().describe("Category name to use (required when mode is 'category')"),
};

export function registerAnalyze(server: McpServer): void {
  server.registerTool(
    "analyze",
    {
      description:
        "Analyze one or more URLs for SEO issues. Processes URLs sequentially and reports progress after each. Supports full analysis, a single analyzer, or a category of analyzers. Full mode also returns a GEO/AEO score measuring AI search visibility (citation likelihood, RAG readiness, and sub-metrics for technical access, content structure, entity clarity, and authority signals).",
      inputSchema,
    },
    async (args, extra) => {
      const { urls, mode, analyzer, category } = args;
      const progressToken = extra._meta?.progressToken;

      if (mode === "analyzer" && !analyzer) {
        throw new Error("'analyzer' field is required when mode is 'analyzer'");
      }
      if (mode === "category" && !category) {
        throw new Error("'category' field is required when mode is 'category'");
      }

      const allResults: BatchResponse["results"] = [];
      let totalCost = 0;
      let remainingCredits = 0;

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]!;

        const body: Record<string, unknown> = { urls: [url] };
        if (mode === "analyzer") body.analyzer = analyzer;
        if (mode === "category") body.category = category;

        const data = await apiRequest<BatchResponse>("/api/seo/analyze/batch", {
          method: "POST",
          body,
        });

        allResults.push(...data.results);
        totalCost += data.total_cost;
        remainingCredits = data.remaining_credits;

        if (progressToken !== undefined) {
          await extra.sendNotification({
            method: "notifications/progress",
            params: {
              progressToken,
              progress: i + 1,
              total: urls.length,
              message: `Analyzed ${url}`,
            },
          });
        }
      }

      const successful = allResults.filter((r) => !r.error).length;
      const failed = allResults.length - successful;

      const lines: string[] = [
        `Analysis complete: ${successful} succeeded, ${failed} failed`,
        `Credits used: ${totalCost} | Remaining: ${remainingCredits}`,
        "",
      ];

      for (const result of allResults) {
        lines.push(`URL: ${result.url}`);
        lines.push(`  Analyzed at: ${result.analyzedAt}`);
        if (result.statusCode !== undefined) lines.push(`  HTTP status: ${result.statusCode}`);

        if (result.error) {
          lines.push(`  Error: ${result.error}`);
        } else if (result.score !== undefined) {
          // Full or category analysis (LlmFormattedResponse)
          lines.push(`  Score: ${result.score}`);
          if (result.scores) {
            const cats = Object.entries(result.scores as Record<string, number>)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
            lines.push(`  Category scores: ${cats}`);
          }
          if (result.geoScore !== undefined) {
            const g = result.geoScore;
            lines.push(`  GEO Score: ${g.geoScore}/100`);
            lines.push(`    Technical Access:  ${Math.round(g.subMetrics.technicalAccess * 100)}%`);
            lines.push(`    Content Structure: ${Math.round(g.subMetrics.contentStructure * 100)}%`);
            lines.push(`    Entity Clarity:    ${Math.round(g.subMetrics.entityClarity * 100)}%`);
            lines.push(`    Authority Signals: ${Math.round(g.subMetrics.authoritySignals * 100)}%`);
            lines.push(`    Citation Likelihood: ${Math.round(g.citationLikelihood * 100)}%`);
            lines.push(`    RAG Readiness:       ${Math.round(g.ragReadiness * 100)}%`);
            lines.push(`    Assessment: ${g.llmAssessment}`);
            lines.push(`    Why it matters: ${g.whyThisMattersForAgents}`);
          }
          const issues = result.issues as Array<Record<string, unknown>> | undefined;
          if (issues && issues.length > 0) {
            lines.push(`  Issues (${issues.length}):`);
            for (const issue of issues) {
              lines.push(`    [${issue.level}] ${issue.key}: ${issue.summary ?? ""}`);
              if (issue.count !== undefined) lines.push(`      Count: ${issue.count}`);
              const examples = issue.examples as Array<Record<string, unknown>> | undefined;
              if (examples && examples.length > 0) {
                for (const ex of examples) {
                  lines.push(`      - ${ex.where}${ex.evidence ? ": " + String(ex.evidence) : ""}`);
                }
              }
              if (issue.fix) lines.push(`      Fix: ${issue.fix}`);
            }
          }
          const passed = result.passed as string[] | undefined;
          if (passed && passed.length > 0) {
            lines.push(`  Passed: ${passed.join(", ")}`);
          }
        } else if (result.analyzer) {
          // Single analyzer result (LlmSingleResult)
          const a = result.analyzer as Record<string, unknown>;
          lines.push(`  Analyzer: ${a.name} (${a.key})`);
          if (result.level !== undefined) lines.push(`  Level: ${result.level}`);
          if (result.summary !== undefined) lines.push(`  Summary: ${result.summary}`);
          if (result.count !== undefined) lines.push(`  Count: ${result.count}`);
          const examples = result.examples as Array<Record<string, unknown>> | undefined;
          if (examples && examples.length > 0) {
            lines.push(`  Examples:`);
            for (const ex of examples) {
              lines.push(`    - ${ex.where}${ex.evidence ? ": " + String(ex.evidence) : ""}`);
            }
          }
          if (result.fix !== undefined) lines.push(`  Fix: ${result.fix}`);
        }

        lines.push("");
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
