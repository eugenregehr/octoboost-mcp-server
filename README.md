# OctoBoost SEO — MCP Server

Exposes the OctoBoost SEO API as [Model Context Protocol (MCP)](https://modelcontextprotocol.io) tools so AI agents can audit websites without leaving their reasoning loop.

Get your free API key at [octo-boost.com](https://octo-boost.com) — new accounts come with free credits to try out every tool.

## Why use this for SEO analysis?

Running SEO checks inside an LLM context is expensive — fetching raw HTML, parsing it, and reasoning over it consumes thousands of tokens per page. This server offloads that work to the OctoBoost API and returns **compact, structured results** (scores, flags, and diagnostics only) that cost a fraction of the tokens while giving the agent exactly what it needs to reason and act.

- **Token-efficient** — structured API results instead of raw HTML; a full 30-analyzer audit of a page fits in a few hundred tokens.
- **LLM-friendly output** — scores and pass/fail flags, not prose. No parsing required.
- **Scoped execution** — run one analyzer, one category, or a full audit. The agent picks the right scope and avoids unnecessary API calls.
- **Real-time progress** — `analyze` emits a `notifications/progress` event after each URL, so the agent and user get live feedback.
- **Credit awareness** — every response includes credits used/remaining so the agent can make cost-conscious decisions.
- **Clear error signals** — `401` for expired keys, `402` for exhausted credits. Easy for an agent to catch and report.

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

1. **Get an API key** — sign up at [octo-boost.com](https://octo-boost.com). New accounts get free credits.

2. **Add to your MCP client** — no install needed, `npx` runs it automatically.

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

Add this block to your client's MCP config file:
- **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Cursor**: Cursor MCP settings file
- **OpenClaw**: `~/.openclaw/mcp.json`

3. **(Optional) Verify** — run the MCP Inspector and call `list_analyzers`:

```bash
OCTOBOOST_API_KEY=your-key npx @modelcontextprotocol/inspector npx octoboost-mcp-server
```

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
