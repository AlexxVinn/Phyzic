/**
 * Supabase URL and anon/publishable key must come from env — never hardcode in source.
 * Supports NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for newer Supabase projects.
 */
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local (see .env.example)."
    );
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY). Add it to .env.local (see .env.example)."
    );
  }
  return key;
}

/** Same-origin path only; blocks protocol-relative and external redirects. */
export function safeRedirectPath(param: string | null): string {
  if (!param) return "/";
  const p = param.trim();
  if (!p.startsWith("/") || p.startsWith("//")) return "/";
  return p;
}
