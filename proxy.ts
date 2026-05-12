import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl, safeRedirectPath } from "@/lib/supabase-config";

function pathRequiresSession(pathname: string): boolean {
  if (pathname.startsWith("/auth/")) return false;
  const prefixes = ["/settings", "/ask", "/admin", "/moderator", "/messages"];
  if (prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  return /^\/question\/[^/]+\/edit$/.test(pathname);
}

function isLoginOrSignup(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (user && isLoginOrSignup(pathname)) {
    const raw = request.nextUrl.searchParams.get("redirect");
    const dest = safeRedirectPath(raw);
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (!user && pathRequiresSession(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "redirect",
      `${pathname}${request.nextUrl.search}`
    );
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
