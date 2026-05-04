import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRegul8McpServer } from "./create-regul8-mcp-server.js";
import { parseProcessEnv } from "./regul8-context.js";

async function main(): Promise<void> {
  try {
    parseProcessEnv();
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  const server = createRegul8McpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
