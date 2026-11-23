"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, App, Button, DatePicker, Descriptions, Dropdown, Input, Select, Table, Tag } from "antd";
import type { TableProps } from "antd";
import { DownloadOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { api, ApiError, download } from "@/lib/api";
import { fmtTime } from "@/lib/format";
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
    { title: "Time", dataIndex: "created_at", width: 190, render: (v) => <span className="whitespace-nowrap text-[13px]">{fmtTime(v)}</span> },
    { title: "User", dataIndex: "username", width: 140, render: (v) => v ?? <span className="text-[#8a96a5]">anonymous</span> },
    { title: "Action", dataIndex: "action", render: (v) => <code className="text-[13px]">{v}</code> },
    { title: "Target", key: "t", responsive: ["md"], render: (_, r) => r.target_label ?? (r.target_type ? `${r.target_type} #${r.target_id}` : <span className="text-[#8a96a5]">—</span>) },
    { title: "Status", dataIndex: "status", width: 100, render: (v) => <Tag color={v === "success" ? "green" : "red"}>{v === "success" ? "Success" : "Failed"}</Tag> },
    { title: "IP", dataIndex: "ip", width: 130, responsive: ["lg"], render: (v) => <span className="font-mono text-[12px]">{v}</span> },
  ];

  return (
    <>
      <PageHead title="Audit log" sub="Every sign-in, change, export and denied request, with whether it succeeded. Rows can't be edited or deleted."
        extra={<>
          <Button icon={<SafetyCertificateOutlined />} onClick={runVerify}>Check integrity</Button>
          {can("audit.export") && (
            <Dropdown menu={{ items: [
              { key: "j", label: `All ${total} matching rows as JSON`, onClick: () => exportRows("json", true) },
              { key: "c", label: `All ${total} matching rows as CSV`, onClick: () => exportRows("csv", true) },
            ] }}><Button icon={<DownloadOutlined />}>Export all matching</Button></Dropdown>
          )}
        </>} />

      {verify && (
        <Alert className="mb-3" closable={{ onClose: () => setVerify(null) }} showIcon type={verify.intact ? "success" : "error"}
          title={verify.intact ? `All ${verify.total} rows are intact.` : `The log was changed outside the app, starting at row #${verify.first_broken_id}.`}
          description={verify.intact ? "Each row's fingerprint matches the one before it, so nothing was edited or removed." : "Rows from this point no longer match their fingerprints. Investigate database access."} />
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <Input.Search allowClear placeholder="Search user, action, target or IP" className="w-72" onSearch={(q) => setF({ q })} />
        <Select allowClear placeholder="Status" className="w-32" options={[{ value: "success", label: "Success" }, { value: "failed", label: "Failed" }]} onChange={(status) => setF({ status })} />
        <Select mode="multiple" allowClear maxTagCount="responsive" placeholder="Action" className="min-w-56" options={actions.map((a) => ({ value: a, label: a }))} onChange={(action) => setF({ action })} />
        <DatePicker.RangePicker showTime onChange={(v) => setF({ from: (v?.[0] as Dayjs | null)?.toISOString(), to: (v?.[1] as Dayjs | null)?.toISOString() })} />
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#e6ecfd] px-4 py-2.5">
          <b>{selected.length} selected</b><span className="flex-1" />
          {can("audit.export") && <>
            <Button size="small" icon={<DownloadOutlined />} onClick={() => exportRows("json", false)}>Export JSON</Button>
            <Button size="small" icon={<DownloadOutlined />} onClick={() => exportRows("csv", false)}>Export CSV</Button>
          </>}
          <Button size="small" type="text" onClick={() => setSelected([])}>Clear</Button>
        </div>
      )}

      <Table<AuditLog>
        rowKey="id" size="middle" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 760 }}
        rowSelection={{ selectedRowKeys: selected, onChange: (k) => setSelected(k as number[]), preserveSelectedRowKeys: true }}
        rowClassName={(r) => (r.status === "failed" ? "bg-[#fff8f8]" : "")}
        pagination={{ ...page, total, showSizeChanger: true, pageSizeOptions: [25, 50, 100, 200], showTotal: (t) => `${t} entries` }}
        onChange={(p) => setPage({ current: p.current ?? 1, pageSize: p.pageSize ?? 50 })}
        expandable={{ expandedRowRender: (r) => (
          <Descriptions size="small" column={{ xs: 1, md: 2 }} bordered items={[
            { key: "m", label: "Request", children: <code>{r.method} {r.path}</code> },
            { key: "h", label: "HTTP status", children: r.http_status ?? "—" },
            { key: "ip", label: "IP address", children: r.ip ?? "—" },
            { key: "ua", label: "Browser", children: <span className="text-[12px]">{r.user_agent ?? "—"}</span> },
            { key: "d", label: "Details", span: 2, children: r.meta ? <pre className="m-0 max-h-80 overflow-auto whitespace-pre-wrap text-[12px]">{JSON.stringify(r.meta, null, 2)}</pre> : "—" },
          ]} />
        ) }}
      />
    </>
  );
}
