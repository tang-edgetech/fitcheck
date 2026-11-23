"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Card, Progress, Skeleton, Statistic, Tag } from "antd";
import { api } from "@/lib/api";
import { fmtAgo } from "@/lib/format";
import { useAdmin } from "@/components/admin/AdminProvider";
import { NoAccess, PageHead } from "@/components/admin/AdminShell";

interface Dash {
  screen_views: { total: number; active: number; by_type: Record<string, number> };
  families: { total: number; active: number };
  users: { total: number; active: number; two_factor: number; pending_setup: number };
  security: { two_factor_enforced: boolean; failed_logins_24h: number; failed_actions_24h: number; errors_24h: number | null };
  recent: { id: number; created_at: string; username: string | null; action: string; status: string; target_label: string | null }[];
}

export default function DashboardPage() {
  const { can, me } = useAdmin();
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => { if (can("dashboard.view")) api<Dash>("/dashboard").then(setD).catch(() => {}); }, [can]);
  if (!can("dashboard.view")) return <NoAccess />;

  return (
    <>
      <PageHead title={`Welcome, ${me?.display_name || me?.username}`} sub="What's live on the tester and how secure the panel is right now." />
      {!d ? <Skeleton active /> : (
        <div className="grid gap-4">
          {!d.security.two_factor_enforced && (
            <Alert type="warning" showIcon title="Two-factor sign-in is optional"
              description={<>Accounts can sign in with only a password. {can("settings.manage") && <Link href="/admin/settings">Require it for everyone</Link>}</>} />
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card><Statistic title="Screen views live on the tester" value={d.screen_views.active} suffix={<span className="text-sm text-[#5c6978]">of {d.screen_views.total}</span>} />
              <div className="mt-2 flex flex-wrap gap-1">{Object.entries(d.screen_views.by_type).map(([t, n]) => <Tag key={t}>{t} {n}</Tag>)}</div></Card>
            <Card><Statistic title="Menu groups (tester tabs)" value={d.families.active} suffix={<span className="text-sm text-[#5c6978]">active of {d.families.total}</span>} />
              <Link href="/admin/families" className="mt-2 inline-block text-[13px]">Manage menu groups</Link></Card>
            <Card><Statistic title="Accounts with 2FA" value={d.users.two_factor} suffix={<span className="text-sm text-[#5c6978]">of {d.users.total}</span>} />
              <Progress percent={d.users.total ? Math.round((d.users.two_factor / d.users.total) * 100) : 0} size="small" showInfo={false} className="mt-2" />
              {d.users.pending_setup > 0 && <div className="text-[13px] text-[#5c6978]">{d.users.pending_setup} still on a temporary password</div>}</Card>
            <Card><Statistic title="Failed sign-ins, last 24 h" value={d.security.failed_logins_24h} styles={{ content: { color: d.security.failed_logins_24h ? "#c93a3a" : undefined } }} />
              <div className="mt-2 text-[13px] text-[#5c6978]">{d.security.failed_actions_24h} failed actions in total{d.security.errors_24h !== null && <> · {d.security.errors_24h} system errors</>}</div></Card>
          </div>
          {can("audit.view") && (
            <Card title="Recent activity" extra={<Link href="/admin/audit-logs">Open audit log</Link>}>
              {d.recent.length === 0 ? <p className="m-0 text-[#5c6978]">No activity yet.</p> : (
                <ul className="m-0 list-none divide-x-0 divide-y divide-solid divide-[#eef1f5] p-0">
                  {d.recent.map((r) => (
                    <li key={r.id} className="flex w-full flex-wrap items-center gap-3 py-2.5">
                      <Tag color={r.status === "success" ? "green" : "red"} className="w-16 text-center">{r.status === "success" ? "Success" : "Failed"}</Tag>
                      <code className="text-[13px]">{r.action}</code>
                      <span className="text-[#5c6978]">{r.target_label}</span>
                      <span className="flex-1" />
                      <span className="text-[13px] text-[#5c6978]">{r.username ?? "anonymous"} · {fmtAgo(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
