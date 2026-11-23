/**
 * Builds the site as plain static files for hosting WITHOUT Node.js (e.g. cPanel with no "Setup Node.js App").
 *
 *   PowerShell:  $env:NEXT_PUBLIC_API_URL="https://fitcheck-api.smartsitecp.com"; npm run build:static
 *   bash:        NEXT_PUBLIC_API_URL=https://fitcheck-api.smartsitecp.com npm run build:static
 *
 * Output: frontend/out/ (the site) and frontend/fitcheck-site.zip (its contents, to upload).
 * On the server the files go in frontend/out/; frontend/.htaccess (in git) serves them at the domain root.
 * The browser calls the API address directly, so Laravel must allow it (CORS_ALLOWED_ORIGINS, SESSION_DOMAIN in .env).
 */
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");
const ZIP = join(ROOT, "fitcheck-site.zip");
const api = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

if (!/^https?:\/\//.test(api)) {
  console.error('Set NEXT_PUBLIC_API_URL first, e.g. $env:NEXT_PUBLIC_API_URL="https://fitcheck-api.smartsitecp.com"');
  process.exit(1);
}

console.log(`Building static site with NEXT_PUBLIC_API_URL=${api} …`);
rmSync(OUT, { recursive: true, force: true });
const build = spawnSync("npx next build", { cwd: ROOT, stdio: "inherit", shell: true, env: { ...process.env, NEXT_OUTPUT: "export", NEXT_PUBLIC_API_URL: api } });
if (build.status !== 0) process.exit(build.status ?? 1);
if (!existsSync(join(OUT, "index.html"))) { console.error("Build finished but out/index.html is missing."); process.exit(1); }
writeFileSync(join(OUT, "BUILD-INFO.txt"), `Built ${new Date().toISOString()}\nNEXT_PUBLIC_API_URL=${api}\n`);

// Apache settings for the static site (what the Next.js server would otherwise do): clean addresses,
// the 404 page, security headers, and long caching for the fingerprinted files in /_next/static/.
writeFileSync(join(OUT, ".htaccess"), `# Written by npm run build:static. Served through frontend/.htaccess.
Options -Indexes -MultiViews
DirectoryIndex index.html
# Folders without a trailing slash: redirect to the clean address ourselves (Apache's own redirect would show /out/)
DirectorySlash Off
ErrorDocument 404 /404.html

<IfModule mod_rewrite.c>
    RewriteEngine On
    # /admin/login  →  /admin/login/  (the page is admin/login/index.html)
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteCond %{THE_REQUEST} ^[A-Z]+\\s([^?\\s]*[^/?\\s])[\\s?]
    RewriteRule ^ %1/ [R=301,L,QSA]
</IfModule>

<IfModule mod_headers.c>
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
    # This site may frame other sites (that's the tester); other sites may not frame this one
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set Content-Security-Policy "frame-ancestors 'self'"
    <FilesMatch "\\.html$">
        Header set Cache-Control "no-cache"
    </FilesMatch>
</IfModule>
<IfModule mod_headers.c>
    <If "%{REQUEST_URI} =~ m#/_next/static/#">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </If>
</IfModule>
`);

if (process.env.NO_ZIP === "1") { console.log(`\nBuilt ${OUT}.`); process.exit(0); }

// bsdtar (Windows 10+, macOS) writes zip; GNU tar can't, so fall back to PowerShell or zip
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
  ? `\nReady: ${ZIP}\nOn the server: upload it into frontend/out/ (create the folder), Extract, done. No restart needed.`
  : `\nBuilt ${OUT}. Zip its contents yourself (zip creation failed).`);
