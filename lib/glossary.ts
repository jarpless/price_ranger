/** One source for info-tip copy. Resale language only. */
export const GLOSSARY = {
  range: {
    term: "Price range",
    body: "The low and high from recent sold listings for this item and condition. The large number is the middle of that range, where most sales landed.",
  },
  confidence: {
    term: "Confidence",
    body: "How tightly those sold listings agree. High means the model and condition are clear. Medium means a detail, often the model, is still a guess. Low means we don't have enough sold listings.",
  },
  comparables: {
    term: "Comparables",
    body: "Real sales of the same kind of item. Sold means the buyer paid. Listed means it is still for sale and may not get that price.",
  },
  condition: {
    term: "Condition",
    body: "New is sealed. Like new has almost no wear. Good is used and fully working. Fair has visible wear. For parts is not working or is incomplete.",
  },
  fees: {
    term: "Fees",
    body: "A cost on top of the item, such as a platform fee, shipping, or a payment fee. Presets add a common amount. The item price stays visible.",
  },
  discount: {
    term: "Discount",
    body: "A percent off the suggested price. −10% and −20% are quick cuts for a faster sale. Shipping and fee presets are separate.",
  },
  limits: {
    term: "Free plan limits",
    body: "Free includes 3 prices and about 10 assistant messages a month. A paid plan lifts the price cap.",
  },
  plans: {
    term: "Plans",
    body: "Free is the ongoing no-cost plan. The 30-day pass is a one-time $2.99. Plus is $4.99 a month or $39 a year. Pro is $12 a month and adds higher assistant limits.",
  },
  billing: {
    term: "Monthly and yearly",
    body: "Monthly Plus renews every month at $4.99. Yearly Plus is $39, about $21 less than paying monthly for a year.",
  },
  sold: {
    term: "Mark sold",
    body: "A note on your listing that the item sold. It does not charge anyone or message a buyer.",
  },
  share: {
    term: "Share link and PDF",
    body: "The link opens the price in a browser. The PDF is a file you can save or hand to someone. Nothing is sent until you share it yourself.",
  },
  draft: {
    term: "Guest mode",
    body: "Try it first keeps this price on this device until you save an account. Saving an account keeps the same prices.",
  },
  messages: {
    term: "Assistant messages",
    body: "Each question you send counts as one message. Free includes about 10 a month. The counter in this panel updates after each send.",
  },
} as const;

export type GlossaryId = keyof typeof GLOSSARY;
