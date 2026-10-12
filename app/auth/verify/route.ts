import { NextResponse } from "next/server";

import { dataBackend } from "@/lib/env";
import { createSessionValue, SESSION_COOKIE, sessionSecret } from "@/lib/session";
import { consumeMagicLink } from "@/lib/store/local";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const failure = NextResponse.redirect(new URL("/login?error=link", url.origin));
  if (dataBackend() !== "local") return failure;

  const user = await consumeMagicLink(url.searchParams.get("token") || "");
  if (!user) return failure;

  const response = NextResponse.redirect(new URL("/", url.origin));
  response.cookies.set(SESSION_COOKIE, await createSessionValue(user.id, sessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
