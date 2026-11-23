"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Card, Form, Input, Spin, Steps } from "antd";
import { api, ApiError } from "@/lib/api";
import { pendingSetup, useAdmin } from "@/components/admin/AdminProvider";
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

  if (!me) return <div className="grid min-h-dvh place-items-center"><Spin /></div>;

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
    <main className="mx-auto grid max-w-[640px] gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Brand />
        <Button type="link" onClick={async () => { await logout(); router.replace("/admin/login"); }}>Sign out</Button>
      </div>
      <div>
        <h1 className="m-0 text-2xl font-semibold">Finish setting up your account</h1>
        <p className="mb-0 mt-1 text-[#5c6978]">Signed in as <b>{me.username}</b>. These steps are required before you can use the admin panel.</p>
      </div>
      <Steps current={all.indexOf(current)} items={all.map((s) => ({ title: labels[s], status: steps.includes(s) ? (s === current ? "process" : "wait") : "finish" }))} />
      <Card title={labels[current]}>
        {current === "password" && (
          <Form form={pwForm} layout="vertical" onFinish={savePassword} requiredMark={false} disabled={busy}>
            <p className="mt-0 text-[#5c6978]">Your account still uses the default password. Choose your own.</p>
            <Form.Item name="current_password" label="Current password" rules={[{ required: true, message: "Enter the password you signed in with" }]}>
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <PasswordFields min={me.password_min_length} />
            <Button type="primary" htmlType="submit" loading={busy}>Save password</Button>
          </Form>
        )}
        {current === "profile" && (
          <Form form={profileForm} layout="vertical" onFinish={saveProfile} requiredMark={false} disabled={busy} initialValues={{ display_name: me.display_name ?? "", email: me.email ?? "" }}>
            <Form.Item name="display_name" label="Display name" extra="Shown in the admin panel and the audit log." rules={[{ required: true, message: "Enter a display name" }, { max: 100 }]}>
              <Input autoComplete="name" />
            </Form.Item>
            <Form.Item name="email" label="Email address" extra="You can sign in with this or your username." rules={[{ required: true, message: "Enter your email address" }, { type: "email", message: "Enter a valid email address" }]}>
              <Input autoComplete="email" inputMode="email" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={busy}>Save details</Button>
          </Form>
        )}
        {current === "two_factor" && (
          <>
            <p className="mt-0 text-[#5c6978]">Your administrator requires two-factor sign-in for every account.</p>
            <TwoFactorSetup onDone={advance} />
          </>
        )}
      </Card>
    </main>
  );
}
