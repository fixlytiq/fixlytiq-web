import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Fixlytiq",
    template: "%s · Fixlytiq",
  },
  description: "Device UI for Fixlytiq ERP — runs with Linux agent and cloud services.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fixlytiq",
  },
  formatDetection: {
    telephone: false,
  },
};

/** Kiosk / embedded display: stable scale, theme, safe for full-screen shell */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#09090b",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-[100dvh] overflow-x-hidden bg-zinc-950 text-zinc-50 antialiased overscroll-none">
        {children}
      </body>
    </html>
  );
}
