# Regul8 MCP

[![CI](https://github.com/yoraibe-tr/regul8-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/yoraibe-tr/regul8-mcp/actions/workflows/ci.yml)

[Model Context Protocol](https://modelcontextprotocol.io) server for **Regul8** on [Base44](https://base44.app): list channels, regulations, countries, and products, then submit marketing content to `processBulkSubmissions` for AI compliance analysis.

- **Local:** stdio transport (`npm run start`) for Cursor / Claude Desktop.
- **Remote PoC:** [Cloudflare Workers](https://developers.cloudflare.com/workers/) + [streamable HTTP](https://modelcontextprotocol.io/specification/draft/basic/transports/#streamable-http) via [`agents/mcp`](https://developers.cloudflare.com/agents/model-context-protocol/mcp-handler-api/) (`npm run deploy:worker`).

Payloads and responses follow [docs/API_REFERENCE.md](./docs/API_REFERENCE.md).

## Prerequisites

- Node.js 18+
- A Regul8 Base44 app id and a user email/password (see API reference)

## Install and build

```bash
git clone https://github.com/yoraibe-tr/regul8-mcp.git
cd regul8-mcp
npm install
npm run build
```

Configure credentials via a local `.env` file (see [.env.example](./.env.example)) **or** inline `env` in your MCP client. Never commit real secrets.

| Variable | Required | Description |
|----------|----------|-------------|
| `REGUL8_APP_ID` | Yes | Base44 application ID |
| `REGUL8_USER_EMAIL` | Yes | Regul8 user email |
| `REGUL8_USER_PASSWORD` | Yes | That user's password |
| `REGUL8_SERVER_URL` | No | Default `https://base44.app` |
| `REGUL8_APP_BASE_URL` | No | Deployed app URL (e.g. `https://your-app.base44.app`); passed to the SDK when set |

## Tools

| Tool | Purpose |
|------|---------|
| `regul8_list_channels` | Channel ids for `channel_id` |
| `regul8_list_regulations` | Regulation ids for `regulation_ids` |
| `regul8_list_countries` | Country ids for `country_ids` |
| `regul8_list_products` | Product ids for `product_ids` |
| `regul8_submit_bulk` | Body `{ "submissionData": { ... } }` → `processBulkSubmissions` |
| `regul8_reset_session` | Drop cached client (e.g. after password change) |

## Cursor

This repo includes [`.cursor/mcp.json`](./.cursor/mcp.json) using `envFile: ${workspaceFolder}/.env`. After `npm run build`, open the folder in Cursor, add your `.env` from `.env.example`, and enable the **regul8** MCP server.

For a global or manual config, use `node` with an absolute path to `dist/index.js` and the same environment variables:

```json
{
  "mcpServers": {
    "regul8": {
      "command": "node",
      "args": ["/absolute/path/to/regul8-mcp/dist/index.js"],
      "env": {
        "REGUL8_APP_ID": "your-app-id",
        "REGUL8_USER_EMAIL": "you@example.com",
        "REGUL8_USER_PASSWORD": "your-password",
        "REGUL8_APP_BASE_URL": "https://your-app.base44.app"
      }
    }
  }
}
```

Restart Cursor or reload MCP after changes.

## Claude Desktop

Add a server entry with the same `command`, `args`, and `env` as above (see Anthropic’s guide to *local MCP servers*). Paths must be absolute on your machine. Restart Claude Desktop after editing the config.

## Run locally (stdio)

```bash
npm run start
```

The process reads JSON-RPC on stdin; it is meant to be spawned by an MCP host, not used interactively.

## Cloudflare Worker (hosted MCP)

Uses `nodejs_compat` (Base44 SDK / axios) and exposes MCP at **`POST /mcp`** (streamable HTTP). `GET /` returns a small JSON discovery payload.

1. Install deps and typecheck: `npm install` (Wrangler is a dev dependency).
2. Authenticate once: `npx wrangler login`.
3. Set secrets (same names as env vars):

   ```bash
   npx wrangler secret put REGUL8_APP_ID
   npx wrangler secret put REGUL8_USER_EMAIL
   npx wrangler secret put REGUL8_USER_PASSWORD
   ```

   Optionally set plain vars in [`wrangler.jsonc`](./wrangler.jsonc) under `[vars]` for `REGUL8_SERVER_URL` / `REGUL8_APP_BASE_URL`, or add more secrets.

4. Deploy: `npm run deploy:worker`
5. Local dev: copy [.dev.vars.example](./.dev.vars.example) to `.dev.vars`, fill values, then `npm run dev:worker`.

**PoC notes:** Compliance calls can take several seconds; ensure your Workers plan and [limits](https://developers.cloudflare.com/workers/platform/limits/) fit your latency needs. This Worker is single-tenant (one set of Regul8 credentials per deployment).

## Repository layout

| Path | Purpose |
|------|---------|
| `src/index.ts` | Stdio entry (local MCP) |
| `src/worker.ts` | Cloudflare Worker + HTTP MCP |
| `src/create-regul8-mcp-server.ts` | Shared `McpServer` and tools |
| `src/regul8-context.ts` | Env parsing + AsyncLocalStorage for Worker requests |
| `src/regul8-client.ts` | Base44 auth, client cache, retries |
| `docs/API_REFERENCE.md` | Regul8 HTTP/SDK reference |
| `wrangler.jsonc` | Worker deploy config |
| `.cursor/mcp.json` | Example Cursor MCP wiring |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
