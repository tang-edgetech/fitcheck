"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, App, Button, Checkbox, Dropdown, Form, Input, Modal, Radio, Select, Switch, Table, Tag, Tooltip, Typography } from "antd";
import type { TableProps } from "antd";
import { KeyOutlined, MoreOutlined, PlusOutlined, SafetyOutlined } from "@ant-design/icons";
import { api, ApiError } from "@/lib/api";
import { fmtAgo } from "@/lib/format";
import type { AdminUser } from "@/lib/types";
import { useAdmin } from "@/components/admin/AdminProvider";
import { NoAccess, PageHead } from "@/components/admin/AdminShell";
import PasswordFields from "@/components/admin/PasswordFields";

export default function UsersPage() {
  const { can, me } = useAdmin();
  const { message, modal } = App.useApp();
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<AdminUser> | null>(null);
  const [temp, setTemp] = useState<{ user: string; password: string } | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [pwFor, setPwFor] = useState<AdminUser | null>(null);

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

  const act = async (u: AdminUser, what: "reset-two-factor" | "delete") => {
    try {
      if (what === "reset-two-factor") {
        await api(`/users/${u.id}/reset-two-factor`, { method: "POST" }); message.success(`Two-factor sign-in removed for ${u.username}. They can set it up again.`);
        setEditing((e) => (e && e.id === u.id ? { ...e, two_factor_confirmed_at: null } : e));
      } else {
        await api(`/users/${u.id}`, { method: "DELETE" }); message.success(`Deleted ${u.username}.`);
      }
      load();
    } catch (e) { message.error(e instanceof ApiError ? e.message : "Could not complete that."); }
  };
  const setActive = async (u: AdminUser, on: boolean) => {
    setToggling(u.id);
    try {
      await api(`/users/${u.id}`, { method: "PUT", body: { is_active: on } });
      setRows((rs) => rs.map((r) => (r.id === u.id ? { ...r, is_active: on } : r)));
      message.success(on ? `${u.username} can sign in again.` : `${u.username} is disabled and was signed out.`);
    } catch (e) { message.error(e instanceof ApiError ? e.message : "Could not change the status."); }
    finally { setToggling(null); }
  };
  const confirm = (u: AdminUser, what: "reset-two-factor" | "delete") => modal.confirm({
    className: `user-confirm-modal user-confirm-modal--${what}`,
    title: what === "delete" ? `Delete ${u.username}?` : `Remove two-factor sign-in for ${u.username}?`,
    content: what === "delete" ? "The account is removed and signed out everywhere. Its audit history stays." : "They can sign in with only their password and are asked to set up two-factor again if it's required. Use this when they lost their phone and recovery codes.",
    okText: what === "delete" ? "Delete" : "Continue", okButtonProps: { danger: what === "delete" }, onOk: () => act(u, what),
  });

  const columns: TableProps<AdminUser>["columns"] = [
    { title: "User", key: "u", className: "user-col-user", render: (_, u) => <div className="user-identity"><div className="user-display-name font-medium">{u.display_name || <span className="user-display-name--empty text-[#8a96a5]">No display name</span>} {u.id === me?.id && <Tag className="user-badge user-badge--you ml-1">You</Tag>}</div><div className="user-account text-[13px] text-[#5c6978]">{u.username}{u.email ? ` · ${u.email}` : ""}</div></div> },
    { title: "Role", dataIndex: "role", className: "user-col-role", render: (r: string) => <Tag className={`role-badge role-badge--${r}`} color={r === "developer" ? "purple" : "blue"}>{roles[r] ?? r}</Tag> },
    { title: "Two-factor", dataIndex: "two_factor_confirmed_at", className: "user-col-two-factor", render: (v) => v ? <Tag className="two-factor-badge two-factor-badge--on" color="green">On</Tag> : <Tag className="two-factor-badge two-factor-badge--off">Off</Tag> },
    { title: "Status", key: "s", width: 170, className: "user-col-status", render: (_, u) => (
      <div className={`user-status user-status--${u.is_active ? "active" : "disabled"} flex flex-col items-start gap-1.5`}>
        <Tooltip title={u.id === me?.id ? "You can't disable your own account" : locked(u) ? "Only a Developer can change a Developer account" : u.is_active ? "Turn off to block sign-in and sign them out now" : "Turn on to let them sign in again"}>
          <label className="user-status-toggle inline-flex cursor-pointer items-center gap-2">
            <Switch className="user-status-switch" size="small" checked={u.is_active} loading={toggling === u.id}
              disabled={u.id === me?.id || locked(u)} onChange={(on) => setActive(u, on)} aria-label={`${u.username} can sign in`} />
            <span className={`user-status-text text-[13px] ${u.is_active ? "text-[#17202b]" : "text-[#c93a3a]"}`}>{u.is_active ? "Active" : "Disabled"}</span>
          </label>
        </Tooltip>
        {u.must_change_password && <Tag className="status-badge status-badge--temporary-password m-0" color="orange">Temporary password</Tag>}
      </div>
    ) },
    { title: "Last sign-in", dataIndex: "last_login_at", responsive: ["md"], className: "user-col-last-login", render: (v, u) => <span className="user-last-login text-[13px] text-[#5c6978]">{fmtAgo(v)}{u.last_login_ip ? ` · ${u.last_login_ip}` : ""}</span> },
    { key: "a", width: 120, className: "user-col-actions", render: (_, u) => locked(u) ? <span className="row-actions-locked text-[12px] text-[#8a96a5]">Developer only</span> : (
      <div className="row-actions flex gap-1">
        <Button className="row-action row-action--edit" size="small" onClick={() => setEditing(u)}>Edit</Button>
        <Dropdown trigger={["click"]} menu={{ className: "row-actions-menu", items: [
          { key: "p", label: "Reset password", className: "row-actions-menu-item row-actions-menu-item--reset-password", disabled: u.id === me?.id, onClick: () => setPwFor(u) },
          { key: "t", label: "Remove two-factor", className: "row-actions-menu-item row-actions-menu-item--reset-two-factor", disabled: !u.two_factor_confirmed_at, onClick: () => confirm(u, "reset-two-factor") },
          { type: "divider" },
          { key: "d", label: "Delete", className: "row-actions-menu-item row-actions-menu-item--delete", danger: true, disabled: u.id === me?.id, onClick: () => confirm(u, "delete") },
        ] }}><Button className="row-action row-action--more" size="small" icon={<MoreOutlined />} aria-label={`More actions for ${u.username}`} /></Dropdown>
      </div>
    ) },
  ];

  return (
    <div className="page page-users">
      <PageHead title="Users" sub="People who can sign in to this admin panel. Developers can do everything; Admins can't see the system log or change Developer accounts."
        extra={<Button className="page-header-btn page-header-btn--add" type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ role: "admin" })}>Add user</Button>} />
      <Input.Search allowClear placeholder="Search name, username or email" className="filter-bar-search mb-3 w-72" onSearch={setQ} />
      <Table<AdminUser> className="data-table data-table--users" rowClassName="data-table-row" rowKey="id" size="middle" columns={columns} dataSource={rows} loading={loading} pagination={false} scroll={{ x: 760 }} />

      <EditUser value={editing} roleOptions={roleOptions} self={me?.id} onClose={() => setEditing(null)}
        onSaved={(t) => { setEditing(null); if (t) setTemp(t); load(); }}
        onResetPassword={(u) => setPwFor(u)} onResetTwoFactor={(u) => confirm(u, "reset-two-factor")} />

      <ResetPassword user={pwFor} onClose={() => setPwFor(null)}
        onDone={(t) => { setPwFor(null); if (t) setTemp(t); load(); }} />

      <Modal className="temp-password-modal" open={!!temp} onCancel={() => setTemp(null)} title="Temporary password" footer={<Button className="temp-password-modal-done" type="primary" onClick={() => setTemp(null)}>Done</Button>}>
        <p className="temp-password-modal-text">Give this password to <b className="temp-password-modal-user">{temp?.user}</b> through a private channel. They must replace it with their own the next time they sign in. They were signed out everywhere.</p>
        <Typography.Paragraph copyable className="temp-password-modal-value rounded-lg bg-[#f7f9fb] p-3 font-mono text-[16px]">{temp?.password}</Typography.Paragraph>
        <Alert className="temp-password-modal-warning" type="warning" showIcon title="This password isn't shown again." />
      </Modal>
    </div>
  );
}

function EditUser({ value, roleOptions, self, onClose, onSaved, onResetPassword, onResetTwoFactor }: {
  value: Partial<AdminUser> | null; roleOptions: { value: string; label: string }[]; self?: number; onClose: () => void; onSaved: (temp?: { user: string; password: string }) => void;
  onResetPassword: (u: AdminUser) => void; onResetTwoFactor: (u: AdminUser) => void;
}) {
  const { message } = App.useApp();
  const { can } = useAdmin();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const isNew = !value?.id;
  const canRename = can("users.change_username");
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
    <Modal className="user-form-modal" open={!!value} onCancel={onClose} title={isNew ? "Add user" : `Edit ${value?.username}`} okText={isNew ? "Create and show password" : "Save"} confirmLoading={busy} onOk={() => form.submit()} destroyOnHidden
      okButtonProps={{ className: "form-modal-btn form-modal-btn--save" }} cancelButtonProps={{ className: "form-modal-btn form-modal-btn--cancel" }}>
      <Form className="form form--user" form={form} layout="vertical" onFinish={save} requiredMark="optional">
        <Form.Item className="form-field form-field--username" name="username" label="Username" rules={[{ required: true, message: "Enter a username" }, { min: 3 }, { max: 50 }, { pattern: /^[A-Za-z0-9_-]+$/, message: "Letters, numbers, - and _ only" }]}
          extra={isNew ? `Letters, numbers, - and _.${canRename ? "" : " Only a Developer can change it later."}` : canRename ? "Used to sign in. If you change it, tell them: their old username stops working." : "Only a Developer can change a username."}>
          <Input className="form-input form-input--username" autoComplete="off" disabled={!isNew && !canRename} />
        </Form.Item>
        <Form.Item className="form-field form-field--display-name" name="display_name" label="Display name"><Input className="form-input form-input--display-name" /></Form.Item>
        <Form.Item className="form-field form-field--email" name="email" label="Email" rules={[{ type: "email", message: "Enter a valid email address" }]}><Input className="form-input form-input--email" inputMode="email" /></Form.Item>
        <Form.Item className="form-field form-field--role" name="role" label="Role" rules={[{ required: true }]}><Select className="form-input form-input--role" options={roleOptions} disabled={value?.id === self} /></Form.Item>
        {!isNew && <Form.Item className="form-field form-field--is-active" name="is_active" label="Can sign in" valuePropName="checked" extra="Turning this off signs them out immediately."><Switch className="form-input form-input--is-active" disabled={value?.id === self} /></Form.Item>}
        {isNew && <p className="form-help form-help--temp-password m-0 text-[13px] text-[#5c6978]">A temporary password is generated. The new user sets their own on first sign-in.</p>}
      </Form>
      {!isNew && value && (
        <section className="user-security mt-2 rounded-lg border border-solid border-[#e3e8ee] bg-[#f7f9fb] p-3">
          <h4 className="user-security-title m-0 mb-1 text-[14px] font-semibold">Password and two-factor</h4>
          {value.id === self ? (
            <p className="user-security-help m-0 text-[13px] text-[#5c6978]">For your own account, use My profile.</p>
          ) : (
            <>
              <p className="user-security-help mb-2 mt-0 text-[13px] text-[#5c6978]">Both sign them out everywhere. Two-factor is {value.two_factor_confirmed_at ? "on" : "off"} for this account.</p>
              <div className="user-security-actions flex flex-wrap gap-2">
                <Button className="user-security-btn user-security-btn--reset-password" icon={<KeyOutlined />} onClick={() => onResetPassword(value as AdminUser)}>Reset password…</Button>
                <Button className="user-security-btn user-security-btn--reset-two-factor" icon={<SafetyOutlined />} disabled={!value.two_factor_confirmed_at} onClick={() => onResetTwoFactor(value as AdminUser)}>Remove two-factor</Button>
              </div>
            </>
          )}
        </section>
      )}
    </Modal>
  );
}

/** Reset someone's password: generate a temporary one, or (Developers) type one and choose whether they must change it. */
function ResetPassword({ user, onClose, onDone }: { user: AdminUser | null; onClose: () => void; onDone: (temp?: { user: string; password: string }) => void }) {
  const { message } = App.useApp();
  const { can, me } = useAdmin();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const canType = can("users.set_password");
  const mode = Form.useWatch("mode", form) ?? "generate";

  async function submit(v: { mode: "generate" | "manual"; password?: string; password_confirmation?: string; must_change?: boolean }) {
    if (!user) return;
    setBusy(true);
    try {
      const r = await api<{ temporary_password?: string; must_change: boolean }>(`/users/${user.id}/reset-password`, { method: "POST", body: v });
      if (r.temporary_password) onDone({ user: user.username, password: r.temporary_password });
      else { message.success(r.must_change ? `Password set for ${user.username}. They must change it at their next sign-in.` : `Password set for ${user.username}.`); onDone(); }
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.fields().length) form.setFields(e.fields());
      else message.error(e instanceof ApiError ? e.message : "Could not reset the password.");
    } finally { setBusy(false); }
  }

  return (
    <Modal className="reset-password-modal" open={!!user} onCancel={onClose} title={`Reset password for ${user?.username ?? ""}`} destroyOnHidden
      okText={mode === "manual" ? "Set password" : "Generate password"} confirmLoading={busy} onOk={() => form.submit()}
      okButtonProps={{ className: "form-modal-btn form-modal-btn--save" }} cancelButtonProps={{ className: "form-modal-btn form-modal-btn--cancel" }}>
      <Form className="form form--reset-password" form={form} layout="vertical" onFinish={submit} initialValues={{ mode: "generate", must_change: true }} requiredMark={false}>
        <Form.Item className="form-field form-field--mode" name="mode" label="How">
          <Radio.Group className="reset-password-mode flex flex-col gap-2">
            <Radio className="reset-password-mode-option reset-password-mode-option--generate" value="generate">
              <b>Generate a temporary password</b>
              <div className="text-[13px] text-[#5c6978]">You see it once and pass it on. They must replace it when they sign in.</div>
            </Radio>
            <Tooltip title={canType ? undefined : "Only a Developer can type a password for someone else"}>
              <Radio className="reset-password-mode-option reset-password-mode-option--manual" value="manual" disabled={!canType}>
                <b>Type a new password</b>
                <div className="text-[13px] text-[#5c6978]">For when you&apos;re helping them directly, for example over the phone.</div>
              </Radio>
            </Tooltip>
          </Radio.Group>
        </Form.Item>
        {mode === "manual" && (
          <>
            <PasswordFields min={me?.password_min_length ?? 8} />
            <Form.Item className="form-field form-field--must-change" name="must_change" valuePropName="checked">
              <Checkbox className="form-input form-input--must-change">Ask them to choose their own password at next sign-in</Checkbox>
            </Form.Item>
          </>
        )}
        <Alert className="reset-password-modal-note" type="info" showIcon title="They are signed out on every device straight away." />
      </Form>
    </Modal>
  );
}
