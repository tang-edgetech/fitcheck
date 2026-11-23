"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { App, ConfigProvider } from "antd";
import { api, ApiError } from "@/lib/api";
import type { Me } from "@/lib/types";

/* Admin look: cool slate with a strong blue, Inter. Deliberately different from the warm tester. */
const adminTheme = {
  token: {
    colorPrimary: "#2f5bea",
    colorSuccess: "#1a8a4b",
    colorError: "#c93a3a",
    colorBgLayout: "#f3f5f8",
    colorText: "#17202b",
    colorTextSecondary: "#5c6978",
    colorBorderSecondary: "#e3e8ee",
    borderRadius: 8,
    fontFamily: "var(--font-inter), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Layout: { siderBg: "#ffffff", headerBg: "#ffffff", bodyBg: "#f3f5f8" },
    Menu: { itemSelectedBg: "#e6ecfd", itemSelectedColor: "#2f5bea", itemBorderRadius: 8 },
    Table: { headerBg: "#f7f9fb", rowSelectedBg: "#eef2fd", rowSelectedHoverBg: "#e6ecfd" },
  },
};

interface Ctx {
  me: Me | null;
  loaded: boolean;
  setMe: (m: Me | null) => void;
  refresh: () => Promise<Me | null>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
}
const AdminCtx = createContext<Ctx | null>(null);

export function useAdmin() {
  const c = useContext(AdminCtx);
  if (!c) throw new Error("useAdmin outside AdminRoot");
  return c;
}

/** Steps a user must finish before using the panel (default password, profile, required 2FA). */
export function pendingSetup(me: Me | null) {
  return !!me && (me.must_change_password || me.needs_profile || me.needs_two_factor);
}

export default function AdminRoot({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const m = await api<Me>("/auth/me", { quiet401: true });
      setMe(m);
      return m;
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) console.error(e);
      setMe(null);
      return null;
    } finally {
      setLoaded(true);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api("/auth/logout", { method: "POST", quiet401: true }); } catch { /* already signed out */ }
    setMe(null);
  }, []);

  const value = useMemo<Ctx>(() => ({
    me, loaded, setMe, refresh, logout,
    can: (p) => !!me?.permissions.includes(p),
  }), [me, loaded, refresh, logout]);

  return (
    <ConfigProvider theme={adminTheme}>
      <App>
        <AdminCtx.Provider value={value}>
          <div className="min-h-dvh bg-[#f3f5f8] font-[family-name:var(--font-inter)] text-[#17202b]">{children}</div>
        </AdminCtx.Provider>
      </App>
    </ConfigProvider>
  );
}
