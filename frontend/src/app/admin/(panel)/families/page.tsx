"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Drawer, Empty, Form, Input, Popconfirm, Select, Space, Switch, Table, Tag, Tooltip } from "antd";
import type { TableProps } from "antd";
import { CloseOutlined, DeleteOutlined, EditOutlined, HolderOutlined, PlusOutlined } from "@ant-design/icons";
import { api, ApiError } from "@/lib/api";
import type { Family, ScreenView } from "@/lib/types";
import { useAdmin } from "@/components/admin/AdminProvider";
import { NoAccess, PageHead } from "@/components/admin/AdminShell";
import { moveItem, useDragSort } from "@/components/admin/useDragSort";

export default function FamiliesPage() {
  const { can } = useAdmin();
  const { message } = App.useApp();
  const [rows, setRows] = useState<Family[]>([]);
  const [views, setViews] = useState<ScreenView[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Family> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, v] = await Promise.all([
        api<{ data: Family[] }>("/families"),
        api<{ data: ScreenView[] }>("/screen-views", { query: { per_page: 200, sort: "sort_order" } }),
      ]);
      setRows(f.data); setViews(v.data);
    } catch (e) { message.error(e instanceof ApiError ? e.message : "Could not load menu groups."); }
    finally { setLoading(false); }
  }, [message]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch from the API when the page opens or its filters change
  useEffect(() => { if (can("families.manage")) load(); }, [load, can]);
  const reorder = async (from: number, to: number) => {
    const next = moveItem(rows, from, to);
    setRows(next);
    try { await api("/families/reorder", { method: "POST", body: { ids: next.map((r) => r.id) } }); message.success("Menu order saved."); }
    catch (e) { message.error(e instanceof ApiError ? e.message : "Could not reorder."); load(); }
  };
  const sort = useDragSort(reorder);
  if (!can("families.manage")) return <NoAccess />;
  const patch = async (r: Family, body: Partial<Family>, ok: string) => {
    try { await api(`/families/${r.id}`, { method: "PUT", body }); message.success(ok); load(); }
    catch (e) { message.error(e instanceof ApiError ? e.message : "Could not save."); }
  };
  const remove = async (r: Family) => {
    try { await api(`/families/${r.id}`, { method: "DELETE" }); message.success(`Deleted ${r.name}.`); load(); }
    catch (e) { message.error(e instanceof ApiError ? e.message : "Could not delete."); }
  };

  const columns: TableProps<Family>["columns"] = [
    { key: "drag", width: 44, className: "sortable-handle-cell", render: (_, __, i) => (
      <Tooltip title="Drag to change the menu order">
        <button type="button" {...sort.handleProps(i, rows.length)}><HolderOutlined /></button>
      </Tooltip>
    ) },
    { title: "Name", dataIndex: "name", className: "group-col-name", render: (_, r) => <div className="group-name"><span className="group-name-text font-medium">{r.name}</span> {r.is_default && <Tag color="blue" className="group-badge group-badge--default ml-1">Opens first</Tag>}<div><code className="group-slug text-[12px] text-[#8a96a5]">{r.slug}</code></div></div> },
    { title: "Devices", key: "n", className: "group-col-devices", render: (_, r) => {
      const names = r.screen_view_ids.map((id) => views.find((v) => v.id === id)?.name).filter(Boolean) as string[];
      return <span className="group-devices text-[13px] text-[#5c6978]"><b className="group-devices-count text-[#17202b]">{r.screen_views_count}</b> {names.slice(0, 4).join(", ")}{names.length > 4 ? ` +${names.length - 4}` : ""}</span>;
    } },
    { title: "On tester", dataIndex: "is_active", width: 100, className: "group-col-active", render: (v: boolean, r) => <Switch className="group-active-switch" size="small" checked={v} onChange={(x) => patch(r, { is_active: x }, `${r.name} is ${x ? "shown" : "hidden"}.`)} aria-label={`Show ${r.name} on the tester`} /> },
    { key: "a", width: 150, className: "group-col-actions", render: (_, r) => (
      <Space className="row-actions" size={2}>
        {!r.is_default && <Tooltip title="Open this tab first on the tester"><Button className="row-action row-action--make-default" size="small" type="link" onClick={() => patch(r, { is_default: true }, `${r.name} now opens first.`)}>Make first</Button></Tooltip>}
        <Button className="row-action row-action--edit" type="text" icon={<EditOutlined />} onClick={() => setEditing(r)} aria-label={`Edit ${r.name}`} />
        <Popconfirm title={`Delete ${r.name}?`} description="The menu tab is removed. Its devices stay." okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => remove(r)}>
          <Button className="row-action row-action--delete" type="text" danger icon={<DeleteOutlined />} aria-label={`Delete ${r.name}`} />
        </Popconfirm>
      </Space>
    ) },
  ];

  return (
    <div className="page page-menu-groups">
      <PageHead title="Menu groups" sub="The menu tabs on the tester. Drag a row by its grip to change the menu order; open a group to choose and order its devices."
        extra={<Button className="page-header-btn page-header-btn--add" type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ is_active: true, is_default: false, screen_view_ids: [] })}>Add group</Button>} />
      <Table<Family> className="data-table data-table--menu-groups sortable-table" rowKey="id" size="middle" columns={columns} dataSource={rows} loading={loading} pagination={false} scroll={{ x: 760 }}
        onRow={(_, i) => sort.itemProps(i ?? 0) as React.HTMLAttributes<HTMLElement>} />
      <EditFamily value={editing} views={views} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    </div>
  );
}

function EditFamily({ value, views, onClose, onSaved }: { value: Partial<Family> | null; views: ScreenView[]; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [ids, setIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const isNew = !value?.id;

  useEffect(() => {
    if (!value) return;
    form.resetFields();
    form.setFieldsValue(value);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the ordered list when a different family opens
    setIds(value.screen_view_ids ?? []);
  }, [value, form]);

  const byId = useMemo(() => new Map(views.map((v) => [v.id, v])), [views]);
  const options = useMemo(() => views.filter((v) => !ids.includes(v.id)).map((v) => ({ value: v.id, label: `${v.name} · ${v.width}×${v.height}${v.is_active ? "" : " (hidden)"}` })), [views, ids]);
  const sort = useDragSort((from, to) => setIds((xs) => moveItem(xs, from, to)));

  async function save(v: Record<string, unknown>) {
    setBusy(true);
    const body = { ...v, screen_view_ids: ids };
    try {
      if (isNew) await api("/families", { method: "POST", body }); else await api(`/families/${value!.id}`, { method: "PUT", body });
      message.success(isNew ? "Group added." : "Saved."); onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) form.setFields(e.fields()); else message.error(e instanceof ApiError ? e.message : "Could not save.");
    } finally { setBusy(false); }
  }

  return (
    <Drawer className="form-drawer form-drawer--menu-group" open={!!value} onClose={onClose} size={560} destroyOnHidden title={isNew ? "Add group" : `Edit ${value?.name}`}
      extra={<Space className="form-drawer-actions"><Button className="form-drawer-btn form-drawer-btn--cancel" onClick={onClose}>Cancel</Button><Button className="form-drawer-btn form-drawer-btn--save" type="primary" loading={busy} onClick={() => form.submit()}>Save</Button></Space>}>
      <Form className="form form--menu-group" form={form} layout="vertical" onFinish={save} requiredMark="optional">
        <div className="form-grid grid grid-cols-2 gap-x-4">
          <Form.Item name="name" label="Tab name" rules={[{ required: true, message: "Enter a name" }, { max: 80 }]}><Input placeholder="e.g. Popular" /></Form.Item>
          <Form.Item name="slug" label="ID" extra="Used in share links (?group=). Empty = from the name." rules={[{ pattern: /^[A-Za-z0-9_-]*$/, message: "Letters, numbers, - and _ only" }]}><Input placeholder="auto" /></Form.Item>
          <Form.Item name="description" label="Note (admin only)" className="col-span-2"><Input placeholder="Optional" /></Form.Item>
          <Form.Item name="is_active" label="Show on the tester" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="is_default" label="Opens first" valuePropName="checked"><Switch /></Form.Item>
        </div>
      </Form>
      <h3 className="form-section-title mb-2 mt-1 text-[15px] font-semibold">Devices in this group <span className="form-section-count font-normal text-[#5c6978]">({ids.length})</span></h3>
      <p className="form-section-help mb-2 mt-0 text-[13px] text-[#5c6978]">Drag by the grip to set the order they appear on the tester.</p>
      <Select showSearch className="group-device-picker mb-3 w-full" placeholder="Add a screen view…" value={null} options={options}
        filterOption={(i, o) => String(o?.label ?? "").toLowerCase().includes(i.toLowerCase())}
        onChange={(id: number) => setIds((xs) => [...xs, id])} />
      {ids.length === 0 ? <Empty className="empty-state" description="No screen views yet" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
        <ol className="sortable-list group-device-list m-0 grid list-none gap-1.5 p-0">
          {ids.map((id, i) => {
            const v = byId.get(id);
            return (
              <li key={id} {...sort.itemProps(i)} className={`group-device-item ${sort.itemProps(i).className} flex items-center gap-2 rounded-lg border border-solid border-[#e3e8ee] bg-white px-2 py-1.5`}>
                <button type="button" {...sort.handleProps(i, ids.length)}><HolderOutlined /></button>
                <span className="group-device-index w-6 font-mono text-[12px] text-[#8a96a5]">{String(i + 1).padStart(2, "0")}</span>
                <span className="group-device-name flex-1">{v?.name ?? `#${id}`} <span className="group-device-size font-mono text-[12px] text-[#5c6978]">{v ? `${v.width}×${v.height}` : ""}</span>{v && !v.is_active && <Tag className="group-device-badge ml-2">hidden</Tag>}</span>
                <Button className="group-device-remove" type="text" size="small" icon={<CloseOutlined />} onClick={() => setIds((xs) => xs.filter((x) => x !== id))} aria-label="Remove" />
              </li>
            );
          })}
        </ol>
      )}
    </Drawer>
  );
}
