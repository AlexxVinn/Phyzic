"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { createClient } from "@/lib/supabase";
import { fmtShortDate, fmtRep } from "@/lib/utils";
import RoleBadge from "./RoleBadge";
import Avatar from "./Avatar";

const ICON_CLASS = { width: 16, height: 16 } as const;

const NAV_COMMUNITY = [
  {
    href: "/",
    label: "Questions",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
    ),
  },
  {
    href: "/ask",
    label: "Ask Question",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
    ),
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
    ),
  },
];

const NAV_PERSONAL = [
  {
    href: "/messages",
    label: "Messages",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><path d="m22 6-10 7L2 6" /></svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.67 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.67a1.65 1.65 0 0 0 1.51-1H11a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.06.32.1.66.1 1h.09a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
    ),
  },
];

interface ActivityItem {
  id: string;
  text: string;
  created_at: string;
}

function navIsActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const REP_BRACKETS = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000] as const;

function repMilestone(rep: number): { fillPct: number; caption: string } {
  if (rep >= REP_BRACKETS[REP_BRACKETS.length - 1]) {
    return { fillPct: 100, caption: "You're in the long tail of trust" };
  }
  const next = REP_BRACKETS.find((b) => b > rep) ?? REP_BRACKETS[REP_BRACKETS.length - 1];
  const bi = REP_BRACKETS.indexOf(next as (typeof REP_BRACKETS)[number]);
  const prev = bi > 0 ? REP_BRACKETS[bi - 1] : 0;
  const span = next - prev;
  const raw = span > 0 ? ((rep - prev) / span) * 100 : 100;
  const fillPct = Math.min(100, Math.max(4, raw));
  return {
    fillPct,
    caption: `Toward ${next.toLocaleString()} rep`,
  };
}

function splitAskedActivity(text: string): { actor: string; title: string } | null {
  const marker = ' asked "';
  const i = text.indexOf(marker);
  if (i <= 0) return null;
  const actor = text.slice(0, i).trim();
  const after = text.slice(i + marker.length);
  const end = after.lastIndexOf('"');
  const title = (end >= 0 ? after.slice(0, end) : after).trim();
  if (!actor || !title) return null;
  return { actor, title };
}

export default function Sidebar() {
  const pathname = usePathname();
  const auth = useAuth();
  const rep = auth.profile?.reputation ?? 0;
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [topTags, setTopTags] = useState<{ name: string; question_count: number }[]>([]);

  const milestone = useMemo(() => repMilestone(rep), [rep]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("tags")
      .select("name,question_count")
      .order("question_count", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (data) setTopTags(data);
      });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_recent_activity", { limit_count: 5 });
        if (!error && data) {
          setActivity(
            (data as any[]).map((a) => ({
              id: a.id || `${a.created_at}`,
              text: a.text,
              created_at: a.created_at,
            }))
          );
          return;
        }
      } catch {}
      try {
        const { data } = await supabase
          .from("questions")
          .select("id,title,created_at,author:profiles(username)")
          .order("created_at", { ascending: false })
          .limit(5);
        if (data) {
          setActivity(
            (data as any[]).map((q) => ({
              id: q.id,
              text: `${q.author?.username || "Someone"} asked "${q.title}"`,
              created_at: q.created_at,
            }))
          );
        }
      } catch {}
    })();
  }, []);

  return (
    <aside className="sidebar" aria-label="Navigation">
      {auth.profile && (
        <Link href="/profile" className="sb-identity-card">
          <Avatar url={auth.profile.avatar_url} name={auth.profile.username} size={40} className="sb-identity-avatar" />
          <div className="sb-identity-body">
            <div className="sb-identity-row">
              <span className="sb-identity-name">{auth.profile.username}</span>
              <RoleBadge role={auth.profile.role} size="sm" />
            </div>
            <div className="sb-identity-rep-row">
              <span className="sb-rep-label">Reputation</span>
              <span className="sb-rep-value">{fmtRep(rep)}</span>
            </div>
            <div className="sb-rep-bar" aria-hidden>
              <div className="sb-rep-fill" style={{ width: `${milestone.fillPct}%` }} />
            </div>
            <div className="sb-rep-caption">{milestone.caption}</div>
          </div>
        </Link>
      )}

      <nav className="sb-nav" aria-label="Primary">
        <div className="sb-nav-group-label">Community</div>
        {NAV_COMMUNITY.map((item) => (
          <Link
            key={item.href}
            className={`sb-nav-link ${navIsActive(pathname, item.href) ? "is-active" : ""}`}
            href={item.href}
          >
            <span className="sb-nav-icon" style={ICON_CLASS}>
              {item.icon}
            </span>
            <span className="sb-nav-text">{item.label}</span>
          </Link>
        ))}
        <div className="sb-nav-group-label sb-nav-group-label-spaced">You</div>
        {NAV_PERSONAL.map((item) => (
          <Link
            key={item.href}
            className={`sb-nav-link ${navIsActive(pathname, item.href) ? "is-active" : ""}`}
            href={item.href}
          >
            <span className="sb-nav-icon" style={ICON_CLASS}>
              {item.icon}
            </span>
            <span className="sb-nav-text">{item.label}</span>
          </Link>
        ))}
      </nav>

      {topTags.length > 0 && (
        <div className="sb-section sb-topic-section">
          <div className="sb-section-head">
            <span className="sb-section-title">Active topics</span>
          </div>
          <div className="sb-topic-chips">
            {topTags.map((t) => (
              <span key={t.name} className="sb-topic-chip" title={`${t.question_count} questions`}>
                <span className="sb-topic-name">{t.name}</span>
                <span className="sb-topic-count">{t.question_count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="sb-section sb-activity-section">
        <div className="sb-section-head">
          <span className="sb-section-pulse" aria-hidden />
          <span className="sb-section-title">Recent activity</span>
        </div>
        <ul className="sb-activity">
          {activity.length > 0 ? (
            activity.slice(0, 4).map((a) => {
              const parsed = splitAskedActivity(a.text);
              return (
                <li key={a.id}>
                  <span className="sb-activity-gutter" aria-hidden />
                  <div className="sb-activity-content">
                    {parsed ? (
                      <>
                        <div className="sb-activity-line1">
                          <span className="sb-activity-actor">{parsed.actor}</span>
                          <span className="sb-activity-verb">asked</span>
                        </div>
                        <div className="sb-activity-title">{parsed.title}</div>
                        <span className="sb-activity-time">{fmtShortDate(a.created_at)}</span>
                      </>
                    ) : (
                      <>
                        <span className="sb-activity-text">{a.text}</span>
                        <span className="sb-activity-time">{fmtShortDate(a.created_at)}</span>
                      </>
                    )}
                  </div>
                </li>
              );
            })
          ) : (
            <li className="sb-muted">No recent activity</li>
          )}
        </ul>
      </div>

      <div className="sb-feedback-card">
        <div className="sb-feedback-title">Field notes</div>
        <p className="sb-feedback-text">Search before asking, define your variables, and typeset math with $...$ and $$...$$</p>
      </div>
    </aside>
  );
}
