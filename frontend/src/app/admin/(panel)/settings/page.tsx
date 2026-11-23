"use client";

import { useEffect, useState } from "react";
import { Alert, App, Button, Card, Form, Input, InputNumber, Modal, Skeleton, Switch } from "antd";
import { api, ApiError } from "@/lib/api";
import { useAdmin } from "@/components/admin/AdminProvider";
import { NoAccess, PageHead } from "@/components/admin/AdminShell";

type S = Record<string, number | boolean>;
const K = {
  tfa: "security.two_factor_enforced", timeout: "security.session_timeout_minutes", pwlen: "security.password_min_length",
  attempts: "security.max_login_attempts", lockout: "security.lockout_minutes",
} as const;

export default function SettingsPage() {
  const { can, me, refresh } = useAdmin();
  const { message } = App.useApp();
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  const [askCode, setAskCode] = useState(false);
  const [code, setCode] = useState("");
  const [form] = Form.useForm();

  useEffect(() => { if (can("settings.manage")) api<S>("/settings").then(setS).catch(() => {}); }, [can]);
  if (!can("settings.manage")) return <NoAccess />;
  if (!s) return <Skeleton active />;

  const save = async (body: Record<string, unknown>, c?: string) => {
    setBusy(true);
    try {
      const r = await api<S>("/settings", { method: "PUT", body: { security: body, code: c } });
      setS(r); setAskCode(false); setCode(""); message.success("Settings saved."); refresh();
    } catch (e) {
      if (e instanceof ApiError && e.data.errors && (e.data.errors as Record<string, unknown>).code) { setAskCode(true); if (c) message.error(e.message); }
      else message.error(e instanceof ApiError ? e.message : "Could not save.");
    } finally { setBusy(false); }
  };
  const toggle2fa = (on: boolean) => {
    if (!on && me?.two_factor_enabled) { setAskCode(true); return; }
    save({ two_factor_enforced: on });
  };

  return (
    <>
      <PageHead title="Settings" sub="Security rules for every account. Each change is recorded in the audit log." />
      <div className="grid max-w-[760px] gap-4">
        <Card title="Two-factor sign-in">
          <div className="flex items-start gap-4">
            <Switch checked={!!s[K.tfa]} loading={busy} onChange={toggle2fa} aria-label="Require two-factor sign-in for everyone" />
            <div>
              <div className="font-medium">Require two-factor sign-in for everyone</div>
              <p className="mb-0 mt-1 text-[#5c6978]">When on, every account must enter a 6-digit code from an authenticator app after its password. Accounts without it are asked to set it up at their next sign-in.</p>
            </div>
          </div>
          {!!s[K.tfa] && !me?.two_factor_enabled && <Alert className="mt-4" type="warning" showIcon title="You haven't set up two-factor sign-in yet." description="You'll be asked to set it up the next time you sign in." />}
        </Card>

        <Card title="Sign-in and sessions">
          <Form form={form} layout="vertical" initialValues={{ timeout: s[K.timeout], pwlen: s[K.pwlen], attempts: s[K.attempts], lockout: s[K.lockout] }}
            onFinish={(v) => save({ session_timeout_minutes: v.timeout, password_min_length: v.pwlen, max_login_attempts: v.attempts, lockout_minutes: v.lockout })}>
            <div className="grid gap-x-6 sm:grid-cols-2">
              <Form.Item name="timeout" label="Sign out after inactivity (minutes)" extra="5 to 720" rules={[{ required: true }]}><InputNumber min={5} max={720} className="w-full" /></Form.Item>
              <Form.Item name="pwlen" label="Minimum password length" extra="8 to 64. Passwords also need upper and lower case, a number and a symbol." rules={[{ required: true }]}><InputNumber min={8} max={64} className="w-full" /></Form.Item>
              <Form.Item name="attempts" label="Failed sign-ins before lockout" extra="Per account and IP address" rules={[{ required: true }]}><InputNumber min={3} max={20} className="w-full" /></Form.Item>
              <Form.Item name="lockout" label="Lockout length (minutes)" rules={[{ required: true }]}><InputNumber min={1} max={1440} className="w-full" /></Form.Item>
            </div>
            <Button type="primary" htmlType="submit" loading={busy}>Save</Button>
          </Form>
        </Card>
      </div>

      <Modal open={askCode} title="Confirm with your authenticator" okText="Turn off" okButtonProps={{ danger: true, disabled: !/^\d{6}$/.test(code.replace(/\s/g, "")) }} confirmLoading={busy}
        onOk={() => save({ two_factor_enforced: false }, code)} onCancel={() => { setAskCode(false); setCode(""); }} destroyOnHidden>
        <p>Turning off required two-factor sign-in weakens every account. Enter the current code from your authenticator app to confirm.</p>
        <Input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" inputMode="numeric" maxLength={7} autoComplete="one-time-code" className="w-40" />
      </Modal>
    </>
  );
}
