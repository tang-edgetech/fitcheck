"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, App, Button, Card, Form, InputNumber, Popconfirm, Select } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { api, ApiError } from "@/lib/api";
import { useAdmin } from "@/components/admin/AdminProvider";
import { NoAccess } from "@/components/admin/AdminShell";
import { useSettings, useSettingsErrors } from "@/components/admin/SettingsShell";
import DeployLog from "@/components/admin/DeployLog";

const LEVELS = [
  { value: "debug", label: "Debug: everything, for troubleshooting" },
  { value: "info", label: "Info: normal events and above (recommended)" },
  { value: "notice", label: "Notice: notable events and above" },
  { value: "warning", label: "Warning: problems and above" },
  { value: "error", label: "Error: failures only" },
];

export default function LogSettingsPage() {
  const { can } = useAdmin();
  const { s, save } = useSettings();
  const { message } = App.useApp();
  const onError = useSettingsErrors();
  const [busy, setBusy] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [form] = Form.useForm();
  if (!can("systemlogs.view")) return <NoAccess />;
  const days = Number(s["log.system_retention_days"]);

  const submit = async (v: Record<string, unknown>) => {
    setBusy(true);
    try { await save("log", v); message.success("Log settings saved."); }
    catch (e) { onError(e, form.setFields); }
    finally { setBusy(false); }
  };
  const prune = async () => {
    setPruning(true);
    try {
      const r = await api<{ deleted: number }>("/settings/system-log/prune", { method: "POST" });
      message.success(r.deleted ? `Deleted ${r.deleted} old system log entries.` : "Nothing to delete. No entries are older than the limit.");
    } catch (e) { message.error(e instanceof ApiError ? e.message : "Could not delete old entries."); }
    finally { setPruning(false); }
  };

  return (
    <>
      <Card className="settings-card settings-card--system-log" title="System log" extra={<Link className="settings-card-link" href="/admin/system-logs">Open system log</Link>}>
        <Form className="form form--log" form={form} layout="vertical" onFinish={submit} requiredMark={false}
          initialValues={{ system_level: s["log.system_level"], system_retention_days: s["log.system_retention_days"] }}>
          <div className="form-grid grid gap-x-6 sm:grid-cols-2">
            <Form.Item className="form-field form-field--system-level" name="system_level" label="Lowest level to keep" extra="Entries below this level are not stored in the system log.">
              <Select className="form-input form-input--system-level" options={LEVELS} popupMatchSelectWidth={false} />
            </Form.Item>
            <Form.Item className="form-field form-field--retention" name="system_retention_days" label="Keep entries for (days)" extra="0 keeps them forever. Older entries are deleted daily." rules={[{ required: true }]}>
              <InputNumber className="form-input form-input--retention w-full" min={0} max={3650} />
            </Form.Item>
          </div>
          <div className="form-actions flex flex-wrap gap-2">
            <Button className="form-btn form-btn--save" type="primary" htmlType="submit" loading={busy}>Save</Button>
            <Popconfirm className="prune-confirm" title={`Delete system log entries older than ${days} days?`} description="This can't be undone." okText="Delete" okButtonProps={{ danger: true }} onConfirm={prune} disabled={days === 0}>
              <Button className="form-btn form-btn--prune" icon={<DeleteOutlined />} loading={pruning} disabled={days === 0}>Delete old entries now</Button>
            </Popconfirm>
          </div>
        </Form>
      </Card>
      <Alert className="settings-alert settings-alert--audit-log" type="info" showIcon title="The audit log is never deleted."
        description="Its rows are append-only and linked together, so removing any would break the integrity check. Export it if you need an archive." />
      <Alert className="settings-alert settings-alert--scheduler" type="warning" showIcon title="Automatic daily clean-up needs the Laravel scheduler"
        description={<>On the server, add a cron entry that runs <code>php artisan schedule:run</code> every minute. Without it, use the button above.</>} />
      <DeployLog />
    </>
  );
}
