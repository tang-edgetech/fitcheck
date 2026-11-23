import { Suspense } from "react";
import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Inter } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const dmMono = DM_Mono({ variable: "--font-dm-mono", subsets: ["latin"], weight: ["400", "500"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Fitcheck", template: "%s · Fitcheck" },
  description: "Check how a website looks on phones, tablets, laptops and TVs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* The style registry generates ids at render time, so it streams inside Suspense (Next 16 cache components) */}
        <Suspense fallback={null}>
          <AntdRegistry layer>{children}</AntdRegistry>
        </Suspense>
      </body>
    </html>
  );
}
