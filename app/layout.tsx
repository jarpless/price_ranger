import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { AppChrome } from "@/components/app-chrome";

import "./globals.css";

const outfit = localFont({
  src: [
    { path: "./fonts/outfit-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/outfit-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/outfit-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/outfit-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-outfit",
  display: "swap",
});

const sourceSerif = localFont({
  src: [
    { path: "./fonts/source-serif-4-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/source-serif-4-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/source-serif-4-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.priceranger.app"),
  title: {
    default: "Price Ranger",
    template: "%s · Price Ranger",
  },
  description: "Price an item, a job, or a guess, then send it.",
  applicationName: "Price Ranger",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Price Ranger",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/brand/icons/icon-light-32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/brand/icons/icon-dark-32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [{ url: "/brand/icons/apple-touch.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Price Ranger",
    description: "Price an item, a job, or a guess, then send it.",
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "Price Ranger" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/brand/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e4636",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-ask="on" className={`${outfit.variable} ${sourceSerif.variable} bg-cream font-sans text-ink antialiased`}>
        {children}
        <AppChrome />
      </body>
    </html>
  );
}
