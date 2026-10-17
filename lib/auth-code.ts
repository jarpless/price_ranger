/** Digits in the email code this project already sends. Do not change the Supabase OTP setting to match the UI. */
export const EMAIL_CODE_LENGTH = 8;

export function normalizeEmailCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, EMAIL_CODE_LENGTH);
}

export function isCompleteEmailCode(value: string): boolean {
  return normalizeEmailCode(value).length === EMAIL_CODE_LENGTH;
}

export function emailCodeLabel(): string {
  return `${EMAIL_CODE_LENGTH}-digit code`;
}

/** Sign-in and signup mail both include an 8-digit code and a link. The sent screen offers both. */
export function emailScreenHasCode(input: { backend: string; kind?: string | null; devCode?: string | null }): boolean {
  if (input.devCode) return true;
  return input.backend === "local" || input.backend === "supabase";
}
