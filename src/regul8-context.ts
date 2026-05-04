import { AsyncLocalStorage } from "node:async_hooks";

export type Regul8Env = {
  appId: string;
  email: string;
  password: string;
  serverUrl: string;
  appBaseUrl: string | undefined;
};

const envStore = new AsyncLocalStorage<Regul8Env>();

export function runWithRegul8Env<T>(env: Regul8Env, fn: () => T | Promise<T>): T | Promise<T> {
  return envStore.run(env, fn);
}

export function getRegul8Env(): Regul8Env {
  const fromStore = envStore.getStore();
  if (fromStore) {
    return fromStore;
  }
  return parseProcessEnv();
}

export function parseProcessEnv(): Regul8Env {
  const appId = process.env.REGUL8_APP_ID?.trim();
  const email = process.env.REGUL8_USER_EMAIL?.trim();
  const password = process.env.REGUL8_USER_PASSWORD;
  const serverUrl = process.env.REGUL8_SERVER_URL?.trim() || "https://base44.app";
  const appBaseUrlRaw = process.env.REGUL8_APP_BASE_URL?.trim();

  if (!appId) {
    throw new Error("Missing REGUL8_APP_ID (Base44 application ID).");
  }
  if (!email) {
    throw new Error("Missing REGUL8_USER_EMAIL.");
  }
  if (password === undefined || password === "") {
    throw new Error("Missing REGUL8_USER_PASSWORD.");
  }

  return {
    appId,
    email,
    password,
    serverUrl,
    appBaseUrl: appBaseUrlRaw || undefined,
  };
}

/** Map Cloudflare Worker bindings / secrets to the same shape as process.env. */
export function parseWorkerBindings(env: Record<string, unknown>): Regul8Env {
  const appId = String(env.REGUL8_APP_ID ?? "").trim();
  const email = String(env.REGUL8_USER_EMAIL ?? "").trim();
  const password = env.REGUL8_USER_PASSWORD != null ? String(env.REGUL8_USER_PASSWORD) : "";
  const serverUrl = String(env.REGUL8_SERVER_URL ?? "").trim() || "https://base44.app";
  const appBaseUrlRaw = String(env.REGUL8_APP_BASE_URL ?? "").trim();

  if (!appId) {
    throw new Error("Missing Worker secret or var REGUL8_APP_ID.");
  }
  if (!email) {
    throw new Error("Missing Worker secret REGUL8_USER_EMAIL.");
  }
  if (!password) {
    throw new Error("Missing Worker secret REGUL8_USER_PASSWORD.");
  }

  return {
    appId,
    email,
    password,
    serverUrl,
    appBaseUrl: appBaseUrlRaw || undefined,
  };
}
