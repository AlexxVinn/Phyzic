"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { createClient } from "@/lib/supabase";
import { fmtShortDate } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Questions", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  )},
  { href: "/leaderboard", label: "Leaderboard", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
  )},
  { href: "/settings", label: "Settings", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.67 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.67a1.65 1.65 0 0 0 1.51-1H11a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.06.32.1.66.1 1h.09a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  )},
];

interface ActivityItem {
  id: string;
  text: string;
  created_at: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const auth = useAuth();
  const rep = auth.profile?.reputation ?? 0;
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [topTags, setTopTags] = useState<{ name: string; question_count: number }[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("tags")
      .select("name,question_count")
      .order("question_count", { ascending: false })
      .limit(8)
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
        <div className="sidebar-user">
          <div className="sidebar-user-row">
            <span className="sidebar-user-label">Reputation</span>
            <strong>{rep.toLocaleString()}</strong>
          </div>
          <div className="xp-track">
            <div className="xp-fill" style={{ width: `${Math.min((rep % 1000) / 10, 100)}%` }} />
          </div>
        </div>
      )}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            className={`sidebar-link ${pathname === item.href ? "is-active" : ""}`}
            href={item.href}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span className="sidebar-link-text">{item.label}</span>
          </Link>
        ))}
      </nav>

      {topTags.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-title">Top tags</div>
          <ul className="hot-list">
            {topTags.map((t) => (
              <li key={t.name}>
                <Link href={`/?tag=${encodeURIComponent(t.name)}`} className="text-left w-full block">
                  {t.name}
                </Link>
                <span className="hot-count">{t.question_count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="sidebar-section">
        <div className="sidebar-section-title">Recent activity</div>
        <ul className="activity-list">
          {activity.length > 0 ? (
            activity.map((a) => (
              <li key={a.id}>
                <span className="activity-text">{a.text}</span>
                <span className="activity-time">{fmtShortDate(a.created_at)}</span>
              </li>
            ))
          ) : (
            <li className="text-muted text-xs">No recent activity</li>
          )}
        </ul>
      </div>
    </aside>
  );
}
