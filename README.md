# Regul8 MCP

Model Context Protocol server for [Regul8](https://base44.app) on Base44: list channels, regulations, countries, and products, then submit marketing content to `processBulkSubmissions` for AI compliance analysis.

API shapes match [API_REFERENCE 4.md](./API_REFERENCE%204.md).

## Prerequisites

- Node.js 18+
- A Regul8 Base44 app id and a user email/password (same as the API reference)

## Install and build

```bash
git clone https://github.com/yoraibe-tr/regul8-mcp.git
cd regul8-mcp
npm install
npm run build
```

Copy [.env.example](./.env.example) and set variables, **or** configure the same keys in Cursor / Claude (recommended for secrets).

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

1. **Settings → MCP → Add server** (or edit your MCP config JSON).
2. Use **command** `node` with **args** including the absolute path to `dist/index.js` in this repo.
3. Add **environment** entries for `REGUL8_APP_ID`, `REGUL8_USER_EMAIL`, `REGUL8_USER_PASSWORD`, and optionally `REGUL8_APP_BASE_URL` / `REGUL8_SERVER_URL`.

Example (adjust paths for your machine):

```json
{
  "mcpServers": {
    "regul8": {
      "command": "node",
      "args": ["C:/Users/Yoraibe/Regul8MCP/dist/index.js"],
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

Edit Claude’s MCP configuration file (location varies by OS; see Anthropic’s *Connect Claude Desktop to local MCP servers* guide). Add a server block with the same `command`, `args`, and `env` as above, then restart Claude Desktop.

## Run locally (stdio)

```bash
npm run start
```

The process waits on stdin; it is normally started by Cursor or Claude, not run interactively.

## Sharing

Publish the repository on GitHub. Others clone, `npm install`, `npm run build`, and point their MCP client at their own built `dist/index.js` with **their** env vars. Do not commit `.env` or real credentials.

Optional next step: publish to npm and expose a `bin` entry so users can run via `npx` without cloning.

## License

MIT
