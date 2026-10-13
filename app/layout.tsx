import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";

import { AppChrome } from "@/components/app-chrome";

import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
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
    icon: "/images/logo-mark.png",
    apple: "/images/logo-mark.png",
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
      <body className={`${outfit.variable} ${fraunces.variable} bg-cream font-sans text-ink antialiased`}>
        {children}
        <AppChrome />
      </body>
    </html>
  );
}
