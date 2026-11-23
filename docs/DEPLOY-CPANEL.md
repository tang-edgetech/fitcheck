# Deploying Fitcheck on cPanel

| Address | What it is | Runs as |
|---|---|---|
| `https://fitcheck.smartsitecp.com` | The tester (public) | Static files served by Apache (built with `npm run build:static`) |
| `https://fitcheck.smartsitecp.com/admin` | The admin panel, part of the same Next.js app | (same app, nothing extra to set up) |
| `https://fitcheck-api.smartsitecp.com` | The Laravel API and MySQL | PHP |

```
Browser ──► fitcheck.smartsitecp.com (Next.js)
                 │  pages: /  and  /admin
                 └─ /api/* and /sanctum/* forwarded ──► fitcheck-api.smartsitecp.com (Laravel + MySQL)
```

Browsers only ever talk to `fitcheck.smartsitecp.com`. Next.js forwards API calls to Laravel behind the scenes, so sign-in cookies stay on one site.

## Same layout as your computer

The server holds a git copy of the repository, exactly like your computer:

| Your computer | Server (cPanel user `cpadmin99`) | Used for |
|---|---|---|
| `C:\xampp\htdocs\fitcheck\` | `/home/cpadmin99/public_html/fitcheck.smartsitecp.com/` | The git copy (`git pull` here) |
| `…\backend\` | `…/backend/` | The API. **Document root of `https://fitcheck-api.smartsitecp.com`: `…/backend/public`** |
| `…\frontend\` | `…/frontend/` | Site source code. **Document root of `https://fitcheck.smartsitecp.com`: `…/frontend`** |
| `…\frontend\out\` | `…/frontend/out/` | **The built site**, made by `npm run build:static` on your computer and uploaded. Not in git. `frontend/.htaccess` serves it at the domain root |
| `…\deploy\` | `…/deploy/` | Auto-deploy and watchdog scripts (Step 9) |

The site's **domain** points at `frontend/`. Its `.htaccess` (in git) answers every address from `frontend/out/`, the built copy inside it, so the source code is never served.

```
/home/cpadmin99/public_html/fitcheck.smartsitecp.com/     ← git clone (git pull)
├── .htaccess              ← from git: keeps .git/, deploy/, docs/ and the frontend source off the web
├── backend/
│   ├── .htaccess          ← from git: only public/ is reachable; .env and the rest are private
│   ├── .env               ← server only (Step 5), git-ignored
│   ├── vendor/            ← uploaded from your computer (Step 5), git-ignored
│   └── public/            ← document root of fitcheck-api.smartsitecp.com
├── frontend/              ← document root of fitcheck.smartsitecp.com
│   ├── .htaccess          ← from git: serves out/ at the domain root
│   ├── src/ …             ← source, never served
│   └── out/               ← the built site (uploaded in Step 6), git-ignored
│       └── index.html  _next/  admin/  help/ …
├── deploy/                ← deploy.sh, watchdog.sh, deploy.env (server only, git-ignored)
└── docs/
```

**Protection is built in.** Everything above sits inside `public_html`, so the repository's `.htaccess` files keep private things private. Nothing needs adding by hand:

| What | Result |
|---|---|
| `.git/`, `deploy/` (your Telegram token), `docs/`, `README.md` | 404 |
| On `fitcheck.smartsitecp.com`: `/src/…`, `/package.json`, `/next.config.ts`, `/node_modules/…` | 404 |
| `backend/.env` | 403 |
| Any other file under `backend/` (`vendor/`, `config/`, …) | Laravel's 404 page |

Every page (`/`, `/admin/`, `/_next/…`, `/help/…`) is answered from `frontend/out/`. All of these rules were checked against the site's real addresses and tested with Apache.

## Before you start

- **No Node.js is needed on the server.** The site is built on your computer (Step 6).
- **PHP 8.3 or newer** for `fitcheck-api.smartsitecp.com`, with `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `ctype`, `fileinfo`, `iconv`, `dom`, `xml`, `filter`, `session`.
- **MySQL**, and **Terminal** (cPanel → Advanced) or SSH.
- On your computer: Node.js and Composer (you already have both).

Your server's IP (cPanel → General Information → **Shared IP Address**; your Terminal prompt suggests `172.105.114.252`) is only needed if you ever switch to a Node.js host.

---

## Step 1 — Clone the repository

The repository is private, so the server needs a read-only **deploy key**. That key is also what lets cron pull updates later (Step 9). In cPanel → **Terminal**:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/fitcheck_deploy -N "" -C "fitcheck deploy"
cat ~/.ssh/fitcheck_deploy.pub
```

On GitHub: `tang-edgetech/fitcheck` → **Settings → Deploy keys → Add deploy key**. Paste the line that was printed, and leave **Allow write access off**. Then:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github-fitcheck
  HostName github.com
  User git
  IdentityFile ~/.ssh/fitcheck_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

cd ~/public_html
# Start clean: move away an old copy of the folder if there is one (delete it later when all works)
[ -e fitcheck.smartsitecp.com ] && mv fitcheck.smartsitecp.com fitcheck.smartsitecp.com.old-$(date +%Y%m%d%H%M)
git clone git@github-fitcheck:tang-edgetech/fitcheck.git fitcheck.smartsitecp.com
ls fitcheck.smartsitecp.com      # backend  deploy  docs  frontend  README.md
```

The first connection asks "Are you sure you want to continue connecting?". Type `yes`.

To get the latest version at any time:

```bash
cd ~/public_html/fitcheck.smartsitecp.com
git pull
```

## Step 2 — Subdomains and document roots

cPanel → **Domains** → create or **Manage** each subdomain:

| Subdomain | Document root |
|---|---|
| `fitcheck.smartsitecp.com` | `public_html/fitcheck.smartsitecp.com/frontend` |
| `fitcheck-api.smartsitecp.com` | `public_html/fitcheck.smartsitecp.com/backend/public` |

If either subdomain already existed pointing elsewhere, use **Manage** to change its document root to the value above.

Then cPanel → **MultiPHP Manager** → tick `fitcheck-api.smartsitecp.com` → **PHP 8.3** → Apply.

## Step 3 — PHP 8.3 in Terminal

MultiPHP Manager only changes PHP for the **website**. The `php` command in Terminal stays on the server's default (8.2 on your server), and Composer and `artisan` refuse to run on it. Point `php` at 8.3:

```bash
ls -d /opt/cpanel/ea-php8*/root/usr/bin/php /opt/alt/php8*/usr/bin/php 2>/dev/null   # find PHP 8.3
echo 'alias php=/opt/cpanel/ea-php83/root/usr/bin/php' >> ~/.bashrc && source ~/.bashrc
php -v                                                                                # must say 8.3.x
```

Use `/opt/alt/php83/usr/bin/php` instead if that's what the first command shows. Cron jobs don't read `~/.bashrc`, so they use the full path (Steps 5 and 9).

## Step 4 — Database

cPanel → **MySQL Database Wizard**:
1. Create the database `cpadmin99_fitcheck`.
2. Create the user `cpadmin99_fitcheck` with a strong password.
3. Give the user **All Privileges** on the database.

## Step 5 — The API (`backend/`)

### 5a. `vendor/` from your computer
GitHub refuses Composer downloads from the server's shared IP ("Your account was suspended … provide a GitHub access token"). So build the PHP packages on your computer and upload them. In PowerShell, in `C:\xampp\htdocs\fitcheck`:

```powershell
cd backend
composer install --no-dev --optimize-autoloader
```

```powershell
& C:\Windows\System32\tar.exe -a -c -f ..\vendor.zip vendor
```

```powershell
composer install
```

The last command restores your local development packages.

On the server: File Manager → `public_html/fitcheck.smartsitecp.com/backend` → **Upload** `vendor.zip` → right-click → **Extract** → delete the zip. Check that `backend/vendor/autoload.php` exists.

Redo 5a only when `backend/composer.lock` changes (when PHP packages are added or updated).

### 5b. `.env`
```bash
cd ~/public_html/fitcheck.smartsitecp.com/backend
cp -n .env.production.example .env
nano .env
```

Set these:
- `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`: the values from Step 4. Put the password in **single quotes**, for example `DB_PASSWORD='p@ss&$word'`, so characters like `$`, `&` and `~` are read literally.
- Check these lines, which are already in the example. They let the site call the API directly (Step 6):
  ```
  SESSION_DOMAIN=.smartsitecp.com
  CORS_ALLOWED_ORIGINS=https://fitcheck.smartsitecp.com
  SANCTUM_STATEFUL_DOMAINS=fitcheck.smartsitecp.com
  ```
- `DEFAULT_ADMIN_PASSWORD`: a strong one-off password for the three starting accounts.
- Leave `APP_KEY` empty; the next command fills it in.

### 5c. Install
```bash
cd ~/public_html/fitcheck.smartsitecp.com/backend
mkdir -p storage/framework/sessions storage/framework/views storage/framework/cache/data storage/logs bootstrap/cache
php artisan key:generate --force
php artisan migrate --force
php artisan db:seed --force             # creates dev-admin, dev-admin-1, super-admin, the devices and menu groups
php artisan config:cache
php artisan route:cache
chmod -R 775 storage bootstrap/cache
chmod 600 .env
```

### 5d. HTTPS and cron
- **HTTPS:** cPanel → **SSL/TLS Status** → tick both subdomains → **Run AutoSSL**.
- **Cron:** cPanel → **Cron Jobs** → **Once Per Minute**:
  ```bash
  cd /home/cpadmin99/public_html/fitcheck.smartsitecp.com/backend && /opt/cpanel/ea-php83/root/usr/bin/php artisan schedule:run >> /dev/null 2>&1
  ```
  This clears old system-log entries daily (Settings → Log).

### 5e. Test
- `https://fitcheck-api.smartsitecp.com/up` → green "Application up".
- `https://fitcheck-api.smartsitecp.com/api/public/screen-views` → JSON with `families` and `site`.
- `https://fitcheck-api.smartsitecp.com/.env` → 403 or 404, never the file's text.

## Step 6 — The site (static files, no Node.js needed)

Your cPanel has no **Setup Node.js App**, so the site is built as plain files on your computer and Apache serves them. Every page of Fitcheck works this way. The browser then calls `https://fitcheck-api.smartsitecp.com` directly, and Laravel allows that for your site only, through the `CORS_ALLOWED_ORIGINS` and `SESSION_DOMAIN` lines in 5b.

### 6a. Build on your computer
In PowerShell, in `C:\xampp\htdocs\fitcheck\frontend`:

```powershell
$env:NEXT_PUBLIC_API_URL="https://fitcheck-api.smartsitecp.com"; npm run build:static
```

This creates **`frontend/fitcheck-site.zip`** (about 2 MB).

### 6b. Upload
File Manager → `public_html/fitcheck.smartsitecp.com/frontend`:
1. Create a folder **`out`**. If it already exists, open it and delete its contents first.
2. Open `out/`, **Upload** `fitcheck-site.zip`, right-click → **Extract**, then delete the zip.
3. Check that `frontend/out/index.html` and `frontend/out/_next/` exist.

There's nothing to start or restart. `frontend/.htaccess` (from git) serves `out/` at the domain's root, and never serves the source code.

### 6c. Test
- `https://fitcheck.smartsitecp.com` → the tester loads its device tabs.
- `https://fitcheck.smartsitecp.com/admin/` → the sign-in page.
- `https://fitcheck.smartsitecp.com/help/Fitcheck-Admin-Handbook.pdf` → the handbook.
- `https://fitcheck.smartsitecp.com/package.json` → 404 (the source stays private).

If the tester says "Could not load the device list", check 5e, and check that `.env` has the `CORS_ALLOWED_ORIGINS` and `SESSION_DOMAIN` lines. After any `.env` change, run `php artisan config:cache`.

> **If your host later adds Setup Node.js App:**
> 1. Create an app with root `public_html/fitcheck.smartsitecp.com/frontend/dist-cpanel` and startup file `server.js`.
> 2. Build with `npm run build:cpanel`.
> 3. Delete `frontend/.htaccess`, because cPanel writes its own.
> 4. Set `SESSION_DOMAIN=null` in `.env` and `SITE_MODE=node` in `deploy.env`.

## Step 7 — First sign-in to `/admin`

1. Go to `https://fitcheck.smartsitecp.com/admin` and sign in as `dev-admin` with `DEFAULT_ADMIN_PASSWORD`.
2. Choose a new password, and add your email and display name.
3. Do the same for `dev-admin-1` and `super-admin`, or turn off any you don't need (Users → Status switch).
4. Open **Audit log**. Your sign-in should show **your** public IP.
5. Recommended: **Settings → Security** → **Require two-factor sign-in for everyone**.
6. Remove `DEFAULT_ADMIN_PASSWORD` from `.env`, then run `php artisan config:cache`.

---

## Step 8 — Updating by hand

```bash
cd ~/public_html/fitcheck.smartsitecp.com
git pull
```

Then, depending on what changed:
- **`backend/`:**
  ```bash
  cd backend
  php artisan migrate --force
  php artisan config:cache
  php artisan route:cache
  ```
  If `backend/composer.lock` changed, redo 5a first.
- **`frontend/`:** on your computer, run `git pull`, then `$env:NEXT_PUBLIC_API_URL="https://fitcheck-api.smartsitecp.com"; npm run build:static`. Upload the new `fitcheck-site.zip` into `frontend/out/` as in 6b (delete the old contents first).

Step 9 does the `backend/` part automatically.

> Don't edit files that are tracked in git directly on the server, such as `backend/public/.htaccess`. `git pull` and `deploy.sh` would conflict with or undo those edits. Server-only settings belong in `backend/.env` and `deploy/deploy.env`.

## Step 9 — Automatic deploys and Telegram alerts

| Script | Cron | What it does |
|---|---|---|
| `deploy/deploy.sh` | every 5 min | If `main` on GitHub has new commits: updates the git copy, and in `backend/` runs migrations (in maintenance mode) and refreshes caches. With `DEPLOY_SITE=1` (only if the server has `npm`), it also rebuilds `frontend/out` when `frontend/` changed. Then it checks the live site. Posts 🚀 / ✅ / 🔴 to Telegram. Silent when nothing changed. |
| `deploy/watchdog.sh` | every 5 min | Checks the tester, `/admin`, the API, HTTPS expiry, disk space and new Laravel errors. Posts 🔴 once when something fails twice in a row, and 🟢 when it recovers. |
| `deploy/watchdog.sh --report` | daily | 📋 summary of every check. |

### 9a. GitHub access for cron ✅
The deploy key from Step 1 lets cron fetch without a password. Check it once:

```bash
cd ~/public_html/fitcheck.smartsitecp.com
git fetch          # must finish without asking for anything
```

### 9b. Telegram bot, group and topic
1. In Telegram, message **@BotFather** → `/newbot`. Copy the **bot token**.
2. Add the bot to your group. Make sure **Topics** is on and the bot can post (making it an admin is simplest).
3. In the topic, tap a message → **Copy Message Link**. You get `https://t.me/c/1234567890/55/60` or `https://t.me/c/1234567890/60?thread=55`:
   - chat id = `-100` + the first number → `-1001234567890`
   - thread id = the topic number → `55`

### 9c. Settings
```bash
cd ~/public_html/fitcheck.smartsitecp.com/deploy
cp deploy.env.example deploy.env
chmod 600 deploy.env
nano deploy.env
```

The paths in the example already match this server. Check or fill in:
- **`SITE_MODE=static`** and **`DEPLOY_SITE=0`** (the defaults): API changes deploy automatically; the site you build and upload yourself (Step 8).
- **`COMPOSER_BIN`:** the result of `which composer`, run with PHP 8.3.
- **Telegram:** the token, chat id and thread id from 9b.

`deploy.env` is git-ignored and blocked from the web.

### 9d. Test, then add cron jobs
```bash
cd ~/public_html/fitcheck.smartsitecp.com
bash deploy/watchdog.sh --test            # a test message appears in the topic
bash deploy/deploy.sh --dry-run --force   # shows what it would do; should say "API in place: 1"
```

cPanel → **Cron Jobs**:

| Common setting | Command |
|---|---|
| Every 5 minutes (`*/5 * * * *`) | `/bin/bash /home/cpadmin99/public_html/fitcheck.smartsitecp.com/deploy/deploy.sh >/dev/null 2>&1` |
| Every 5 minutes (`*/5 * * * *`) | `/bin/bash /home/cpadmin99/public_html/fitcheck.smartsitecp.com/deploy/watchdog.sh >/dev/null 2>&1` |
| Once a day (`0 9 * * *`) | `/bin/bash /home/cpadmin99/public_html/fitcheck.smartsitecp.com/deploy/watchdog.sh --report >/dev/null 2>&1` |

**From now on, deploying is just:** push to `main` on GitHub. Within about 5 minutes the topic shows 🚀, then ✅, or 🔴 with the failed step. Logs are in `~/fitcheck-deploy-state/`, created automatically.

- **What it never does:** run the seeders (so it can't reset passwords or bring back deleted accounts), or touch `.env`, `vendor/`, `storage/` or `frontend/out/`.

---

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Composer: "your php version (8.2.x) does not satisfy that requirement" | Terminal uses the server's default PHP. Do Step 3. |
| Composer: "Could not fetch https://api.github.com/… provide a GitHub access token" | GitHub blocks downloads from the server's shared IP. Press Ctrl+C, then upload `vendor/` from your computer (5a). |
| Site shows "Index of", a 403, or a blank page | The document root of `fitcheck.smartsitecp.com` isn't `…/frontend`, `frontend/.htaccess` is missing (run `git pull`), or `frontend/out/` is empty or has an extra folder level (`out/index.html` must exist). |
| API addresses show the Next.js site, or a Node.js error | The API's document root isn't `…/backend/public`, or `backend/.htaccess` is missing (run `git pull`). |
| Tester says "Could not load the device list" | The API is down or not on HTTPS yet (check 5e). Or `.env` lacks `CORS_ALLOWED_ORIGINS=https://fitcheck.smartsitecp.com` (run `php artisan config:cache` after adding it). Or the site was built without `NEXT_PUBLIC_API_URL`. |
| Sign-in fails with "page expired" (419) or loops | `.env` needs `SESSION_DOMAIN=.smartsitecp.com`, `SANCTUM_STATEFUL_DOMAINS=fitcheck.smartsitecp.com` and `CORS_ALLOWED_ORIGINS=https://fitcheck.smartsitecp.com`, both sites on HTTPS. Run `php artisan config:cache` after any `.env` edit, and clear the browser's cookies for smartsitecp.com once. |
| API returns 500 | `APP_KEY` missing, wrong database details, `vendor/` missing, or `storage` not writable. See `backend/storage/logs/`. |
| `git pull` says local changes would be overwritten | A tracked file was edited on the server. Run `git status` to see it, then `git checkout -- <file>`. Keep server settings in `.env` and `deploy.env`. |
| No Telegram messages | Run `bash deploy/watchdog.sh --test` and read `~/fitcheck-deploy-state/watchdog.log`. Check the chat id starts with `-100`, the bot is in the group and can post, and the thread id is right. |
| Deploys never start | `git fetch` must work without a password (9a). `COMPOSER_BIN`, `PHP_BIN` and `NODE_ACTIVATE` must be full paths. |
