"use client";

import { useEffect, useState } from "react";

const PATHS = [
  { path: "/new", label: "New price" },
  { path: "/ask", label: "Ask Price Ranger" },
];

export function ShortcutLinks() {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <ul className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
      {PATHS.map((item) => {
        const url = origin ? `${origin}${item.path}` : item.path;
        return (
          <li key={item.path} className="border-b border-line px-4 py-4 last:border-b-0">
            <p className="whitespace-nowrap text-base font-semibold">{item.label}</p>
            <p className="mt-1 break-all font-mono text-caption text-muted">{url}</p>
          </li>
        );
      })}
    </ul>
  );
}
