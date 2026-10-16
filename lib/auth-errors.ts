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

function boundedSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 86_400) return 0;
  return Math.round(seconds);
}

/** Seconds named in an auth error. Zero when the message does not name a wait. */
export function durationSeconds(message: string): number {
  const hour = message.match(/(\d+)\s*hours?/i);
  if (hour) return boundedSeconds(Number(hour[1]) * 3600);
  const minute = message.match(/(\d+)\s*minutes?/i);
  if (minute) return boundedSeconds(Number(minute[1]) * 60);
  const second = message.match(/(\d+)\s*seconds?/i);
  if (second) return boundedSeconds(Number(second[1]));
  if (/\bhours?\b/i.test(message)) return 3600;
  return 0;
}

/** The sentence shown while another email is blocked. An hour-long limit says so. */
export function rateLimitCopy(seconds: number): string {
  const wait = boundedSeconds(seconds);
  if (wait >= 3600) {
    const hours = Math.max(1, Math.round(wait / 3600));
    const span = hours === 1 ? "about an hour" : `about ${hours} hours`;
    return `You can request another email in ${span}. Password sign-in still works if this inbox is already verified.`;
  }
  if (wait >= 120) {
    const minutes = Math.ceil(wait / 60);
    return `You can request another email in ${minutes} minutes.`;
  }
  if (wait > 1) return `You can request another email in ${wait} seconds.`;
  return "You can request another email now.";
}

export function classifyAuthError(error: unknown): ClassifiedAuthError {
  const { code, message, status } = asRecord(error);
  const rate =
    code === "over_email_send_rate_limit" ||
    code === "over_sms_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    status === 429 ||
    /over_email_send_rate_limit|rate limit|only request this after|once every/i.test(`${code} ${message}`);

  if (rate) {
    const parsed = durationSeconds(message);
    const seconds = parsed || (code === "over_email_send_rate_limit" ? 3600 : 900);
    return {
      code: "rate_limit",
      retryAfterSeconds: seconds,
      message: rateLimitCopy(seconds),
    };
  }
  if (code === "email_address_invalid" || code === "email_address_not_authorized" || (code === "validation_failed" && /email/i.test(message))) {
    return { code: "email", retryAfterSeconds: 0, message: "That email doesn't look valid. Check it and try again." };
  }
  if (code === "email_exists" || code === "user_already_exists" || code === "identity_already_exists") {
    return { code: "taken", retryAfterSeconds: 0, message: "That email already has an account. Sign in instead." };
  }
  if (code === "email_not_confirmed" || code === "provider_email_needs_verification") {
    return { code: "unverified", retryAfterSeconds: 0, message: "That email isn't verified yet. Open the link in the email, then sign in with your password." };
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
