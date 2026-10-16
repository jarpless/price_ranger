import type { ReactNode } from "react";

/** The page action sits in the flow. The assistant pill is the fixed control. */
export function PrimaryDock({ children }: { children: ReactNode }) {
  return (
    <div className="primary-dock">
      <div className="primary-dock-inner">{children}</div>
    </div>
  );
}
