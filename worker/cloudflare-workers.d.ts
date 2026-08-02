// Minimal ambient typing for the Workers runtime's `cloudflare:workers`
// module, which has no first-party types outside the full
// `@cloudflare/workers-types` package. That package isn't a dependency here
// because its global `Request`/`Response`/`fetch` declarations would
// conflict with this app's DOM-typed frontend code, so `env.DB` is typed
// with drizzle's own runtime-agnostic D1 type instead.
declare module "cloudflare:workers" {
  export const env: { DB?: import("drizzle-orm/d1").AnyD1Database };
}
