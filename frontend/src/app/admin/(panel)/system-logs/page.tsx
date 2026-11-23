"use client";

import { useCallback, useEffect, useState } from "react";
import { App, DatePicker, Input, Select, Table, Tag } from "antd";
import type { TableProps } from "antd";
import type { Dayjs } from "dayjs";
import { api, ApiError } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import type { SystemLog } from "@/lib/types";
import { useAdmin } from "@/components/admin/AdminProvider";
import { NoAccess, PageHead } from "@/components/admin/AdminShell";

const LEVELS = ["emergency", "alert", "critical", "error", "warning", "notice", "info", "debug"];
const COLOR: Record<string, string> = { emergency: "magenta", alert: "magenta", critical: "red", error: "red", warning: "orange", notice: "blue", info: "default", debug: "default" };

export default function SystemLogPage() {
  const { can } = useAdmin();
  const { message } = App.useApp();
  const [rows, setRows] = useState<SystemLog[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ q?: string; level?: string[]; from?: string; to?: string }>({});
  const [page, setPage] = useState({ current: 1, pageSize: 50 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ data: SystemLog[]; total: number; counts: Record<string, number> }>("/system-logs", { query: { ...filters, page: page.current, per_page: page.pageSize } });
      setRows(r.data); setTotal(r.total); setCounts(r.counts);
    } catch (e) { message.error(e instanceof ApiError ? e.message : "Could not load the system log."); }
    finally { setLoading(false); }
  }, [filters, page, message]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch from the API when the page opens or its filters change
  useEffect(() => { if (can("systemlogs.view")) load(); }, [load, can]);
  if (!can("systemlogs.view")) return <NoAccess />;

  const setF = (p: object) => { setFilters((f) => ({ ...f, ...p })); setPage((x) => ({ ...x, current: 1 })); };
  const columns: TableProps<SystemLog>["columns"] = [
    { title: "Time", dataIndex: "created_at", width: 190, className: "syslog-col-time", render: (v) => <span className="syslog-time whitespace-nowrap text-[13px]">{fmtTime(v)}</span> },
    { title: "Level", dataIndex: "level", width: 100, className: "syslog-col-level", render: (v) => <Tag className={`log-level log-level--${v}`} color={COLOR[v]}>{v}</Tag> },
    { title: "Message", dataIndex: "message", className: "syslog-col-message", render: (v) => <span className="syslog-message line-clamp-2 break-words">{v}</span> },
    { title: "Where", dataIndex: "url", responsive: ["lg"], width: 260, className: "syslog-col-url", render: (v) => <span className="syslog-url line-clamp-1 font-mono text-[12px] text-[#5c6978]">{v}</span> },
  ];

  return (
    <div className="page page-system-logs">
      <PageHead title="System log" sub="Application errors, warnings and notable events written by the server. Developers only."
        extra={<div className="syslog-summary flex flex-wrap items-center gap-1.5 text-[13px] text-[#5c6978]">Last 24 h:{Object.keys(counts).length ? Object.entries(counts).map(([l, n]) => <Tag key={l} className={`syslog-summary-count log-level log-level--${l}`} color={COLOR[l]}>{l} {n}</Tag>) : " nothing logged"}</div>} />
      <div className="filter-bar mb-3 flex flex-wrap gap-2">
        <Input.Search allowClear placeholder="Search message or URL" className="filter-bar-search w-72" onSearch={(q) => setF({ q })} />
        <Select mode="multiple" allowClear placeholder="Level" className="filter-bar-level min-w-48" options={LEVELS.map((l) => ({ value: l, label: l }))} onChange={(level) => setF({ level })} />
        <DatePicker.RangePicker className="filter-bar-dates" showTime onChange={(v) => setF({ from: (v?.[0] as Dayjs | null)?.toISOString(), to: (v?.[1] as Dayjs | null)?.toISOString() })} />
      </div>
      <Table<SystemLog>
        className="data-table data-table--system-logs" rowKey="id" size="middle" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 700 }}
        rowClassName={(r) => `data-table-row syslog-row--${r.level}`}
        pagination={{ ...page, total, showSizeChanger: true, showTotal: (t) => `${t} entries` }}
        onChange={(p) => setPage({ current: p.current ?? 1, pageSize: p.pageSize ?? 50 })}
        expandable={{ expandedRowRender: (r) => (
          <div className="syslog-details grid gap-2 text-[13px]">
            <div className="syslog-details-message"><b className="syslog-details-label">Message:</b> <span className="syslog-details-value whitespace-pre-wrap">{r.message}</span></div>
            <div className="syslog-details-meta"><b className="syslog-details-label">URL:</b> <code className="syslog-details-url">{r.url}</code> · <b className="syslog-details-label">IP:</b> {r.ip ?? "—"} · <b className="syslog-details-label">User id:</b> {r.user_id ?? "—"} · <b className="syslog-details-label">Channel:</b> {r.channel}</div>
            {r.context && <pre className="syslog-details-context m-0 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-[#f7f9fb] p-3 text-[12px]">{JSON.stringify(r.context, null, 2)}</pre>}
          </div>
        ) }}
      />
    </div>
  );
}
