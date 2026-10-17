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
      { src: "/brand/icons/icon-light-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icons/icon-light-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "New price",
        short_name: "New price",
        description: "Start a price",
        url: "/new",
        icons: [{ src: "/brand/icons/icon-light-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Ask Price Ranger",
        short_name: "Ask",
        description: "Open the assistant",
        url: "/ask",
        icons: [{ src: "/brand/icons/icon-light-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
