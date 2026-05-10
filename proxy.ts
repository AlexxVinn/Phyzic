import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { subscribe } from "diagnostics_channel";

const supabaseUrl = "https://gysfiojtcvjejkhrqgky.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5c2Zpb2p0Y3ZqZWpraHJxZ2t5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNjcxNjcsImV4cCI6MjA5Mzk0MzE2N30.JxWNF54TEUF2Oh8fxiIYJZDiIX1iVpJQa7L13qdRrC0";

export function proxy(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  // Note: proxy runs synchronously; we can't use async auth checks here without async middleware.
  // For route guards, we rely on client-side checks + server-side RLS.
  // We do protect admin/moderator routes via cookie presence check (lightweight).
  const pathname = req.nextUrl.pathname;
  const protectedRoutes = ["/admin", "/moderator"];
  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));

  if (isProtected) {
    const hasAuth = req.cookies.has("sb-gysfiojtcvjejkhrqgky-auth-token") || req.cookies.has("sb-gysfiojtcvjejkhrqgky-auth-token.0");
    if (!hasAuth) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return res;
}