import type { Metadata } from "next";
import AdminRoot from "@/components/admin/AdminProvider";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Fitcheck admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminRoot>{children}</AdminRoot>;
}
