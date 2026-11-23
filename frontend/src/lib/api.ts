"use client";

/** Thin client for the Laravel API. Uses the session cookie + CSRF token. */

/**
 * Where the API lives. Empty (the default): the Next.js server proxies /api and /sanctum (local dev, Node.js hosting).
 * Static builds (npm run build:static) set NEXT_PUBLIC_API_URL, e.g. https://fitcheck-api.smartsitecp.com, and call it directly.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
  /** Field errors from a 422 validation response, shaped for antd Form.setFields */
  fields(): { name: string | string[]; errors: string[] }[] {
    const errs = (this.data.errors ?? {}) as Record<string, string[]>;
    return Object.entries(errs).map(([k, v]) => ({ name: k.includes(".") ? k.split(".") : k, errors: v }));
  }
}

type Query = Record<string, string | number | boolean | undefined | null | (string | number)[]>;
interface Opts { method?: string; body?: unknown; query?: Query; signal?: AbortSignal; quiet401?: boolean }

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}
async function ensureCsrf(force = false) {
  if (force || !readCookie("XSRF-TOKEN")) await fetch(API_BASE + "/sanctum/csrf-cookie", { credentials: "include" });
}
function qs(q?: Query) {
  if (!q) return "";
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (Array.isArray(v)) v.forEach((x) => p.append(k + "[]", String(x)));
    else p.set(k, String(v));
  });
  const s = p.toString();
  return s ? "?" + s : "";
}

/** Session ended (401) or account setup needed (423): the admin shell listens for this. */
export const AUTH_EVENT = "fitcheck:auth";

async function request(path: string, o: Opts, retried = false): Promise<Response> {
  const method = (o.method ?? "GET").toUpperCase();
  if (method !== "GET") await ensureCsrf();
  const res = await fetch(API_BASE + "/api" + path + qs(o.query), {
    method,
    credentials: "include",
    signal: o.signal,
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(o.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-XSRF-TOKEN": readCookie("XSRF-TOKEN") } : {}),
    },
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
  });
  if (res.status === 419 && !retried) {
    await ensureCsrf(true);
    return request(path, o, true);
  }
  return res;
}

async function fail(res: Response, o: Opts): Promise<never> {
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* not JSON */ }
  const message = (data.message as string) || `Request failed (${res.status})`;
  if ((res.status === 401 && !o.quiet401) || res.status === 423) {
    window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { status: res.status, message, data } }));
  }
  throw new ApiError(res.status, message, data);
}

export async function api<T = unknown>(path: string, o: Opts = {}): Promise<T> {
  const res = await request(path, o);
  if (!res.ok) return fail(res, o);
  return (res.status === 204 ? null : await res.json()) as T;
}

/** POST that returns a file (e.g. audit export) and saves it in the browser. */
export async function download(path: string, body: unknown, fallbackName: string) {
  const res = await request(path, { method: "POST", body });
  if (!res.ok) return fail(res, {});
  const cd = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
