"use client";

import { useState } from "react";

import { formatUsd, parseDollarsToCents } from "@/lib/money";

export function Calculator() {
  const [price, setPrice] = useState("100");
  const [discount, setDiscount] = useState("10");
  const [fee, setFee] = useState("0");
  const cents = parseDollarsToCents(price) ?? 0;
  const percent = Math.min(100, Math.max(0, Number(discount) || 0));
  const feeCents = parseDollarsToCents(fee) ?? 0;
  const discounted = Math.round((cents * (100 - percent)) / 100);
  const total = discounted + feeCents;

  return (
    <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
      <label className="block text-base font-semibold">
        Starting price
        <input
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          inputMode="decimal"
          className="mt-2 h-14 w-full rounded-2xl border border-line bg-paper px-4 text-lg outline-none focus:border-pine"
        />
      </label>
      <label className="block text-base font-semibold">
        Discount percent
        <input
          value={discount}
          onChange={(event) => setDiscount(event.target.value)}
          inputMode="numeric"
          className="mt-2 h-14 w-full rounded-2xl border border-line bg-paper px-4 text-lg outline-none focus:border-pine"
        />
      </label>
      <label className="block text-base font-semibold">
        Extra fee
        <input
          value={fee}
          onChange={(event) => setFee(event.target.value)}
          inputMode="decimal"
          className="mt-2 h-14 w-full rounded-2xl border border-line bg-paper px-4 text-lg outline-none focus:border-pine"
        />
      </label>
      <p className="rounded-3xl bg-paper p-5">
        <span className="text-sm font-semibold uppercase tracking-wide text-muted">Your price</span>
        <span className="mt-1 block font-serif text-5xl text-pine">{formatUsd(total)}</span>
      </p>
    </form>
  );
}
