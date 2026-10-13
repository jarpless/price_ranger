"use client";

import { PendingLink as Link } from "@/components/pending-link";
import { useEffect, useState } from "react";

interface Ticket {
  id: string;
  summary: string;
  status: string;
  href: string;
}

function label(status: string): string {
  if (status === "in_progress") return "In progress";
  if (status === "planned") return "Planned";
  if (status === "shipped") return "Shipped";
  return "New";
}

export function MyFeedbackList() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);

  useEffect(() => {
    let cancel = false;
    void fetch("/api/feedback")
      .then((response) => response.json())
      .then((payload: { tickets?: Ticket[] }) => {
        if (!cancel) setTickets(payload.tickets || []);
      })
      .catch(() => {
        if (!cancel) setTickets([]);
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (!tickets || tickets.length === 0) return null;

  return (
    <div className="rounded-2xl border border-line bg-paper p-3">
      <p className="text-caption font-semibold text-muted">Your feedback</p>
      <ul className="mt-2 space-y-2">
        {tickets.slice(0, 4).map((ticket) => (
          <li key={ticket.id}>
            <Link href={ticket.href} className="block text-body font-semibold text-pine">
              {ticket.summary}
            </Link>
            <p className="text-caption text-muted">{label(ticket.status)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
