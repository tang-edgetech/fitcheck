"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /admin/settings opens the first tab. With a Next.js server, next.config.ts redirects before this page loads;
 * static builds have no server redirects, so the page does it.
 */
export default function SettingsIndex() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/settings/general"); }, [router]);
  return null;
}
