"use client";

import { useState } from "react";
import { Alert, App, Button, Card, Form, Input, InputNumber, Modal, Switch } from "antd";
import { ApiError } from "@/lib/api";
import { useAdmin } from "@/components/admin/AdminProvider";
import { useSettings, useSettingsErrors } from "@/components/admin/SettingsShell";

const K = {
  tfa: "security.two_factor_enforced", timeout: "security.session_timeout_minutes", pwlen: "security.password_min_length",
  attempts: "security.max_login_attempts", lockout: "security.lockout_minutes",
} as const;

export default function SecuritySettingsPage() {
  const { me } = useAdmin();
  const { s, save } = useSettings();
  const { message } = App.useApp();
  const onError = useSettingsErrors();
  const [busy, setBusy] = useState(false);
  const [askCode, setAskCode] = useState(false);
  const [code, setCode] = useState("");
  const [form] = Form.useForm();

  const put = async (body: Record<string, unknown>, c?: string) => {
    setBusy(true);
    try {
      await save("security", body, { code: c });
      setAskCode(false); setCode(""); message.success("Security settings saved.");
    } catch (e) {
      if (e instanceof ApiError && e.data.errors && (e.data.errors as Record<string, unknown>).code) { setAskCode(true); if (c) message.error(e.message); }
      else onError(e, form.setFields);
    } finally { setBusy(false); }
  };
  const toggle2fa = (on: boolean) => {
    if (!on && me?.two_factor_enabled) { setAskCode(true); return; }
    put({ two_factor_enforced: on });
  };

  return (
    <>
      <Card className="settings-card settings-card--two-factor" title="Two-factor sign-in">
        <div className="settings-toggle flex items-start gap-4">
          <Switch className="settings-toggle-switch" checked={!!s[K.tfa]} loading={busy} onChange={toggle2fa} aria-label="Require two-factor sign-in for everyone" />
          <div className="settings-toggle-text">
            <div className="settings-toggle-label font-medium">Require two-factor sign-in for everyone</div>
            <p className="settings-toggle-help mb-0 mt-1 text-[#5c6978]">When on, every account must enter a 6-digit code from an authenticator app after its password. Accounts without it are asked to set it up at their next sign-in.</p>
          </div>
        </div>
        {!!s[K.tfa] && !me?.two_factor_enabled && <Alert className="settings-alert settings-alert--two-factor mt-4" type="warning" showIcon title="You haven't set up two-factor sign-in yet." description="You'll be asked to set it up the next time you sign in." />}
      </Card>

      <Card className="settings-card settings-card--sessions" title="Sign-in and sessions">
        <Form className="form form--sessions" form={form} layout="vertical"
          initialValues={{ session_timeout_minutes: s[K.timeout], password_min_length: s[K.pwlen], max_login_attempts: s[K.attempts], lockout_minutes: s[K.lockout] }}
          onFinish={(v) => put(v)}>
          <div className="form-grid grid gap-x-6 sm:grid-cols-2">
            <Form.Item className="form-field form-field--timeout" name="session_timeout_minutes" label="Sign out after inactivity (minutes)" extra="5 to 720" rules={[{ required: true }]}><InputNumber min={5} max={720} className="form-input form-input--timeout w-full" /></Form.Item>
            <Form.Item className="form-field form-field--password-length" name="password_min_length" label="Minimum password length" extra="8 to 64. Passwords also need upper and lower case, a number and a symbol." rules={[{ required: true }]}><InputNumber min={8} max={64} className="form-input form-input--password-length w-full" /></Form.Item>
            <Form.Item className="form-field form-field--login-attempts" name="max_login_attempts" label="Failed sign-ins before lockout" extra="Per account and IP address" rules={[{ required: true }]}><InputNumber min={3} max={20} className="form-input form-input--login-attempts w-full" /></Form.Item>
            <Form.Item className="form-field form-field--lockout" name="lockout_minutes" label="Lockout length (minutes)" rules={[{ required: true }]}><InputNumber min={1} max={1440} className="form-input form-input--lockout w-full" /></Form.Item>
          </div>
          <Button className="form-btn form-btn--save" type="primary" htmlType="submit" loading={busy}>Save</Button>
        </Form>
      </Card>

      <Modal className="confirm-code-modal" open={askCode} title="Confirm with your authenticator" okText="Turn off" okButtonProps={{ danger: true, disabled: !/^\d{6}$/.test(code.replace(/\s/g, "")) }} confirmLoading={busy}
        onOk={() => put({ two_factor_enforced: false }, code)} onCancel={() => { setAskCode(false); setCode(""); }} destroyOnHidden>
        <p className="confirm-code-modal-text">Turning off required two-factor sign-in weakens every account. Enter the current code from your authenticator app to confirm.</p>
        <Input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" inputMode="numeric" maxLength={7} autoComplete="one-time-code" className="confirm-code-modal-input w-40" />
      </Modal>
    </>
  );
}
