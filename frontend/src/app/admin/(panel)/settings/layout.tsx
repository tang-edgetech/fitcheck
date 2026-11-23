import SettingsShell from "@/components/admin/SettingsShell";

/** Settings: one route per tab (General, Security, Log, Extra) sharing a header and the loaded values. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>;
}
