import type { Metadata } from "next";
import AdminRoot from "@/components/admin/AdminProvider";

// Everything under /admin depends on the signed-in user, fetched in the browser.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Fitcheck admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminRoot>{children}</AdminRoot>;
}
