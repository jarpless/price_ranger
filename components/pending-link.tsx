"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";

function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-current opacity-15" aria-hidden />
      <span className="sr-only" role="status">
        Loading
      </span>
    </>
  );
}

export function PendingLink({ className = "", children, ...props }: ComponentProps<typeof Link> & { children: ReactNode }) {
  return (
    <Link {...props} className={`relative ${className}`}>
      {children}
      <LinkPending />
    </Link>
  );
}
