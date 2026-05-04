/// <reference types="@cloudflare/workers-types" />

import { createMcpHandler } from "agents/mcp";
import { createRegul8McpServer } from "./create-regul8-mcp-server.js";
import { parseWorkerBindings, runWithRegul8Env } from "./regul8-context.js";

const mcpServer = createRegul8McpServer();

const mcpHandler = createMcpHandler(mcpServer, {
  route: "/mcp",
  corsOptions: {
    origin: "*",
    methods: "GET,POST,DELETE,OPTIONS",
    headers: "Content-Type,Accept,Mcp-Session-Id,mcp-session-id",
    exposeHeaders: "Mcp-Session-Id,mcp-session-id",
  },
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return Response.json({
        service: "regul8-mcp",
        transport: "streamable-http",
        mcp_post: `${url.origin}/mcp`,
        docs: "https://github.com/yoraibe-tr/regul8-mcp",
      });
    }

    try {
      const regul8Env = parseWorkerBindings(env as unknown as Record<string, unknown>);
      return await runWithRegul8Env(regul8Env, () => mcpHandler(request, env, ctx));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return Response.json({ error: message }, { status: 500 });
    }
  },
};
