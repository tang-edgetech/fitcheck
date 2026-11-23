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
    { title: "Time", dataIndex: "created_at", width: 190, render: (v) => <span className="whitespace-nowrap text-[13px]">{fmtTime(v)}</span> },
    { title: "Level", dataIndex: "level", width: 100, render: (v) => <Tag color={COLOR[v]}>{v}</Tag> },
    { title: "Message", dataIndex: "message", render: (v) => <span className="line-clamp-2 break-words">{v}</span> },
    { title: "Where", dataIndex: "url", responsive: ["lg"], width: 260, render: (v) => <span className="line-clamp-1 font-mono text-[12px] text-[#5c6978]">{v}</span> },
  ];

  return (
    <>
      <PageHead title="System log" sub="Application errors, warnings and notable events written by the server. Developers only."
        extra={<div className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#5c6978]">Last 24 h:{Object.keys(counts).length ? Object.entries(counts).map(([l, n]) => <Tag key={l} color={COLOR[l]}>{l} {n}</Tag>) : " nothing logged"}</div>} />
      <div className="mb-3 flex flex-wrap gap-2">
        <Input.Search allowClear placeholder="Search message or URL" className="w-72" onSearch={(q) => setF({ q })} />
        <Select mode="multiple" allowClear placeholder="Level" className="min-w-48" options={LEVELS.map((l) => ({ value: l, label: l }))} onChange={(level) => setF({ level })} />
        <DatePicker.RangePicker showTime onChange={(v) => setF({ from: (v?.[0] as Dayjs | null)?.toISOString(), to: (v?.[1] as Dayjs | null)?.toISOString() })} />
      </div>
      <Table<SystemLog>
        rowKey="id" size="middle" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 700 }}
        pagination={{ ...page, total, showSizeChanger: true, showTotal: (t) => `${t} entries` }}
        onChange={(p) => setPage({ current: p.current ?? 1, pageSize: p.pageSize ?? 50 })}
        expandable={{ expandedRowRender: (r) => (
          <div className="grid gap-2 text-[13px]">
            <div><b>Message:</b> <span className="whitespace-pre-wrap">{r.message}</span></div>
            <div><b>URL:</b> <code>{r.url}</code> · <b>IP:</b> {r.ip ?? "—"} · <b>User id:</b> {r.user_id ?? "—"} · <b>Channel:</b> {r.channel}</div>
            {r.context && <pre className="m-0 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-[#f7f9fb] p-3 text-[12px]">{JSON.stringify(r.context, null, 2)}</pre>}
          </div>
        ) }}
      />
    </>
  );
}
