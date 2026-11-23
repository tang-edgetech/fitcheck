/**
 * Builds the Next.js app for cPanel's "Setup Node.js App" and packs it into one zip to upload.
 *
 *   PowerShell:  $env:BACKEND_URL="https://fitcheck-api.smartsitecp.com"; npm run build:cpanel
 *   bash:        BACKEND_URL=https://fitcheck-api.smartsitecp.com npm run build:cpanel
 *
 * Output: frontend/dist-cpanel/ (the runnable site; on the server this folder IS the Node.js app root)
 *         and frontend/fitcheck-frontend.zip (to upload when you build on your computer instead).
 * The startup file is server.js. Files cPanel keeps in dist-cpanel/ (.htaccess, tmp/, .well-known/) survive rebuilds.
 * BACKEND_URL is baked into the build (the /api proxy target), so rebuild if the API address changes.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

// standalone = server.js + the node_modules it needs; static assets and public/ are copied in beside it.
// On the server dist-cpanel/ is also the Node.js app root and the domain's document root, so keep what
// cPanel and AutoSSL put there: the app's .htaccess, Passenger's tmp/ and log, and .well-known/.
const KEEP = new Set([".htaccess", "tmp", "stderr.log", ".well-known", "cgi-bin"]);
mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) {
  if (!KEEP.has(name)) rmSync(join(OUT, name), { recursive: true, force: true });
}
cpSync(join(ROOT, ".next", "standalone"), OUT, { recursive: true });
cpSync(join(ROOT, ".next", "static"), join(OUT, ".next", "static"), { recursive: true });
cpSync(join(ROOT, "public"), join(OUT, "public"), { recursive: true });
writeFileSync(join(OUT, "DEPLOY-INFO.txt"), `Built ${new Date().toISOString()}\nBACKEND_URL=${backend}\nStartup file: server.js\n`);

// Built on the server itself (deploy.sh sets NO_ZIP=1): the app already runs from dist-cpanel/, no zip needed
if (process.env.NO_ZIP === "1") {
  console.log(`\nBuilt ${OUT}. Restart the Node.js app to use it.`);
  process.exit(0);
}

// Windows 10+ and macOS ship bsdtar, which can write zip (-a picks the format from the extension).
// GNU tar (Git Bash, most Linux) can't, so try Windows' own tar, then plain tar, then PowerShell, then `zip`.
// The kept server files (.htaccess, tmp/ …) never go into the zip, so uploading it can't overwrite them.
const skip = [...KEEP].flatMap((k) => ["--exclude", `./${k}`]);
const attempts = [
  ["C:/Windows/System32/tar.exe", ["-a", "-c", "-f", ZIP, ...skip, "-C", OUT, "."]],
  ["tar", ["-a", "-c", "-f", ZIP, ...skip, "-C", OUT, "."]],
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
