/**
 * Trial length and free-quote counts come from the environment.
 * Experiment B adds the extra days and extra quotes on top.
 * Defaults match the Free plan when the variables are unset.
 */

import { PLANS } from "../plans";

function wholeNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

/** Days a free account can keep pricing before the upgrade prompt. */
export function trialDays(): number {
  return wholeNumber("TRIAL_DAYS", 14);
}

/** How many of your own prices a free account can save. Samples do not count. */
export function freeQuoteLimit(): number {
  return wholeNumber("FREE_QUOTE_LIMIT", PLANS.free.activeQuotes ?? 3);
}

/** Added to the trial for experiment group B. */
export function experimentExtraTrialDays(): number {
  return wholeNumber("EXPERIMENT_TRIAL_EXTRA_DAYS", 7);
}

/** Added to the free quote count for experiment group B. */
export function experimentExtraFreeQuotes(): number {
  return wholeNumber("EXPERIMENT_EXTRA_FREE_QUOTES", 2);
}

export const TOS_VERSION = "2026-10-12-draft";
