import AdminShell from "@/components/admin/AdminShell";

// Admin pages load per-user data after sign-in, so navigation into them can't be instant by design.
export const instant = false;

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
