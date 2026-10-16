import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** A failed refresh must not wipe a session that the browser still holds. Sign-out opts in. */
export async function createClient(options?: { allowAuthClear?: boolean }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const cookieStore = await cookies();
  const allowAuthClear = options?.allowAuthClear === true;
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options: cookieOptions } of cookiesToSet) {
            const authCookie = /^sb-.+-auth-token(?:\.\d+)?$/.test(name);
            const maxAge = cookieOptions && "maxAge" in cookieOptions ? Number(cookieOptions.maxAge) : undefined;
            const clearing = value === "" || maxAge === 0;
            if (authCookie && clearing && !allowAuthClear) continue;
            cookieStore.set(name, value, cookieOptions);
          }
        } catch {
          // Server Components cannot always write cookies. Middleware refreshes the session.
        }
      },
    },
  });
}
