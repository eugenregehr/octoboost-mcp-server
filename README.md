# OctoBoost SEO MCP Server

[![MCP Registry](https://img.shields.io/badge/MCP_Registry-published-blue)](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.eugenregehr/geo-seo-analyzer-octoboost)

Expose the OctoBoost SEO API as [Model Context Protocol (MCP)](https://modelcontextprotocol.io) tools so agents can audit websites with compact, structured results instead of fetching and parsing raw HTML.

Get your free API key at [octo-boost.com](https://octo-boost.com). New accounts include free credits to try every tool.

## What This Server Does

`octoboost-mcp-server` gives an MCP client three core capabilities:

- discover available analyzers with `list_analyzers`
- crawl a domain for relevant URLs with `scan_domain`
- run full audits with `analyze`

It is built for agent workflows that need SEO and AI-visibility signals inside the reasoning loop without spending thousands of tokens on raw page content.

## Who It's For

This server is a good fit for:

- developers building MCP-enabled products, assistants, or internal automation
- teams using MCP clients such as Cursor or Claude Desktop and wanting SEO tooling via config only
- AI agent workflows that need token-efficient site audits, progress updates, and structured outputs they can reason over

It is less useful if you want a general SEO learning guide or a raw HTML scraping tool. The main value here is compact audit output for automated workflows.

## Why Use This Instead Of Raw Scraping?

Running SEO checks directly in an LLM context is expensive. OctoBoost moves the heavy lifting to the API and returns only the signals an agent needs to decide what to do next.

- **Token-efficient**: structured results instead of raw HTML
- **LLM-friendly**: scores, flags, and diagnostics instead of prose parsing
- **Credit-aware**: responses include credits used and credits remaining
- **Predictable errors**: `401` for invalid or expired keys, `402` for exhausted credits

## Quick Start

1. Get an API key from [octo-boost.com](https://octo-boost.com).
2. Add the server to your MCP client config.
3. Call `list_analyzers` to verify the connection.

```json
{
  "mcpServers": {
    "octoboost-seo": {
      "command": "npx",
      "args": ["-y", "octoboost-mcp-server"],
      "env": {
        "OCTOBOOST_API_KEY": "your-api-key"
      }
    }
  }
}
```

Common config locations:

- **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Cursor**: Cursor MCP settings
- **OpenClaw**: `~/.openclaw/mcp.json`

## Core Workflow

Most agent flows follow this pattern:

```text
1. list_analyzers
   -> learn categories and available checks

2. scan_domain { domain: "acme.com", maxPages: 50 }
   -> collect relevant URLs for the audit

3. analyze { urls: [...] }
   -> run a full audit with SEO score + GEO/AEO score for each URL
```

## Tools Overview

### `list_analyzers`

Returns available analyzer keys, categories, and weights. Call this first so an agent knows what it can run.

- no input required
- current categories include `seo`, `accessibility`, `ux`, `performance`, and `geo`
- weights returned reflect your personal setup (see [Analysis Setup](#analysis-setup) below)

### `scan_domain`

Crawls a domain and returns SEO-relevant URLs.

| Parameter             | Type     | Default | Description                        |
| --------------------- | -------- | ------- | ---------------------------------- |
| `domain`              | string   | —       | Domain or URL to scan              |
| `maxPages`            | number   | `100`   | Maximum pages to crawl, up to 500  |
| `excludePatterns`     | string[] | `[]`    | URL patterns to skip               |
| `respectRobotsTxt`    | boolean  | `true`  | Honor `robots.txt`                 |
| `defaultLanguageOnly` | boolean  | `true`  | Skip alternate-language duplicates |

### `analyze`

Runs a full audit for one or more URLs. All 30+ analyzers run on each URL, returning an overall SEO score, per-category scores, and a GEO/AEO score for AI search visibility. URLs are processed sequentially and emit progress notifications after each one.

| Parameter | Type     | Description     |
| --------- | -------- | --------------- |
| `urls`    | string[] | URLs to analyze |

**Cost:** 3 credits per URL.

## Analysis Setup

From your dashboard at [octo-boost.com/dashboard](https://octo-boost.com/dashboard), you can configure how much each analyzer contributes to the overall score. Set a weight between 0 and 5 for any of the 30+ analyzers.

- **Weight 0** — the analyzer still runs but is excluded from the overall score calculation
- **Weight 1–5** — higher values give an analyzer more influence over the final score
- Changes apply immediately to all future API calls made with your key
- `list_analyzers` always returns your current weights, so agents can adapt their reasoning to your setup


## GEO/AEO Output

Full audits include a `geoScore` alongside the technical SEO score.

This score is meant for AI-search and agent workflows. It helps answer whether a page is easy for systems like ChatGPT, Claude, Gemini, or Perplexity to understand, extract, retrieve, and cite.

Key fields include:

- `geoScore`
- `technicalAccess`
- `contentStructure`
- `entityClarity`
- `authoritySignals`
- `citationLikelihood`
- `ragReadiness`
- `llmAssessment`
- `whyThisMattersForAgents`

## Project Status

Live today:

- [x] core audit workflow via `list_analyzers`, `scan_domain`, and `analyze`
- [x] GEO/AEO scoring for AI visibility
- [x] compact, credit-aware responses for agent execution
- [x] per-analyzer weight configuration via Analysis Setup in the dashboard

Planned next:

- [ ] LLM-based prioritization and condensation for more compact output
- [ ] higher-level tools such as `get_fix_plan`, `summarize_top_opportunities` and `compare_urls`
- [ ] better site-level workflows built on top of crawl plus analysis
- [ ] dedicated interface and API documentation
