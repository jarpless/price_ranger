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
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-paper px-4 py-2 shadow-dock lg:static lg:inset-auto lg:z-auto lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
      <div className="mx-auto flex w-full max-w-[36rem] lg:max-w-none lg:justify-start">{children}</div>
    </div>
  );
}
