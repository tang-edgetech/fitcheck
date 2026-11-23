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

Browsers only ever talk to `fitcheck.smartsitecp.com`. Next.js forwards API calls to Laravel behind the scenes, so sign-in cookies stay on one site and no cross-site setup is needed.

## Which folder goes where

Server account: **`cpadmin99`**. Both apps live in one folder:

```
/home/cpadmin99/public_html/fitcheck.smartsitecp.com/
├── frontend/      ← fitcheck.smartsitecp.com      (Setup Node.js App root and the domain's document root)
└── backend/       ← fitcheck-api.smartsitecp.com  (document root: backend/public)
```

| In the repository | What it is | On the server | Serves |
|---|---|---|---|
| `backend/` | Laravel API (PHP) | `public_html/fitcheck.smartsitecp.com/backend/`: the **contents** of `backend/`, uploaded as they are | `fitcheck-api.smartsitecp.com`, document root **`…/backend/public`** |
| `frontend/` | Next.js site: tester and `/admin` | `public_html/fitcheck.smartsitecp.com/frontend/`: **not** the `frontend/` folder itself, but the package built from it (`frontend/fitcheck-frontend.zip`) | `fitcheck.smartsitecp.com` (Setup Node.js App) |
| `docs/`, `deploy/` | Guides and scripts | Not uploaded. `deploy/` runs from a git copy of the repository in Part D. | — |

After setup, the server looks like this:

```
/home/cpadmin99/
├── public_html/fitcheck.smartsitecp.com/
│   ├── backend/                  ← contents of the repo's backend/
│   │   ├── .htaccess             ← from the repo: keeps everything except public/ private
│   │   ├── .env                  ← created on the server (A6), never uploaded
│   │   ├── app/  bootstrap/  config/  database/  routes/  storage/  vendor/  artisan …
│   │   └── public/               ← web root of fitcheck-api.smartsitecp.com
│   └── frontend/                 ← contents of fitcheck-frontend.zip (built from frontend/)
│       ├── .htaccess             ← written by Setup Node.js App (keep it), plus the lines from B5
│       ├── server.js             ← startup file
│       └── .next/  node_modules/  public/  package.json
├── fitcheck-src/                 ← only with Part D: a git clone of the whole repository (outside public_html)
└── fitcheck-deploy-state/        ← only with Part D: deploy and watchdog logs
```

### Why the apps are safe inside `public_html`
Folders under `public_html` can be reached from the web, so two protections are built in:
- **`backend/.htaccess`** (in the repository) refuses hidden files such as `.env`, and sends every other request to `public/`. `vendor/`, `storage/`, `config/` and the rest can never be downloaded. It also switches off the Node.js app settings inherited from parent folders, so they can't take over the API. I checked it with Apache: `.env` returns 403, and `composer.json` or `vendor/…` only reach Laravel's 404 page.
- **Lines added in B5** to `frontend/.htaccess` hide `server.js`, `.next/` and `node_modules/`.

**First setup:** do Part A (`backend/` → API), then Part B (`frontend/` → site), then Part C (first sign-in to `/admin`). **Optional:** Part D makes later updates automatic when you push to GitHub, and adds Telegram alerts.

## Before you start

**On the cPanel account**
- **Setup Node.js App** in cPanel (Software section), with Node.js **20.9 or newer** (22 is best). Without it, the Next.js app can't run on this hosting.
- **PHP 8.3 or newer**, with these extensions: `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `ctype`, `fileinfo`, `iconv`, `dom`, `xml`, `filter`, `session`.
- **MySQL** (or MariaDB).
- **Terminal** in cPanel (Advanced section) or SSH access. You need it to run a few `php artisan` commands. If it's missing, ask your host to enable it.

**On your computer** (where the project is): Node.js, Composer, and this repository.

Replace `SERVER-IP` below with the server's IP (cPanel → General Information → **Shared IP Address**).

---

## Part A — `fitcheck-api.smartsitecp.com` (Laravel API, from the repo's `backend/`)

### A1. Subdomain and document root
cPanel → **Domains**. Create `fitcheck-api.smartsitecp.com`, or select **Manage** if it already exists. Set its **document root** to:

```
public_html/fitcheck.smartsitecp.com/backend/public
```

The document root must end in `/public`. That folder holds Laravel's `index.php`; everything above it stays private. If the document root is left at `…/backend`, `backend/.htaccess` still forwards requests to `public/` and blocks the rest, but `…/backend/public` is the safe, standard setup.

### A2. PHP version and extensions
1. cPanel → **MultiPHP Manager** → tick `fitcheck-api.smartsitecp.com` → PHP **8.3** (or newer) → Apply.
2. cPanel → **Select PHP Version** (if your host has it) → **Extensions**: make sure the extensions listed above are ticked.

### A3. Database
1. cPanel → **MySQL Database Wizard**.
2. Create the database `cpadmin99_fitcheck`, then a user `cpadmin99_fitcheck` with a strong password.
3. Give the user **All Privileges** on the database. Keep the names and password for A6.

### A4. Prepare the files on your computer
Install only what production needs, so the upload includes a ready `vendor` folder:

```powershell
cd backend
composer install --no-dev --optimize-autoloader
```

Then zip everything **inside** `backend/`, so that `app/`, `public/`, `artisan` and so on sit at the top level of the zip, not inside a `backend/` folder:

```powershell
# still inside backend/. Uses Windows' own tar, which works even while files are in use.
# Leaves out your local .env, logs and caches.
& C:\Windows\System32\tar.exe -a -c -f ..\fitcheck-backend.zip --exclude ./.env --exclude ./node_modules --exclude './storage/logs/*.log' --exclude './storage/framework/sessions/*' --exclude './storage/framework/views/*.php' --exclude './storage/framework/cache/data/*' --exclude './bootstrap/cache/*.php' .
```

This creates `fitcheck-backend.zip` next to the `backend/` folder (about 15–20 MB). It includes `vendor/`, `.htaccess` and `.env.production.example`, and **not** your local `.env`.

Afterwards, restore the development packages locally:

```powershell
composer install
```

> If cPanel Terminal has `composer`, you can upload without `vendor` and run `composer install --no-dev --optimize-autoloader` on the server instead.

### A5. Upload
1. cPanel → **File Manager** → turn on **Settings → Show Hidden Files** → open `public_html/fitcheck.smartsitecp.com/backend`.
2. **Upload** `fitcheck-backend.zip`, then right-click → **Extract** (into this same folder). Delete the zip afterwards.
3. Check that `.htaccess`, `app/`, `public/`, `vendor/` and `artisan` are directly inside `backend/`, and that `backend/public/index.php` exists. If they landed in a `backend/backend/` subfolder, the zip was made from the folder instead of its contents: move them up one level.

### A6. Settings (`.env`)
In `backend/`, copy `.env.production.example` to **`.env`** and edit it:
- `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`: the values from A3.
- `TRUSTED_PROXIES=SERVER-IP,127.0.0.1,::1`
- `DEFAULT_ADMIN_PASSWORD`: a strong one-off password for the three starting accounts.
- Leave `APP_KEY` empty; the next step fills it in.

### A7. Install
cPanel → **Terminal**:

```bash
cd ~/public_html/fitcheck.smartsitecp.com/backend
php -v                                  # must say 8.3 or newer; if not, use the full path shown in A9
mkdir -p storage/framework/sessions storage/framework/views storage/framework/cache/data storage/logs bootstrap/cache
php artisan key:generate --force
php artisan migrate --force
php artisan db:seed --force             # creates dev-admin, dev-admin-1, super-admin, the devices and menu groups
php artisan config:cache
php artisan route:cache
chmod -R 775 storage bootstrap/cache
chmod 600 .env
```

`db:seed` is safe to run again later: it only adds what's missing.

### A8. HTTPS
cPanel → **SSL/TLS Status** → tick both subdomains → **Run AutoSSL**. Wait until both show a valid certificate.

### A9. Scheduled clean-up (cron)
cPanel → **Cron Jobs** → Common settings: **Once Per Minute**. Command:

```bash
cd /home/cpadmin99/public_html/fitcheck.smartsitecp.com/backend && /opt/cpanel/ea-php83/root/usr/bin/php artisan schedule:run >> /dev/null 2>&1
```

Use the PHP path for your version: run `ls /opt/cpanel/` in Terminal to see `ea-php83`, `ea-php84` and so on. Some hosts use `/usr/local/bin/php` instead. The job deletes old system-log entries daily (Settings → Log).

### A10. Test the API
- `https://fitcheck-api.smartsitecp.com/up` shows a green "Application up" page.
- `https://fitcheck-api.smartsitecp.com/api/public/screen-views` shows JSON with `families` and `site`.
- `https://fitcheck-api.smartsitecp.com/.env` must give **403 Forbidden** or **404**, never the file's text.

---

## Part B — `fitcheck.smartsitecp.com` (site and admin panel, built from the repo's `frontend/`)

Don't upload the `frontend/` folder itself (its source code can't run as is). You build it into one zip on your computer (B2) and upload only that.

### B1. Subdomain and document root
cPanel → **Domains** → create or **Manage** `fitcheck.smartsitecp.com`, with the document root:

```
public_html/fitcheck.smartsitecp.com/frontend
```

### B2. Build the upload package on your computer
The API address is built into the package, so build it with the live address:

```powershell
cd frontend
$env:BACKEND_URL="https://fitcheck-api.smartsitecp.com"; npm run build:cpanel
```

This creates **`frontend/fitcheck-frontend.zip`** (about 8 MB). It contains `server.js`, a hidden `.next` folder, `public` (with the help pictures and handbook PDF) and only the `node_modules` the server needs.

### B3. Create the Node.js app
cPanel → **Setup Node.js App** → **Create Application**:

| Field | Value |
|---|---|
| Node.js version | 22.x (or 20.x, at least 20.9) |
| Application mode | Production |
| Application root | `public_html/fitcheck.smartsitecp.com/frontend` |
| Application URL | `fitcheck.smartsitecp.com` |
| Application startup file | `server.js` |

Under **Environment variables**, add `NODE_ENV` = `production` and `HOSTNAME` = `127.0.0.1`. Then select **Create**.

cPanel writes an `.htaccess` into `frontend/` that connects the domain to the app. **Keep that file**; never delete it.

### B4. Upload
1. In Setup Node.js App, select **Stop App**.
2. File Manager (hidden files shown) → `public_html/fitcheck.smartsitecp.com/frontend` → delete any sample files cPanel created (such as `app.js`), but **not** `.htaccess`.
3. **Upload** `fitcheck-frontend.zip` → right-click → **Extract** → delete the zip.
4. Check that `server.js`, `.next/`, `node_modules/` and `public/` are directly inside `frontend/`, not in a subfolder. There should be **no** `src/` folder; that would mean the source `frontend/` folder was uploaded instead of the zip.
5. Back in Setup Node.js App, select **Start App** (or **Restart**).

**Don't** select "Run NPM Install". The package already contains everything it needs.

### B5. Hide the app's own files
`frontend/` is both the app and the domain's document root, so Apache could otherwise hand out `server.js` or files in `.next/` directly. Edit `frontend/.htaccess` and add these lines **below** cPanel's `CLOUDLINUX PASSENGER CONFIGURATION` block. Don't change that block.

```apache
# Fitcheck: the app's own files are not for download (Next.js serves /_next/ and public/ itself)
RedirectMatch 404 /(server\.js|package\.json|DEPLOY-INFO\.txt|\.next|node_modules)(/|$)
```

### B6. Test the site
- `https://fitcheck.smartsitecp.com`: the tester loads with its device tabs. Paste a link and select Show.
- `https://fitcheck.smartsitecp.com/admin`: opens the sign-in page.
- `https://fitcheck.smartsitecp.com/help/Fitcheck-Admin-Handbook.pdf`: the handbook opens.
- `https://fitcheck.smartsitecp.com/server.js`: must give **404**.

---

## Part C — First sign-in to `/admin`

1. Go to `https://fitcheck.smartsitecp.com/admin` and sign in as `dev-admin` with the `DEFAULT_ADMIN_PASSWORD` from A6.
2. The panel makes you choose a new password, and add your email and display name.
3. Do the same for `dev-admin-1` and `super-admin`, or turn off any you don't need (Users → Status switch).
4. Open **Audit log**. The IP on your sign-in should be **your** public IP. If it shows the server's IP, fix `TRUSTED_PROXIES` in `.env` and run `php artisan config:cache`.
5. Recommended: **Settings → Security** → turn on **Require two-factor sign-in for everyone**.
6. Optional: **Settings → General** (site name, default view) and **Settings → Extra** (banner, help email).
7. Remove the `DEFAULT_ADMIN_PASSWORD` line from the server's `.env`, then run `php artisan config:cache`.

### Optional: hide the API from the public
Only the Next.js app needs to reach `fitcheck-api.smartsitecp.com`. To block everyone else, add this at the very top of `backend/public/.htaccess`, then check that the site still loads devices:

```apache
<RequireAny>
    Require ip SERVER-IP
    Require ip 127.0.0.1
</RequireAny>
```

---

## Part D — Automatic deploys and Telegram alerts

Two scripts in `deploy/`, both run from cron. Both post to a **Telegram group topic** (a forum thread).

Do this **after** Parts A–C, so the two app folders, the database and `.env` already exist. From then on, `deploy.sh` keeps them up to date from a git clone of the whole repository at `~/fitcheck-src`, kept outside `public_html` so the source is never on the web:

```
~/fitcheck-src/backend/   ──copied to──►            ~/public_html/fitcheck.smartsitecp.com/backend/
                                                    (keeps .env, storage/, vendor/, public/.htaccess, .well-known/)
~/fitcheck-src/frontend/  ──built, then copied to──► ~/public_html/fitcheck.smartsitecp.com/frontend/
                                                    (same package as B2; keeps .htaccess, tmp/, .well-known/)
~/fitcheck-src/deploy/    ──the scripts themselves run from here; never copied
```

| Script | Schedule | What it does |
|---|---|---|
| `deploy.sh` | every 5 min | If `main` on GitHub has new commits: updates the API (sync, composer, migrations in maintenance mode, caches). Builds and restarts the site if `frontend/` changed, then checks the live site. Posts 🚀 start, ✅ done or 🔴 failed (with the step and log lines). Silent when nothing changed. |
| `watchdog.sh` | every 5 min | Checks the tester, `/admin`, the API through the site, the API's `/up`, HTTPS expiry for both addresses, disk space and new Laravel errors. Posts 🔴 once when a check fails twice in a row, and 🟢 when it recovers. Never repeats while still down. |
| `watchdog.sh --report` | daily | Posts a 📋 summary of every check. |

### D1. Telegram bot, group and topic
1. In Telegram, message **@BotFather** → `/newbot` → follow the prompts. Copy the **bot token**.
2. Add the bot to your group. In the group's settings, make sure **Topics** is on and the bot may post messages; making it an admin is simplest.
3. Find the **chat id** and **thread id**. Easiest: open the topic, tap a message → **Copy Message Link**. Depending on the Telegram app, you get `https://t.me/c/1234567890/55/60` or `https://t.me/c/1234567890/60?thread=55`:
   - chat id = `-100` + the first number → `-1001234567890`
   - thread id = the topic's number → `55` (the middle number in the first form, `thread=` in the second)

   Alternatively, post `/start@YourBotName` in the topic, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and read `"chat":{"id":…}` and `"message_thread_id":…`.
4. Leave the thread id empty to post in the group's General topic. Set `TELEGRAM_DEPLOY_THREAD_ID` to send deploy messages to a different topic from alerts.

### D2. Put a copy of the repository on the server
`deploy.sh` pulls from a git clone at `~/fitcheck-src`. The repository is private, so give the server a read-only **deploy key**. In cPanel **Terminal**:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/fitcheck_deploy -N "" -C "fitcheck deploy"
cat ~/.ssh/fitcheck_deploy.pub
```

On GitHub: repository → **Settings → Deploy keys → Add deploy key**. Paste the key and leave "Allow write access" **off**. Then:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github-fitcheck
  HostName github.com
  User git
  IdentityFile ~/.ssh/fitcheck_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
git clone git@github-fitcheck:tang-edgetech/fitcheck.git ~/fitcheck-src
```

### D3. Settings
```bash
cd ~/fitcheck-src/deploy
cp deploy.env.example deploy.env
chmod 600 deploy.env
nano deploy.env        # or edit it in File Manager (show hidden files)
```

The paths in the example already match this server. Check or fill in:
- **`PHP_BIN`:** see A9.
- **`COMPOSER_BIN`:** run `which composer` and use the **full** path. Cron has a minimal PATH.
- **`NODE_ACTIVATE`:** run `ls ~/nodevenv/public_html/fitcheck.smartsitecp.com/frontend/` to see the Node version folder (for example `22`).
- **Telegram:** the token, chat id and thread id from D1.

`deploy.env` is git-ignored, so the bot token never goes into the repository.

### D4. Test once by hand
```bash
cd ~/fitcheck-src
bash deploy/watchdog.sh --test            # a test message should appear in the topic
bash deploy/watchdog.sh --report          # a status summary should appear
bash deploy/deploy.sh --dry-run --force   # shows what it would deploy, changes nothing
bash deploy/deploy.sh --force             # first real deploy of both parts (takes a few minutes)
```

Logs: `~/fitcheck-deploy-state/deploy.log` and `watchdog.log`.

> **Memory on shared hosting:** building the site (`next build`) can need about 1–2 GB of memory. If the first deploy fails at "Build site" (often exit code 137), set `DEPLOY_SITE=0` in `deploy.env`. The server then deploys only the API automatically, and you build the site on your computer and upload it as in Part B.

### D5. Cron jobs
cPanel → **Cron Jobs** → add three jobs:

| Common setting | Command |
|---|---|
| Every 5 minutes (`*/5 * * * *`) | `/bin/bash /home/cpadmin99/fitcheck-src/deploy/deploy.sh >/dev/null 2>&1` |
| Every 5 minutes (`*/5 * * * *`) | `/bin/bash /home/cpadmin99/fitcheck-src/deploy/watchdog.sh >/dev/null 2>&1` |
| Once a day (`0 9 * * *`) | `/bin/bash /home/cpadmin99/fitcheck-src/deploy/watchdog.sh --report >/dev/null 2>&1` |

These are in addition to the `schedule:run` job from A9. A deploy that is still running when the next one starts is skipped, never run twice.

**From now on, deploying is just:** push to `main` on GitHub. Within about 5 minutes the topic shows 🚀, then ✅ (or 🔴 with the failed step).

**Rolling back:** push a revert commit (`git revert <commit>` then `git push`). The next run deploys it.

**What deploy.sh never touches:**
- **Files:** the server's `.env`, `storage/` (logs, sessions), `backend/public/.htaccess` (so the optional IP allow-list stays), `frontend/.htaccess` (cPanel's app settings and the B5 lines) and `.well-known/` (AutoSSL).
- **Database:** it runs migrations only, never the seeders, so it can't reset passwords or bring back deleted accounts.

---

## Updating later

With Part D set up, pushing to `main` deploys automatically. Without it, or with `DEPLOY_SITE=0` for the site, update by hand:

**API changes:** upload the changed files (or a new zip, without `.env`). Then:

```bash
cd ~/public_html/fitcheck.smartsitecp.com/backend
php artisan migrate --force
php artisan config:cache
php artisan route:cache
```

**Site changes:** rebuild with `npm run build:cpanel` (same `BACKEND_URL`). Then Stop App, upload and extract over the old files (keep `.htaccess`), and Start App.

**Handbook changes:** run `node docs/handbook/illustrations.mjs` and `node docs/handbook/build-handbook.mjs` before `npm run build:cpanel`, so the new PDF is included.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Site shows a Passenger / "Incomplete response" error | Node.js is older than 20.9, or `.next` wasn't extracted (check hidden files). See `stderr.log` in `frontend/`. |
| Site shows a directory listing or "Index of" | `frontend/.htaccess` from Setup Node.js App is missing. Open Setup Node.js App, Edit the app and Save (or Restart) to write it again. |
| API addresses show the Next.js site, or a Node.js error | The API subdomain's document root isn't `…/backend/public`, or `backend/.htaccess` is missing (it switches the Node.js settings off for the API). |
| Tester says "Could not load the device list" | The package was built with the wrong `BACKEND_URL`, or the API is down or has no HTTPS yet. Open the A10 links. |
| Sign-in fails with "page expired" (419) or loops back to the sign-in page | `SANCTUM_STATEFUL_DOMAINS` must be exactly `fitcheck.smartsitecp.com`. The site must be on HTTPS. Run `php artisan config:cache` after any `.env` edit. |
| API returns 500 | `APP_KEY` missing (run A7 again), wrong database details, or `storage` not writable. Details in `backend/storage/logs/`. |
| Everyone gets "Too many failed attempts" together | `TRUSTED_PROXIES` doesn't include the server's IP (see Part C step 4). |
| Old system-log entries never disappear | The cron job (A9) isn't running, or its PHP path is wrong. |
| No Telegram messages | Run `bash deploy/watchdog.sh --test` and read `~/fitcheck-deploy-state/watchdog.log`. Usual causes: wrong chat id (it must start with `-100`), the bot isn't in the group or can't post, or a wrong thread id. |
| Deploys never start | `deploy.sh` needs `git fetch` to work from cron. Run `cd ~/fitcheck-src && git fetch` by hand to check the deploy key. Also check `COMPOSER_BIN` and `PHP_BIN` are full paths. |
| Deploy fails at "Build site" with exit 137 | Out of memory during `next build`. Set `DEPLOY_SITE=0` (see D4). |
