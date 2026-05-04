import { Base44Error, createClient, type Base44Client } from "@base44/sdk";
import { getRegul8Env } from "./regul8-context.js";

let clientPromise: Promise<Base44Client> | null = null;

export function resetRegul8Client(): void {
  clientPromise = null;
}

async function createLoggedInClient(): Promise<Base44Client> {
  const env = getRegul8Env();
  const client = createClient({
    appId: env.appId,
    serverUrl: env.serverUrl,
    ...(env.appBaseUrl ? { appBaseUrl: env.appBaseUrl } : {}),
  });
  await client.auth.loginViaEmailPassword(env.email, env.password);
  return client;
}

export async function getRegul8Client(): Promise<Base44Client> {
  if (!clientPromise) {
    clientPromise = createLoggedInClient().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

/** Base44 functions axios client uses interceptResponses: false — unwrap `.data` when present. */
export function unwrapAxiosData<T>(res: unknown): T {
  if (res !== null && typeof res === "object" && "data" in res) {
    return (res as { data: T }).data;
  }
  return res as T;
}

export async function withRegul8Retry<T>(fn: (client: Base44Client) => Promise<T>): Promise<T> {
  let attempts = 0;
  const max = 2;
  while (attempts < max) {
    try {
      const client = await getRegul8Client();
      return await fn(client);
    } catch (e) {
      const status = e instanceof Base44Error ? e.status : undefined;
      if (status === 401 && attempts + 1 < max) {
        resetRegul8Client();
        attempts += 1;
        continue;
      }
      throw e;
    }
  }
  throw new Error("withRegul8Retry: exhausted retries");
}
