"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, App, Button, DatePicker, Descriptions, Dropdown, Input, Select, Table, Tag } from "antd";
import type { TableProps } from "antd";
import { DownloadOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { api, ApiError, download } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import { actionLabel, activityText } from "@/lib/activity";
import type { AuditLog } from "@/lib/types";
import { useAdmin } from "@/components/admin/AdminProvider";
import { NoAccess, PageHead } from "@/components/admin/AdminShell";

interface Resp { data: AuditLog[]; total: number; actions: string[] }
type Filters = { q?: string; status?: string; action?: string[]; from?: string; to?: string };

export default function AuditLogPage() {
  const { can } = useAdmin();
  const { message } = App.useApp();
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState({ current: 1, pageSize: 50 });
  const [selected, setSelected] = useState<number[]>([]);
  const [verify, setVerify] = useState<{ intact: boolean; first_broken_id: number | null; total: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<Resp>("/audit-logs", { query: { ...filters, page: page.current, per_page: page.pageSize } });
      setRows(r.data); setTotal(r.total); setActions(r.actions);
    } catch (e) { message.error(e instanceof ApiError ? e.message : "Could not load the audit log."); }
    finally { setLoading(false); }
  }, [filters, page, message]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch from the API when the page opens or its filters change
  useEffect(() => { if (can("audit.view")) load(); }, [load, can]);
  if (!can("audit.view")) return <NoAccess />;

  const setF = (p: Partial<Filters>) => { setFilters((f) => ({ ...f, ...p })); setPage((x) => ({ ...x, current: 1 })); };
  const exportRows = async (format: "json" | "csv", all: boolean) => {
    try {
      await download("/audit-logs/export", all ? { format, all: true, ...filters } : { format, ids: selected }, `fitcheck-audit.${format}`);
      message.success(all ? `Exported all ${total} matching rows as ${format.toUpperCase()}.` : `Exported ${selected.length} rows as ${format.toUpperCase()}.`);
      load(); // the export itself is now in the log
    } catch (e) { message.error(e instanceof ApiError ? e.message : "Export failed."); }
  };
  const runVerify = async () => {
    try { setVerify(await api("/audit-logs/verify")); } catch (e) { message.error(e instanceof ApiError ? e.message : "Could not check."); }
  };

  const columns: TableProps<AuditLog>["columns"] = [
    { title: "Time", dataIndex: "created_at", width: 190, className: "audit-col-time", render: (v) => <span className="audit-time whitespace-nowrap text-[13px]">{fmtTime(v)}</span> },
    { title: "User", dataIndex: "username", width: 140, className: "audit-col-user", render: (v) => <span className="audit-user">{v ?? <span className="text-[#8a96a5]">anonymous</span>}</span> },
    { title: "Activity", key: "activity", className: "audit-col-activity", render: (_, r) => <span className="audit-activity">{activityText(r, false)}</span> },
    { title: "Status", dataIndex: "status", width: 100, className: "audit-col-status", render: (v) => <Tag className={`status-badge status-badge--${v}`} color={v === "success" ? "green" : "red"}>{v === "success" ? "Success" : "Failed"}</Tag> },
    { title: "HTTP", dataIndex: "http_status", width: 84, className: "audit-col-http", render: (v: number | null) => <HttpStatus code={v} /> },
    { title: "IP", dataIndex: "ip", width: 130, responsive: ["lg"], className: "audit-col-ip", render: (v) => <span className="audit-ip font-mono text-[12px]">{v}</span> },
  ];

  return (
    <div className="page page-audit-log">
      <PageHead title="Audit log" sub="Every sign-in, change, export and denied request, with whether it succeeded. Rows can't be edited or deleted."
        extra={<>
          <Button className="audit-verify-btn" icon={<SafetyCertificateOutlined />} onClick={runVerify}>Check integrity</Button>
          {can("audit.export") && (
            <Dropdown menu={{ items: [
              { key: "j", label: `All ${total} matching rows as JSON`, onClick: () => exportRows("json", true) },
              { key: "c", label: `All ${total} matching rows as CSV`, onClick: () => exportRows("csv", true) },
            ] }}><Button className="audit-export-all-btn" icon={<DownloadOutlined />}>Export all matching</Button></Dropdown>
          )}
        </>} />

      {verify && (
        <Alert className={`audit-integrity-alert audit-integrity-alert--${verify.intact ? "intact" : "broken"} mb-3`} closable={{ onClose: () => setVerify(null) }} showIcon type={verify.intact ? "success" : "error"}
          title={verify.intact ? `All ${verify.total} rows are intact.` : `The log was changed outside the app, starting at row #${verify.first_broken_id}.`}
          description={verify.intact ? "Each row's fingerprint matches the one before it, so nothing was edited or removed." : "Rows from this point no longer match their fingerprints. Investigate database access."} />
      )}

      <div className="filter-bar mb-3 flex flex-wrap gap-2">
        <Input.Search allowClear placeholder="Search user, target or IP" className="filter-bar-search w-72" onSearch={(q) => setF({ q })} />
        <Select allowClear placeholder="Status" className="filter-bar-status w-32" options={[{ value: "success", label: "Success" }, { value: "failed", label: "Failed" }]} onChange={(status) => setF({ status })} />
        <Select mode="multiple" allowClear maxTagCount="responsive" placeholder="Activity" className="filter-bar-activity min-w-56" options={actions.map((a) => ({ value: a, label: actionLabel(a) })).sort((x, y) => x.label.localeCompare(y.label))} onChange={(action) => setF({ action })} />
        <DatePicker.RangePicker className="filter-bar-dates" showTime onChange={(v) => setF({ from: (v?.[0] as Dayjs | null)?.toISOString(), to: (v?.[1] as Dayjs | null)?.toISOString() })} />
      </div>

      {selected.length > 0 && (
        <div className="bulk-bar mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#e6ecfd] px-4 py-2.5">
          <b className="bulk-bar-count">{selected.length} selected</b><span className="flex-1" />
          {can("audit.export") && <>
            <Button className="bulk-bar-btn bulk-bar-btn--json" size="small" icon={<DownloadOutlined />} onClick={() => exportRows("json", false)}>Export JSON</Button>
            <Button className="bulk-bar-btn bulk-bar-btn--csv" size="small" icon={<DownloadOutlined />} onClick={() => exportRows("csv", false)}>Export CSV</Button>
          </>}
          <Button className="bulk-bar-btn bulk-bar-btn--clear" size="small" type="text" onClick={() => setSelected([])}>Clear</Button>
        </div>
      )}

      <Table<AuditLog>
        className="data-table data-table--audit" rowKey="id" size="middle" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 760 }}
        rowSelection={{ selectedRowKeys: selected, onChange: (k) => setSelected(k as number[]), preserveSelectedRowKeys: true }}
        rowClassName={(r) => `data-table-row audit-row--${r.status}${r.status === "failed" ? " bg-[#fff8f8]" : ""}`}
        pagination={{ ...page, total, showSizeChanger: true, pageSizeOptions: [25, 50, 100, 200], showTotal: (t) => `${t} entries` }}
        onChange={(p) => setPage({ current: p.current ?? 1, pageSize: p.pageSize ?? 50 })}
        expandable={{ expandedRowRender: (r) => (
          <Descriptions className="audit-details" size="small" column={{ xs: 1, md: 2 }} bordered items={[
            { key: "a", label: "Action code", children: <code>{r.action}</code> },
            { key: "t", label: "Target", children: r.target_label ?? (r.target_type ? `${r.target_type} #${r.target_id}` : "—") },
            { key: "m", label: "Request", children: <code>{r.method} {r.path}</code> },
            { key: "h", label: "HTTP status", children: <HttpStatus code={r.http_status} long /> },
            { key: "ip", label: "IP address", children: r.ip ?? "—" },
            { key: "ua", label: "Browser", children: <span className="text-[12px]">{r.user_agent ?? "—"}</span> },
            { key: "d", label: "Details", span: 2, children: r.meta ? <pre className="m-0 max-h-80 overflow-auto whitespace-pre-wrap text-[12px]">{JSON.stringify(r.meta, null, 2)}</pre> : "—" },
          ]} />
        ) }}
      />
    </div>
  );
}

const HTTP_TEXT: Record<number, string> = { 200: "OK", 201: "Created", 204: "No content", 401: "Not signed in", 403: "Not allowed", 404: "Not found", 419: "Session expired", 422: "Invalid input", 423: "Setup required", 429: "Too many attempts", 500: "Server error" };

/** HTTP status code as a small coloured badge: green 2xx, amber 4xx, red 5xx. */
function HttpStatus({ code, long = false }: { code: number | null; long?: boolean }) {
  if (code == null) return <span className="http-status http-status--none text-[#8a96a5]" title="Recorded before HTTP status was stored">—</span>;
  const kind = code >= 500 ? "error" : code >= 400 ? "warning" : "success";
  const color = { error: "red", warning: "orange", success: "green" }[kind];
  return <Tag className={`http-status http-status--${kind} m-0 font-mono`} color={color} title={HTTP_TEXT[code]}>{code}{long && HTTP_TEXT[code] ? ` ${HTTP_TEXT[code]}` : ""}</Tag>;
}
