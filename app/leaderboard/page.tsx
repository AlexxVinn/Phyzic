"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { fmtRep } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import RoleBadge from "@/components/RoleBadge";
import Avatar from "@/components/Avatar";
import type { UserRole } from "@/components/AuthProvider";

interface LeaderboardUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  reputation: number;
  role: UserRole;
}

export default function LeaderboardPage() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"weekly" | "monthly" | "all">("all");
  const [field, setField] = useState<string>("all");
  const [stats, setStats] = useState<Record<string, { q: number; a: number; acc: number }>>({});
  const supabase = createClient();


  useEffect(() => {
    supabase
      .from("profiles")
      .select("id,username,full_name,avatar_url,reputation,role")
      .order("reputation", { ascending: false })
      .limit(100)
      .then((res) => {
        if (res.error) {
          console.error(res.error);
          setUsers([]);
        } else {
          setUsers((res.data as LeaderboardUser[]) || []);
        }
        setLoading(false);
      });
  }, [supabase]);

  useEffect(() => {
    const top = users.slice(0, 25);
    if (top.length === 0) return;
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        top.map(async (u) => {
          const [qRes, aRes, accRes] = await Promise.all([
            supabase.from("questions").select("id", { count: "exact", head: true }).eq("author_id", u.id),
            supabase.from("answers").select("id", { count: "exact", head: true }).eq("author_id", u.id),
            supabase.from("answers").select("id", { count: "exact", head: true }).eq("author_id", u.id).eq("accepted", true),
          ]);
          return [u.id, { q: qRes.count || 0, a: aRes.count || 0, acc: accRes.count || 0 }] as const;
        })
      );
      if (cancelled) return;
      setStats(Object.fromEntries(pairs));
    })();
    return () => { cancelled = true; };
  }, [users, supabase]);

  return (
    <div className="app">
      <Navbar />
      <div className="shell shell-no-right">
        <Sidebar />
        <main className="main">
          <div className="feed-head">
            <div className="feed-head-text">
              <h1 className="feed-title">Leaderboard</h1>
              <p className="feed-sub">Reputation-weighted ranking and contribution totals.</p>
            </div>
          </div>

          <div className="lb-controls">
            <div className="lb-tabs" role="tablist" aria-label="Leaderboard range">
              <button type="button" className={`lb-tab ${range === "weekly" ? "is-active" : ""}`} onClick={() => setRange("weekly")}>Weekly</button>
              <button type="button" className={`lb-tab ${range === "monthly" ? "is-active" : ""}`} onClick={() => setRange("monthly")}>Monthly</button>
              <button type="button" className={`lb-tab ${range === "all" ? "is-active" : ""}`} onClick={() => setRange("all")}>All‑time</button>
            </div>
            <div className="lb-filters">
              <label className="lb-filter">
                <span>Field</span>
                <select value={field} onChange={(e) => setField(e.target.value)}>
                  <option value="all">All</option>
                  <option value="classical-mechanics">Classical mechanics</option>
                  <option value="quantum">Quantum</option>
                  <option value="em">Electromagnetism</option>
                  <option value="relativity">Relativity</option>
                  <option value="statmech">Stat mech</option>
                </select>
              </label>
            </div>
          </div>

          <div className="leaderboard-root">
            {loading ? (
              <div className="profile-empty">Loading…</div>
            ) : users.length === 0 ? (
              <div className="profile-empty">No users yet. Run the Supabase migration to enable profiles.</div>
            ) : (
              <table className="lb-table">
                <thead>
                  <tr>
                    <th className="lb-rank-col">#</th>
                    <th>User</th>
                    <th className="lb-num">Questions</th>
                    <th className="lb-num">Answers</th>
                    <th className="lb-num">Accepted</th>
                    <th className="lb-num">Reputation</th>
                  </tr>
                </thead>
                <tbody>
                  {users.slice(0, 50).map((u, i) => {
                    const name = u.full_name || u.username || "User";
                    const rank = i + 1;
                    const s = stats[u.id];
                    return (
                      <tr key={u.id}>
                        <td><span className={rank <= 3 ? "lb-rank-top" : "lb-rank"}>{rank}</span></td>
                        <td>
                          <Link href={`/profile?u=${encodeURIComponent(u.username || u.id)}`} className="lb-user-link">
                            <span className="lb-avatar-wrap"><Avatar url={u.avatar_url} name={name} size={28} /></span>
                            <span className="lb-name">{name}</span>
                            <RoleBadge role={u.role || "user"} size="sm" />
                          </Link>
                        </td>
                        <td className="lb-num">{s ? s.q : "…"}</td>
                        <td className="lb-num">{s ? s.a : "…"}</td>
                        <td className="lb-num">{s ? s.acc : "…"}</td>
                        <td className="lb-num lb-rep">{fmtRep(u.reputation)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
