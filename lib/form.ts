export function clip(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function guestErrorDetail(message: string): string {
  const cleaned = message.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
  return cleaned || "Guest sign-in did not complete.";
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
  password: "Use at least 8 characters.",
  taken: "That email already has an account. Sign in instead.",
  code: "That code isn't valid anymore. Request a new one.",
  provider: "That sign-in provider needs Supabase, with the provider turned on.",
  guest: "Guest sign-in needs anonymous auth in Supabase, or local mode.",
  signin: "That email and password did not match. If you deleted this account, create a new one.",
  unverified: "That email isn't verified yet. Enter the 6-digit code, or send it again.",
  "resend-wait": "Wait a minute before sending another code.",
  rate_limit: "You can request another code in a minute.",
  captcha: "The sign-in check failed. Try again.",
  auth: "We couldn't send that just now. Try again in a minute.",
  payments: "Test payments aren't available from this server yet.",
};
