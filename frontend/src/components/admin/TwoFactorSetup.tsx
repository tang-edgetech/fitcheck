"use client";

import { useState } from "react";
import { Alert, App, Button, Form, Input, Typography } from "antd";
import { api, ApiError } from "@/lib/api";
import type { Me } from "@/lib/types";

interface Start { secret: string; otpauth_url: string; qr_svg: string }

/** Enrol in TOTP: scan QR → confirm a code → save recovery codes. */
export default function TwoFactorSetup({ onDone }: { onDone: (me: Me) => void }) {
  const { message } = App.useApp();
  const [start, setStart] = useState<Start | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [me, setMeLocal] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();

  async function begin() {
    setBusy(true);
    try { setStart(await api<Start>("/profile/two-factor", { method: "POST" })); }
    catch (e) { message.error(e instanceof ApiError ? e.message : "Could not start the setup."); }
    finally { setBusy(false); }
  }
  async function confirm(v: { code: string }) {
    setBusy(true);
    try {
      const r = await api<{ recovery_codes: string[]; user: Me }>("/profile/two-factor/confirm", { method: "POST", body: v });
      setCodes(r.recovery_codes); setMeLocal(r.user);
    } catch (e) {
      if (e instanceof ApiError) form.setFields([{ name: "code", errors: [e.message] }]);
    } finally { setBusy(false); }
  }
  const copyCodes = async () => {
    try { await navigator.clipboard.writeText(codes!.join("\n")); message.success("Recovery codes copied."); }
    catch { message.info("Select the codes and copy them manually."); }
  };
  const downloadCodes = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([`Fitcheck recovery codes (${new Date().toLocaleDateString()})\nEach code works once.\n\n${codes!.join("\n")}\n`], { type: "text/plain" }));
    a.download = "fitcheck-recovery-codes.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  if (codes) {
    return (
      <div className="grid gap-4">
        <Alert type="success" showIcon title="Two-factor sign-in is on." description="Save these recovery codes somewhere safe. If you lose your phone, each code lets you sign in once. They won't be shown again." />
        <pre className="m-0 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-[#f7f9fb] p-4 font-mono text-[15px] tracking-wide">{codes.map((c) => <span key={c}>{c}</span>)}</pre>
        <div className="flex flex-wrap gap-2">
          <Button onClick={copyCodes}>Copy</Button>
          <Button onClick={downloadCodes}>Download .txt</Button>
          <Button type="primary" onClick={() => me && onDone(me)}>I&apos;ve saved them</Button>
        </div>
      </div>
    );
  }
  if (!start) {
    return (
      <div className="grid gap-3">
        <p className="m-0 text-[#5c6978]">You&apos;ll need an authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator, Authy or 1Password.</p>
        <div><Button type="primary" onClick={begin} loading={busy}>Set up two-factor sign-in</Button></div>
      </div>
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-[220px_1fr]">
      {/* SVG comes from our own API (bacon-qr-code), not from user input */}
      <div className="h-[220px] w-[220px] rounded-lg border border-solid border-[#e3e8ee] bg-white p-2.5 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: start.qr_svg }} aria-label="QR code for your authenticator app" role="img" />
      <div className="grid content-start gap-3">
        <ol className="m-0 grid gap-1.5 pl-5">
          <li>Open your authenticator app and add an account.</li>
          <li>Scan the QR code. If you can&apos;t scan, enter this key: <Typography.Text code copyable={{ text: start.secret }} className="break-all">{start.secret.replace(/(.{4})/g, "$1 ").trim()}</Typography.Text></li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
        <Form form={form} layout="inline" onFinish={confirm} requiredMark={false}>
          <Form.Item name="code" rules={[{ required: true, pattern: /^\s*\d{3}\s?\d{3}\s*$/, message: "Enter the 6 digits" }]}>
            <Input placeholder="123 456" inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="w-36" autoFocus />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={busy}>Turn on</Button>
        </Form>
      </div>
    </div>
  );
}
