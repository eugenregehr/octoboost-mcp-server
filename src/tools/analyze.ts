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

interface CwvMetric {
  p75: string;
  level: "success" | "warning" | "error";
}

interface BatchResponse {
  results: Array<{
    url: string;
    analyzedAt: string;
    error?: string;
    statusCode?: number;
    score?: number;
    scores?: Record<string, number>;
    geoScore?: GeoScoreResult;
    coreWebVitals?: {
      lcp?: CwvMetric;
      cls?: CwvMetric;
      inp?: CwvMetric;
      fcp?: CwvMetric;
      ttfb?: CwvMetric;
    };
    issues?: Array<Record<string, unknown>>;
    passed?: string[];
  }>;
  total_urls: number;
  successful: number;
  failed: number;
  total_cost: number;
  remaining_credits: number;
}

const inputSchema = {
  urls: z.array(z.string().url()).min(1).describe("List of URLs to analyze"),
};

export function registerAnalyze(server: McpServer): void {
  server.registerTool(
    "analyze",
    {
      description:
        "Analyze one or more URLs for SEO issues. Runs all analyzers and returns scores, issues, and a GEO/AEO score measuring AI search visibility (citation likelihood, RAG readiness, and sub-metrics for technical access, content structure, entity clarity, and authority signals). Processes URLs sequentially and reports progress after each. Costs 3 credits per URL.",
      inputSchema,
    },
    async (args, extra) => {
      const { urls } = args;
      const progressToken = extra._meta?.progressToken;

      const allResults: BatchResponse["results"] = [];
      let totalCost = 0;
      let remainingCredits = 0;

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]!;

        const data = await apiRequest<BatchResponse>("/api/seo/analyze/batch", {
          method: "POST",
          body: { urls: [url] },
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
          if (result.coreWebVitals) {
            const cwv = result.coreWebVitals;
            const cwvMetrics: [string, CwvMetric | undefined][] = [
              ["LCP",  cwv.lcp],
              ["CLS",  cwv.cls],
              ["INP",  cwv.inp],
              ["FCP",  cwv.fcp],
              ["TTFB", cwv.ttfb],
            ];
            const cwvLines = cwvMetrics
              .filter(([, m]) => m !== undefined)
              .map(([k, m]) => `${k}: ${m!.p75} [${m!.level}]`);
            if (cwvLines.length > 0) {
              lines.push(`  Core Web Vitals (p75): ${cwvLines.join(" | ")}`);
            }
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
        }

        lines.push("");
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
