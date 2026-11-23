# Fitcheck

Paste a link and see the site on phones, tablets, laptops and TVs side by side. The device list ("screen views") and the tester tabs ("families") are managed in an admin panel and stored in MySQL.

| Part | Stack | Folder |
|---|---|---|
| Tester (public) + admin panel | Next.js 16, Tailwind CSS 4, Ant Design 6 | `frontend/` |
| API | Laravel 13, Sanctum (session cookie auth), MySQL / MariaDB | `backend/` |
| Early design proposals (static HTML) | | `docs/` |

The browser only talks to Next.js. Next.js proxies `/api/*` and `/sanctum/*` to Laravel (`BACKEND_URL`, default `http://127.0.0.1:8000`), so cookies and CSRF stay same-origin.

## First-time setup

Requires PHP 8.3+, Composer, Node 20+, and MySQL/MariaDB (XAMPP works).

```powershell
cd backend
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate --seed
```

Create the `fitcheck` database first if it doesn't exist (utf8mb4). DB settings are in `backend/.env`.

```powershell
cd frontend
npm install
```

## Run

In two terminals:

```powershell
php backend/artisan serve --port=8000
```

```powershell
npm --prefix frontend run dev
```

- Tester: http://localhost:3000
- Admin: http://localhost:3000/admin

## Default accounts

Created by `php artisan db:seed`, which is safe to run on every deploy: it only creates what's missing and never overwrites changes made in the admin panel.

| Username | Role |
|---|---|
| `dev-admin` | Developer |
| `dev-admin-1` | Developer |
| `super-admin` | Admin |

All three start with the password from `DEFAULT_ADMIN_PASSWORD` in `backend/.env` (`Admin@1234`). On first sign-in each account must choose a new password and set an email and display name. If two-factor sign-in is required, it must also set that up.

**Roles.** Developers can do everything. Admins can do everything except view the system log and change Developer accounts. Permissions live in `backend/config/fitcheck.php`.

## Security features

- **Sign-in:** username or email plus password. Lockout after repeated failures (configurable).
- **Two-factor sign-in:** TOTP with an authenticator app, plus 8 single-use recovery codes. A global switch (Settings) requires it for everyone. Turning it off needs the operator's own code.
- **Sessions:** HttpOnly session cookie with CSRF protection. Idle timeout (configurable). Other sessions are signed out on password change.
- **Audit log:** every sign-in, change, export and denied request, with Success or Failed status and the HTTP status code. Shown in plain language ("dev-admin added menu group Tablets"); the technical action code is kept in each row's details and in exports. Rows are append-only and hash-chained ("Check integrity" detects edits). Bulk select or filter, then export as JSON or CSV. Exports are audited too.
- **System log:** application errors and notable events, written to the `system_logs` table and to daily files in `backend/storage/logs`.

## Settings

Admin → Settings has one route per tab:

| Tab | Route | What it controls |
|---|---|---|
| General | `/admin/settings/general` | Site name, and whether the tester opens in Scroll or Grid view at True scale or Fill height |
| Security | `/admin/settings/security` | Required two-factor sign-in, idle timeout, password length, lockout |
| Log | `/admin/settings/log` | Lowest system-log level kept, retention in days, "Delete old entries now". Developers only |
| Extra | `/admin/settings/extra` | Announcement banner on the tester, help contact email |

Old system-log entries are deleted daily by `php artisan fitcheck:prune-system-log`, which needs the Laravel scheduler on the server (cron: `* * * * * php artisan schedule:run`). The audit log is never deleted.

## User guide and handbook

- **In the admin panel:** every page has an ⓘ button next to its title that opens step-by-step help for that page. The header's **User guide** link opens the PDF handbook.
- **PDF:** [`docs/handbook/Fitcheck-Admin-Handbook.pdf`](docs/handbook/Fitcheck-Admin-Handbook.pdf), written for the Admin role (Developer-only features are left out). A copy is served at `/help/Fitcheck-Admin-Handbook.pdf`.
- **One source:** the text lives in `frontend/src/lib/help.ts` and the pictures in `frontend/public/help/`. After changing either, rebuild both:

```powershell
node docs/handbook/illustrations.mjs
```

```powershell
node docs/handbook/build-handbook.mjs
```

The first redraws the admin-screen illustrations (numbered markers match the numbered steps); the second prints the PDF with Chrome or Edge. The sign-in and tester pictures are real screenshots (`login.jpg`, `tester.jpg`).

## Class naming convention

Every part of the tester and the admin panel has a readable class name, so anyone can style it, target it in tests, or point to it in a conversation ("the `bulk-bar` on the audit log"). Names follow one pattern, close to Bootstrap's:

| Kind | Pattern | Examples |
|---|---|---|
| Component (block) | `name` | `page-header`, `stat-card`, `filter-bar`, `data-table`, `form-drawer` |
| Part of a component | `name-part` | `page-header-title`, `stat-card-note`, `bulk-bar-count`, `activity-message` |
| Variant | `name--variant` | `status-badge--failed`, `stat-card--two-factor`, `row-action--delete`, `data-table--audit` |
| State | `is-state` | `is-dragging`, `is-drop-before` |
| Page root | `page page-{name}` | `page page-dashboard`, `page page-audit-log`, `page page-menu-groups` |

Semantic names come first in `className`, then Tailwind utilities. They carry no styles of their own except where noted, so targeting them never fights the design. Ant Design's own `ant-*` classes are still there underneath.

## Admin panel class names

| Area | Main class names |
|---|---|
| Shell | `admin-root`, `admin-layout`, `admin-sidebar`, `admin-sidebar-brand`, `admin-nav`, `admin-nav-item--{dashboard\|screen-views\|families\|users\|audit-logs\|system-logs\|settings}`, `admin-mobile-nav`, `admin-main`, `admin-header`, `admin-header-menu-toggle`, `admin-header-tester-link`, `admin-user-menu`, `admin-user-avatar`, `admin-user-name`, `admin-user-role`, `admin-body`, `admin-content`, `admin-footer`, `brand` |
| Every page | `page page-{name}`, `page-header`, `page-header-title`, `page-header-subtitle`, `page-header-actions`, `page-header-btn--add`, `no-access`, `page-loading` |
| Shared | `filter-bar` (+ `filter-bar-search`, `-status`, …), `bulk-bar` (+ `bulk-bar-count`, `bulk-bar-btn--{action}`), `data-table data-table--{name}`, `data-table-row`, `{page}-col-{field}`, `row-actions`, `row-action--{edit\|delete\|…}`, `status-badge--{success\|failed\|…}`, `http-status--{success\|warning\|error}`, `form form--{name}`, `form-grid`, `form-field--{name}`, `form-input--{name}`, `form-btn--{action}`, `form-drawer--{name}`, `form-drawer-btn--{cancel\|save}`, `empty-state` |
| Dashboard | `stat-cards`, `stat-card--{screen-views\|menu-groups\|two-factor\|failed-sign-ins}`, `activity-card`, `activity-list`, `activity-item--{success\|failed}`, `activity-message`, `activity-time` |
| Audit log | `audit-activity`, `audit-row--{success\|failed}`, `audit-details`, `audit-verify-btn`, `audit-integrity-alert--{intact\|broken}` |
| Menu groups | `sortable-table`, `sortable-list`, `sortable-item`, `sortable-handle`, `is-dragging`, `is-drop-before` / `is-drop-after`, `group-device-list`, `group-device-item` |
| Other pages | `screen-view-*`, `viewport-input*`, `user-*`, `role-badge--*`, `two-factor-badge--*`, `temp-password-modal`, `syslog-*`, `log-level--*`, `settings-card--*`, `settings-toggle`, `profile-card--*`, `two-factor-setup--*`, `recovery-codes`, `login-*`, `setup-*` |

## Tester class names

Modifiers use `--`. Only `device-list` (scrollbars, drag) and `footer-option` carry styles.

| Area | Class names |
|---|---|
| Page | `tester-page`, `tester-page--scroll` / `tester-page--grid` |
| Header | `site-header`, `site-logo`, `url-form`, `url-input`, `url-submit` |
| Toolbar | `toolbar`, `menu-navigation` (the `<nav>`), `nav-tabs`, `menu-item`, `menu-item--active`, `nav-tab`, `nav-tab--active`, `nav-tab--filtered`, `nav-tab-label`, `nav-tab-count`, `nav-tab-caret`, `control-label`, `size-control`, `view-control`, `card-size-control` |
| Main | `site-main` (the `<main>`), `device-list`, `device-list--scroll` / `device-list--grid`, `is-dragging` (while drag-scrolling), `device-list-message` |
| Each device | `device-item`, `device-item--mobile` / `--tablet` / `--desktop` / `--tv`, `device-label`, `device-number`, `device-name`, `device-size`, `device-frame`, `device-frame--island` / `--notch` / …, `device-screen` |
| Footer | `site-footer`, `footer-nav`, `footer-nav-prev`, `footer-nav-next`, `footer-status`, `footer-actions`, `footer-option`, `footer-option--on`, `footer-option--page-scroll`, `footer-option--landscape`, `footer-divider`, `footer-reload`, `footer-help` |
| Overlays | `device-picker`, `device-picker-all`, `device-picker-list`, `device-picker-item`, `focus-view`, `help-modal` |

Each `device-item` also has `data-device` (its slug) and `data-type`, and each `nav-tab` has `data-family`.

## Useful commands

```powershell
php backend/artisan migrate:fresh --seed
```

Resets the database to the seeded state. This deletes all data.

```powershell
npm --prefix frontend run lint
```
