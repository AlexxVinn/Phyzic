import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = "https://gysfiojtcvjejkhrqgky.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5c2Zpb2p0Y3ZqZWpraHJxZ2t5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNjcxNjcsImV4cCI6MjA5Mzk0MzE2N30.JxWNF54TEUF2Oh8fxiIYJZDiIX1iVpJQa7L13qdRrC0";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}
