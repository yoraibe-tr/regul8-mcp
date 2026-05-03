import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Base44Error } from "@base44/sdk";
import * as z from "zod";
import {
  getRegul8Client,
  readRegul8Env,
  resetRegul8Client,
  unwrapAxiosData,
  withRegul8Retry,
} from "./regul8-client.js";

const submissionDataSchema = z.object({
  channel_id: z.string().min(1),
  regulation_ids: z.array(z.string()).min(1),
  country_ids: z.array(z.string()).optional(),
  product_ids: z.array(z.string()).optional(),
  analysis_tool: z.enum(["azure_openai", "openai", "base44"]).optional(),
  content_type: z.string().min(1),
  items: z.array(z.record(z.string(), z.unknown())).min(1),
});

function toolError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

function toolJson(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function formatBase44Error(e: unknown): string {
  if (e instanceof Base44Error) {
    return `Regul8/Base44 error (${e.status ?? "?"}): ${e.message}${e.data ? `\n${JSON.stringify(e.data)}` : ""}`;
  }
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

async function main(): Promise<void> {
  try {
    readRegul8Env();
  } catch (e) {
    console.error(formatBase44Error(e));
    process.exit(1);
  }

  const server = new McpServer(
    { name: "regul8-mcp", version: "1.0.0" },
    {
      instructions:
        "Regul8 compliance MCP: use regul8_list_* tools to fetch channel/regulation/country/product IDs before regul8_submit_bulk. Google Ads require content_type headline|description1|description2 with exactly one non-null field per item. Always inspect results.failed even when success is true. Set REGUL8_APP_ID, REGUL8_USER_EMAIL, REGUL8_USER_PASSWORD (and optionally REGUL8_APP_BASE_URL, REGUL8_SERVER_URL) in the MCP server environment.",
    },
  );

  const listAnnotations = {
    title: "List reference data",
    readOnlyHint: true,
  } as const;

  server.registerTool(
    "regul8_list_channels",
    {
      title: "List channels",
      description:
        "Returns all Regul8 marketing channels. Use each record's id as channel_id in regul8_submit_bulk.",
      inputSchema: z.object({}),
      annotations: listAnnotations,
    },
    async () => {
      try {
        const data = await withRegul8Retry(async (c) => {
          const handler = (c.entities as Record<string, { list: (...args: unknown[]) => Promise<unknown> }>).Channel;
          if (!handler?.list) {
            throw new Error("Channel entity is not available on this Base44 app.");
          }
          return handler.list();
        });
        return toolJson(data);
      } catch (e) {
        return toolError(formatBase44Error(e));
      }
    },
  );

  server.registerTool(
    "regul8_list_regulations",
    {
      title: "List regulations",
      description:
        "Returns regulations (e.g. FCA, CySEC). Use id values in regulation_ids for regul8_submit_bulk.",
      inputSchema: z.object({}),
      annotations: listAnnotations,
    },
    async () => {
      try {
        const data = await withRegul8Retry(async (c) => {
          const handler = (c.entities as Record<string, { list: (...args: unknown[]) => Promise<unknown> }>).Regulation;
          if (!handler?.list) {
            throw new Error("Regulation entity is not available on this Base44 app.");
          }
          return handler.list();
        });
        return toolJson(data);
      } catch (e) {
        return toolError(formatBase44Error(e));
      }
    },
  );

  server.registerTool(
    "regul8_list_countries",
    {
      title: "List countries",
      description:
        "Returns countries with regulation links. Use id in country_ids; countries must be linked to selected regulations.",
      inputSchema: z.object({}),
      annotations: listAnnotations,
    },
    async () => {
      try {
        const data = await withRegul8Retry(async (c) => {
          const handler = (c.entities as Record<string, { list: (...args: unknown[]) => Promise<unknown> }>).Country;
          if (!handler?.list) {
            throw new Error("Country entity is not available on this Base44 app.");
          }
          return handler.list();
        });
        return toolJson(data);
      } catch (e) {
        return toolError(formatBase44Error(e));
      }
    },
  );

  server.registerTool(
    "regul8_list_products",
    {
      title: "List products",
      description: "Returns products. Use id values in product_ids for regul8_submit_bulk when applicable.",
      inputSchema: z.object({}),
      annotations: listAnnotations,
    },
    async () => {
      try {
        const data = await withRegul8Retry(async (c) => {
          const handler = (c.entities as Record<string, { list: (...args: unknown[]) => Promise<unknown> }>).Product;
          if (!handler?.list) {
            throw new Error("Product entity is not available on this Base44 app.");
          }
          return handler.list();
        });
        return toolJson(data);
      } catch (e) {
        return toolError(formatBase44Error(e));
      }
    },
  );

  server.registerTool(
    "regul8_submit_bulk",
    {
      title: "Submit content for compliance",
      description:
        "Calls processBulkSubmissions with submissionData (channel_id, regulation_ids, country_ids, product_ids, analysis_tool, content_type, items). Returns results, failed, and progress. Creates new submission records; avoid blind retries.",
      inputSchema: z.object({
        submissionData: submissionDataSchema,
      }),
    },
    async ({ submissionData }) => {
      try {
        const payload = {
          country_ids: submissionData.country_ids ?? [],
          product_ids: submissionData.product_ids ?? [],
          analysis_tool: submissionData.analysis_tool ?? "azure_openai",
          channel_id: submissionData.channel_id,
          regulation_ids: submissionData.regulation_ids,
          content_type: submissionData.content_type,
          items: submissionData.items,
        };

        const raw = await withRegul8Retry((c) =>
          c.functions.invoke("processBulkSubmissions", { submissionData: payload }),
        );
        const data = unwrapAxiosData<unknown>(raw);
        return toolJson(data);
      } catch (e) {
        return toolError(formatBase44Error(e));
      }
    },
  );

  server.registerTool(
    "regul8_reset_session",
    {
      title: "Reset cached Regul8 session",
      description:
        "Clears the in-memory Base44 client (e.g. after password change or forced re-login). Next tool call logs in again.",
      inputSchema: z.object({}),
    },
    async () => {
      resetRegul8Client();
      try {
        await getRegul8Client();
        return { content: [{ type: "text" as const, text: "Session reset and re-authenticated successfully." }] };
      } catch (e) {
        return toolError(formatBase44Error(e));
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
