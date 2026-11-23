"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Card, Form, Input, Spin, Steps } from "antd";
import { api, ApiError } from "@/lib/api";
import { pendingSetup, useAdmin } from "@/components/admin/AdminProvider";
import HelpButton from "@/components/admin/HelpButton";
import Brand from "@/components/admin/Brand";
import PasswordFields from "@/components/admin/PasswordFields";
import TwoFactorSetup from "@/components/admin/TwoFactorSetup";
import type { Me } from "@/lib/types";

/** First sign-in: change the default password, set email + display name, and set up 2FA when it's required. */
export default function SetupPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { me, setMe, refresh, logout } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [pwForm] = Form.useForm();
  const [profileForm] = Form.useForm();

  useEffect(() => {
    refresh().then((m) => {
      if (!m) router.replace("/admin/login");
      else if (!pendingSetup(m)) router.replace("/admin");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!me) return <div className="page-loading grid min-h-dvh place-items-center"><Spin /></div>;

  const steps = [
    me.must_change_password && "password",
    me.needs_profile && "profile",
    me.needs_two_factor && "two_factor",
  ].filter(Boolean) as string[];
  const current = steps[0];
  const all = ["password", "profile", "two_factor"].filter((s) => s !== "two_factor" || me.two_factor_enforced);
  const labels: Record<string, string> = { password: "New password", profile: "Your details", two_factor: "Two-factor sign-in" };

  const advance = (m: Me) => {
    setMe(m);
    if (!pendingSetup(m)) { message.success("Your account is ready."); router.replace("/admin"); }
  };
  const fail = (form: ReturnType<typeof Form.useForm>[0], e: unknown) => {
    if (e instanceof ApiError && e.status === 422) form.setFields(e.fields());
    else message.error(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
  };

  async function savePassword(v: Record<string, string>) {
    setBusy(true);
    try { advance(await api<Me>("/profile/password", { method: "PUT", body: v })); } catch (e) { fail(pwForm, e); } finally { setBusy(false); }
  }
  async function saveProfile(v: Record<string, string>) {
    setBusy(true);
    try { advance(await api<Me>("/profile", { method: "PUT", body: v })); } catch (e) { fail(profileForm, e); } finally { setBusy(false); }
  }

  return (
    <main className="page page-setup mx-auto grid max-w-[640px] gap-6 px-4 py-10">
      <div className="setup-header flex items-center justify-between">
        <Brand />
        <Button className="setup-header-btn setup-header-btn--sign-out" type="link" onClick={async () => { await logout(); router.replace("/admin/login"); }}>Sign out</Button>
      </div>
      <div className="setup-intro">
        <div className="setup-intro-heading flex items-center gap-1.5"><h1 className="setup-intro-title m-0 text-2xl font-semibold">Finish setting up your account</h1><HelpButton /></div>
        <p className="setup-intro-text mb-0 mt-1 text-[#5c6978]">Signed in as <b>{me.username}</b>. These steps are required before you can use the admin panel.</p>
      </div>
      <Steps className="setup-steps" current={all.indexOf(current)} items={all.map((s) => ({ title: labels[s], status: steps.includes(s) ? (s === current ? "process" : "wait") : "finish" }))} />
      <Card className="setup-card" title={labels[current]}>
        {current === "password" && (
          <Form className="setup-step-panel setup-step-panel--password form form--password" form={pwForm} layout="vertical" onFinish={savePassword} requiredMark={false} disabled={busy}>
            <p className="form-help mt-0 text-[#5c6978]">Your account still uses the default password. Choose your own.</p>
            <Form.Item className="form-field form-field--current-password" name="current_password" label="Current password" rules={[{ required: true, message: "Enter the password you signed in with" }]}>
              <Input.Password className="form-input form-input--current-password" autoComplete="current-password" />
            </Form.Item>
            <PasswordFields min={me.password_min_length} />
            <Button className="form-btn form-btn--save-password" type="primary" htmlType="submit" loading={busy}>Save password</Button>
          </Form>
        )}
        {current === "profile" && (
          <Form className="setup-step-panel setup-step-panel--profile form form--profile" form={profileForm} layout="vertical" onFinish={saveProfile} requiredMark={false} disabled={busy} initialValues={{ display_name: me.display_name ?? "", email: me.email ?? "" }}>
            <Form.Item className="form-field form-field--display-name" name="display_name" label="Display name" extra="Shown in the admin panel and the audit log." rules={[{ required: true, message: "Enter a display name" }, { max: 100 }]}>
              <Input className="form-input form-input--display-name" autoComplete="name" />
            </Form.Item>
            <Form.Item className="form-field form-field--email" name="email" label="Email address" extra="You can sign in with this or your username." rules={[{ required: true, message: "Enter your email address" }, { type: "email", message: "Enter a valid email address" }]}>
              <Input className="form-input form-input--email" autoComplete="email" inputMode="email" />
            </Form.Item>
            <Button className="form-btn form-btn--save-details" type="primary" htmlType="submit" loading={busy}>Save details</Button>
          </Form>
        )}
        {current === "two_factor" && (
          <div className="setup-step-panel setup-step-panel--two-factor">
            <p className="setup-step-help mt-0 text-[#5c6978]">Your administrator requires two-factor sign-in for every account.</p>
            <TwoFactorSetup onDone={advance} />
          </div>
        )}
      </Card>
    </main>
  );
}
