"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { App, AutoComplete, Button, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Switch, Table, Tag, Tooltip } from "antd";
import type { TableProps } from "antd";
import { CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SwapOutlined } from "@ant-design/icons";
import { api, ApiError } from "@/lib/api";
import { fmtAgo } from "@/lib/format";
import type { DeviceType, Family, Frame, ScreenView } from "@/lib/types";
import { useAdmin } from "@/components/admin/AdminProvider";
import { NoAccess, PageHead } from "@/components/admin/AdminShell";
import DeviceFrame, { fitScale } from "@/components/tester/DeviceFrame";

const TYPE_COLOR: Record<DeviceType, string> = { Mobile: "blue", Tablet: "purple", Desktop: "cyan", TV: "gold" };
const FRAME_LABEL: Record<Frame, string> = {
  island: "Phone, Dynamic Island", notch: "Phone, notch", hole: "Phone, punch-hole camera", home: "Phone, home button",
  tablet: "Tablet", browser: "Browser window (laptop/desktop)", tv: "TV with stand", none: "No frame",
};
const DEFAULT_FRAME: Record<DeviceType, Frame> = { Mobile: "hole", Tablet: "tablet", Desktop: "browser", TV: "tv" };

interface ListResp { data: ScreenView[]; total: number; brands: string[]; types: DeviceType[]; frames: Frame[] }
type Filters = { q: string; type?: string; brand?: string; active?: string };

export default function ScreenViewsPage() {
  const { can } = useAdmin();
  const { message, modal } = App.useApp();
  const [rows, setRows] = useState<ScreenView[]>([]);
  const [total, setTotal] = useState(0);
  const [brands, setBrands] = useState<string[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ q: "" });
  const [page, setPage] = useState({ current: 1, pageSize: 50 });
  const [sort, setSort] = useState<{ sort?: string; dir?: string }>({});
  const [selected, setSelected] = useState<number[]>([]);
  const [editing, setEditing] = useState<Partial<ScreenView> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<ListResp>("/screen-views", { query: { ...filters, ...sort, page: page.current, per_page: page.pageSize } });
      setRows(r.data); setTotal(r.total); setBrands(r.brands);
    } catch (e) { message.error(e instanceof ApiError ? e.message : "Could not load screen views."); }
    finally { setLoading(false); }
  }, [filters, sort, page, message]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch from the API when the page opens or its filters change
  useEffect(() => { if (can("screenviews.manage")) load(); }, [load, can]);
  useEffect(() => { if (can("families.manage")) api<{ data: Family[] }>("/families").then((r) => setFamilies(r.data)).catch(() => {}); }, [can]);

  if (!can("screenviews.manage")) return <NoAccess />;

  const toggleActive = async (r: ScreenView, v: boolean) => {
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, is_active: v } : x)));
    try { await api(`/screen-views/${r.id}`, { method: "PUT", body: { is_active: v } }); message.success(`${r.name} is ${v ? "live on" : "hidden from"} the tester.`); }
    catch (e) { message.error(e instanceof ApiError ? e.message : "Could not save."); load(); }
  };
  const remove = async (r: ScreenView) => {
    try { await api(`/screen-views/${r.id}`, { method: "DELETE" }); message.success(`Deleted ${r.name}.`); load(); }
    catch (e) { message.error(e instanceof ApiError ? e.message : "Could not delete."); }
  };
  const bulk = (action: "activate" | "deactivate" | "delete") => {
    const go = async () => {
      try {
        const r = await api<{ count: number }>("/screen-views/bulk", { method: "POST", body: { action, ids: selected } });
        message.success(`${action === "delete" ? "Deleted" : action === "activate" ? "Activated" : "Deactivated"} ${r.count} screen views.`);
        setSelected([]); load();
      } catch (e) { message.error(e instanceof ApiError ? e.message : "Could not update."); }
    };
    if (action === "delete") modal.confirm({ title: `Delete ${selected.length} screen views?`, content: "They will be removed from every menu group and from the tester. This can't be undone; deactivate instead to hide them.", okText: "Delete", okButtonProps: { danger: true }, onOk: go });
    else go();
  };

  const columns: TableProps<ScreenView>["columns"] = [
    { title: "Name", dataIndex: "name", sorter: true, render: (_, r) => <div><div className="font-medium">{r.name}</div><code className="text-[12px] text-[#8a96a5]">{r.slug}</code></div> },
    { title: "Brand", dataIndex: "brand", sorter: true },
    { title: "Type", dataIndex: "type", sorter: true, render: (t: DeviceType) => <Tag color={TYPE_COLOR[t]}>{t}</Tag> },
    { title: "Viewport", key: "size", dataIndex: "width", sorter: true, render: (_, r) => <span className="font-mono text-[13px]">{r.width} × {r.height}</span> },
    { title: "Frame", dataIndex: "frame", responsive: ["xl"], render: (f: Frame) => <span className="text-[13px] text-[#5c6978]">{FRAME_LABEL[f]}</span> },
    { title: "Menu groups", key: "fam", responsive: ["lg"], render: (_, r) => r.families?.length ? <div className="flex flex-wrap gap-1">{r.families.map((f) => <Tag key={f.id} className="m-0">{f.name}</Tag>)}</div> : <span className="text-[#8a96a5]">None</span> },
    { title: "On tester", dataIndex: "is_active", width: 100, render: (v: boolean, r) => <Switch size="small" checked={v} onChange={(x) => toggleActive(r, x)} aria-label={`Show ${r.name} on the tester`} /> },
    { title: "Order", dataIndex: "sort_order", sorter: true, width: 80, responsive: ["md"] },
    { title: "Updated", dataIndex: "updated_at", sorter: true, responsive: ["xxl"], render: (v) => <span className="text-[13px] text-[#5c6978]">{fmtAgo(v)}</span> },
    { key: "act", width: 120, render: (_, r) => (
      <Space size={2}>
        <Tooltip title="Edit"><Button type="text" icon={<EditOutlined />} onClick={() => setEditing(r)} aria-label={`Edit ${r.name}`} /></Tooltip>
        <Tooltip title="Duplicate"><Button type="text" icon={<CopyOutlined />} onClick={() => setEditing({ ...r, id: undefined, slug: "", name: r.name + " copy" })} aria-label={`Duplicate ${r.name}`} /></Tooltip>
        <Popconfirm title={`Delete ${r.name}?`} description="It will disappear from the tester and every menu group." okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => remove(r)}>
          <Tooltip title="Delete"><Button type="text" danger icon={<DeleteOutlined />} aria-label={`Delete ${r.name}`} /></Tooltip>
        </Popconfirm>
      </Space>
    ) },
  ];

  return (
    <>
      <PageHead title="Screen views" sub="Every device viewport the tester can show. Sizes are CSS pixels, the width the device's browser reports."
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ type: "Mobile", frame: "hole", is_active: true, sort_order: 0 })}>Add screen view</Button>} />

      <div className="mb-3 flex flex-wrap gap-2">
        <Input.Search allowClear placeholder="Search name, brand or width" className="w-64" onSearch={(q) => { setFilters((f) => ({ ...f, q })); setPage((p) => ({ ...p, current: 1 })); }} />
        <Select allowClear placeholder="Type" className="w-32" options={["Mobile", "Tablet", "Desktop", "TV"].map((t) => ({ value: t, label: t }))} onChange={(type) => { setFilters((f) => ({ ...f, type })); setPage((p) => ({ ...p, current: 1 })); }} />
        <Select allowClear showSearch placeholder="Brand" className="w-40" options={brands.map((b) => ({ value: b, label: b }))} onChange={(brand) => { setFilters((f) => ({ ...f, brand })); setPage((p) => ({ ...p, current: 1 })); }} />
        <Select allowClear placeholder="Status" className="w-36" options={[{ value: "1", label: "On tester" }, { value: "0", label: "Hidden" }]} onChange={(active) => { setFilters((f) => ({ ...f, active })); setPage((p) => ({ ...p, current: 1 })); }} />
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#e6ecfd] px-4 py-2.5">
          <b>{selected.length} selected</b><span className="flex-1" />
          <Button size="small" onClick={() => bulk("activate")}>Show on tester</Button>
          <Button size="small" onClick={() => bulk("deactivate")}>Hide</Button>
          <Button size="small" danger onClick={() => bulk("delete")}>Delete</Button>
          <Button size="small" type="text" onClick={() => setSelected([])}>Clear</Button>
        </div>
      )}

      <Table<ScreenView>
        rowKey="id" size="middle" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 900 }}
        rowSelection={{ selectedRowKeys: selected, onChange: (k) => setSelected(k as number[]), preserveSelectedRowKeys: true }}
        pagination={{ ...page, total, showSizeChanger: true, pageSizeOptions: [25, 50, 100, 200], showTotal: (t) => `${t} screen views` }}
        onChange={(p, _f, s) => {
          setPage({ current: p.current ?? 1, pageSize: p.pageSize ?? 50 });
          const so = Array.isArray(s) ? s[0] : s;
          setSort(so?.order ? { sort: String(so.field ?? so.columnKey), dir: so.order === "descend" ? "desc" : "asc" } : {});
        }}
      />

      <EditDrawer value={editing} brands={brands} families={families} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    </>
  );
}

function EditDrawer({ value, brands, families, onClose, onSaved }: { value: Partial<ScreenView> | null; brands: string[]; families: Family[]; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const w = Form.useWatch("width", form) as number | undefined;
  const h = Form.useWatch("height", form) as number | undefined;
  const frame = Form.useWatch("frame", form) as Frame | undefined;
  const name = Form.useWatch("name", form) as string | undefined;
  const isNew = !value?.id;

  useEffect(() => {
    if (!value) return;
    form.resetFields();
    form.setFieldsValue({ ...value, family_ids: value.families?.map((f) => f.id) ?? [] });
  }, [value, form]);

  const preview = useMemo(() => {
    if (!w || !h || w < 200 || h < 200) return null;
    return { s: fitScale(300, 300, w, h, frame ?? "none"), w, h };
  }, [w, h, frame]);

  async function save(v: Record<string, unknown>) {
    setBusy(true);
    try {
      if (isNew) await api("/screen-views", { method: "POST", body: v });
      else await api(`/screen-views/${value!.id}`, { method: "PUT", body: v });
      message.success(isNew ? "Screen view added." : "Saved.");
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) form.setFields(e.fields());
      else message.error(e instanceof ApiError ? e.message : "Could not save.");
    } finally { setBusy(false); }
  }

  return (
    <Drawer open={!!value} onClose={onClose} size={560} destroyOnHidden title={isNew ? "Add screen view" : `Edit ${value?.name}`}
      extra={<Space><Button onClick={onClose}>Cancel</Button><Button type="primary" loading={busy} onClick={() => form.submit()}>Save</Button></Space>}>
      <div className="mb-5 grid h-[320px] place-items-center rounded-lg bg-[#f7f9fb]">
        {preview ? (
          <div className="flex flex-col items-center gap-2">
            <DeviceFrame url="" w={preview.w} h={preview.h} s={preview.s} shape={frame ?? "none"} emptyText={`${name || "Preview"}\n${preview.w} × ${preview.h}`} />
          </div>
        ) : <span className="text-[#8a96a5]">Enter a width and height to preview</span>}
      </div>
      <Form form={form} layout="vertical" onFinish={save} requiredMark="optional">
        <div className="grid grid-cols-2 gap-x-4">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: "Enter a name" }, { max: 100 }]} className="col-span-2"><Input placeholder="e.g. iPhone 17 Pro" /></Form.Item>
          <Form.Item name="brand" label="Brand" rules={[{ required: true, message: "Enter a brand" }]}>
            <AutoComplete options={brands.map((b) => ({ value: b }))} filterOption={(i, o) => !!o?.value.toLowerCase().includes(i.toLowerCase())} placeholder="Apple" />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={["Mobile", "Tablet", "Desktop", "TV"].map((t) => ({ value: t, label: t }))} onChange={(t: DeviceType) => form.setFieldValue("frame", DEFAULT_FRAME[t])} />
          </Form.Item>
          <Form.Item label="Viewport (CSS px)" required className="col-span-2" extra="Width × height in portrait, as the device's browser reports it (window.innerWidth × innerHeight).">
            <Space.Compact>
              <Form.Item name="width" noStyle rules={[{ required: true, type: "number", min: 200, max: 4000, message: "Width 200–4000" }]}><InputNumber placeholder="Width" min={200} max={4000} className="w-32" /></Form.Item>
              <Button icon={<SwapOutlined />} onClick={() => { const a = form.getFieldValue("width"); form.setFieldsValue({ width: form.getFieldValue("height"), height: a }); }} aria-label="Swap width and height" />
              <Form.Item name="height" noStyle rules={[{ required: true, type: "number", min: 200, max: 4000, message: "Height 200–4000" }]}><InputNumber placeholder="Height" min={200} max={4000} className="w-32" /></Form.Item>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="frame" label="Frame" rules={[{ required: true }]} className="col-span-2">
            <Select options={(Object.keys(FRAME_LABEL) as Frame[]).map((f) => ({ value: f, label: FRAME_LABEL[f] }))} />
          </Form.Item>
          <Form.Item name="family_ids" label="Menu groups" className="col-span-2" extra="The tester menu tabs this device appears in. It is added to the end of each group.">
            <Select mode="multiple" allowClear options={families.map((f) => ({ value: f.id, label: f.name }))} placeholder="None" />
          </Form.Item>
          <Form.Item name="slug" label="ID" extra="Used in share links. Leave empty to generate it from the name." rules={[{ pattern: /^[A-Za-z0-9_-]*$/, message: "Letters, numbers, - and _ only" }]}><Input placeholder="auto" /></Form.Item>
          <Form.Item name="sort_order" label="Order" extra="Lower numbers first in the All list."><InputNumber min={0} max={100000} className="w-full" /></Form.Item>
          <Form.Item name="is_active" label="Show on the tester" valuePropName="checked"><Switch /></Form.Item>
        </div>
      </Form>
    </Drawer>
  );
}
