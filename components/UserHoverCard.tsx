"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";
import { useAuth } from "./AuthProvider";
import { createClient } from "@/lib/supabase";
import { fmtRep } from "@/lib/utils";

type PresenceStatus = "online" | "away" | "offline";

export interface HoverUser {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string | null;
  reputation?: number;
  role?: any;
}

export default function UserHoverCard({
  user,
  children,
}: {
  user: HoverUser | null | undefined;
  children: ReactNode;
}) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [profile, setProfile] = useState<any>(null);
  const [presence, setPresence] = useState<{ status: PresenceStatus; last_seen_at: string | null } | null>(null);
  const [counts, setCounts] = useState<{ questions: number; answers: number; followers: number } | null>(null);
  const loadingRef = useRef(false);

  const username = user?.username || "";
  const name = user?.full_name || user?.username || "User";

  useEffect(() => {
    setCounts(null);
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    if (!user?.id || !username) return;
    if (loadingRef.current) return;
    if (profile?.id === user.id) return;

    loadingRef.current = true;
    (async () => {
      try {
        const p = (await auth.fetchProfileByUsername(username)) || null;
        setProfile(p || null);
      } finally {
        loadingRef.current = false;
      }
    })();
  }, [open, user?.id, username, auth, profile?.id]);

  useEffect(() => {
    if (!open) return;
    if (!user?.id) return;
    if (counts) return;

    const supabase = createClient();
    let alive = true;
    (async () => {
      try {
        const [qCount, aCount, fCount] = await Promise.all([
          supabase.from("questions").select("id", { count: "exact", head: true }).eq("author_id", user.id),
          supabase.from("answers").select("id", { count: "exact", head: true }).eq("author_id", user.id),
          supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", user.id),
        ]);
        if (!alive) return;
        setCounts({
          questions: qCount.count || 0,
          answers: aCount.count || 0,
          followers: fCount.count || 0,
        });
      } catch {
        if (alive) setCounts({ questions: 0, answers: 0, followers: 0 });
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, user?.id, counts]);

  useEffect(() => {
    if (!open) return;
    if (!user?.id) return;

    const supabase = createClient();
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("user_presence")
          .select("status,last_seen_at")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!alive) return;
        if (data?.status) {
          setPresence({ status: data.status as PresenceStatus, last_seen_at: data.last_seen_at || null });
        } else {
          setPresence({ status: "offline", last_seen_at: null });
        }
      } catch {
        if (alive) setPresence({ status: "offline", last_seen_at: null });
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, user?.id]);

  const status = presence?.status || "offline";
  const dotColor = status === "online" ? "#22c55e" : status === "away" ? "#f59e0b" : "#64748b";

  return (
    <span
      style={{ display: "inline-flex", position: "relative" }}
      onMouseEnter={(e) => {
        setPos({ x: e.clientX, y: e.clientY });
        setOpen(true);
      }}
      onMouseMove={(e) => {
        if (!open) return;
        setPos({ x: e.clientX, y: e.clientY });
      }}
      onMouseLeave={() => setOpen(false)}
    >
      {children}

      {open && user?.id ? (
        <div
          role="dialog"
          aria-label="User preview"
          style={{
            position: "fixed",
            left: Math.min(pos.x + 14, window.innerWidth - 280),
            top: Math.min(pos.y + 14, window.innerHeight - 140),
            width: 260,
            padding: 12,
            borderRadius: 12,
            opacity: 1,
            background: "linear-gradient(135deg, rgb(24, 24, 24), rgb(31, 31, 31))",
            border: "1px solid var(--border)",
            boxShadow: "0 18px 45px rgba(0,0,0,.22)",
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Avatar url={(profile?.avatar_url ?? user.avatar_url) || null} name={name} size={34} />
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  right: -1,
                  bottom: -1,
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: dotColor,
                  border: "2px solid var(--surface-1)",
                }}
              />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                {profile?.role && profile.role !== "user" ? <RoleBadge role={profile.role} size="sm" /> : null}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>@{username}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {status === "online" ? "Online" : status === "away" ? "Away" : "Offline"}
            </span>
            <span style={{ marginLeft: "auto" }}>
              {fmtRep(profile?.reputation ?? user.reputation ?? 0)} rep
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }} title="Questions">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {counts?.questions ?? "–"}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }} title="Answers">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5" />
                <path d="M6 11l6-6 6 6" />
              </svg>
              {counts?.answers ?? "–"}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }} title="Followers">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <path d="M20 8v6" />
                <path d="M23 11h-6" />
              </svg>
              {counts?.followers ?? "–"}
            </span>
          </div>
        </div>
      ) : null}
    </span>
  );
}
