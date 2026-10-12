import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";

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
  description: "A simple phone app for pricing a job and presenting a few options.",
  applicationName: "Price Ranger",
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
      </body>
    </html>
  );
}
