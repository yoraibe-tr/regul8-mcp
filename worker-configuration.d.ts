/** Cloudflare Worker bindings (secrets + optional vars). Configure via `wrangler secret put` / `wrangler.toml` [vars]. */
interface Env {
  REGUL8_APP_ID: string;
  REGUL8_USER_EMAIL: string;
  REGUL8_USER_PASSWORD: string;
  REGUL8_SERVER_URL?: string;
  REGUL8_APP_BASE_URL?: string;
}
