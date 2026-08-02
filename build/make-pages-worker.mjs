// Cloudflare Pages only runs server-side code from a `_worker.js` at the root
// of the published directory (or a `functions/` dir). Vite emits the server
// bundle to dist/server instead, so without this the deployment is static-only
// and every route 404s — this app has no index.html, its HTML is rendered by
// the Worker.
//
// Copies the built server bundle to dist/client/_worker.js/ (directory form,
// since the bundle is multiple ES modules) so `dist/client` is a complete
// Pages publish directory. Harmless for the Workers deploy path, which reads
// dist/server directly and ignores _worker.js via .assetsignore.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverDir = resolve(root, "dist/server");
const clientDir = resolve(root, "dist/client");
const workerDir = resolve(clientDir, "_worker.js");

if (!existsSync(serverDir) || !existsSync(clientDir)) {
  console.error("[pages-worker] dist/server or dist/client missing — run the build first.");
  process.exit(1);
}

await rm(workerDir, { recursive: true, force: true });
await mkdir(workerDir, { recursive: true });

// wrangler.json/.vite are build metadata for the Workers path, not worker code.
await cp(serverDir, workerDir, {
  recursive: true,
  filter: (source) => !/(?:wrangler\.json|[/\\]\.vite)$/.test(source),
});

const assetsIgnorePath = resolve(clientDir, ".assetsignore");
const existing = existsSync(assetsIgnorePath)
  ? await readFile(assetsIgnorePath, "utf8")
  : "";
if (!existing.split("\n").includes("_worker.js")) {
  await writeFile(
    assetsIgnorePath,
    `${existing.replace(/\n*$/, "\n")}_worker.js\n`,
  );
}

console.log("[pages-worker] wrote dist/client/_worker.js");
