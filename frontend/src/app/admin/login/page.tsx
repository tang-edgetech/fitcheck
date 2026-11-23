"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Form, Input } from "antd";
import { LockOutlined, SafetyOutlined, UserOutlined } from "@ant-design/icons";
import { api, ApiError } from "@/lib/api";
import { pendingSetup, useAdmin } from "@/components/admin/AdminProvider";
import Brand from "@/components/admin/Brand";
import type { Me } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const { refresh, setMe } = useAdmin();
  const [step, setStep] = useState<"password" | "code">("password");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const next = () => {
    const n = new URLSearchParams(window.location.search).get("next");
    return n && n.startsWith("/admin") && !n.startsWith("//") ? n : "/admin";
  };
  const done = (m: Me) => { setMe(m); router.replace(pendingSetup(m) ? "/admin/setup" : next()); };

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("reason");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the redirect reason
    if (r) setNotice(r);
    refresh().then((m) => { if (m) done(m); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitPassword(v: { login: string; password: string }) {
    setBusy(true); setError("");
    try {
      const r = await api<Me & { two_factor?: boolean }>("/auth/login", { method: "POST", body: v, quiet401: true });
      if (r.two_factor) setStep("code"); else done(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reach the server. Try again.");
    } finally { setBusy(false); }
  }
  async function submitCode(v: { code?: string; recovery_code?: string }) {
    setBusy(true); setError("");
    try {
      done(await api<Me>("/auth/two-factor", { method: "POST", body: v, quiet401: true }));
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Could not reach the server. Try again.";
      setError(msg);
      if (msg.includes("expired")) setStep("password");
    } finally { setBusy(false); }
  }

  return (
    <main className="page page-login grid min-h-dvh place-items-center p-4">
      <div className="login-container w-full max-w-[400px]">
        <div className="login-brand mb-6 flex justify-center"><Brand /></div>
        <Card className="login-card">
          {step === "password" ? (
            <>
              <h1 className="login-title mb-1 mt-0 text-xl font-semibold">Sign in</h1>
              <p className="login-help mb-5 mt-0 text-[#5c6978]">Use your username or email address.</p>
              {notice && <Alert className="login-alert login-alert--notice mb-4" type="info" showIcon title={notice} />}
              {error && <Alert className="login-alert login-alert--error mb-4" type="error" showIcon title={error} />}
              <Form className="form form--login" layout="vertical" onFinish={submitPassword} requiredMark={false} disabled={busy}>
                <Form.Item className="form-field form-field--login" name="login" label="Username or email" rules={[{ required: true, message: "Enter your username or email" }]}>
                  <Input className="form-input form-input--login" size="large" prefix={<UserOutlined />} autoComplete="username" autoFocus />
                </Form.Item>
                <Form.Item className="form-field form-field--password" name="password" label="Password" rules={[{ required: true, message: "Enter your password" }]}>
                  <Input.Password className="form-input form-input--password" size="large" prefix={<LockOutlined />} autoComplete="current-password" />
                </Form.Item>
                <Button className="form-btn form-btn--sign-in" type="primary" htmlType="submit" size="large" block loading={busy}>Sign in</Button>
              </Form>
            </>
          ) : (
            <>
              <h1 className="login-title login-title--two-factor mb-1 mt-0 text-xl font-semibold">Two-factor sign-in</h1>
              <p className="login-help login-help--two-factor mb-5 mt-0 text-[#5c6978]">{useRecovery ? "Enter one of the recovery codes you saved when you set up two-factor sign-in. Each code works once." : "Open your authenticator app and enter the 6-digit code for Fitcheck."}</p>
              {error && <Alert className="login-alert login-alert--error mb-4" type="error" showIcon title={error} />}
              <Form className="form form--two-factor" layout="vertical" onFinish={submitCode} requiredMark={false} disabled={busy} key={String(useRecovery)}>
                {useRecovery ? (
                  <Form.Item className="form-field form-field--recovery-code" name="recovery_code" label="Recovery code" rules={[{ required: true, message: "Enter a recovery code" }]}>
                    <Input className="form-input form-input--recovery-code" size="large" placeholder="ABCDE-12345" autoComplete="one-time-code" autoFocus />
                  </Form.Item>
                ) : (
                  <Form.Item className="form-field form-field--code" name="code" label="6-digit code" rules={[{ required: true, pattern: /^\s*\d{3}\s?\d{3}\s*$/, message: "Enter the 6 digits from your app" }]}>
                    <Input className="form-input form-input--code" size="large" prefix={<SafetyOutlined />} inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus />
                  </Form.Item>
                )}
                <Button className="form-btn form-btn--verify" type="primary" htmlType="submit" size="large" block loading={busy}>Verify</Button>
              </Form>
              <div className="login-links mt-4 flex justify-between">
                <Button type="link" className="login-link login-link--toggle-recovery px-0" onClick={() => { setUseRecovery((x) => !x); setError(""); }}>{useRecovery ? "Use authenticator code" : "Use a recovery code"}</Button>
                <Button type="link" className="login-link login-link--back px-0" onClick={() => { setStep("password"); setError(""); }}>Back</Button>
              </div>
            </>
          )}
        </Card>
        <p className="login-footer mt-6 text-center text-[13px] text-[#5c6978]"><Link href="/" className="login-footer-link text-[#5c6978]">← Back to the tester</Link></p>
      </div>
    </main>
  );
}
