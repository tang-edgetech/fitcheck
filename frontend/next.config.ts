import type { NextConfig } from "next";

// Three ways to build:
//   npm run dev / build / start   Next.js server proxies /api and /sanctum to Laravel (same-origin cookies).
//   npm run build:cpanel          The same, as a self-contained server.js for cPanel "Setup Node.js App".
//   npm run build:static          Plain HTML/JS files for hosting without Node.js (frontend/out/). The browser then
//                                 calls the API subdomain directly (NEXT_PUBLIC_API_URL; Laravel allows it via CORS).
//                                 Redirects, rewrites and headers need a server, so Apache does those (frontend/.htaccess).
const MODE = process.env.NEXT_OUTPUT;
const STATIC = MODE === "export";

// The Laravel API, for the proxy in server modes. Fixed at build time with build:cpanel.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const serverOnly: Partial<NextConfig> = {
  async redirects() {
    // Settings has one route per tab; the bare URL opens the first tab (static builds redirect in the page itself)
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

const nextConfig: NextConfig = {
  output: STATIC ? "export" : MODE === "standalone" ? "standalone" : undefined,
  // Static files: /admin/login/ → admin/login/index.html, which any web server can serve
  trailingSlash: STATIC,
  images: { unoptimized: STATIC },
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(STATIC ? {} : serverOnly),
};

export default nextConfig;
