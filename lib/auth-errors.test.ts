import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { authErrorPath, classifyAuthError } from "./auth-errors";

test("an email send rate limit is a countdown, not a generic failure", () => {
  const error = classifyAuthError({
    code: "over_email_send_rate_limit",
    message: "For security purposes, you can only request this after 60 seconds.",
    status: 429,
  });
  assert.equal(error.code, "rate_limit");
  assert.equal(error.retryAfterSeconds, 60);
  assert.match(error.message, /60 seconds/);
  assert.doesNotMatch(error.message, /hour/i);
  assert.doesNotMatch(error.message, /something went wrong/i);
  assert.match(authErrorPath(error, "a@b.co"), /error=rate_limit/);
  assert.match(authErrorPath(error, "a@b.co"), /retry=60/);
  assert.doesNotMatch(authErrorPath(error, "a@b.co"), /email=/);
  assert.doesNotMatch(authErrorPath(error, "a@b.co"), /a@b\.co/);
});

test("an email rate limit with no duration is an hour, not 60 seconds", () => {
  const error = classifyAuthError({
    code: "over_email_send_rate_limit",
    message: "Email rate limit exceeded",
    status: 429,
  });
  assert.equal(error.code, "rate_limit");
  assert.equal(error.retryAfterSeconds, 3600);
  assert.match(error.message, /hour/i);
  assert.match(error.message, /password/i);
  assert.doesNotMatch(error.message, /60 seconds/);
  assert.match(authErrorPath(error), /retry=3600/);
});

test("a numberless request limit does not claim 60 seconds", () => {
  const error = classifyAuthError({ code: "over_request_rate_limit", message: "Rate limit exceeded", status: 429 });
  assert.equal(error.retryAfterSeconds, 900);
  assert.match(error.message, /15 minutes/);
  assert.doesNotMatch(error.message, /60 seconds/);
});

test("a signup email rate limit says so in plain words", () => {
  const error = classifyAuthError({
    code: "over_email_send_rate_limit",
    message: "Email rate limit exceeded",
    status: 429,
  });
  assert.equal(error.code, "rate_limit");
  assert.match(error.message, /Too many sign-up emails right now/);
  assert.match(error.message, /try again/i);
  assert.doesNotMatch(error.message, /deleted/i);
  assert.doesNotMatch(error.message, /didn't go through/i);
  assert.doesNotMatch(authErrorPath(error, "new@example.com"), /new@example\.com/);
});

test("a thrown rate-limit error is the same plain limit, not a deleted account", () => {
  const error = classifyAuthError(new Error("Email rate limit exceeded"));
  assert.equal(error.code, "rate_limit");
  assert.match(error.message, /Too many sign-up emails right now/);
  assert.match(error.message, /few minutes|minutes/);
  assert.doesNotMatch(error.message, /deleted/i);
});

test("a confirmation-email failure is a send problem, not a deleted account", () => {
  const error = classifyAuthError({
    code: "unexpected_failure",
    message: "Error sending confirmation email",
    status: 500,
  });
  assert.equal(error.code, "send");
  assert.match(error.message, /couldn't send the sign-up email/i);
  assert.match(error.message, /few minutes/);
  assert.doesNotMatch(error.message, /deleted/i);
  assert.doesNotMatch(error.message, /didn't go through/i);
  assert.equal(authErrorPath(error), "/signin?error=send");
});

test("signup failures are classified instead of the generic error page", () => {
  const source = readFileSync(new URL("../app/auth-actions.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function createPasswordAccount");
  const end = source.indexOf("export async function verifyEmailCode");
  const body = source.slice(start, end);
  assert.match(body, /catch \(error\)/);
  assert.match(body, /isNextRedirect\(error\)/);
  assert.match(body, /classifyAuthError\(error\)/);
  const page = readFileSync(new URL("../app/error.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /account is deleted/i);
});

test("an invalid email stays specific", () => {
  const error = classifyAuthError({ code: "email_address_invalid", message: "Unable to validate email address" });
  assert.equal(error.code, "email");
  assert.match(error.message, /email/i);
  assert.doesNotMatch(error.message, /something went wrong/i);
});

test("other known auth codes stay specific", () => {
  const unverified = classifyAuthError({ code: "email_not_confirmed", message: "Email not confirmed" });
  assert.equal(unverified.code, "unverified");
  assert.match(unverified.message, /link/i);
  assert.match(unverified.message, /8-digit/);
  assert.equal(classifyAuthError({ code: "otp_expired", message: "Token has expired" }).code, "code");
  assert.equal(classifyAuthError({ code: "invalid_credentials", message: "Invalid login credentials" }).code, "signin");
  assert.equal(classifyAuthError({ code: "oauth_provider_not_supported", message: "Unsupported provider" }).code, "provider");
  assert.doesNotMatch(classifyAuthError({ code: "hook_timeout", message: "Hook timed out" }).message, /something went wrong/i);
});
