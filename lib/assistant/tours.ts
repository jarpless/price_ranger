import type { CoachPage } from "./coach";

export const TOUR_MEMORY_KEY = "pr-tours-seen-v1";

export type TourMark = "done" | "skipped";

export type TourMemory = Partial<Record<CoachPage, TourMark>>;

export type TourAction = {
  kind: "fill" | "click";
  spotlight: string;
  labels?: string[];
  value?: string;
  requires?: "group";
  confirm: string;
  done: string;
};

export type TourStep = {
  spotlight: string;
  title: string;
  body: string;
  missing: string;
  action?: TourAction;
};

const NEW_QUOTE: TourStep[] = [
  {
    spotlight: "new-quote-customer",
    title: "Who is it for?",
    body: "Type the customer name. You can change it later.",
    missing: "The customer field isn't on this screen.",
    action: {
      kind: "fill",
      spotlight: "new-quote-customer",
      value: "Alex Rivera",
      confirm: "Use Alex Rivera as the customer?",
      done: "Filled in Alex Rivera.",
    },
  },
  {
    spotlight: "new-quote-job",
    title: "What's the job?",
    body: "A short name is enough.",
    missing: "The job field isn't on this screen.",
    action: {
      kind: "fill",
      spotlight: "new-quote-job",
      value: "Kitchen refresh",
      confirm: "Use Kitchen refresh as the job?",
      done: "Filled in Kitchen refresh.",
    },
  },
  {
    spotlight: "new-quote-create",
    title: "Create the quote",
    body: "Next you'll add prices and options.",
    missing: "The create button isn't on this screen.",
    action: {
      kind: "click",
      spotlight: "new-quote-create",
      confirm: "Create this quote now?",
      done: "Creating the quote.",
    },
  },
];

const BUILDER_DESKTOP: TourStep[] = [
  {
    spotlight: "quote-items",
    title: "Add a line",
    body: "Press Add next to a price. It lands in the open group.",
    missing: "The price list isn't on this screen.",
    action: {
      kind: "click",
      spotlight: "quote-items",
      labels: ["Add"],
      requires: "group",
      confirm: "Add the first price to this group?",
      done: "Added the first price.",
    },
  },
  {
    spotlight: "present-button",
    title: "Present it",
    body: "Present saves a copy your customer can see.",
    missing: "Present isn't on this screen yet.",
    action: {
      kind: "click",
      spotlight: "present-button",
      confirm: "Present this quote now?",
      done: "Presenting the quote.",
    },
  },
];

const BUILDER_MOBILE: TourStep[] = [
  {
    spotlight: "quote-options",
    title: "Options",
    body: "Each option is a price the customer can pick. Tap one to add groups.",
    missing: "Options aren't on this screen.",
  },
  BUILDER_DESKTOP[1],
];

const SHARE: TourStep[] = [
  {
    spotlight: "share-actions",
    title: "Send it yourself",
    body: "Copy the link or tap Share. Nothing goes out until you do.",
    missing: "Share buttons show up after you send the price.",
    action: {
      kind: "click",
      spotlight: "share-actions",
      labels: ["Copy link", "Copied"],
      confirm: "Copy the share link?",
      done: "Copied the link.",
    },
  },
  {
    spotlight: "mark-sold",
    title: "When it sells",
    body: "Mark sold after they buy. You can come back to it.",
    missing: "Mark sold isn't on this screen yet.",
  },
];

const SETTINGS: TourStep[] = [
  {
    spotlight: "settings-plan",
    title: "Your plan",
    body: "The plan name and messages used this month are in this card.",
    missing: "The plan card isn't on this screen.",
  },
  {
    spotlight: "settings-plans",
    title: "See plans",
    body: "Opening plans doesn't charge you. Checkout waits until you choose.",
    missing: "The plans link isn't on this screen.",
    action: {
      kind: "click",
      spotlight: "settings-plans",
      labels: ["See plans"],
      confirm: "Open plans? You won't be charged.",
      done: "Opening plans.",
    },
  },
];

export function tourSteps(page: CoachPage, desktop: boolean): TourStep[] {
  if (page === "new-quote") return NEW_QUOTE;
  if (page === "quote-builder") return desktop ? BUILDER_DESKTOP : BUILDER_MOBILE;
  if (page === "share") return SHARE;
  return SETTINGS;
}

export function parseTourMemory(raw: string | null): TourMemory {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const memory: TourMemory = {};
    for (const [key, mark] of Object.entries(value)) {
      if ((key === "new-quote" || key === "quote-builder" || key === "share" || key === "settings") && (mark === "done" || mark === "skipped")) {
        memory[key] = mark;
      }
    }
    return memory;
  } catch {
    return {};
  }
}

export function shouldAutoStart(memory: TourMemory, page: CoachPage): boolean {
  return !memory[page];
}

export function rememberTour(memory: TourMemory, page: CoachPage, mark: TourMark): TourMemory {
  return { ...memory, [page]: mark };
}
