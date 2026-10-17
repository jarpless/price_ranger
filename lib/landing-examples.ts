/**
 * Splash examples are everyday resale goods with no maker, label, or marketplace name.
 * Prices are plausible good-condition sold ranges for unnamed pieces, not a catalog lookup.
 */
export const LANDING_EXAMPLES = [
  {
    id: "dresser",
    name: "Mid-century wooden dresser",
    price: "$340",
    range: "$280–$420",
    condition: "Good",
    confidence: "High confidence",
    photoLabel: "Photo of a mid-century wooden dresser",
  },
  {
    id: "camera",
    name: "Vintage film camera",
    price: "$125",
    range: "$90–$170",
    condition: "Good",
    confidence: "High confidence",
    photoLabel: "Photo of a vintage film camera",
  },
  {
    id: "bike",
    name: "Road bike",
    price: "$275",
    range: "$210–$360",
    condition: "Good",
    confidence: "High confidence",
    photoLabel: "Photo of a road bike",
  },
  {
    id: "chair",
    name: "Leather armchair",
    price: "$385",
    range: "$310–$480",
    condition: "Good",
    confidence: "High confidence",
    photoLabel: "Photo of a leather armchair",
  },
] as const;

export type LandingExample = (typeof LANDING_EXAMPLES)[number];
export type LandingExampleId = LandingExample["id"];
