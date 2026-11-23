import type { NextConfig } from "next";

// The Laravel API. The browser only talks to Next.js; /api and /sanctum are proxied,
// so session cookies and CSRF stay same-origin (no CORS, no tokens in JavaScript).
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // cPanel (Setup Node.js App) runs a self-contained server.js; `npm run build:cpanel` turns this on.
  // Note: the /api rewrite target (BACKEND_URL) is fixed at build time in this mode.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    // Settings has one route per tab; the bare URL opens the first tab
    return [{ source: "/admin/settings", destination: "/admin/settings/general", permanent: false }];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/sanctum/:path*", destination: `${BACKEND_URL}/sanctum/:path*` },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The admin panel must never be framed by another site. The tester page itself frames other sites, which is fine.
      { source: "/admin/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }, { key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
};

export default nextConfig;
