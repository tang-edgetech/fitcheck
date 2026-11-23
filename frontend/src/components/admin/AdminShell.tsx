"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { App, Avatar, Button, Dropdown, Layout, Menu, Spin, Tag } from "antd";
import {
  AppstoreOutlined, AuditOutlined, DashboardOutlined, DownOutlined, ExportOutlined, FileSearchOutlined, LogoutOutlined,
  MenuOutlined, MobileOutlined, QuestionCircleOutlined, SettingOutlined, TeamOutlined, UserOutlined,
} from "@ant-design/icons";
import { AUTH_EVENT } from "@/lib/api";
import { pendingSetup, useAdmin } from "./AdminProvider";
import Brand from "./Brand";
import HelpButton, { HANDBOOK_URL } from "./HelpButton";

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

  if (!me || pendingSetup(me)) return <div className="admin-loading grid min-h-dvh place-items-center"><Spin size="large" /></div>;

  const items = NAV.filter((n) => can(n.perm)).map((n) => ({ key: n.key, className: "admin-nav-item admin-nav-item--" + (n.key.split("/")[2] ?? "dashboard"), icon: n.icon, label: <Link href={n.key}>{n.label}</Link> }));
  const selected = NAV.map((n) => n.key).filter((k) => k === "/admin" ? path === "/admin" : path.startsWith(k)).pop() ?? "/admin";
  const signOut = async () => { await logout(); message.success("Signed out."); router.replace("/admin/login"); };

  const menu = <Menu mode="inline" selectedKeys={[selected]} items={items} className="admin-nav border-0 px-2" onClick={() => setMobileOpen(false)} />;

  return (
    <Layout className="admin-layout min-h-dvh">
      <Layout.Sider width={232} breakpoint="lg" collapsedWidth={0} trigger={null} collapsed={false}
        className="admin-sidebar !fixed inset-y-0 left-0 z-30 border-0 border-r border-solid border-[#e3e8ee] max-lg:hidden">
        <div className="admin-sidebar-brand flex h-16 items-center px-5"><Link href="/admin" className="admin-sidebar-brand-link text-inherit no-underline"><Brand /></Link></div>
        {menu}
      </Layout.Sider>
      {mobileOpen && (
        <div className="admin-mobile-nav fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="admin-mobile-nav-panel h-full w-64 bg-white pt-2" onClick={(e) => e.stopPropagation()}>
            <div className="admin-mobile-nav-brand flex h-14 items-center px-5"><Brand /></div>
            {menu}
          </div>
        </div>
      )}
      <Layout className="admin-main lg:ml-[232px]">
        <Layout.Header className="admin-header sticky top-0 z-20 flex h-16 items-center gap-3 border-0 border-b border-solid border-[#e3e8ee] px-6 leading-none max-md:px-4">
          <Button className="admin-header-menu-toggle lg:hidden" icon={<MenuOutlined />} onClick={() => setMobileOpen(true)} aria-label="Open menu" />
          <span className="admin-header-spacer flex-1" />
          <a href={HANDBOOK_URL} target="_blank" rel="noopener" className="admin-header-handbook-link inline-flex items-center gap-1.5 text-[14px] text-[#5c6978]"><QuestionCircleOutlined /> <span className="max-sm:hidden">User guide</span></a>
          <a href="/" target="_blank" rel="noopener" className="admin-header-tester-link inline-flex items-center gap-1.5 text-[14px] text-[#5c6978]">Open tester <ExportOutlined /></a>
          <Dropdown trigger={["click"]} menu={{ className: "admin-user-dropdown", items: [
            { key: "p", className: "admin-user-dropdown-item admin-user-dropdown-item--profile", icon: <UserOutlined />, label: <Link href="/admin/profile">My profile</Link> },
            { type: "divider" },
            { key: "o", className: "admin-user-dropdown-item admin-user-dropdown-item--sign-out", icon: <LogoutOutlined />, label: "Sign out", onClick: signOut },
          ] }}>
            <Button type="text" className="admin-user-menu flex h-11 items-center gap-2.5 px-2">
              <Avatar size={30} className="admin-user-avatar bg-[#2f5bea]">{(me.display_name || me.username).slice(0, 1).toUpperCase()}</Avatar>
              <span className="admin-user-info text-left leading-tight max-sm:hidden">
                <span className="admin-user-name block text-[14px] font-semibold">{me.display_name || me.username}</span>
                <span className="admin-user-role block text-[12px] text-[#5c6978]">{me.role_label}{me.two_factor_enabled ? "" : " · 2FA off"}</span>
              </span>
              <DownOutlined className="text-[11px] text-[#5c6978]" />
            </Button>
          </Dropdown>
        </Layout.Header>
        <Layout.Content className="admin-body p-6 max-md:p-4">
          <div className="admin-content w-full">{children}</div>
        </Layout.Content>
        <Layout.Footer className="admin-footer bg-transparent pt-0 text-center text-[12px] text-[#8a96a5]">
          Signed in as {me.username} · sessions end after {me.session_timeout_minutes} minutes without activity {me.two_factor_enforced && <Tag className="admin-footer-tag ml-2" color="blue">2FA required</Tag>}
        </Layout.Footer>
      </Layout>
    </Layout>
  );
}

/** Page heading used on every admin page. */
export function PageHead({ title, sub, extra }: { title: string; sub?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="page-header mb-5 flex flex-wrap items-end gap-3">
      <div className="page-header-text min-w-0 flex-1">
        <div className="page-header-heading flex items-center gap-1.5">
          <h1 className="page-header-title m-0 text-[22px] font-semibold tracking-tight">{title}</h1>
          <HelpButton />
        </div>
        {sub && <p className="page-header-subtitle mb-0 mt-1 text-[#5c6978]">{sub}</p>}
      </div>
      {extra && <div className="page-header-actions flex flex-wrap gap-2">{extra}</div>}
    </div>
  );
}

/** Shown when a page's permission is missing (the menu already hides it). */
export function NoAccess() {
  return <p className="no-access text-[#5c6978]">Your role doesn&apos;t include this page.</p>;
}
