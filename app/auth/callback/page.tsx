"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Completing sign-in…");

  useEffect(() => {
    const client = createClient();
    client.auth.getSession().then(async (res) => {
      if (res.data.session) {
        // Ensure profile exists for OAuth users
        try {
          const { data: existing } = await client
            .from("profiles")
            .select("id")
            .eq("id", res.data.session.user.id)
            .maybeSingle();
          if (!existing) {
            await client.from("profiles").upsert({
              id: res.data.session.user.id,
              username: res.data.session.user.user_metadata?.username || res.data.session.user.email?.split("@")[0] || "user",
              full_name: res.data.session.user.user_metadata?.full_name || "",
              avatar_url: res.data.session.user.user_metadata?.avatar_url || null,
              reputation: 0,
              role: "user",
              status: "active",
            }, { onConflict: "id" });
          }
        } catch {
          // ignore profile creation errors, trigger should handle it
        }
        router.replace("/");
      } else {
        setMsg("Sign-in failed. Return to login.");
      }
    }).catch(() => {
      setMsg("Sign-in failed. Return to login.");
    });
  }, [router]);

  return (
    <div className="auth-callback-body">
      <div className="auth-callback-card">
        <p className="auth-callback-msg">{msg}</p>
      </div>
    </div>
  );
}
