"use client";

import { useEffect, type ReactNode } from "react";

/** Pins the one primary action in the thumb zone on compact widths. */
export function PrimaryDock({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.dataset.dock = "1";
    return () => {
      delete document.body.dataset.dock;
    };
  }, []);

  return (
    <div className="primary-dock">
      <div className="primary-dock-inner">{children}</div>
    </div>
  );
}
