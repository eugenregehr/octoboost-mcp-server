# OctoBoost SEO — MCP Server

Exposes the OctoBoost SEO API as [Model Context Protocol (MCP)](https://modelcontextprotocol.io) tools so AI agents can audit websites without leaving their reasoning loop.

Get your free API key at [octo-boost.com](https://octo-boost.com) — new accounts come with free credits to try out every tool.

## Why use this with an AI agent?

SEO audits normally require a human to kick off a crawl, wait for results, interpret a dashboard, and decide what to fix. With this MCP server, an agent can do all of that autonomously:

- **Discovery first** — call `list_analyzers` to understand what checks exist (30 analyzers across 8 categories) before deciding which ones matter for the task at hand.
- **Scoped crawls** — call `scan_domain` to get the full URL inventory of a site, then pass exactly the pages that need attention to the analysis step.
- **Targeted or full analysis** — run every analyzer at once, isolate a single check (e.g. `title`), or focus on a whole category (e.g. `accessibility`). The agent picks the right scope based on the task.
- **Real-time progress** — `analyze` processes URLs one at a time and emits a `notifications/progress` event after each one, so the agent (and the user watching) gets live feedback instead of waiting for a bulk result.
- **Credit awareness** — every response includes credits used and credits remaining, so an agent can make cost-conscious decisions (e.g. scan a sample before committing to a full audit).
- **Clear error signals** — expired keys surface as `401`, exhausted credits as `402`. An agent can catch these and report them intelligibly rather than producing a confusing failure.

## Tools

### `list_analyzers`

Returns all available analyzer keys, their categories, and their weights.

Call this at the start of any audit session to let the agent know what it can work with.

Current analyzer keys:

- `alt-tags`
- `color-contrast`
- `title`
- `meta-description`
- `heading-hierarchy`
- `canonical`
- `aria-attribute-check`
- `error-handling-check`
- `form-check`
- `h1-check`
- `hreflang`
- `html-lang`
- `html-structure`
- `image-optimization`
- `image-size`
- `internal-links`
- `link-descriptions`
- `list-markup`
- `lorem-ipsum`
- `meta-viewport`
- `robots-meta`
- `robots-txt`
- `script-loading`
- `script-size`
- `social-meta`
- `structured-data`
- `tab-focus-order`
- `touch-target-size`
- `url-structure`
- `xml-sitemap`

**No input required.**

```
Found 30 analyzers across 4 categories.

Categories: seo, accessibility, ux, performance

Analyzers:
  title (categories: seo)
  meta_description (categories: seo)
  ...
```

---

### `scan_domain`

Crawls a domain and returns all SEO-relevant page URLs.

| Parameter             | Type     | Default | Description                                |
| --------------------- | -------- | ------- | ------------------------------------------ |
| `domain`              | string   | —       | Domain or URL to scan (e.g. `example.com`) |
| `maxPages`            | number   | `100`   | Max pages to crawl (max: 500)              |
| `excludePatterns`     | string[] | `[]`    | URL patterns to skip                       |
| `respectRobotsTxt`    | boolean  | `true`  | Honour robots.txt                          |
| `defaultLanguageOnly` | boolean  | `true`  | Skip alternate-language duplicates         |

---

### `analyze`

Analyzes one or more URLs for SEO issues. URLs are processed sequentially with progress notifications emitted after each.

| Parameter  | Type                                     | Description                          |
| ---------- | ---------------------------------------- | ------------------------------------ |
| `urls`     | string[]                                 | URLs to analyze (max: 20)            |
| `mode`     | `"full"` \| `"analyzer"` \| `"category"` | Scope of analysis                    |
| `analyzer` | string?                                  | Required when `mode` is `"analyzer"` |
| `category` | string?                                  | Required when `mode` is `"category"` |

**Mode reference:**

| Mode       | What runs                     | Typical use                        |
| ---------- | ----------------------------- | ---------------------------------- |
| `full`     | All 30 analyzers              | Comprehensive site audit           |
| `category` | All analyzers in one category | Focused audit (e.g. accessibility) |
| `analyzer` | One specific analyzer         | Targeted check (e.g. `title`)      |

## Setup

### 1. Get an API key

Sign up at [octo-boost.com](https://octo-boost.com). New accounts receive free credits — no payment required to get started.

### 2. Configure your MCP client

No installation or build step required — `npx` downloads and runs the server automatically.

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

#### Cursor

Add the same block under `mcpServers` in your Cursor MCP settings file.

#### OpenClaw

Add to `~/.openclaw/mcp.json` (create the file if it doesn't exist):

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

Restart OpenClaw after saving. Alternatively, use the CLI:

```bash
openclaw config set mcpServers.octoboost-seo.command "npx"
openclaw config set mcpServers.octoboost-seo.args '["-y", "octoboost-mcp-server"]'
openclaw config set mcpServers.octoboost-seo.env.OCTOBOOST_API_KEY "your-api-key"
```

### 3. Verify with MCP Inspector

```bash
OCTOBOOST_API_KEY=your-key npx @modelcontextprotocol/inspector npx octoboost-mcp-server
```

Open the Inspector UI, call `list_analyzers`, and confirm you see 30 analyzer keys.

## Environment variables

| Variable            | Required | Description                         |
| ------------------- | -------- | ----------------------------------- |
| `OCTOBOOST_API_KEY` | yes      | API key from your OctoBoost account |

## Example agent workflow

```
1. list_analyzers
   → agent learns categories and picks "accessibility" for the task

2. scan_domain { domain: "acme.com", maxPages: 50 }
   → agent receives 38 URLs

3. analyze { urls: [first 10 URLs], mode: "category", category: "accessibility" }
   → progress: 1/10 … 10/10
   → agent reads scores, identifies 3 failing pages

4. analyze { urls: [3 failing URLs], mode: "full" }
   → agent gets the complete picture and writes a remediation report
```
