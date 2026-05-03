import type { Metadata } from "next";
import "./globals.css";
import { ThemeNoFlashScript, ThemeProvider } from "@/components/theme/ThemeProvider";

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
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <ThemeNoFlashScript />
      </head>
      <body className="psypic-root">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
