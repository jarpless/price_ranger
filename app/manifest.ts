import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Price Ranger",
    short_name: "Ranger",
    description: "Price an item, a job, or a guess, then send it.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3eee4",
    theme_color: "#1e4636",
    icons: [
      { src: "/images/logo-mark.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/images/logo-full.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "New price",
        short_name: "New price",
        description: "Start a price",
        url: "/new",
        icons: [{ src: "/images/logo-mark.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Ask Price Ranger",
        short_name: "Ask",
        description: "Open the assistant",
        url: "/ask",
        icons: [{ src: "/images/logo-mark.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
