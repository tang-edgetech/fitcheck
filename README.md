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
- **Audit log:** every sign-in, change, export and denied request, with Success or Failed status. Rows are append-only and hash-chained ("Check integrity" detects edits). Bulk select or filter, then export as JSON or CSV. Exports are audited too.
- **System log:** application errors and notable events, written to the `system_logs` table and to daily files in `backend/storage/logs`.

## Tester class names

Stable class names for styling, testing or referring to parts of the tester page. They carry no styles of their own (except `device-list` scrollbars and `footer-option`), so they are safe to target. Modifiers use `--`.

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
