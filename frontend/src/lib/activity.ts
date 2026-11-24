/**
 * Turns audit log rows into plain-language sentences, e.g.
 *   auth.login (success)          → "dev-admin signed in"
 *   families.update (failed, 422) → "dev-admin couldn't edit menu group Popular: The name field is required."
 * Used by the dashboard's Recent activity and the audit log, so both read the same.
 */
import type { AuditLog } from "./types";

type Meta = Record<string, unknown> | null | undefined;
export type ActivityRow = Pick<AuditLog, "action" | "status" | "username" | "target_label"> & { meta?: Meta };

interface Phrase {
  /** Short name for filters, e.g. "Signed in" */
  label: string;
  /** What happened when it worked (verb phrase after the person's name) */
  done: (t: string, m: Meta) => string;
  /** What they tried, used as "couldn't …" when it failed */
  tried?: (t: string, m: Meta) => string;
  /** Full failure phrase when "couldn't …" reads badly */
  fail?: (t: string, m: Meta) => string;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const SETTING_NAMES: Record<string, string> = {
  two_factor_enforced: "two-factor requirement",
  session_timeout_minutes: "session timeout",
  password_min_length: "minimum password length",
  max_login_attempts: "sign-in attempt limit",
  lockout_minutes: "lockout time",
  site_name: "site name",
  default_view: "default tester view",
  default_size: "default tester size",
  system_level: "system log level",
  system_retention_days: "system log retention",
  banner_enabled: "announcement banner",
  banner_text: "announcement text",
  help_email: "help contact email",
};
const settingNames = (t: string) =>
  t.split(",").map((k) => SETTING_NAMES[k.trim().split(".").pop() ?? ""] ?? k.trim()).filter(Boolean).join(", ");
/** "old to new" when an update changed the username, else "" */
const renamed = (m: Meta) => {
  const b = (m?.before as Record<string, unknown> | undefined)?.username, a = (m?.after as Record<string, unknown> | undefined)?.username;
  return typeof b === "string" && typeof a === "string" && b !== a ? `${b} to ${a}` : "";
};
/** "on" / "off" when an update only switched the account on or off */
const toggled = (m: Meta) => {
  const b = m?.before as Record<string, unknown> | undefined, a = m?.after as Record<string, unknown> | undefined;
  if (!b || !a || b.is_active === a.is_active) return "";
  const other = Object.keys(a).some((k) => k !== "is_active" && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  return other ? "" : a.is_active ? "on" : "off";
};
const LOGIN_REASONS: Record<string, string> = {
  "wrong credentials": "wrong username or password",
  "locked out": "too many failed attempts, so sign-in is locked for now",
  "account disabled": "the account is disabled",
};

const PHRASES: Record<string, Phrase> = {
  "auth.login": {
    label: "Signed in",
    done: (_, m) => (str(m?.method) === "recovery code" ? "signed in with a recovery code" : "signed in"),
    fail: (t, m) => {
      // No target means the typed name matched no account; the username column then holds what was typed
      const who = t || !m?.username ? "" : ` as "${str(m.username)}"`;
      const why = LOGIN_REASONS[str(m?.reason)];
      return `couldn't sign in${who}${why ? `: ${why}` : ""}`;
    },
  },
  "auth.two_factor": {
    label: "Two-factor code at sign-in",
    done: () => "entered their two-factor code",
    fail: (_, m) => (str(m?.reason) === "too many codes" ? "entered too many wrong two-factor codes" : `entered a wrong two-factor ${str(m?.method) === "recovery code" ? "recovery code" : "code"}`),
  },
  "auth.logout": { label: "Signed out", done: () => "signed out" },
  "auth.session_end": {
    label: "Signed out automatically",
    done: (_, m) => (str(m?.reason).includes("without activity") ? "was signed out after being inactive" : "was signed out because the account was disabled"),
  },
  "access.denied": { label: "Blocked from a page", done: () => "opened a restricted page", fail: () => "was blocked from a page they don't have access to" },
  "audit.export": {
    label: "Exported the audit log",
    done: (t, m) => `exported ${t || "rows"} of the audit log${m?.format ? ` as ${str(m.format).toUpperCase()}` : ""}`,
    tried: () => "export the audit log",
  },

  "families.create": { label: "Added a menu group", done: (t) => `added menu group ${t}`, tried: (t) => `add menu group ${t}` },
  "families.update": { label: "Edited a menu group", done: (t) => `edited menu group ${t}`, tried: (t) => `edit menu group ${t}` },
  "families.delete": { label: "Deleted a menu group", done: (t) => `deleted menu group ${t}`, tried: (t) => `delete menu group ${t}` },
  "families.reorder": { label: "Reordered menu groups", done: () => "changed the order of the menu groups", tried: () => "change the order of the menu groups" },

  "screenviews.create": { label: "Added a screen view", done: (t) => `added screen view ${t}`, tried: (t) => `add screen view ${t}` },
  "screenviews.update": { label: "Edited a screen view", done: (t) => `edited screen view ${t}`, tried: (t) => `edit screen view ${t}` },
  "screenviews.delete": { label: "Deleted a screen view", done: (t) => `deleted screen view ${t}`, tried: (t) => `delete screen view ${t}` },
  "screenviews.bulk_activate": { label: "Showed screen views on the tester", done: (t) => `showed ${t} on the tester`, tried: (t) => `show ${t} on the tester` },
  "screenviews.bulk_deactivate": { label: "Hid screen views from the tester", done: (t) => `hid ${t} from the tester`, tried: (t) => `hide ${t} from the tester` },
  "screenviews.bulk_delete": { label: "Deleted screen views", done: (t) => `deleted ${t}`, tried: (t) => `delete ${t}` },
  "screenviews.import": { label: "Added devices from the library", done: (t) => `added ${t || "devices"} from the library`, tried: () => "add devices from the library" },
  "screenviews.bulk": { label: "Changed several screen views", done: () => "changed several screen views", tried: () => "change several screen views" },

  "users.create": { label: "Added a user", done: (t) => `added user ${t}`, tried: (t) => `add user ${t}` },
  "users.update": { label: "Edited a user", done: (t, m) => (renamed(m) ? `renamed user ${renamed(m)}` : toggled(m) === "on" ? `re-enabled user ${t}` : toggled(m) === "off" ? `disabled user ${t}` : `edited user ${t}`), tried: (t) => `edit user ${t}` },
  "users.delete": { label: "Deleted a user", done: (t) => `deleted user ${t}`, tried: (t) => `delete user ${t}` },
  "users.reset_password": {
    label: "Reset a user's password",
    done: (t, m) => (str(m?.mode) === "manual"
      ? `set a new password for ${t}${m?.must_change === false ? "" : " (to be changed at next sign-in)"}`
      : `gave ${t} a temporary password`),
    tried: (t) => `reset the password for ${t}`,
  },
  "settings.prune_system_log": { label: "Cleared old system log entries", done: (t, m) => `deleted ${t || "old entries"} from the system log (older than ${m?.retention_days ?? "?"} days)`, tried: () => "clear old system log entries" },
  "users.reset_two_factor": { label: "Removed a user's two-factor sign-in", done: (t) => `turned off two-factor sign-in for ${t}`, tried: (t) => `turn off two-factor sign-in for ${t}` },

  "profile.update": { label: "Updated their profile", done: (_, m) => (renamed(m) ? `changed their username from ${renamed(m)}` : "updated their profile"), tried: () => "update their profile" },
  "profile.password": { label: "Changed their password", done: () => "changed their password", tried: () => "change their password" },
  "profile.two_factor.start": { label: "Started two-factor setup", done: () => "started setting up two-factor sign-in", tried: () => "start setting up two-factor sign-in" },
  "profile.two_factor.enable": { label: "Turned on two-factor sign-in", done: () => "turned on two-factor sign-in", tried: () => "turn on two-factor sign-in" },
  "profile.two_factor.disable": { label: "Turned off two-factor sign-in", done: () => "turned off two-factor sign-in", tried: () => "turn off two-factor sign-in" },
  "profile.two_factor.recovery_codes": { label: "Created new recovery codes", done: () => "created new recovery codes", tried: () => "create new recovery codes" },

  "settings.update": {
    label: "Changed settings",
    done: (t) => (!t || t === "no change" ? "saved settings with no changes" : `changed settings: ${settingNames(t)}`),
    tried: () => "change settings",
  },
};

/** Route names use hyphens and resource verbs; explicit audit names use underscores. Map both to one key. */
function keyOf(action: string) {
  const k = action.replace(/-/g, "_");
  if (k === "profile.two_factor.confirm") return "profile.two_factor.enable";
  if (k === "auth.two_factor" || PHRASES[k]) return k;
  return k.replace(/\.store$/, ".create").replace(/\.destroy$/, ".delete");
}

const GENERIC_ERRORS = new Set(["Error", "Unprocessable Content", "Forbidden", "Not Found", "Unauthorized", "Too Many Requests", "Server Error", "Internal Server Error"]);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Plain-language name of an action code, for filters and menus. */
export function actionLabel(action: string) {
  return PHRASES[keyOf(action)]?.label ?? cap(action.replace(/[._]/g, " "));
}

/**
 * One sentence describing the row. With the person's name ("dev-admin signed in") for activity feeds,
 * or without it ("Signed in") where the person already has its own column.
 */
export function activityText(r: ActivityRow, withActor = true) {
  const p = PHRASES[keyOf(r.action)];
  const t = (r.target_label ?? "").trim();
  const m = r.meta;
  let phrase: string;
  if (r.status === "success") {
    phrase = p ? p.done(t, m) : `did "${r.action}"${t ? ` on ${t}` : ""}`;
  } else {
    phrase = p?.fail ? p.fail(t, m) : `couldn't ${p?.tried ? p.tried(t, m) : p ? p.done(t, m) : `do "${r.action}"`}`;
    const err = str(m?.error) === "This action is unauthorized." ? "not allowed for their role" : str(m?.error);
    if (!p?.fail && err && !GENERIC_ERRORS.has(err)) phrase += `: ${err.length > 140 ? err.slice(0, 137) + "…" : err}`;
  }
  phrase = phrase.replace(/\s+/g, " ").trim();
  if (!withActor) return cap(phrase);
  const unknownAccount = keyOf(r.action) === "auth.login" && r.status === "failed" && !t;
  return `${!unknownAccount && r.username ? r.username : r.status === "failed" ? "Someone" : "The system"} ${phrase}`;
}
