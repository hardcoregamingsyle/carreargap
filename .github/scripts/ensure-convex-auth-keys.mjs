// One-time (idempotent) setup for Convex Auth: generates the RS256 JWT
// signing keypair Convex Auth needs and a default SITE_URL, but only if
// they aren't already set on the deployment. Safe to run on every deploy.
import { execFileSync } from "node:child_process";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

function convexEnvGet(name) {
  try {
    return execFileSync("npx", ["convex", "env", "get", name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function convexEnvSet(name, value) {
  // `--` forces commander to treat `value` as positional even when it starts
  // with `-` (true for the PEM private key: "-----BEGIN PRIVATE KEY-----"),
  // which otherwise gets misparsed as an unknown option.
  execFileSync("npx", ["convex", "env", "set", "--", name, value], {
    stdio: "inherit",
  });
}

const defaultSiteUrl =
  process.env.CONVEX_AUTH_SITE_URL ||
  "https://careerready-sfhs.finart.chatgpt.site";

if (!convexEnvGet("SITE_URL")) {
  console.log(`SITE_URL not set, defaulting to ${defaultSiteUrl}`);
  console.log(
    "Update this later with: npx convex env set SITE_URL <your-real-domain>",
  );
  convexEnvSet("SITE_URL", defaultSiteUrl);
}

if (convexEnvGet("JWT_PRIVATE_KEY") && convexEnvGet("JWKS")) {
  console.log("JWT_PRIVATE_KEY / JWKS already configured, skipping.");
} else {
  console.log("Generating a new Convex Auth JWT keypair...");
  const keys = await generateKeyPair("RS256", { extractable: true });
  const privateKey = await exportPKCS8(keys.privateKey);
  const publicKey = await exportJWK(keys.publicKey);
  const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });
  const jwtPrivateKey = privateKey.trimEnd().replace(/\n/g, " ");

  convexEnvSet("JWT_PRIVATE_KEY", jwtPrivateKey);
  convexEnvSet("JWKS", jwks);
}
