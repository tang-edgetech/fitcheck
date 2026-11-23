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
  const { me, setMe } = useAdmin();
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
    <>
      <PageHead title="My profile" sub={<>Signed in as <b>{me.username}</b> · {me.role_label} · last sign-in {fmtTime(me.last_login_at)}</>} />
      <div className="grid max-w-[760px] gap-4">
        <Card title="Your details">
          <Form form={pf} layout="vertical" onFinish={saveProfile} initialValues={{ display_name: me.display_name, email: me.email }} requiredMark={false}>
            <div className="grid gap-x-6 sm:grid-cols-2">
              <Form.Item name="display_name" label="Display name" rules={[{ required: true, message: "Enter a display name" }, { max: 100 }]}><Input autoComplete="name" /></Form.Item>
              <Form.Item name="email" label="Email" rules={[{ required: true, message: "Enter your email" }, { type: "email", message: "Enter a valid email address" }]}><Input autoComplete="email" inputMode="email" /></Form.Item>
            </div>
            <Button type="primary" htmlType="submit" loading={busy === "p"}>Save details</Button>
          </Form>
        </Card>

        <Card title="Password">
          <Form form={pw} layout="vertical" onFinish={savePassword} requiredMark={false}>
            <Form.Item name="current_password" label="Current password" rules={[{ required: true, message: "Enter your current password" }]}><Input.Password autoComplete="current-password" /></Form.Item>
            <PasswordFields min={me.password_min_length} />
            <Button type="primary" htmlType="submit" loading={busy === "w"}>Change password</Button>
          </Form>
        </Card>

        <Card title={<>Two-factor sign-in {me.two_factor_enabled ? <Tag color="green" className="ml-2">On</Tag> : <Tag className="ml-2">Off</Tag>}</>}>
          {me.two_factor_enabled ? (
            <div className="grid gap-3">
              <p className="m-0 text-[#5c6978]">You enter a code from your authenticator app each time you sign in.</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setAsk("codes")}>New recovery codes</Button>
                <Button danger disabled={me.two_factor_enforced} onClick={() => setAsk("disable")}>Turn off</Button>
              </div>
              {me.two_factor_enforced && <span className="text-[13px] text-[#5c6978]">It can&apos;t be turned off because it&apos;s required for every account.</span>}
            </div>
          ) : setup ? (
            <TwoFactorSetup onDone={(m) => { setMe(m); setSetup(false); message.success("Two-factor sign-in is on."); }} />
          ) : (
            <div className="grid gap-3">
              <p className="m-0 text-[#5c6978]">Add a second step to sign-in so a stolen password isn&apos;t enough to get in.</p>
              <div><Button type="primary" onClick={() => setSetup(true)}>Set up</Button></div>
            </div>
          )}
        </Card>
      </div>

      <Modal open={!!ask} title={ask === "disable" ? "Turn off two-factor sign-in?" : "Create new recovery codes?"} okText={ask === "disable" ? "Turn off" : "Create codes"}
        okButtonProps={{ danger: ask === "disable", disabled: !password }} confirmLoading={busy === "a"} onOk={confirmAsk} onCancel={() => { setAsk(null); setPassword(""); }} destroyOnHidden>
        <p>{ask === "disable" ? "Your account will be protected by your password only." : "Your old recovery codes stop working."} Enter your password to confirm.</p>
        <Input.Password autoFocus value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" onPressEnter={confirmAsk} />
      </Modal>
      <Modal open={!!codes} title="Your new recovery codes" footer={<Button type="primary" onClick={() => setCodes(null)}>I&apos;ve saved them</Button>} onCancel={() => setCodes(null)}>
        <p>Each code works once. They won&apos;t be shown again.</p>
        <Typography.Paragraph copyable={{ text: codes?.join("\n") }} className="m-0 rounded-lg bg-[#f7f9fb] p-4 font-mono text-[15px]">
          {codes?.map((c) => <span key={c} className="block">{c}</span>)}
        </Typography.Paragraph>
      </Modal>
    </>
  );
}
