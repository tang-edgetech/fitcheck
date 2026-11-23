"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { App, Avatar, Button, Dropdown, Layout, Menu, Spin, Tag } from "antd";
import {
  AppstoreOutlined, AuditOutlined, DashboardOutlined, DownOutlined, ExportOutlined, FileSearchOutlined, LogoutOutlined,
  MenuOutlined, MobileOutlined, SettingOutlined, TeamOutlined, UserOutlined,
} from "@ant-design/icons";
import { AUTH_EVENT } from "@/lib/api";
import { pendingSetup, useAdmin } from "./AdminProvider";
import Brand from "./Brand";

const NAV = [
  { key: "/admin", label: "Dashboard", icon: <DashboardOutlined />, perm: "dashboard.view" },
  { key: "/admin/screen-views", label: "Screen views", icon: <MobileOutlined />, perm: "screenviews.manage" },
  { key: "/admin/families", label: "Menu groups", icon: <AppstoreOutlined />, perm: "families.manage" },
  { key: "/admin/users", label: "Users", icon: <TeamOutlined />, perm: "users.manage" },
  { key: "/admin/audit-logs", label: "Audit log", icon: <AuditOutlined />, perm: "audit.view" },
  { key: "/admin/system-logs", label: "System log", icon: <FileSearchOutlined />, perm: "systemlogs.view" },
  { key: "/admin/settings", label: "Settings", icon: <SettingOutlined />, perm: "settings.manage" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { message } = App.useApp();
  const { me, refresh, logout, can } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    refresh().then((m) => {
      if (!m) router.replace("/admin/login?next=" + encodeURIComponent(path));
      else if (pendingSetup(m)) router.replace("/admin/setup");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Session ended or account setup required while using the panel */
  useEffect(() => {
    const on = (e: Event) => {
      const { status, message: msg } = (e as CustomEvent).detail as { status: number; message: string };
      if (status === 401) router.replace("/admin/login?reason=" + encodeURIComponent(msg || "Your session ended. Sign in again.") + "&next=" + encodeURIComponent(path));
      if (status === 423) router.replace("/admin/setup");
    };
    window.addEventListener(AUTH_EVENT, on);
    return () => window.removeEventListener(AUTH_EVENT, on);
  }, [router, path]);

  if (!me || pendingSetup(me)) return <div className="grid min-h-dvh place-items-center"><Spin size="large" /></div>;

  const items = NAV.filter((n) => can(n.perm)).map((n) => ({ key: n.key, icon: n.icon, label: <Link href={n.key}>{n.label}</Link> }));
  const selected = NAV.map((n) => n.key).filter((k) => k === "/admin" ? path === "/admin" : path.startsWith(k)).pop() ?? "/admin";
  const signOut = async () => { await logout(); message.success("Signed out."); router.replace("/admin/login"); };

  const menu = <Menu mode="inline" selectedKeys={[selected]} items={items} className="border-0 px-2" onClick={() => setMobileOpen(false)} />;

  return (
    <Layout className="min-h-dvh">
      <Layout.Sider width={232} breakpoint="lg" collapsedWidth={0} trigger={null} collapsed={false}
        className="!fixed inset-y-0 left-0 z-30 border-0 border-r border-solid border-[#e3e8ee] max-lg:hidden">
        <div className="flex h-16 items-center px-5"><Link href="/admin" className="text-inherit no-underline"><Brand /></Link></div>
        {menu}
      </Layout.Sider>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="h-full w-64 bg-white pt-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-14 items-center px-5"><Brand /></div>
            {menu}
          </div>
        </div>
      )}
      <Layout className="lg:ml-[232px]">
        <Layout.Header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-0 border-b border-solid border-[#e3e8ee] px-6 leading-none max-md:px-4">
          <Button className="lg:hidden" icon={<MenuOutlined />} onClick={() => setMobileOpen(true)} aria-label="Open menu" />
          <span className="flex-1" />
          <a href="/" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-[14px] text-[#5c6978]">Open tester <ExportOutlined /></a>
          <Dropdown trigger={["click"]} menu={{ items: [
            { key: "p", icon: <UserOutlined />, label: <Link href="/admin/profile">My profile</Link> },
            { type: "divider" },
            { key: "o", icon: <LogoutOutlined />, label: "Sign out", onClick: signOut },
          ] }}>
            <Button type="text" className="flex h-11 items-center gap-2.5 px-2">
              <Avatar size={30} className="bg-[#2f5bea]">{(me.display_name || me.username).slice(0, 1).toUpperCase()}</Avatar>
              <span className="text-left leading-tight max-sm:hidden">
                <span className="block text-[14px] font-semibold">{me.display_name || me.username}</span>
                <span className="block text-[12px] text-[#5c6978]">{me.role_label}{me.two_factor_enabled ? "" : " · 2FA off"}</span>
              </span>
              <DownOutlined className="text-[11px] text-[#5c6978]" />
            </Button>
          </Dropdown>
        </Layout.Header>
        <Layout.Content className="p-6 max-md:p-4">
          <div className="mx-auto max-w-[1360px]">{children}</div>
        </Layout.Content>
        <Layout.Footer className="bg-transparent pt-0 text-center text-[12px] text-[#8a96a5]">
          Signed in as {me.username} · sessions end after {me.session_timeout_minutes} minutes without activity {me.two_factor_enforced && <Tag className="ml-2" color="blue">2FA required</Tag>}
        </Layout.Footer>
      </Layout>
    </Layout>
  );
}

/** Page heading used on every admin page. */
export function PageHead({ title, sub, extra }: { title: string; sub?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="m-0 text-[22px] font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mb-0 mt-1 text-[#5c6978]">{sub}</p>}
      </div>
      {extra && <div className="flex flex-wrap gap-2">{extra}</div>}
    </div>
  );
}

/** Shown when a page's permission is missing (the menu already hides it). */
export function NoAccess() {
  return <p className="text-[#5c6978]">Your role doesn&apos;t include this page.</p>;
}
