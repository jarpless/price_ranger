/**
 * Maps Supabase Auth errors to a short code and a sentence a person can act on.
 * Known codes must never surface as a generic failure.
 */
export interface ClassifiedAuthError {
  code:
    | "rate_limit"
    | "email"
    | "taken"
    | "signin"
    | "unverified"
    | "code"
    | "provider"
    | "password"
    | "captcha"
    | "guest"
    | "auth";
  retryAfterSeconds: number;
  message: string;
}

function asRecord(error: unknown): { code: string; message: string; status: number } {
  if (!error || typeof error !== "object") {
    return { code: "", message: typeof error === "string" ? error : "", status: 0 };
  }
  const record = error as { code?: unknown; message?: unknown; status?: unknown };
  return {
    code: typeof record.code === "string" ? record.code : "",
    message: typeof record.message === "string" ? record.message : "",
    status: typeof record.status === "number" ? record.status : 0,
  };
}

function secondsFrom(message: string): number {
  const match = message.match(/(\d+)\s*second/i);
  if (!match) return 0;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600) return 0;
  return seconds;
}

export function classifyAuthError(error: unknown): ClassifiedAuthError {
  const { code, message, status } = asRecord(error);
  const wait = secondsFrom(message) || 60;
  const rate =
    code === "over_email_send_rate_limit" ||
    code === "over_sms_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    status === 429 ||
    /over_email_send_rate_limit|rate limit|only request this after|once every/i.test(`${code} ${message}`);

  if (rate) {
    const seconds = secondsFrom(message) || wait;
    return {
      code: "rate_limit",
      retryAfterSeconds: seconds,
      message: `You can request another code in ${seconds} seconds.`,
    };
  }
  if (code === "email_address_invalid" || code === "email_address_not_authorized" || (code === "validation_failed" && /email/i.test(message))) {
    return { code: "email", retryAfterSeconds: 0, message: "That email doesn't look valid. Check it and try again." };
  }
  if (code === "email_exists" || code === "user_already_exists" || code === "identity_already_exists") {
    return { code: "taken", retryAfterSeconds: 0, message: "That email already has an account. Sign in instead." };
  }
  if (code === "email_not_confirmed" || code === "provider_email_needs_verification") {
    return { code: "unverified", retryAfterSeconds: 0, message: "That email isn't verified yet. Password sign-in waits until you enter the 8-digit code, or open the link." };
  }
  if (code === "otp_expired" || code === "otp_disabled" || code === "flow_state_expired" || code === "flow_state_not_found") {
    return { code: "code", retryAfterSeconds: 0, message: "That code isn't valid anymore. Request a new one." };
  }
  if (code === "invalid_credentials" || code === "user_not_found") {
    return { code: "signin", retryAfterSeconds: 0, message: "That email and password did not match." };
  }
  if (code === "weak_password" || code === "same_password") {
    return { code: "password", retryAfterSeconds: 0, message: "Use at least 8 characters." };
  }
  if (code === "signup_disabled" || code === "email_provider_disabled" || code === "provider_disabled" || code === "oauth_provider_not_supported") {
    return { code: "provider", retryAfterSeconds: 0, message: "That sign-in option isn't turned on yet. Use email for now." };
  }
  if (code === "captcha_failed") {
    return { code: "captcha", retryAfterSeconds: 0, message: "The sign-in check failed. Try again." };
  }
  if (code === "anonymous_provider_disabled") {
    return { code: "guest", retryAfterSeconds: 0, message: "Guest mode isn't available. Sign in with email." };
  }
  if (code === "request_timeout" || code === "hook_timeout" || code === "hook_timeout_after_retry") {
    return { code: "auth", retryAfterSeconds: 0, message: "Sign-in took too long. Try again in a moment." };
  }
  if (code || message) {
    return { code: "auth", retryAfterSeconds: 0, message: "We couldn't send that just now. Try again in a minute." };
  }
  return { code: "auth", retryAfterSeconds: 0, message: "We couldn't send that just now. Try again in a minute." };
}

export function isNextRedirect(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).includes("NEXT_REDIRECT");
}

/** Error links never carry an email. The sign-in form reads pr_signin_email instead. */
export function authErrorPath(error: ClassifiedAuthError, _email = ""): string {
  const params = new URLSearchParams();
  params.set("error", error.code);
  if (error.retryAfterSeconds > 0) params.set("retry", String(error.retryAfterSeconds));
  return `/signin?${params.toString()}`;
}
