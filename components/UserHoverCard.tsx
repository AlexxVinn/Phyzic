"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

const CARD_W = 260;
const CARD_H = 132;

function clampPosition(rect: DOMRect) {
  const gap = 8;
  let left = rect.left;
  let top = rect.bottom + gap;
  if (left + CARD_W > window.innerWidth - 12) {
    left = window.innerWidth - CARD_W - 12;
  }
  if (top + CARD_H > window.innerHeight - 12) {
    top = rect.top - CARD_H - gap;
  }
  left = Math.max(12, left);
  top = Math.max(12, top);
  return { left, top };
}

export default function UserHoverCard({
  user,
  children,
}: {
  user: HoverUser | null | undefined;
  children: ReactNode;
}) {
  const auth = useAuth();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [profile, setProfile] = useState<any>(null);
  const [presence, setPresence] = useState<{ status: PresenceStatus; last_seen_at: string | null } | null>(null);
  const [counts, setCounts] = useState<{ questions: number; answers: number; followers: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const loadingRef = useRef(false);

  const username = user?.username || "";
  const name = user?.full_name || user?.username || "User";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setCounts(null);
  }, [user?.id]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(clampPosition(rect));
  }, []);

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

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePosition]);

  const status = presence?.status || "offline";
  const dotColor = status === "online" ? "#22c55e" : status === "away" ? "#f59e0b" : "#64748b";

  const card =
    open && user?.id && mounted ? (
      <div
        role="dialog"
        aria-label="User preview"
        className="user-hover-card"
        style={{ left: pos.left, top: pos.top }}
      >
        <div className="user-hover-card-inner">
          <div className="user-hover-card-head">
            <div className="user-hover-card-avatar">
              <Avatar url={(profile?.avatar_url ?? user.avatar_url) || null} name={name} size={34} />
              <span
                aria-hidden="true"
                className="user-hover-card-dot"
                style={{ background: dotColor }}
              />
            </div>
            <div className="user-hover-card-id">
              <div className="user-hover-card-name-row">
                <span className="user-hover-card-name">{name}</span>
                {profile?.role && profile.role !== "user" ? <RoleBadge role={profile.role} size="sm" /> : null}
              </div>
              <span className="user-hover-card-handle">@{username}</span>
            </div>
          </div>

          <div className="user-hover-card-row">
            <span>{status === "online" ? "Online now" : status === "away" ? "Away" : "Offline"}</span>
            <span className="user-hover-card-rep">{fmtRep(profile?.reputation ?? user.reputation ?? 0)} rep</span>
          </div>

          <div className="user-hover-card-stats">
            <span title="Questions">{counts?.questions ?? "–"} questions</span>
            <span title="Answers">{counts?.answers ?? "–"} answers</span>
            <span title="Followers">{counts?.followers ?? "–"} followers</span>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        className="user-hover-trigger"
        onMouseEnter={() => {
          updatePosition();
          setOpen(true);
        }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => {
          updatePosition();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {mounted && card ? createPortal(card, document.body) : null}
    </>
  );
}
