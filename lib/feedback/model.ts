import type { PlanId } from "../plans";

export type Severity = "low" | "medium" | "high";

export const SCORE = {
  plan: { free: 0, pass: 10, plus: 20, pro: 30 } as Record<PlanId, number>,
  revenueCap: 25,
  revenueCentsPerPoint: 100,
  activityCap: 15,
  activityPerPoint: 2,
  opportunityCap: 20,
  industry: { trades: 10, services: 6, retail: 4, yard: 4 } as Record<string, number>,
  quotePoints: 2,
  quoteCap: 10,
  duplicatePoints: 4,
  duplicateCap: 20,
  severity: { low: 5, medium: 15, high: 25 } as Record<Severity, number>,
};

export interface ScoreInput {
  plan: PlanId;
  paidCents: number;
  events30d: number;
  industry: string | null;
  quotes30d: number;
  duplicateCount: number;
  severity: Severity;
}

export interface ScoreLine {
  factor: string;
  points: number;
  reason: string;
}

export interface ScoreResult {
  score: number;
  lines: ScoreLine[];
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function scoreTicket(input: ScoreInput): ScoreResult {
  const planPoints = SCORE.plan[input.plan] ?? 0;
  const paid = Math.max(0, Math.floor(input.paidCents));
  const revenuePoints = Math.min(SCORE.revenueCap, Math.floor(paid / SCORE.revenueCentsPerPoint));
  const activityPoints = Math.min(
    SCORE.activityCap,
    Math.floor(Math.max(0, input.events30d) / SCORE.activityPerPoint),
  );
  const industryPoints = input.industry ? SCORE.industry[input.industry] ?? 0 : 0;
  const quotePoints = Math.min(SCORE.quoteCap, Math.max(0, input.quotes30d) * SCORE.quotePoints);
  const opportunityPoints = Math.min(SCORE.opportunityCap, industryPoints + quotePoints);
  const duplicatePoints = Math.min(
    SCORE.duplicateCap,
    Math.max(0, input.duplicateCount) * SCORE.duplicatePoints,
  );
  const severityPoints = SCORE.severity[input.severity] ?? SCORE.severity.medium;
  const lines: ScoreLine[] = [
    {
      factor: "Plan",
      points: planPoints,
      reason: `${input.plan} plan is ${planPoints} points. Free is 0, Pass 10, Plus 20, Pro 30.`,
    },
    {
      factor: "Revenue paid",
      points: revenuePoints,
      reason: `${money(paid)} recorded is ${revenuePoints} points, one point per dollar, capped at ${SCORE.revenueCap}.`,
    },
    {
      factor: "Activity",
      points: activityPoints,
      reason: `${input.events30d} events in 30 days is ${activityPoints} points, one point per ${SCORE.activityPerPoint} events, capped at ${SCORE.activityCap}.`,
    },
    {
      factor: "Opportunity",
      points: opportunityPoints,
      reason: `${input.industry || "No segment"} is ${industryPoints} points. ${input.quotes30d} quotes in 30 days is ${quotePoints} points. Together they cap at ${SCORE.opportunityCap}.`,
    },
    {
      factor: "Duplicates",
      points: duplicatePoints,
      reason: `${input.duplicateCount} other requests for the same thing is ${duplicatePoints} points, ${SCORE.duplicatePoints} each, capped at ${SCORE.duplicateCap}.`,
    },
    {
      factor: "Severity",
      points: severityPoints,
      reason: `${input.severity} is ${severityPoints} points. Low is 5, medium 15, high 25.`,
    },
  ];
  return { score: lines.reduce((sum, line) => sum + line.points, 0), lines };
}

export function replaceDuplicateLine(current: ScoreResult, duplicateCount: number): ScoreResult {
  const duplicatePoints = Math.min(SCORE.duplicateCap, Math.max(0, duplicateCount) * SCORE.duplicatePoints);
  const lines = current.lines.map((line) =>
    line.factor === "Duplicates"
      ? {
          ...line,
          points: duplicatePoints,
          reason: `${duplicateCount} other requests for the same thing is ${duplicatePoints} points, ${SCORE.duplicatePoints} each, capped at ${SCORE.duplicateCap}.`,
        }
      : line,
  );
  if (!lines.some((line) => line.factor === "Duplicates")) {
    lines.push({
      factor: "Duplicates",
      points: duplicatePoints,
      reason: `${duplicateCount} other requests for the same thing is ${duplicatePoints} points.`,
    });
  }
  return { score: lines.reduce((sum, line) => sum + line.points, 0), lines };
}
