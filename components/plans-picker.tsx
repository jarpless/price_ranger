"use client";

import { useState, type ReactNode } from "react";

import { startCheckout } from "@/app/guide-actions";
import { InfoTip } from "@/components/info-tip";
import { formatUsd } from "@/lib/money";
import { PLAN_PRICES_CENTS, PLANS, type PlanId } from "@/lib/plans";

const YEAR_SAVINGS = PLAN_PRICES_CENTS.plusMonth * 12 - PLAN_PRICES_CENTS.plusYear;

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-12 flex-1 whitespace-nowrap rounded-2xl text-base font-semibold ${active ? "bg-pine text-cream" : "border border-line bg-paper text-ink"}`}
    >
      {children}
    </button>
  );
}

export function PlansPicker({ current, ready, quoteLimit = 3 }: { current: PlanId; ready: boolean; quoteLimit?: number }) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const plusPrice = interval === "year" ? PLAN_PRICES_CENTS.plusYear : PLAN_PRICES_CENTS.plusMonth;
  const plusLabel = interval === "year" ? `${formatUsd(plusPrice)}/year` : `${formatUsd(plusPrice)}/month`;

  return (
    <div className="mt-6 space-y-4">
      <div>
        <div className="mb-2 flex items-center gap-1">
          <p className="text-base font-semibold">Plus billing</p>
          <InfoTip id="billing" />
        </div>
        <div className="flex gap-2" role="group" aria-label="Monthly or yearly">
          <Chip active={interval === "month"} onClick={() => setInterval("month")}>
            Monthly
          </Chip>
          <Chip active={interval === "year"} onClick={() => setInterval("year")}>
            Yearly · save {formatUsd(YEAR_SAVINGS)}
          </Chip>
        </div>
      </div>
      <ul className="grid gap-3 lg:grid-cols-2">
        <PlanCard
          name={PLANS.free.name}
          price={PLANS.free.priceLabel}
          current={current === "free"}
          points={[`${quoteLimit} prices`, "10 assistant messages a month", "Price Ranger mark on shared links"]}
        />
        <PlanCard
          name="30-day pass"
          price={formatUsd(PLAN_PRICES_CENTS.passOnce)}
          current={current === "pass"}
          points={["Unlimited prices for 30 days", "One payment, no renewal", "Higher assistant limit"]}
          action={ready ? <CheckoutButton plan="pass" interval="once" label="Get the pass" /> : null}
        />
        <PlanCard
          name={PLANS.plus.name}
          price={plusLabel}
          current={current === "plus"}
          points={["Unlimited prices", "100 assistant messages a month", "No Price Ranger mark on links"]}
          action={ready ? <CheckoutButton plan="plus" interval={interval} label={interval === "year" ? "Get Plus yearly" : "Get Plus monthly"} /> : null}
        />
        <PlanCard
          name={PLANS.pro.name}
          price={`${formatUsd(PLAN_PRICES_CENTS.proMonth)}/month`}
          current={current === "pro"}
          points={["Unlimited prices", "1,000 assistant messages a month", "Best for a busy selling week"]}
          action={ready ? <CheckoutButton plan="pro" interval="month" label="Get Pro" /> : null}
        />
      </ul>
      {ready ? null : <p className="text-body leading-6">Payments are coming soon.</p>}
    </div>
  );
}

function PlanCard({
  name,
  price,
  current,
  points,
  action,
}: {
  name: string;
  price: string;
  current: boolean;
  points: string[];
  action?: ReactNode;
}) {
  return (
    <li className={`rounded-2xl border bg-paper p-5 shadow-card ${current ? "border-pine" : "border-line"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-serif text-title">{name}</p>
        {current ? <span className="whitespace-nowrap text-caption font-semibold text-pine">Current plan</span> : null}
      </div>
      <p className="mt-1 whitespace-nowrap font-serif text-price text-pine tabular-nums">{price}</p>
      <ul className="mt-3 space-y-1 text-body leading-6 text-muted">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      {action ? <div className="mt-4">{action}</div> : null}
    </li>
  );
}

function CheckoutButton({ plan, interval, label }: { plan: string; interval: string; label: string }) {
  return (
    <form action={startCheckout}>
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="interval" value={interval} />
      <button type="submit" className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-pine px-4 text-base font-semibold text-cream">
        {label}
      </button>
    </form>
  );
}
