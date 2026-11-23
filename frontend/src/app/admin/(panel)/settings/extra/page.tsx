"use client";

import { useState } from "react";
import { App, Button, Card, Form, Input, Switch } from "antd";
import { useSettings, useSettingsErrors } from "@/components/admin/SettingsShell";

export default function ExtraSettingsPage() {
  const { s, save } = useSettings();
  const { message } = App.useApp();
  const onError = useSettingsErrors();
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const bannerOn = Form.useWatch("banner_enabled", form);

  const submit = async (v: Record<string, unknown>) => {
    setBusy(true);
    try { await save("extra", v); message.success("Saved. The tester shows the change on its next load."); }
    catch (e) { onError(e, form.setFields); }
    finally { setBusy(false); }
  };

  return (
    <Card className="settings-card settings-card--extra" title="Tester extras">
      <Form className="form form--extra" form={form} layout="vertical" onFinish={submit} requiredMark={false}
        initialValues={{ banner_enabled: s["extra.banner_enabled"], banner_text: s["extra.banner_text"], help_email: s["extra.help_email"] }}>
        <Form.Item className="form-field form-field--banner-enabled" name="banner_enabled" label="Announcement banner" valuePropName="checked" extra="A short message across the top of the tester, e.g. planned maintenance.">
          <Switch className="form-input form-input--banner-enabled" />
        </Form.Item>
        <Form.Item className="form-field form-field--banner-text" name="banner_text" label="Banner text"
          rules={[{ max: 300 }, { required: !!bannerOn, message: "Enter the message to show" }]}>
          <Input.TextArea className="form-input form-input--banner-text" rows={2} maxLength={300} showCount disabled={!bannerOn} placeholder="e.g. The tester will be unavailable on Saturday 10:00–11:00." />
        </Form.Item>
        <Form.Item className="form-field form-field--help-email" name="help_email" label="Help contact email" extra="Shown in the tester's “Blank screen?” help. Leave empty to hide." rules={[{ type: "email", message: "Enter a valid email address" }]}>
          <Input className="form-input form-input--help-email" inputMode="email" placeholder="support@example.com" />
        </Form.Item>
        <Button className="form-btn form-btn--save" type="primary" htmlType="submit" loading={busy}>Save</Button>
      </Form>
    </Card>
  );
}
