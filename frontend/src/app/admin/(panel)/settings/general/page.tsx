"use client";

import { useState } from "react";
import { App, Button, Card, Form, Input, Radio } from "antd";
import { useSettings, useSettingsErrors } from "@/components/admin/SettingsShell";

export default function GeneralSettingsPage() {
  const { s, save } = useSettings();
  const { message } = App.useApp();
  const onError = useSettingsErrors();
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();

  const submit = async (v: Record<string, unknown>) => {
    setBusy(true);
    try { await save("general", v); message.success("General settings saved."); }
    catch (e) { onError(e, form.setFields); }
    finally { setBusy(false); }
  };

  return (
    <Card className="settings-card settings-card--general" title="Site and tester defaults">
      <Form className="form form--general" form={form} layout="vertical" onFinish={submit} requiredMark={false}
        initialValues={{ site_name: s["general.site_name"], default_view: s["general.default_view"], default_size: s["general.default_size"] }}>
        <Form.Item className="form-field form-field--site-name" name="site_name" label="Site name" extra="Shown in the tester's header and browser tab." rules={[{ required: true, message: "Enter a site name" }, { max: 60 }]}>
          <Input className="form-input form-input--site-name" maxLength={60} />
        </Form.Item>
        <div className="form-grid grid gap-x-6 sm:grid-cols-2">
          <Form.Item className="form-field form-field--default-view" name="default_view" label="Tester opens in" extra="Visitors can still switch. Their own choice is remembered on their device.">
            <Radio.Group className="form-input form-input--default-view" optionType="button" options={[{ value: "scroll", label: "Scroll" }, { value: "grid", label: "Grid" }]} />
          </Form.Item>
          <Form.Item className="form-field form-field--default-size" name="default_size" label="Device size" extra="True scale shows real size differences; fill height makes every device the same height.">
            <Radio.Group className="form-input form-input--default-size" optionType="button" options={[{ value: "true", label: "True scale" }, { value: "fill", label: "Fill height" }]} />
          </Form.Item>
        </div>
        <Button className="form-btn form-btn--save" type="primary" htmlType="submit" loading={busy}>Save</Button>
      </Form>
    </Card>
  );
}
