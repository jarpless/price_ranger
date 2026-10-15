import assert from "node:assert/strict";
import test from "node:test";

import { guestErrorDetail } from "./form";
import { readFreshSupabaseSession, readSupabaseCookieUser } from "./supabase/cookie-session";

function cookieValue(session: unknown): string {
  const json = JSON.stringify(session);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `base64-${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

const future = 2_000_000_000;
const user = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "",
  is_anonymous: true,
};

test("a fresh supabase cookie skips the auth network", () => {
  const fresh = readFreshSupabaseSession(
    [{ name: "sb-project-auth-token", value: cookieValue({ expires_at: future, user }) }],
    future - 3600,
  );
  assert.equal(fresh.status, "known");
  if (fresh.status !== "known" || !fresh.user) throw new Error("expected a user");
  assert.equal(fresh.user.id, user.id);
  assert.equal(fresh.user.is_anonymous, true);
});

test("no auth cookie is a known logged-out session", () => {
  const fresh = readFreshSupabaseSession([{ name: "other", value: "1" }]);
  assert.deepEqual(fresh, { status: "known", user: null });
});

test("a cookie near expiry is refreshed", () => {
  const cookies = [{ name: "sb-project-auth-token", value: cookieValue({ expires_at: future, user }) }];
  const fresh = readFreshSupabaseSession(cookies, future - 30);
  assert.equal(fresh.status, "refresh");
  assert.equal(readSupabaseCookieUser(cookies)?.id, user.id);
});

function jwt(payload: object): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `${encode({ alg: "none" })}.${encode(payload)}.sig`;
}

test("an email on the access token is a signed-in account", () => {
  const token = jwt({ sub: user.id, email: "toby@priceranger.app", exp: future });
  const session = {
    expires_at: future,
    access_token: token,
    user: { id: user.id, email: "", is_anonymous: false },
  };
  const read = readSupabaseCookieUser([{ name: "sb-project-auth-token", value: cookieValue(session) }]);
  assert.equal(read?.email, "toby@priceranger.app");
  assert.equal(read?.is_anonymous, false);
});

test("guest sign-in surfaces the auth error", () => {
  assert.equal(guestErrorDetail("Anonymous sign-ins are disabled"), "Anonymous sign-ins are disabled");
  assert.equal(guestErrorDetail("  line\nbreak  "), "line break");
  assert.equal(guestErrorDetail("   "), "Guest sign-in did not complete.");
});
