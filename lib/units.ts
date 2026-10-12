import { UNITS, type Unit } from "./types";

const SINGULAR: Record<Unit, string> = {
  square: "square",
  sq_ft: "sq ft",
  linear_ft: "lin ft",
  roll: "roll",
  bundle: "bundle",
  each: "",
  hour: "hour",
};

const PLURAL: Record<Unit, string> = {
  square: "squares",
  sq_ft: "sq ft",
  linear_ft: "lin ft",
  roll: "rolls",
  bundle: "bundles",
  each: "",
  hour: "hours",
};

export const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: "square", label: "Squares" },
  { value: "sq_ft", label: "Sq ft" },
  { value: "linear_ft", label: "Lin ft" },
  { value: "roll", label: "Rolls" },
  { value: "bundle", label: "Bundles" },
  { value: "each", label: "Each" },
  { value: "hour", label: "Hours" },
];

export function isUnit(value: string): value is Unit {
  return (UNITS as readonly string[]).includes(value);
}

export function unitWord(unit: Unit, quantity: number): string {
  return quantity === 1 ? SINGULAR[unit] : PLURAL[unit];
}

export function formatQuantity(quantity: number): string {
  if (Number.isInteger(quantity)) return String(quantity);
  return String(Math.round(quantity * 100) / 100);
}
