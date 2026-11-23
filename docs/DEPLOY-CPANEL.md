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

Do Part A (the API) first, then Part B (the site). Part C covers the admin panel's first sign-in.

## Before you start

**On the cPanel account**
- **Setup Node.js App** in cPanel (Software section), with Node.js **20.9 or newer** (22 is best). Without it, the Next.js app can't run on this hosting.
- **PHP 8.3 or newer**, with these extensions: `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `ctype`, `fileinfo`, `iconv`, `dom`, `xml`, `filter`, `session`.
- **MySQL** (or MariaDB).
- **Terminal** in cPanel (Advanced section) or SSH access. You need it to run a few `php artisan` commands. If it's missing, ask your host to enable it.

**On your computer** (where the project is): Node.js, Composer, and this repository.

In the steps below, replace `CPUSER` with your cPanel username (shown top right in cPanel) and `SERVER-IP` with the server's IP (cPanel → General Information → **Shared IP Address**).

---

## Part A — `fitcheck-api.smartsitecp.com` (Laravel API)

### A1. Create the subdomain
1. cPanel → **Domains** → **Create A New Domain**.
2. Domain: `fitcheck-api.smartsitecp.com`.
3. Untick **Share document root**. Set the document root to **`fitcheck-api/public`**.
4. Submit. The app files will go in `/home/CPUSER/fitcheck-api`, and only its `public` folder is visible on the web.

### A2. PHP version and extensions
1. cPanel → **MultiPHP Manager** → tick `fitcheck-api.smartsitecp.com` → PHP **8.3** (or newer) → Apply.
2. cPanel → **Select PHP Version** (if your host has it) → **Extensions**: make sure the extensions listed above are ticked.

### A3. Database
1. cPanel → **MySQL Database Wizard**.
2. Create the database `CPUSER_fitcheck`, then a user `CPUSER_fitcheck` with a strong password.
3. Give the user **All Privileges** on the database. Keep the names and password for A6.

### A4. Prepare the files on your computer
Install only what production needs, so the upload includes a ready `vendor` folder:

```powershell
cd backend
composer install --no-dev --optimize-autoloader
```

Zip the **contents** of the `backend` folder (`app`, `bootstrap`, `config`, `database`, `public`, `resources`, `routes`, `storage`, `vendor`, `artisan`, `composer.json`, `composer.lock`, `.env.production.example`). **Leave out `.env`**, because it holds your local settings.

Afterwards, restore the development packages locally:

```powershell
composer install
```

> If cPanel Terminal has `composer`, you can upload without `vendor` and run `composer install --no-dev --optimize-autoloader` on the server instead.

### A5. Upload
1. cPanel → **File Manager** → open `/home/CPUSER/fitcheck-api` (created in A1).
2. **Upload** the zip, then right-click → **Extract**. Delete the zip afterwards.
3. Check that `/home/CPUSER/fitcheck-api/public/index.php` exists.

### A6. Settings (`.env`)
1. In File Manager, turn on **Settings → Show Hidden Files**.
2. Copy `.env.production.example` to **`.env`** and edit it:
   - `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`: the values from A3.
   - `TRUSTED_PROXIES=SERVER-IP,127.0.0.1,::1`
   - `DEFAULT_ADMIN_PASSWORD`: a strong one-off password for the three starting accounts.
   - Leave `APP_KEY` empty; the next step fills it in.

### A7. Install
cPanel → **Terminal**:

```bash
cd ~/fitcheck-api
php -v                                  # must say 8.3 or newer; if not, use the full path shown in A9
php artisan key:generate --force
php artisan migrate --force
php artisan db:seed --force             # creates dev-admin, dev-admin-1, super-admin, the devices and menu groups
php artisan config:cache
php artisan route:cache
chmod -R 775 storage bootstrap/cache
```

`db:seed` is safe to run again later: it only adds what's missing.

### A8. HTTPS
cPanel → **SSL/TLS Status** → tick both subdomains → **Run AutoSSL**. Wait until both show a valid certificate.

### A9. Scheduled clean-up (cron)
cPanel → **Cron Jobs** → Common settings: **Once Per Minute**. Command:

```bash
cd /home/CPUSER/fitcheck-api && /opt/cpanel/ea-php83/root/usr/bin/php artisan schedule:run >> /dev/null 2>&1
```

Use the PHP path for your version: run `ls /opt/cpanel/` in Terminal to see `ea-php83`, `ea-php84` and so on. Some hosts use `/usr/local/bin/php` instead. The job deletes old system-log entries daily (Settings → Log).

### A10. Test the API
- `https://fitcheck-api.smartsitecp.com/up` shows a green "Application up" page.
- `https://fitcheck-api.smartsitecp.com/api/public/screen-views` shows JSON with `families` and `site`.

---

## Part B — `fitcheck.smartsitecp.com` (site and admin panel)

### B1. Create the subdomain
cPanel → **Domains** → **Create A New Domain** → `fitcheck.smartsitecp.com`. Keep the suggested document root. The Node.js app takes over this address in B3.

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
| Application root | `fitcheck-frontend` |
| Application URL | `fitcheck.smartsitecp.com` |
| Application startup file | `server.js` |

Under **Environment variables**, add `NODE_ENV` = `production` and `HOSTNAME` = `127.0.0.1`. Then select **Create**.

### B4. Upload
1. In Setup Node.js App, select **Stop App**.
2. File Manager → `/home/CPUSER/fitcheck-frontend` → delete any sample files cPanel created (such as `app.js`).
3. **Upload** `fitcheck-frontend.zip` → right-click → **Extract** → delete the zip.
4. With hidden files shown, check that `server.js`, `.next/` and `public/` are directly inside `fitcheck-frontend`, not in a subfolder.
5. Back in Setup Node.js App, select **Start App** (or **Restart**).

**Don't** select "Run NPM Install". The package already contains everything it needs.

### B5. Test the site
- `https://fitcheck.smartsitecp.com`: the tester loads with its device tabs. Paste a link and select Show.
- `https://fitcheck.smartsitecp.com/admin`: opens the sign-in page.
- `https://fitcheck.smartsitecp.com/help/Fitcheck-Admin-Handbook.pdf`: the handbook opens.

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
Only the Next.js app needs to reach `fitcheck-api`. To block everyone else, add this at the very top of `/home/CPUSER/fitcheck-api/public/.htaccess`, then check that the site still loads devices:

```apache
<RequireAny>
    Require ip SERVER-IP
    Require ip 127.0.0.1
</RequireAny>
```

---

## Part D — Automatic deploys and Telegram alerts

Two scripts in `deploy/`, both run from cron. Both post to a **Telegram group topic** (a forum thread).

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

Fill in:
- **Paths:** replace `CPUSER` everywhere.
- **`PHP_BIN`:** see A9.
- **`COMPOSER_BIN`:** run `which composer` and use the **full** path. Cron has a minimal PATH.
- **`NODE_ACTIVATE`:** run `ls ~/nodevenv/fitcheck-frontend/` to see the Node version folder.
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
cPanel → **Cron Jobs** → add three jobs (replace `CPUSER`):

| Common setting | Command |
|---|---|
| Every 5 minutes (`*/5 * * * *`) | `/bin/bash /home/CPUSER/fitcheck-src/deploy/deploy.sh >/dev/null 2>&1` |
| Every 5 minutes (`*/5 * * * *`) | `/bin/bash /home/CPUSER/fitcheck-src/deploy/watchdog.sh >/dev/null 2>&1` |
| Once a day (`0 9 * * *`) | `/bin/bash /home/CPUSER/fitcheck-src/deploy/watchdog.sh --report >/dev/null 2>&1` |

These are in addition to the `schedule:run` job from A9. A deploy that is still running when the next one starts is skipped, never run twice.

**From now on, deploying is just:** push to `main` on GitHub. Within about 5 minutes the topic shows 🚀, then ✅ (or 🔴 with the failed step).

**Rolling back:** push a revert commit (`git revert <commit>` then `git push`). The next run deploys it.

**What deploy.sh never touches:** the server's `.env`, `storage/` (logs, sessions), `public/.htaccess` (so the optional IP allow-list stays) and the database seeders. It runs migrations only, so it never resets passwords or brings back deleted accounts.

---

## Updating later

With Part D set up, pushing to `main` deploys automatically. Without it, or with `DEPLOY_SITE=0` for the site, update by hand:

**API changes:** upload the changed files (or a new zip, without `.env`). Then:

```bash
cd ~/fitcheck-api
php artisan migrate --force
php artisan config:cache
php artisan route:cache
```

**Site changes:** rebuild with `npm run build:cpanel` (same `BACKEND_URL`). Then Stop App, upload and extract over the old files, and Start App.

**Handbook changes:** run `node docs/handbook/illustrations.mjs` and `node docs/handbook/build-handbook.mjs` before `npm run build:cpanel`, so the new PDF is included.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Site shows a Passenger / "Incomplete response" error | Node.js is older than 20.9, or `.next` wasn't extracted (check hidden files). See `stderr.log` in `fitcheck-frontend`. |
| Tester says "Could not load the device list" | The package was built with the wrong `BACKEND_URL`, or the API is down or has no HTTPS yet. Open the A10 links. |
| Sign-in fails with "page expired" (419) or loops back to the sign-in page | `SANCTUM_STATEFUL_DOMAINS` must be exactly `fitcheck.smartsitecp.com`. The site must be on HTTPS. Run `php artisan config:cache` after any `.env` edit. |
| API returns 500 | `APP_KEY` missing (run A7 again), wrong database details, or `storage` not writable. Details in `~/fitcheck-api/storage/logs/`. |
| Everyone gets "Too many failed attempts" together | `TRUSTED_PROXIES` doesn't include the server's IP (see Part C step 4). |
| Old system-log entries never disappear | The cron job (A9) isn't running, or its PHP path is wrong. |
| No Telegram messages | Run `bash deploy/watchdog.sh --test` and read `~/fitcheck-deploy-state/watchdog.log`. Usual causes: wrong chat id (it must start with `-100`), the bot isn't in the group or can't post, or a wrong thread id. |
| Deploys never start | `deploy.sh` needs `git fetch` to work from cron. Run `cd ~/fitcheck-src && git fetch` by hand to check the deploy key. Also check `COMPOSER_BIN` and `PHP_BIN` are full paths. |
| Deploy fails at "Build site" with exit 137 | Out of memory during `next build`. Set `DEPLOY_SITE=0` (see D4). |
