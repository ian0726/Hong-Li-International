import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://blueroute-auto-parts.kenyang337447.chatgpt.site"),
  title: "閎麗國際有限公司｜B2B 汽車零件產品中心",
  description: "依照廠牌、型號與年份，快速找到精準適配的汽車零配件。",
  openGraph: {
    title: "閎麗國際有限公司｜B2B 汽車零件產品中心",
    description: "專業、清楚、有效率的汽車零配件選品體驗。",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "閎麗國際有限公司｜B2B 汽車零件產品中心",
    description: "專業、清楚、有效率的汽車零配件選品體驗。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
