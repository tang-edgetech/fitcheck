# Deploying Fitcheck on cPanel

| Address | What it is | Runs as |
|---|---|---|
| `https://fitcheck.smartsitecp.com` | The tester (public) | cPanel **Setup Node.js App** (Next.js) |
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
| `…\frontend\dist-cpanel\` | `…/frontend/dist-cpanel/` | **The built site**, made by `npm run build:cpanel` and not in git. **Setup Node.js App "Application root"** |
| `…\deploy\` | `…/deploy/` | Auto-deploy and watchdog scripts (Step 9) |

The site's **domain** points at `frontend/`, while the **Node.js app** runs from `frontend/dist-cpanel/`, the built copy inside it. cPanel allows the two to differ. The source code itself can't run as a website.

```
/home/cpadmin99/public_html/fitcheck.smartsitecp.com/     ← git clone (git pull)
├── .htaccess              ← from git: keeps .git/, deploy/, docs/ and the frontend source off the web
├── backend/
│   ├── .htaccess          ← from git: only public/ is reachable; .env and the rest are private
│   ├── .env               ← server only (Step 5), git-ignored
│   ├── vendor/            ← uploaded from your computer (Step 5), git-ignored
│   └── public/            ← document root of fitcheck-api.smartsitecp.com
├── frontend/              ← document root of fitcheck.smartsitecp.com
│   ├── .htaccess          ← written by Setup Node.js App (connects the domain to the app), git-ignored
│   ├── src/ …             ← source, never served
│   └── dist-cpanel/       ← Node.js app root (built in Step 6)
│       └── server.js  .next/  node_modules/  public/
├── deploy/                ← deploy.sh, watchdog.sh, deploy.env (server only, git-ignored)
└── docs/
```

**Protection is built in.** Everything above sits inside `public_html`, so the repository's `.htaccess` files keep private things private. Nothing needs adding by hand:

| What | Result |
|---|---|
| `.git/`, `deploy/` (your Telegram token), `docs/`, `README.md` | 404 |
| On `fitcheck.smartsitecp.com`: `/src/…`, `/package.json`, `/next.config.ts`, `/dist-cpanel/…`, `/node_modules/…` | 404 |
| `backend/.env` | 403 |
| Any other file under `backend/` (`vendor/`, `config/`, …) | Laravel's 404 page |

Every page (`/`, `/admin`, `/_next/…`, `/help/…`) is answered by the Node.js app. All of these rules were checked against the app's real addresses and tested with Apache.

## Before you start

- **Setup Node.js App** in cPanel (Software section), with Node.js **20.9 or newer** (22 is best).
- **PHP 8.3 or newer** for `fitcheck-api.smartsitecp.com`, with `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `ctype`, `fileinfo`, `iconv`, `dom`, `xml`, `filter`, `session`.
- **MySQL**, and **Terminal** (cPanel → Advanced) or SSH.
- On your computer: Node.js and Composer (you already have both).

Server IP for `TRUSTED_PROXIES` below: cPanel → General Information → **Shared IP Address**. Your Terminal prompt suggests `172.105.114.252`.

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
- `TRUSTED_PROXIES=172.105.114.252,127.0.0.1,::1`, using your server IP.
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

## Step 6 — The site (`frontend/` → `frontend/dist-cpanel/`)

The domain points at `frontend/` (Step 2), but the site **runs** from its built copy in `frontend/dist-cpanel/`. So that's where the Node.js app's root goes.

### 6a. Create the Node.js app
cPanel → **Setup Node.js App** → **Create Application**:

| Field | Value |
|---|---|
| Node.js version | 22.x (or 20.x, at least 20.9) |
| Application mode | Production |
| Application root | `public_html/fitcheck.smartsitecp.com/frontend/dist-cpanel` |
| Application URL | `fitcheck.smartsitecp.com` |
| Application startup file | `server.js` |

Under **Environment variables**, add `NODE_ENV` = `production` and `HOSTNAME` = `127.0.0.1`. Then select **Create**, and **Stop App** for now.

cPanel then:
- writes an `.htaccess` into `frontend/` (the domain's document root) that connects the domain to the app. Keep it; it's git-ignored, so `git pull` never touches it.
- may put a sample `server.js` in `dist-cpanel/`. The build in 6b replaces it.

**Never** select "Run NPM Install".

### 6b. Build the site
**Option A: build on the server.** Simplest for updates. At the top of the app's page in Setup Node.js App, cPanel shows a command starting with `source /home/cpadmin99/nodevenv/…/activate`. Copy and run it, then:

```bash
cd ~/public_html/fitcheck.smartsitecp.com/frontend
npm ci
NO_ZIP=1 BACKEND_URL=https://fitcheck-api.smartsitecp.com npm run build:cpanel
```

This fills `frontend/dist-cpanel/`. `npm ci` downloads from the npm registry, not GitHub, so it isn't blocked.

**Option B: build on your computer.** Use this if the server stops the build for using too much memory (it gets "Killed", or exit code 137):

```powershell
cd frontend
$env:BACKEND_URL="https://fitcheck-api.smartsitecp.com"; npm run build:cpanel
```

Upload `frontend/fitcheck-frontend.zip` into `public_html/fitcheck.smartsitecp.com/frontend/dist-cpanel` and **Extract** it (overwrite).

Either way, `dist-cpanel/` must now contain `server.js`, `.next/`, `node_modules/` and `public/`.

### 6c. Start and test
In Setup Node.js App, select **Start App**. Then check:
- `https://fitcheck.smartsitecp.com` → the tester loads its device tabs.
- `https://fitcheck.smartsitecp.com/admin` → the sign-in page.
- `https://fitcheck.smartsitecp.com/help/Fitcheck-Admin-Handbook.pdf` → the handbook.
- `https://fitcheck.smartsitecp.com/package.json` and `/src/app/page.tsx` → 404 (the source stays private).

## Step 7 — First sign-in to `/admin`

1. Go to `https://fitcheck.smartsitecp.com/admin` and sign in as `dev-admin` with `DEFAULT_ADMIN_PASSWORD`.
2. Choose a new password, and add your email and display name.
3. Do the same for `dev-admin-1` and `super-admin`, or turn off any you don't need (Users → Status switch).
4. Open **Audit log**. Your sign-in should show **your** public IP. If it shows the server's IP, fix `TRUSTED_PROXIES` in `.env` and run `php artisan config:cache`.
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
- **`frontend/`:** run the nodevenv `source …` command, then:
  ```bash
  cd frontend
  npm ci
  NO_ZIP=1 BACKEND_URL=https://fitcheck-api.smartsitecp.com npm run build:cpanel
  ```
  Then **Restart** the app in Setup Node.js App.

Step 9 does all of this automatically.

> Don't edit files that are tracked in git directly on the server, such as `backend/public/.htaccess`. `git pull` and `deploy.sh` would conflict with or undo those edits. Server-only settings belong in `backend/.env` and `deploy/deploy.env`.

## Step 9 — Automatic deploys and Telegram alerts

| Script | Cron | What it does |
|---|---|---|
| `deploy/deploy.sh` | every 5 min | If `main` on GitHub has new commits: updates the git copy, and in `backend/` runs migrations (in maintenance mode) and refreshes caches. Rebuilds `frontend/dist-cpanel` and restarts the app if `frontend/` changed, then checks the live site. Posts 🚀 / ✅ / 🔴 to Telegram. Silent when nothing changed. |
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
- **`COMPOSER_BIN`:** the result of `which composer`, run with PHP 8.3.
- **`NODE_ACTIVATE`:** the `…/activate` path from the command in 6b.
- **Telegram:** the token, chat id and thread id from 9b.

`deploy.env` is git-ignored and blocked from the web.

### 9d. Test, then add cron jobs
```bash
cd ~/public_html/fitcheck.smartsitecp.com
bash deploy/watchdog.sh --test            # a test message appears in the topic
bash deploy/deploy.sh --dry-run --force   # shows what it would do; should say "API in place: 1, site in place: 1"
```

cPanel → **Cron Jobs**:

| Common setting | Command |
|---|---|
| Every 5 minutes (`*/5 * * * *`) | `/bin/bash /home/cpadmin99/public_html/fitcheck.smartsitecp.com/deploy/deploy.sh >/dev/null 2>&1` |
| Every 5 minutes (`*/5 * * * *`) | `/bin/bash /home/cpadmin99/public_html/fitcheck.smartsitecp.com/deploy/watchdog.sh >/dev/null 2>&1` |
| Once a day (`0 9 * * *`) | `/bin/bash /home/cpadmin99/public_html/fitcheck.smartsitecp.com/deploy/watchdog.sh --report >/dev/null 2>&1` |

**From now on, deploying is just:** push to `main` on GitHub. Within about 5 minutes the topic shows 🚀, then ✅, or 🔴 with the failed step. Logs are in `~/fitcheck-deploy-state/`, created automatically.

- **Memory:** if the server can't build the site (the deploy fails at "Build site" with exit 137), set `DEPLOY_SITE=0` in `deploy.env`. API changes keep deploying automatically, and you build the site with Option B in 6b.
- **What it never does:** run the seeders (so it can't reset passwords or bring back deleted accounts), or touch `.env`, `vendor/`, `storage/` or cPanel's files in `dist-cpanel/`.

---

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Composer: "your php version (8.2.x) does not satisfy that requirement" | Terminal uses the server's default PHP. Do Step 3. |
| Composer: "Could not fetch https://api.github.com/… provide a GitHub access token" | GitHub blocks downloads from the server's shared IP. Press Ctrl+C, then upload `vendor/` from your computer (5a). |
| `npm run build:cpanel` on the server: "Killed" or exit 137 | Not enough memory. Use Option B in 6b, and set `DEPLOY_SITE=0` for Step 9. |
| Site shows a Passenger / "Incomplete response" error | Node.js older than 20.9, or `dist-cpanel/` is missing `server.js` or `.next/`. See `dist-cpanel/stderr.log`. |
| Site shows "Index of" or a 403 | The document root of `fitcheck.smartsitecp.com` isn't `…/frontend`, the app's root isn't `…/frontend/dist-cpanel`, or the `.htaccess` cPanel writes into `frontend/` is missing. Edit and Save the app in Setup Node.js App to write it again. |
| API addresses show the Next.js site, or a Node.js error | The API's document root isn't `…/backend/public`, or `backend/.htaccess` is missing (run `git pull`). |
| Tester says "Could not load the device list" | Built with the wrong `BACKEND_URL`, or the API is down or not on HTTPS yet. Check 5e. |
| Sign-in fails with "page expired" (419) or loops | `SANCTUM_STATEFUL_DOMAINS` must be exactly `fitcheck.smartsitecp.com`, on HTTPS. Run `php artisan config:cache` after any `.env` edit. |
| API returns 500 | `APP_KEY` missing, wrong database details, `vendor/` missing, or `storage` not writable. See `backend/storage/logs/`. |
| Everyone gets "Too many failed attempts" together | `TRUSTED_PROXIES` doesn't include the server IP (Step 7, item 4). |
| `git pull` says local changes would be overwritten | A tracked file was edited on the server. Run `git status` to see it, then `git checkout -- <file>`. Keep server settings in `.env` and `deploy.env`. |
| No Telegram messages | Run `bash deploy/watchdog.sh --test` and read `~/fitcheck-deploy-state/watchdog.log`. Check the chat id starts with `-100`, the bot is in the group and can post, and the thread id is right. |
| Deploys never start | `git fetch` must work without a password (9a). `COMPOSER_BIN`, `PHP_BIN` and `NODE_ACTIVATE` must be full paths. |
