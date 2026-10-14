import assert from "node:assert/strict";
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
  assert.doesNotMatch(error.message, /something went wrong/i);
  assert.match(authErrorPath(error, "a@b.co"), /error=rate_limit/);
  assert.match(authErrorPath(error, "a@b.co"), /retry=60/);
  assert.doesNotMatch(authErrorPath(error, "a@b.co"), /email=/);
  assert.doesNotMatch(authErrorPath(error, "a@b.co"), /a@b\.co/);
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
  assert.match(unverified.message, /8-digit/);
  assert.equal(classifyAuthError({ code: "otp_expired", message: "Token has expired" }).code, "code");
  assert.equal(classifyAuthError({ code: "invalid_credentials", message: "Invalid login credentials" }).code, "signin");
  assert.equal(classifyAuthError({ code: "oauth_provider_not_supported", message: "Unsupported provider" }).code, "provider");
  assert.doesNotMatch(classifyAuthError({ code: "hook_timeout", message: "Hook timed out" }).message, /something went wrong/i);
});
