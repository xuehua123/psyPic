import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PsyPic",
  description: "Commercial image generation workspace"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="psypic-root">{children}</body>
    </html>
  );
}
