"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Card, Progress, Skeleton, Statistic, Tag, Tooltip } from "antd";
import { api } from "@/lib/api";
import { fmtAgo, fmtTime } from "@/lib/format";
import { activityText } from "@/lib/activity";
import { useAdmin } from "@/components/admin/AdminProvider";
import { NoAccess, PageHead } from "@/components/admin/AdminShell";

interface Dash {
  screen_views: { total: number; active: number; by_type: Record<string, number> };
  families: { total: number; active: number };
  users: { total: number; active: number; two_factor: number; pending_setup: number };
  security: { two_factor_enforced: boolean; failed_logins_24h: number; failed_actions_24h: number; errors_24h: number | null };
  recent: { id: number; created_at: string; username: string | null; action: string; status: "success" | "failed"; target_label: string | null; http_status: number | null; meta: Record<string, unknown> | null }[];
}

export default function DashboardPage() {
  const { can, me } = useAdmin();
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => { if (can("dashboard.view")) api<Dash>("/dashboard").then(setD).catch(() => {}); }, [can]);
  if (!can("dashboard.view")) return <NoAccess />;

  return (
    <div className="page page-dashboard">
      <PageHead title={`Welcome, ${me?.display_name || me?.username}`} sub="What's live on the tester and how secure the panel is right now." />
      {!d ? <Skeleton active className="page-loading" /> : (
        <div className="dashboard grid gap-4">
          {!d.security.two_factor_enforced && (
            <Alert className="dashboard-alert dashboard-alert--two-factor" type="warning" showIcon title="Two-factor sign-in is optional"
              description={<>Accounts can sign in with only a password. {can("settings.manage") && <Link href="/admin/settings">Require it for everyone</Link>}</>} />
          )}
          <div className="stat-cards grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="stat-card stat-card--screen-views"><Statistic title="Screen views live on the tester" value={d.screen_views.active} suffix={<span className="text-sm text-[#5c6978]">of {d.screen_views.total}</span>} />
              <div className="stat-card-tags mt-2 flex flex-wrap gap-1">{Object.entries(d.screen_views.by_type).map(([t, n]) => <Tag key={t}>{t} {n}</Tag>)}</div></Card>
            <Card className="stat-card stat-card--menu-groups"><Statistic title="Menu groups (tester tabs)" value={d.families.active} suffix={<span className="text-sm text-[#5c6978]">active of {d.families.total}</span>} />
              <Link href="/admin/families" className="stat-card-link mt-2 inline-block text-[13px]">Manage menu groups</Link></Card>
            <Card className="stat-card stat-card--two-factor"><Statistic title="Accounts with 2FA" value={d.users.two_factor} suffix={<span className="text-sm text-[#5c6978]">of {d.users.total}</span>} />
              <Progress percent={d.users.total ? Math.round((d.users.two_factor / d.users.total) * 100) : 0} size="small" showInfo={false} className="stat-card-progress mt-2" />
              {d.users.pending_setup > 0 && <div className="stat-card-note text-[13px] text-[#5c6978]">{d.users.pending_setup} still on a temporary password</div>}</Card>
            <Card className="stat-card stat-card--failed-sign-ins"><Statistic title="Failed sign-ins, last 24 h" value={d.security.failed_logins_24h} styles={{ content: { color: d.security.failed_logins_24h ? "#c93a3a" : undefined } }} />
              <div className="stat-card-note mt-2 text-[13px] text-[#5c6978]">{d.security.failed_actions_24h} failed actions in total{d.security.errors_24h !== null && <> · {d.security.errors_24h} system errors</>}</div></Card>
          </div>
          {can("audit.view") && (
            <Card className="activity-card" title="Recent activity" extra={<Link className="activity-card-link" href="/admin/audit-logs">Open audit log</Link>}>
              {d.recent.length === 0 ? <p className="activity-empty m-0 text-[#5c6978]">No activity yet.</p> : (
                <ul className="activity-list m-0 list-none divide-x-0 divide-y divide-solid divide-[#eef1f5] p-0">
                  {d.recent.map((r) => (
                    <li key={r.id} className={`activity-item activity-item--${r.status} flex w-full items-center gap-3 py-2.5`}>
                      <Tag color={r.status === "success" ? "green" : "red"} className={`status-badge status-badge--${r.status} m-0 w-16 flex-none text-center`}>{r.status === "success" ? "Success" : "Failed"}</Tag>
                      <span className="activity-message min-w-0 flex-1">{activityText(r)}</span>
                      <Tooltip title={fmtTime(r.created_at)}>
                        <time className="activity-time flex-none whitespace-nowrap text-[13px] text-[#5c6978]" dateTime={r.created_at}>{fmtAgo(r.created_at)}</time>
                      </Tooltip>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
