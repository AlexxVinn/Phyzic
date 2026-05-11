"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { createClient } from "@/lib/supabase";
import { fmtShortDate, fmtRep } from "@/lib/utils";
import RoleBadge from "./RoleBadge";

const NAV_ITEMS = [
  { href: "/", label: "Questions", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  )},
  { href: "/ask", label: "Ask Question", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
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
      {/* Reputation card */}
      {auth.profile && (
        <div className="sb-rep-card">
          <div className="sb-rep-header">
            <span className="sb-rep-label">Reputation</span>
            <span className="sb-rep-value">{rep.toLocaleString()}</span>
          </div>
          <div className="sb-rep-bar">
            <div className="sb-rep-fill" style={{ width: `${Math.min((rep % 1000) / 10, 100)}%` }} />
          </div>
          <div className="sb-rep-meta">
            <span className="sb-rep-role"><RoleBadge role={auth.profile.role} size="sm" /></span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="sb-nav">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            className={`sb-nav-link ${pathname === item.href ? "is-active" : ""}`}
            href={item.href}
          >
            <span className="sb-nav-icon">{item.icon}</span>
            <span className="sb-nav-text">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Recent activity */}
      <div className="sb-section">
        <div className="sb-section-title">Recent Activity</div>
        <ul className="sb-activity">
          {activity.length > 0 ? (
            activity.slice(0, 4).map((a) => (
              <li key={a.id}>
                <span className="sb-activity-dot" />
                <div className="sb-activity-content">
                  <span className="sb-activity-text">{a.text}</span>
                  <span className="sb-activity-time">{fmtShortDate(a.created_at)}</span>
                </div>
              </li>
            ))
          ) : (
            <li className="sb-muted">No recent activity</li>
          )}
        </ul>
      </div>

      {/* Feedback card */}
      <div className="sb-feedback-card">
        <div className="sb-feedback-title">New to Phyzic?</div>
        <p className="sb-feedback-text">Search before asking, define your variables, and typeset math with $...$ and $$...$$</p>
      </div>
    </aside>
  );
}
