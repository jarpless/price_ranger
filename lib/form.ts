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
  incomplete: "Enter the full code from the email.",
  provider: "That sign-in provider needs Supabase, with the provider turned on.",
  guest: "Guest sign-in needs anonymous auth in Supabase, or local mode.",
  signin: "That email and password did not match. If you deleted this account, create a new one.",
  unverified: "That email isn't verified yet. Open the link in the email, then sign in with your password.",
  "resend-wait": "Wait before sending another email.",
  rate_limit: "Email is temporarily limited. Wait, then try again, or sign in with your password.",
  captcha: "The sign-in check failed. Try again.",
  auth: "We couldn't send that just now. Try again in a minute.",
  payments: "Payments aren't available from this server yet. Test mode is the default until a Stripe key is set.",
};
