"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App, Skeleton, Tabs } from "antd";
import { AppstoreAddOutlined, FileTextOutlined, LockOutlined, SettingOutlined } from "@ant-design/icons";
import { api, ApiError } from "@/lib/api";
import { useAdmin } from "./AdminProvider";
import { NoAccess, PageHead } from "./AdminShell";

export type SettingsValues = Record<string, string | number | boolean>;
export type SettingsGroup = "general" | "security" | "log" | "extra";

interface Ctx {
  s: SettingsValues;
  /** Saves one group, e.g. save("general", { site_name: "Fitcheck" }). Throws ApiError so pages can show field errors. */
  save: (group: SettingsGroup, values: Record<string, unknown>, extra?: Record<string, unknown>) => Promise<SettingsValues>;
}
const SettingsContext = createContext<Ctx | null>(null);

export function useSettings() {
  const c = useContext(SettingsContext);
  if (!c) throw new Error("useSettings must be used inside the Settings layout");
  return c;
}

/** Shows a 422's field errors on the form, or a message for anything else. */
export function useSettingsErrors() {
  const { message } = App.useApp();
  return (e: unknown, setFields?: (f: ReturnType<ApiError["fields"]>) => void) => {
    // Server errors are keyed "general.site_name"; the forms use the short name "site_name"
    if (e instanceof ApiError && e.status === 422 && setFields && e.fields().length) {
      setFields(e.fields().map((f) => ({ ...f, name: (Array.isArray(f.name) ? f.name.join(".") : f.name).split(".").pop() ?? "" })));
    }
    else message.error(e instanceof ApiError ? e.message : "Could not save.");
  };
}

const TABS: { key: SettingsGroup; label: string; icon: React.ReactNode; perm: string }[] = [
  { key: "general", label: "General", icon: <SettingOutlined />, perm: "settings.manage" },
  { key: "security", label: "Security", icon: <LockOutlined />, perm: "settings.manage" },
  { key: "log", label: "Log", icon: <FileTextOutlined />, perm: "systemlogs.view" },
  { key: "extra", label: "Extra", icon: <AppstoreAddOutlined />, perm: "settings.manage" },
];

/** Settings page frame: header, one tab per route (/admin/settings/general, /security, /log, /extra) and the loaded values. */
export default function SettingsShell({ children }: { children: React.ReactNode }) {
  const { can, refresh } = useAdmin();
  const path = usePathname();
  const router = useRouter();
  const [s, setS] = useState<SettingsValues | null>(null);

  useEffect(() => { if (can("settings.manage")) api<SettingsValues>("/settings").then(setS).catch(() => {}); }, [can]);
  const save = useCallback(async (group: SettingsGroup, values: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    const r = await api<SettingsValues>("/settings", { method: "PUT", body: { [group]: values, ...extra } });
    setS(r);
    if (group === "security") refresh();
    return r;
  }, [refresh]);

  if (!can("settings.manage")) return <NoAccess />;
  const active = TABS.find((t) => path.startsWith(`/admin/settings/${t.key}`))?.key ?? "general";

  return (
    <div className="page page-settings">
      <PageHead title="Settings" sub="Changes apply straight away and are recorded in the audit log." />
      <Tabs className="settings-tabs" activeKey={active} onChange={(k) => router.push(`/admin/settings/${k}`)}
        items={TABS.filter((t) => can(t.perm)).map((t) => ({
          key: t.key,
          label: <span className={`settings-tab settings-tab--${t.key} inline-flex items-center gap-1.5`}>{t.icon}{t.label}</span>,
        }))} />
      {!s ? <Skeleton className="page-loading" active /> : (
        <SettingsContext.Provider value={{ s, save }}>
          <div className={`settings-panel settings-panel--${active} grid gap-4${active === "log" ? "" : " max-w-[760px]"}`}>{children}</div>
        </SettingsContext.Provider>
      )}
    </div>
  );
}
