/**
 * npm run release: builds the live site into frontend/out/ for production and stages it for commit.
 *
 * Use it after testing on localhost, then commit and push. The server's cron job (deploy/deploy.sh)
 * pulls the commit and frontend/out/ goes live as it is: the server never builds the site.
 *
 * The API address defaults to production; override with RELEASE_API_URL if it ever moves.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = (process.env.RELEASE_API_URL || "https://fitcheck-api.smartsitecp.com").replace(/\/+$/, "");

const run = (cmd, env = {}) => {
  const r = spawnSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true, env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

console.log(`Release build for ${api}\n`);
run("node scripts/build-static.mjs", { NEXT_PUBLIC_API_URL: api, NO_ZIP: "1" });
// -A also stages deletions (old hashed files Next.js no longer produces)
run("git add -A out");
console.log("\nfrontend/out is built and staged. Now commit and push; the server picks it up within 15 minutes.");
