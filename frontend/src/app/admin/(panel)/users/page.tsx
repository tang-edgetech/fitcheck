"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, App, Button, Dropdown, Form, Input, Modal, Select, Switch, Table, Tag, Typography } from "antd";
import type { TableProps } from "antd";
import { MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { api, ApiError } from "@/lib/api";
import { fmtAgo } from "@/lib/format";
import type { AdminUser } from "@/lib/types";
import { useAdmin } from "@/components/admin/AdminProvider";
import { NoAccess, PageHead } from "@/components/admin/AdminShell";

export default function UsersPage() {
  const { can, me } = useAdmin();
  const { message, modal } = App.useApp();
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<AdminUser> | null>(null);
  const [temp, setTemp] = useState<{ user: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api<{ data: AdminUser[]; roles: Record<string, string> }>("/users", { query: { q } }); setRows(r.data); setRoles(r.roles); }
    catch (e) { message.error(e instanceof ApiError ? e.message : "Could not load users."); }
    finally { setLoading(false); }
  }, [q, message]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch from the API when the page opens or its filters change
  useEffect(() => { if (can("users.manage")) load(); }, [load, can]);
  if (!can("users.manage")) return <NoAccess />;

  const isDev = me?.role === "developer";
  const locked = (u: AdminUser) => u.role === "developer" && !isDev;
  const roleOptions = Object.entries(roles).filter(([k]) => isDev || k !== "developer").map(([value, label]) => ({ value, label }));

  const act = async (u: AdminUser, what: "reset-password" | "reset-two-factor" | "delete") => {
    try {
      if (what === "reset-password") {
        const r = await api<{ temporary_password: string }>(`/users/${u.id}/reset-password`, { method: "POST" });
        setTemp({ user: u.username, password: r.temporary_password });
      } else if (what === "reset-two-factor") {
        await api(`/users/${u.id}/reset-two-factor`, { method: "POST" }); message.success(`Two-factor sign-in removed for ${u.username}. They can set it up again.`);
      } else {
        await api(`/users/${u.id}`, { method: "DELETE" }); message.success(`Deleted ${u.username}.`);
      }
      load();
    } catch (e) { message.error(e instanceof ApiError ? e.message : "Could not complete that."); }
  };
  const confirm = (u: AdminUser, what: "reset-password" | "reset-two-factor" | "delete") => modal.confirm({
    title: what === "delete" ? `Delete ${u.username}?` : what === "reset-password" ? `Reset password for ${u.username}?` : `Remove two-factor sign-in for ${u.username}?`,
    content: what === "delete" ? "The account is removed and signed out everywhere. Its audit history stays." : what === "reset-password" ? "They are signed out and must choose a new password with the temporary one you'll see next." : "Use this when they lost their phone and recovery codes.",
    okText: what === "delete" ? "Delete" : "Continue", okButtonProps: { danger: what === "delete" }, onOk: () => act(u, what),
  });

  const columns: TableProps<AdminUser>["columns"] = [
    { title: "User", key: "u", render: (_, u) => <div><div className="font-medium">{u.display_name || <span className="text-[#8a96a5]">No display name</span>} {u.id === me?.id && <Tag className="ml-1">You</Tag>}</div><div className="text-[13px] text-[#5c6978]">{u.username}{u.email ? ` · ${u.email}` : ""}</div></div> },
    { title: "Role", dataIndex: "role", render: (r: string) => <Tag color={r === "developer" ? "purple" : "blue"}>{roles[r] ?? r}</Tag> },
    { title: "Two-factor", dataIndex: "two_factor_confirmed_at", render: (v) => v ? <Tag color="green">On</Tag> : <Tag>Off</Tag> },
    { title: "Status", key: "s", render: (_, u) => !u.is_active ? <Tag color="red">Disabled</Tag> : u.must_change_password ? <Tag color="orange">Temporary password</Tag> : <Tag color="green">Active</Tag> },
    { title: "Last sign-in", dataIndex: "last_login_at", responsive: ["md"], render: (v, u) => <span className="text-[13px] text-[#5c6978]">{fmtAgo(v)}{u.last_login_ip ? ` · ${u.last_login_ip}` : ""}</span> },
    { key: "a", width: 120, render: (_, u) => locked(u) ? <span className="text-[12px] text-[#8a96a5]">Developer only</span> : (
      <div className="flex gap-1">
        <Button size="small" onClick={() => setEditing(u)}>Edit</Button>
        <Dropdown trigger={["click"]} menu={{ items: [
          { key: "p", label: "Reset password", onClick: () => confirm(u, "reset-password") },
          { key: "t", label: "Remove two-factor", disabled: !u.two_factor_confirmed_at, onClick: () => confirm(u, "reset-two-factor") },
          { type: "divider" },
          { key: "d", label: "Delete", danger: true, disabled: u.id === me?.id, onClick: () => confirm(u, "delete") },
        ] }}><Button size="small" icon={<MoreOutlined />} aria-label={`More actions for ${u.username}`} /></Dropdown>
      </div>
    ) },
  ];

  return (
    <>
      <PageHead title="Users" sub="People who can sign in to this admin panel. Developers can do everything; Admins can't see the system log or change Developer accounts."
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ role: "admin" })}>Add user</Button>} />
      <Input.Search allowClear placeholder="Search name, username or email" className="mb-3 w-72" onSearch={setQ} />
      <Table<AdminUser> rowKey="id" size="middle" columns={columns} dataSource={rows} loading={loading} pagination={false} scroll={{ x: 760 }} />

      <EditUser value={editing} roleOptions={roleOptions} self={me?.id} onClose={() => setEditing(null)}
        onSaved={(t) => { setEditing(null); if (t) setTemp(t); load(); }} />

      <Modal open={!!temp} onCancel={() => setTemp(null)} title="Temporary password" footer={<Button type="primary" onClick={() => setTemp(null)}>Done</Button>}>
        <p>Give this password to <b>{temp?.user}</b> through a private channel. They must change it, and set their email and display name, the first time they sign in.</p>
        <Typography.Paragraph copyable className="rounded-lg bg-[#f7f9fb] p-3 font-mono text-[16px]">{temp?.password}</Typography.Paragraph>
        <Alert type="warning" showIcon title="This password isn't shown again." />
      </Modal>
    </>
  );
}

function EditUser({ value, roleOptions, self, onClose, onSaved }: {
  value: Partial<AdminUser> | null; roleOptions: { value: string; label: string }[]; self?: number; onClose: () => void; onSaved: (temp?: { user: string; password: string }) => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const isNew = !value?.id;
  useEffect(() => { if (value) { form.resetFields(); form.setFieldsValue(value); } }, [value, form]);

  async function save(v: Record<string, unknown>) {
    setBusy(true);
    try {
      if (isNew) {
        const r = await api<{ user: AdminUser; temporary_password: string }>("/users", { method: "POST", body: v });
        message.success(`Created ${r.user.username}.`); onSaved({ user: r.user.username, password: r.temporary_password });
      } else {
        await api(`/users/${value!.id}`, { method: "PUT", body: v }); message.success("Saved."); onSaved();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.fields().length) form.setFields(e.fields());
      else message.error(e instanceof ApiError ? e.message : "Could not save.");
    } finally { setBusy(false); }
  }

  return (
    <Modal open={!!value} onCancel={onClose} title={isNew ? "Add user" : `Edit ${value?.username}`} okText={isNew ? "Create and show password" : "Save"} confirmLoading={busy} onOk={() => form.submit()} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={save} requiredMark="optional">
        {isNew && (
          <Form.Item name="username" label="Username" extra="Letters, numbers, - and _. Can't be changed later." rules={[{ required: true, message: "Enter a username" }, { min: 3 }, { max: 50 }, { pattern: /^[A-Za-z0-9_-]+$/, message: "Letters, numbers, - and _ only" }]}>
            <Input autoComplete="off" />
          </Form.Item>
        )}
        <Form.Item name="display_name" label="Display name"><Input /></Form.Item>
        <Form.Item name="email" label="Email" rules={[{ type: "email", message: "Enter a valid email address" }]}><Input inputMode="email" /></Form.Item>
        <Form.Item name="role" label="Role" rules={[{ required: true }]}><Select options={roleOptions} disabled={value?.id === self} /></Form.Item>
        {!isNew && <Form.Item name="is_active" label="Can sign in" valuePropName="checked" extra="Turning this off signs them out immediately."><Switch disabled={value?.id === self} /></Form.Item>}
        {isNew && <p className="m-0 text-[13px] text-[#5c6978]">A temporary password is generated. The new user sets their own on first sign-in.</p>}
      </Form>
    </Modal>
  );
}
