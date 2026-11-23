/**
 * Builds the Next.js app for cPanel's "Setup Node.js App" and packs it into one zip to upload.
 *
 *   PowerShell:  $env:BACKEND_URL="https://fitcheck-api.smartsitecp.com"; npm run build:cpanel
 *   bash:        BACKEND_URL=https://fitcheck-api.smartsitecp.com npm run build:cpanel
 *
 * Output: frontend/dist-cpanel/ (folder) and frontend/fitcheck-frontend.zip
 * Upload and extract the zip into the Node.js app's root on the server; the startup file is server.js.
 * BACKEND_URL is baked into the build (the /api proxy target), so rebuild if the API address changes.
 */
import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist-cpanel");
const ZIP = join(ROOT, "fitcheck-frontend.zip");
const backend = process.env.BACKEND_URL ?? "";

if (!/^https?:\/\//.test(backend)) {
  console.error('Set BACKEND_URL first, e.g. $env:BACKEND_URL="https://fitcheck-api.smartsitecp.com"');
  process.exit(1);
}
if (backend.includes("127.0.0.1") || backend.includes("localhost")) console.warn("Warning: BACKEND_URL points at this computer; the server won't reach it.");

console.log(`Building for cPanel with BACKEND_URL=${backend} …`);
const build = spawnSync("npx next build", { cwd: ROOT, stdio: "inherit", shell: true, env: { ...process.env, NEXT_OUTPUT: "standalone", BACKEND_URL: backend } });
if (build.status !== 0) process.exit(build.status ?? 1);

// standalone = server.js + the node_modules it needs; static assets and public/ are copied in beside it
rmSync(OUT, { recursive: true, force: true });
cpSync(join(ROOT, ".next", "standalone"), OUT, { recursive: true });
cpSync(join(ROOT, ".next", "static"), join(OUT, ".next", "static"), { recursive: true });
cpSync(join(ROOT, "public"), join(OUT, "public"), { recursive: true });
writeFileSync(join(OUT, "DEPLOY-INFO.txt"), `Built ${new Date().toISOString()}\nBACKEND_URL=${backend}\nStartup file: server.js\n`);

// Windows 10+ and macOS ship bsdtar, which can write zip (-a picks the format from the extension).
// GNU tar (Git Bash, most Linux) can't, so try Windows' own tar, then plain tar, then PowerShell, then `zip`.
const attempts = [
  ["C:/Windows/System32/tar.exe", ["-a", "-c", "-f", ZIP, "-C", OUT, "."]],
  ["tar", ["-a", "-c", "-f", ZIP, "-C", OUT, "."]],
  ["powershell", ["-NoProfile", "-Command", `Compress-Archive -Path '${OUT}\\*' -DestinationPath '${ZIP}' -Force`]],
  ["zip", ["-qr", ZIP, "."], { cwd: OUT }],
];
for (const [cmd, args, opts] of attempts) {
  if (cmd.includes(":/") && !existsSync(cmd)) continue;
  rmSync(ZIP, { force: true });
  const z = spawnSync(cmd, args, { stdio: "ignore", ...opts });
  if (z.status === 0 && existsSync(ZIP)) break;
}
console.log(existsSync(ZIP)
  ? `\nReady: ${ZIP}\nUpload it to the Node.js app root on cPanel, extract, then Restart the app.`
  : `\nBuilt ${OUT}. Zip that folder's contents yourself (zip creation failed).`);
