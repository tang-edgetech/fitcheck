"use client";

import { useState } from "react";
import { App, Button, Card, Form, Input, Modal, Tag, Typography } from "antd";
import { api, ApiError } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import type { Me } from "@/lib/types";
import { useAdmin } from "@/components/admin/AdminProvider";
import { PageHead } from "@/components/admin/AdminShell";
import PasswordFields from "@/components/admin/PasswordFields";
import TwoFactorSetup from "@/components/admin/TwoFactorSetup";

export default function ProfilePage() {
  const { me, setMe, can } = useAdmin();
  const { message } = App.useApp();
  const [pf] = Form.useForm();
  const [pw] = Form.useForm();
  const [busy, setBusy] = useState("");
  const [setup, setSetup] = useState(false);
  const [ask, setAsk] = useState<"disable" | "codes" | null>(null);
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  if (!me) return null;

  const err = (form: ReturnType<typeof Form.useForm>[0] | null, e: unknown) => {
    if (form && e instanceof ApiError && e.status === 422 && e.fields().length) form.setFields(e.fields());
    else message.error(e instanceof ApiError ? e.message : "Something went wrong.");
  };
  const saveProfile = async (v: object) => {
    setBusy("p");
    try { setMe(await api<Me>("/profile", { method: "PUT", body: v })); message.success("Profile saved."); } catch (e) { err(pf, e); } finally { setBusy(""); }
  };
  const savePassword = async (v: object) => {
    setBusy("w");
    try { setMe(await api<Me>("/profile/password", { method: "PUT", body: v })); pw.resetFields(); message.success("Password changed. Your other sessions were signed out."); }
    catch (e) { err(pw, e); } finally { setBusy(""); }
  };
  const confirmAsk = async () => {
    setBusy("a");
    try {
      if (ask === "disable") { setMe(await api<Me>("/profile/two-factor", { method: "DELETE", body: { password } })); message.success("Two-factor sign-in is off."); }
      else setCodes((await api<{ recovery_codes: string[] }>("/profile/two-factor/recovery-codes", { method: "POST", body: { password } })).recovery_codes);
      setAsk(null); setPassword("");
    } catch (e) { err(null, e); } finally { setBusy(""); }
  };

  return (
    <div className="page page-profile">
      <PageHead title="My profile" sub={<>Signed in as <b>{me.username}</b> · {me.role_label} · last sign-in {fmtTime(me.last_login_at)}</>} />
      <div className="profile-cards grid max-w-[760px] gap-4">
        <Card className="profile-card profile-card--details" title="Your details">
          <Form className="form form--profile" form={pf} layout="vertical" onFinish={saveProfile} initialValues={{ username: me.username, display_name: me.display_name, email: me.email }} requiredMark={false}>
            <div className="form-grid grid gap-x-6 sm:grid-cols-2">
              {can("users.change_username") && (
                <Form.Item className="form-field form-field--username sm:col-span-2" name="username" label="Username" extra="You sign in with this or your email. Your old username stops working once you save." rules={[{ required: true, message: "Enter a username" }, { min: 3 }, { max: 50 }, { pattern: /^[A-Za-z0-9_-]+$/, message: "Letters, numbers, - and _ only" }]}>
                  <Input className="form-input form-input--username" autoComplete="username" spellCheck={false} />
                </Form.Item>
              )}
              <Form.Item className="form-field form-field--display-name" name="display_name" label="Display name" rules={[{ required: true, message: "Enter a display name" }, { max: 100 }]}><Input className="form-input form-input--display-name" autoComplete="name" /></Form.Item>
              <Form.Item className="form-field form-field--email" name="email" label="Email" rules={[{ required: true, message: "Enter your email" }, { type: "email", message: "Enter a valid email address" }]}><Input className="form-input form-input--email" autoComplete="email" inputMode="email" /></Form.Item>
            </div>
            <Button className="form-btn form-btn--save-details" type="primary" htmlType="submit" loading={busy === "p"}>Save details</Button>
          </Form>
        </Card>

        <Card className="profile-card profile-card--password" title="Password">
          <Form className="form form--password" form={pw} layout="vertical" onFinish={savePassword} requiredMark={false}>
            <Form.Item className="form-field form-field--current-password" name="current_password" label="Current password" rules={[{ required: true, message: "Enter your current password" }]}><Input.Password className="form-input form-input--current-password" autoComplete="current-password" /></Form.Item>
            <PasswordFields min={me.password_min_length} />
            <Button className="form-btn form-btn--change-password" type="primary" htmlType="submit" loading={busy === "w"}>Change password</Button>
          </Form>
        </Card>

        <Card className="profile-card profile-card--two-factor" title={<>Two-factor sign-in {me.two_factor_enabled ? <Tag color="green" className="two-factor-status two-factor-status--on ml-2">On</Tag> : <Tag className="two-factor-status two-factor-status--off ml-2">Off</Tag>}</>}>
          {me.two_factor_enabled ? (
            <div className="two-factor-panel two-factor-panel--enabled grid gap-3">
              <p className="two-factor-panel-help m-0 text-[#5c6978]">You enter a code from your authenticator app each time you sign in.</p>
              <div className="two-factor-panel-actions flex flex-wrap gap-2">
                <Button className="two-factor-panel-btn two-factor-panel-btn--new-codes" onClick={() => setAsk("codes")}>New recovery codes</Button>
                <Button className="two-factor-panel-btn two-factor-panel-btn--turn-off" danger disabled={me.two_factor_enforced} onClick={() => setAsk("disable")}>Turn off</Button>
              </div>
              {me.two_factor_enforced && <span className="two-factor-panel-note text-[13px] text-[#5c6978]">It can&apos;t be turned off because it&apos;s required for every account.</span>}
            </div>
          ) : setup ? (
            <TwoFactorSetup onDone={(m) => { setMe(m); setSetup(false); message.success("Two-factor sign-in is on."); }} />
          ) : (
            <div className="two-factor-panel two-factor-panel--disabled grid gap-3">
              <p className="two-factor-panel-help m-0 text-[#5c6978]">Add a second step to sign-in so a stolen password isn&apos;t enough to get in.</p>
              <div className="two-factor-panel-actions"><Button className="two-factor-panel-btn two-factor-panel-btn--set-up" type="primary" onClick={() => setSetup(true)}>Set up</Button></div>
            </div>
          )}
        </Card>
      </div>

      <Modal className="confirm-password-modal" open={!!ask} title={ask === "disable" ? "Turn off two-factor sign-in?" : "Create new recovery codes?"} okText={ask === "disable" ? "Turn off" : "Create codes"}
        okButtonProps={{ danger: ask === "disable", disabled: !password }} confirmLoading={busy === "a"} onOk={confirmAsk} onCancel={() => { setAsk(null); setPassword(""); }} destroyOnHidden>
        <p className="confirm-password-modal-text">{ask === "disable" ? "Your account will be protected by your password only." : "Your old recovery codes stop working."} Enter your password to confirm.</p>
        <Input.Password className="confirm-password-modal-input" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" onPressEnter={confirmAsk} />
      </Modal>
      <Modal className="recovery-codes-modal" open={!!codes} title="Your new recovery codes" footer={<Button className="recovery-codes-modal-btn recovery-codes-modal-btn--saved" type="primary" onClick={() => setCodes(null)}>I&apos;ve saved them</Button>} onCancel={() => setCodes(null)}>
        <p className="recovery-codes-modal-text">Each code works once. They won&apos;t be shown again.</p>
        <Typography.Paragraph copyable={{ text: codes?.join("\n") }} className="recovery-codes m-0 rounded-lg bg-[#f7f9fb] p-4 font-mono text-[15px]">
          {codes?.map((c) => <span key={c} className="recovery-code block">{c}</span>)}
        </Typography.Paragraph>
      </Modal>
    </div>
  );
}
