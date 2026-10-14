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
