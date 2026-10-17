import type { Unit } from "./types";

export const INDUSTRY_IDS = ["trades", "retail", "services", "yard"] as const;

export type IndustryId = (typeof INDUSTRY_IDS)[number];

export interface StarterItem {
  name: string;
  unit: Unit;
  unitPriceCents: number;
}

export interface Vocabulary {
  id: IndustryId;
  label: string;
  blurb: string;
  quote: string;
  quotes: string;
  job: string;
  customer: string;
  present: string;
  customerExample: string;
  jobExample: string;
  starters: StarterItem[];
}

export const VOCABULARIES: Record<IndustryId, Vocabulary> = {
  trades: {
    id: "trades",
    label: "Handyman & trades",
    blurb: "Service calls, repairs, installs, and hourly work.",
    quote: "Quote",
    quotes: "Quotes",
    job: "Job",
    customer: "Customer",
    present: "Present to customer",
    customerExample: "Maria Alvarez",
    jobExample: "Ceiling fan install",
    starters: [
      { name: "Service call", unit: "each", unitPriceCents: 9500 },
      { name: "Hourly labor", unit: "hour", unitPriceCents: 8500 },
      { name: "Drywall patch", unit: "each", unitPriceCents: 17500 },
    ],
  },
  retail: {
    id: "retail",
    label: "Retail & events",
    blurb: "A booth, a pop-up, or a weekend event.",
    quote: "Offer",
    quotes: "Offers",
    job: "Event",
    customer: "Customer",
    present: "Show the offer",
    customerExample: "Saturday market",
    jobExample: "Booth for the weekend",
    starters: [
      { name: "Booth fee", unit: "each", unitPriceCents: 7500 },
      { name: "Table rental", unit: "each", unitPriceCents: 2500 },
      { name: "Staff hour", unit: "hour", unitPriceCents: 2000 },
    ],
  },
  services: {
    id: "services",
    label: "Services",
    blurb: "Consulting, appointments, and hourly work.",
    quote: "Proposal",
    quotes: "Proposals",
    job: "Engagement",
    customer: "Client",
    present: "Present the proposal",
    customerExample: "North clinic",
    jobExample: "Spring consultation",
    starters: [
      { name: "Consultation", unit: "hour", unitPriceCents: 15000 },
      { name: "On-site visit", unit: "each", unitPriceCents: 9500 },
      { name: "Follow-up hour", unit: "hour", unitPriceCents: 12500 },
    ],
  },
  yard: {
    id: "yard",
    label: "Yard/garage sale",
    blurb: "A driveway sale with a printed price sheet.",
    quote: "Offer",
    quotes: "Offers",
    job: "Sale",
    customer: "Buyer",
    present: "Show the sale",
    customerExample: "Driveway sale",
    jobExample: "Saturday morning",
    starters: [
      { name: "Lamp", unit: "each", unitPriceCents: 800 },
      { name: "Box of books", unit: "each", unitPriceCents: 500 },
      { name: "Chair", unit: "each", unitPriceCents: 1200 },
    ],
  },
};

export function isIndustryId(value: string | null | undefined): value is IndustryId {
  return Boolean(value && (INDUSTRY_IDS as readonly string[]).includes(value));
}

export function vocabulary(id: IndustryId | null | undefined): Vocabulary {
  if (id && isIndustryId(id)) return VOCABULARIES[id];
  return VOCABULARIES.trades;
}
