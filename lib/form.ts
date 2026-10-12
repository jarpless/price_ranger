export function clip(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const FORM_ERRORS: Record<string, string> = {
  missing: "Add the missing details and try again.",
  price: "Enter a price like 320 or 12.50.",
  quantity: "Enter a quantity greater than zero.",
  email: "Enter a valid email address.",
  link: "That sign-in link isn't valid anymore. Request a new one.",
  name: "Give it a short name.",
  options: "Add an option before you present.",
  confirm: "Check the box to confirm.",
};
