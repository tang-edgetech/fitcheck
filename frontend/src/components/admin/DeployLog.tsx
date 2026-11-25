"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Descriptions, Empty, Table, Tag, Tooltip } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";

interface Commit { hash: string; date: string; author: string; subject: string }
interface Check { checked_at: string; result: "up-to-date" | "new-commits" | "fetch-failed"; message: string | null; branch: string | null; head: Commit | null; remote: Commit | null }
interface Run {
  started_at: string; finished_at: string; seconds: number; result: "success" | "failed"; failed_step: string | null; exit_code: number | null;
  trigger: string; branch: string | null; from: string | null; to: string | null; parts: string[]; note: string | null; commits: Commit[]; log_tail: string | null;
}
interface Data { check: Check | null; runs: Run[]; repo: { branch: string | null; commit: string | null } | null; github?: Commit | null }

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
};
const when = (iso: string) => <Tooltip title={new Date(iso).toLocaleString()}><span className="deploy-time">{ago(iso)}</span></Tooltip>;
const dur = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);
const commitText = (c: Commit | null | undefined) => (c ? <><code className="deploy-hash">{c.hash}</code> {c.subject} <span className="text-[#8a96a5]">· {c.author}</span></> : "—");

const CHECK_TAG: Record<Check["result"], React.ReactNode> = {
  "up-to-date": <Tag className="deploy-tag deploy-tag--up-to-date" color="green">Up to date</Tag>,
  "new-commits": <Tag className="deploy-tag deploy-tag--new" color="blue">New commits found</Tag>,
  "fetch-failed": <Tag className="deploy-tag deploy-tag--fetch-failed" color="red">Couldn&apos;t reach GitHub</Tag>,
};
const runTag = (r: Run) => (r.result === "success"
  ? <Tag className="deploy-tag deploy-tag--success" color="green">Success</Tag>
  : <Tag className="deploy-tag deploy-tag--failed" color="red">Failed</Tag>);

/** Settings > Log: the auto-deploy cron job (deploy/deploy.sh): last check, latest commit, and recent deploys. */
export default function DeployLog() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadedAt, setLoadedAt] = useState(0);
  const load = useCallback(() => {
    setBusy(true);
    api<Data>("/settings/deploy-log").then((d) => { setData(d); setLoadedAt(Date.now()); setError(false); }).catch(() => setError(true)).finally(() => setBusy(false));
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load once when the tab opens
  useEffect(() => { load(); }, [load]);

  const check = data?.check, last = data?.runs[0];
  // GitHub asked just now (public repositories), else what the cron job saw at its last check
  const latest = data?.github ?? check?.remote;
  const waiting = !!(latest && check?.head && latest.hash.slice(0, 7) !== check.head.hash.slice(0, 7));
  const stale = check && loadedAt - new Date(check.checked_at).getTime() > 60 * 60 * 1000;

  return (
    <Card className="settings-card settings-card--deploys" title="Deploys (auto pull and build)"
      extra={<Button className="deploy-reload" size="small" icon={<ReloadOutlined />} loading={busy} onClick={load}>Refresh</Button>}>
      {error && <Alert className="deploy-alert" type="error" showIcon title="Could not load the deploy log." />}
      {data && !check && !data.runs.length && (
        <Alert className="deploy-alert deploy-alert--none" type="info" showIcon title="No deploys recorded yet"
          description={<>They appear here once the cron job runs <code>deploy/deploy.sh</code> on the server (every 15 minutes).{data.repo?.commit && <> This copy runs commit <code>{data.repo.commit}</code> on <b>{data.repo.branch}</b>.</>}</>} />
      )}
      {stale && (
        <Alert className="deploy-alert deploy-alert--stale mb-3" type="warning" showIcon title={`The cron job last checked ${ago(check.checked_at)}`}
          description="It normally checks every 15 minutes. Check the cron entry in cPanel → Cron Jobs." />
      )}
      {check && (
        <Descriptions className="deploy-summary mb-4" size="small" column={1} bordered>
          <Descriptions.Item label="Running now">{commitText(check.head)}{check.branch && <Tag className="deploy-branch ml-2">{check.branch}</Tag>}</Descriptions.Item>
          <Descriptions.Item label="Latest on GitHub">{commitText(latest)}{waiting && <Tag className="deploy-tag deploy-tag--waiting ml-2" color="gold">Deploys at the next check (every 15 min)</Tag>}</Descriptions.Item>
          <Descriptions.Item label="Last check">{CHECK_TAG[check.result]} {when(check.checked_at)}{check.message && <div className="deploy-check-message mt-1 text-[12px] text-[#5c6978]">{check.message}</div>}</Descriptions.Item>
          <Descriptions.Item label="Last deploy">{last ? <>{runTag(last)} {when(last.finished_at)} · took {dur(last.seconds)}{last.result === "failed" && last.failed_step && <> · stopped at <b>{last.failed_step}</b></>}</> : "None yet"}</Descriptions.Item>
        </Descriptions>
      )}
      {data && (data.runs.length > 0 || check) && (
        <Table<Run> className="deploy-runs" size="small" rowKey={(r) => r.started_at} dataSource={data.runs} pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty className="empty-state" image={Empty.PRESENTED_IMAGE_SIMPLE} description="No deploys yet: nothing new has been pushed since the cron job started." /> }}
          scroll={{ x: 640 }}
          expandable={{
            rowExpandable: (r) => r.commits.length > 0 || !!r.log_tail || !!r.note,
            expandedRowRender: (r) => (
              <div className="deploy-run-detail grid gap-2">
                {r.note && <Alert className="deploy-run-note" type="info" showIcon title={r.note} />}
                {r.commits.length > 0 && (
                  <ul className="deploy-run-commits m-0 grid list-none gap-1 p-0">
                    {r.commits.map((c) => <li key={c.hash}>{commitText(c)} <span className="text-[12px] text-[#8a96a5]">{new Date(c.date).toLocaleString()}</span></li>)}
                  </ul>
                )}
                {r.log_tail && <pre className="deploy-run-log m-0 max-h-72 overflow-auto rounded-md bg-[#0f1720] p-3 text-[12px] leading-snug text-[#d7dee7]">{r.log_tail}</pre>}
              </div>
            ),
          }}
          columns={[
            { title: "When", key: "when", width: 120, render: (_, r) => when(r.finished_at) },
            { title: "Result", key: "result", width: 170, render: (_, r) => <>{runTag(r)}{r.result === "failed" && r.failed_step && <div className="text-[12px] text-[#b42318]">at {r.failed_step}</div>}</> },
            { title: "Commit", key: "commit", render: (_, r) => <>{r.from && r.from !== r.to && <><code>{r.from}</code> → </>}<code>{r.to}</code>{r.commits[0] && <span className="ml-1.5 text-[#5c6978]">{r.commits[0].subject}{r.commits.length > 1 && ` +${r.commits.length - 1} more`}</span>}</> },
            { title: "Updated", key: "parts", width: 110, render: (_, r) => (r.parts.length ? r.parts.join(" + ") : "Nothing (docs only)") },
            { title: "Took", key: "took", width: 80, render: (_, r) => dur(r.seconds) },
            { title: "Started by", dataIndex: "trigger", width: 120 },
          ]}
        />
      )}
    </Card>
  );
}
