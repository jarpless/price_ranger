import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { emailScreenHasCode, isCompleteEmailCode, normalizeEmailCode } from "./auth-code";
import { siteOriginFromHeaders } from "./env";

test("an email code is eight digits and a shorter paste is not submitted as complete", () => {
  assert.equal(normalizeEmailCode("12 34-5678 extra"), "12345678");
  assert.equal(isCompleteEmailCode("12345678"), true);
  assert.equal(isCompleteEmailCode("123456"), false);
  assert.equal(emailScreenHasCode({ backend: "supabase", kind: "signin" }), true);
  assert.equal(emailScreenHasCode({ backend: "supabase", kind: "signup" }), false);
  assert.equal(emailScreenHasCode({ backend: "local", kind: "signup" }), true);
});

test("a signup fragment is stored by the browser client before the next page loads", () => {
  const callback = readFileSync(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");
  const recover = readFileSync(new URL("../components/recover-session.tsx", import.meta.url), "utf8");
  const session = readFileSync(new URL("../app/auth/callback/session/route.ts", import.meta.url), "utf8");
  assert.match(callback, /\/auth\/recover/);
  assert.match(recover, /setSession\(\{ access_token: accessToken, refresh_token: refreshToken \}\)/);
  assert.match(session, /readSupabaseCookieUser/);
  assert.doesNotMatch(callback, /\/auth\/callback\/session/);
});

test("a sign-in link stays on the browser host that holds the cookie", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.priceranger.app";
  try {
    const headers = new Headers({
      host: "price-ranger-preview.vercel.app",
      "x-forwarded-proto": "https",
    });
    assert.equal(siteOriginFromHeaders(headers), "https://price-ranger-preview.vercel.app");
    assert.equal(
      siteOriginFromHeaders(new Headers({ host: "evil.example", "x-forwarded-proto": "https" })),
      "https://www.priceranger.app",
    );
  } finally {
    if (previous == null) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});
