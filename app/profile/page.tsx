"use client";

import { useEffect, useState, useCallback, useMemo, Suspense, startTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { fmtRep, fmtDate, fmtShortDate } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import RoleBadge from "@/components/RoleBadge";
import Avatar from "@/components/Avatar";
import ConnectionButton from "@/components/ConnectionButton";
import MessageButton from "@/components/MessageButton";
import type { Profile } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase";
import { fetchConnections } from "@/lib/connections";

const TAB_KEYS = ["about", "questions", "answers", "activity", "saved"];

const HEATMAP_COLS = 14;

function dateKeyUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

type ContribCell = { key: string; count: number; level: number; isFuture: boolean };

/** GitHub-style grid: rows = Sun–Sat, columns = weeks (oldest → newest). */
function buildContributionGrid(dayCounts: Record<string, number>, cols = HEATMAP_COLS): ContribCell[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastSunday = new Date(today);
  while (lastSunday.getDay() !== 0) lastSunday.setDate(lastSunday.getDate() - 1);

  const grid: ContribCell[][] = [];
  for (let r = 0; r < 7; r++) {
    const row: ContribCell[] = [];
    for (let c = 0; c < cols; c++) {
      const columnSunday = new Date(lastSunday);
      columnSunday.setDate(lastSunday.getDate() - (cols - 1 - c) * 7);
      const d = new Date(columnSunday);
      d.setDate(columnSunday.getDate() + r);
      d.setHours(0, 0, 0, 0);
      const key = dateKeyUTC(d);
      const count = dayCounts[key] || 0;
      const isFuture = d.getTime() > today.getTime();
      let level = 0;
      if (!isFuture && count > 0) {
        if (count === 1) level = 1;
        else if (count <= 2) level = 2;
        else if (count <= 4) level = 3;
        else level = 4;
      }
      row.push({ key, count, level, isFuture });
    }
    grid.push(row);
  }
  return grid;
}

type Item = Record<string, unknown>;

function ConnectionsSection({ userId }: { userId: string }) {
  const [connections, setConnections] = useState<Awaited<ReturnType<typeof fetchConnections>>>([]);
  useEffect(() => {
    let active = true;
    fetchConnections(userId).then((data) => { if (active) setConnections(data.slice(0, 6)); }).catch(() => {});
    return () => { active = false; };
  }, [userId]);

  if (connections.length === 0) return null;
  return (
    <div className="profile-top-tags">
      <div className="profile-section-label">Mutual collaborators</div>
      <div className="profile-collab-list">
        {connections.map((c) => (
          <Link key={c.peerId} href={`/profile?u=${encodeURIComponent(c.username)}`} className="profile-collab-chip">
            <Avatar url={c.avatarUrl} name={c.username} size={22} />
            <span>{c.username}</span>
            <span>{fmtRep(c.reputation)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ProfilePageInner() {
  const auth = useAuth();
  const searchParams = useSearchParams();
  const [targetUser, setTargetUser] = useState<Profile | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [activeTab, setActiveTab] = useState("about");
  const [stats, setStats] = useState({ questions: 0, answers: 0, accepted: 0, votes: 0 });
  const [followStatus, setFollowStatus] = useState({ following: false, followers: 0, followingCount: 0 });
  const [connectionCount, setConnectionCount] = useState(0);
  const [presence, setPresence] = useState<{ status: string; last_seen_at: string } | null>(null);
  const [sharedTopics, setSharedTopics] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [topTags, setTopTags] = useState<{ tag: string; count: number }[]>([]);
  const [contribDays, setContribDays] = useState<Record<string, number>>({});
  const [recentQs, setRecentQs] = useState<{ id: string; title: string; score: number; answer_count: number; created_at: string }[]>([]);
  const [recentAs, setRecentAs] = useState<
    { id: string; score: number; accepted: boolean; created_at: string; question_id: string; qtitle: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const contribGrid = useMemo(() => buildContributionGrid(contribDays, HEATMAP_COLS), [contribDays]);
  const maxTagCount = useMemo(() => topTags.reduce((m, t) => Math.max(m, t.count), 0), [topTags]);

  const resolveTarget = useCallback(async () => {
    const usernameParam = searchParams.get("u");
    const userIdParam = searchParams.get("id");
    const currentUser = auth.user;

    let target: Profile | null = null;
    if (usernameParam) {
      target = await auth.fetchProfileByUsername(usernameParam);
    }
    if (!target && userIdParam) {
      target = await auth.fetchProfile(userIdParam);
    }
    if (!target && currentUser) {
      target = await auth.refreshProfile(true);
      setIsOwner(true);
    }
    if (target && currentUser) {
      setIsOwner(currentUser.id === target.id);
    }
    setTargetUser(target);
    if (target) {
      setEditName(target.full_name || "");
      setEditUsername(target.username || "");
      setEditBio(target.bio || "");
    }
    setLoading(false);
  }, [searchParams, auth]);

  useEffect(() => {
    startTransition(() => { void resolveTarget(); });
  }, [resolveTarget]);

  useEffect(() => {
    if (!targetUser) return;
    const supabase = createClient();
    (async () => {
      try {
        const [qRes, aRes, accRes, vRes] = await Promise.all([
          supabase.from("questions").select("id", { count: "exact", head: true }).eq("author_id", targetUser.id),
          supabase.from("answers").select("id", { count: "exact", head: true }).eq("author_id", targetUser.id),
          supabase.from("answers").select("id", { count: "exact", head: true }).eq("author_id", targetUser.id).eq("accepted", true),
          supabase.from("votes").select("id", { count: "exact", head: true }).eq("user_id", targetUser.id),
        ]);
        setStats({
          questions: qRes.count || 0,
          answers: aRes.count || 0,
          accepted: accRes.count || 0,
          votes: vRes.count || 0,
        });
      } catch {}
    })();
  }, [targetUser]);

  useEffect(() => {
    if (!targetUser || !auth.user || isOwner) return;
    auth.fetchFollowStatus(auth.user.id, targetUser.id).then(setFollowStatus).catch(() => {});
  }, [targetUser, auth, isOwner]);

  useEffect(() => {
    if (!targetUser) return;
    const supabase = createClient();
    (async () => {
      try {
        const res = await supabase
          .from("connections")
          .select("id", { count: "exact", head: true })
          .eq("status", "accepted")
          .or(`requester_id.eq.${targetUser.id},addressee_id.eq.${targetUser.id}`);
        setConnectionCount(res.count || 0);
      } catch { setConnectionCount(0); }
    })();
  }, [targetUser]);

  useEffect(() => {
    if (!targetUser) return;
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase.from("user_presence").select("status,last_seen_at").eq("user_id", targetUser.id).maybeSingle();
        if (data) setPresence(data as unknown as { status: string; last_seen_at: string });
      } catch { setPresence(null); }
    })();
  }, [targetUser]);

  useEffect(() => {
    if (!targetUser || !auth.user || isOwner) return;
    const userId = auth.user.id;
    const supabase = createClient();
    (async () => {
      try {
        const [viewerTags, targetTags] = await Promise.all([
          supabase.rpc("get_user_top_tags", { p_user_id: userId }).then((r) => r.data || []),
          supabase.rpc("get_user_top_tags", { p_user_id: targetUser.id }).then((r) => r.data || []),
        ]);
        const vSet = new Set((viewerTags as any[]).map((x) => x.tag).filter(Boolean));
        const tSet = new Set((targetTags as any[]).map((x) => x.tag).filter(Boolean));
        setSharedTopics([...vSet].filter((t) => tSet.has(t)));
      } catch { setSharedTopics([]); }
    })();
  }, [targetUser, auth.user, isOwner]);

  useEffect(() => {
    if (!targetUser) return;
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase.rpc("get_user_top_tags", { p_user_id: targetUser.id });
        const rows = Array.isArray(data) ? data : [];
        setTopTags(
          rows
            .map((r) => {
              if (!r || typeof r !== "object") return null;
              const o = r as Record<string, unknown>;
              const tag = typeof o.tag === "string" ? o.tag : null;
              const count = typeof o.count === "number" ? o.count : typeof o.count === "string" ? Number(o.count) : null;
              if (!tag || count === null || Number.isNaN(count)) return null;
              return { tag, count };
            })
            .filter((x): x is { tag: string; count: number } => Boolean(x))
            .slice(0, 10)
        );
      } catch {
        const { data } = await supabase
          .from("questions")
          .select("tags")
          .eq("author_id", targetUser.id);
        const counts: Record<string, number> = {};
        for (const row of data || []) {
          if (!row || typeof row !== "object") continue;
          const tags = (row as Record<string, unknown>).tags;
          if (!Array.isArray(tags)) continue;
          for (const t of tags) {
            if (typeof t !== "string") continue;
            counts[t] = (counts[t] || 0) + 1;
          }
        }
        setTopTags(
          Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag, count]) => ({ tag, count }))
        );
      }
    })();
  }, [targetUser]);

  useEffect(() => {
    if (!targetUser) return;
    const supabase = createClient();
    (async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - HEATMAP_COLS * 7 - 14);
        const sinceIso = since.toISOString();
        const [qRes, aRes, rq, ra] = await Promise.all([
          supabase.from("questions").select("created_at").eq("author_id", targetUser.id).gte("created_at", sinceIso),
          supabase.from("answers").select("created_at").eq("author_id", targetUser.id).gte("created_at", sinceIso),
          supabase
            .from("questions")
            .select("id,title,score,answer_count,created_at")
            .eq("author_id", targetUser.id)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("answers")
            .select("id,score,accepted,created_at,question_id,question:questions!answers_question_id_fkey(id,title)")
            .eq("author_id", targetUser.id)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);
        const map: Record<string, number> = {};
        for (const row of [...(qRes.data || []), ...(aRes.data || [])]) {
          const raw = (row as { created_at?: string }).created_at;
          const k = typeof raw === "string" ? raw.slice(0, 10) : "";
          if (k) map[k] = (map[k] || 0) + 1;
        }
        setContribDays(map);

        setRecentQs(
          (rq.data || []).map((x) => {
            const o = x as Record<string, unknown>;
            return {
              id: String(o.id ?? ""),
              title: typeof o.title === "string" ? o.title : "Question",
              score: typeof o.score === "number" ? o.score : 0,
              answer_count: typeof o.answer_count === "number" ? o.answer_count : 0,
              created_at: typeof o.created_at === "string" ? o.created_at : "",
            };
          })
        );

        const ansRows = ra.data || [];
        setRecentAs(
          ansRows.map((x) => {
            const o = x as Record<string, unknown>;
            const q = o.question && typeof o.question === "object" ? (o.question as Record<string, unknown>) : null;
            const qtitle = q && typeof q.title === "string" ? q.title : "Question";
            return {
              id: String(o.id ?? ""),
              score: typeof o.score === "number" ? o.score : 0,
              accepted: o.accepted === true,
              created_at: typeof o.created_at === "string" ? o.created_at : "",
              question_id: String(o.question_id ?? ""),
              qtitle,
            };
          })
        );
      } catch {
        setContribDays({});
        setRecentQs([]);
        setRecentAs([]);
      }
    })();
  }, [targetUser]);

  useEffect(() => {
    if (!targetUser) return;
    startTransition(() => { setItems([]); });
    const supabase = createClient();
    (async () => {
      try {
        let data: Item[] = [];
        if (activeTab === "questions") {
          const res = await supabase
            .from("questions")
            .select("id,title,score,answer_count,solved,created_at")
            .eq("author_id", targetUser.id)
            .order("created_at", { ascending: false });
          data = res.data || [];
        } else if (activeTab === "answers") {
          const res = await supabase
            .from("answers")
            .select("id,body,score,accepted,created_at,question:questions!answers_question_id_fkey(id,title)")
            .eq("author_id", targetUser.id)
            .order("created_at", { ascending: false });
          data = res.data || [];
        } else if (activeTab === "activity") {
          const res = await supabase
            .from("reputation_history")
            .select("id,delta,reason,source_type,source_id,created_at")
            .eq("user_id", targetUser.id)
            .order("created_at", { ascending: false })
            .limit(50);
          data = res.data || [];
        } else if (activeTab === "saved") {
          const res = await supabase
            .from("saved_posts")
            .select("id,post_type,post_id,created_at")
            .eq("user_id", targetUser.id)
            .order("created_at", { ascending: false });
          const raw = res.data || [];
          const enriched = await Promise.all(
            raw.map(async (sp) => {
              const postType = typeof (sp as Record<string, unknown>)?.post_type === "string" ? (sp as Record<string, unknown>).post_type : null;
              const postId = typeof (sp as Record<string, unknown>)?.post_id === "string" ? (sp as Record<string, unknown>).post_id : null;
              if (!postType || !postId) return sp as Item;

              if (postType === "question") {
                const q = await supabase.from("questions").select("id,title").eq("id", postId).maybeSingle();
                return { ...(sp as Item), title: q.data?.title || "Question" };
              }

              const { data: aData } = await supabase
                .from("answers")
                .select("id,body,question:questions!answers_question_id_fkey(id,title)")
                .eq("id", postId)
                .maybeSingle();

              const qObj = (aData && typeof aData === "object") ? (aData as Record<string, unknown>).question : null;
              const qTitle = (qObj && typeof qObj === "object" && "title" in qObj && typeof (qObj as Record<string, unknown>).title === "string")
                ? String((qObj as Record<string, unknown>).title)
                : "Answer";
              const body = (aData && typeof aData === "object" && "body" in (aData as Record<string, unknown>) && typeof (aData as Record<string, unknown>).body === "string")
                ? String((aData as Record<string, unknown>).body)
                : undefined;

              return { ...(sp as Item), title: qTitle, ...(body ? { body } : {}) };
            })
          );
          data = enriched as Item[];
        }
        setItems(data);
      } catch {
        setItems([]);
      }
    })();
  }, [targetUser, activeTab]);

  const handleSaveEdit = async () => {
    if (!targetUser || !isOwner) return;
    setSaving(true);
    try {
      await auth.updateProfile({ full_name: editName, username: editUsername, bio: editBio });
      setTargetUser({ ...targetUser, full_name: editName, username: editUsername, bio: editBio });
      setEditMode(false);
    } catch (e: unknown) {
      alert((e as Error)?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleFollow = async () => {
    if (!targetUser) return;
    try {
      if (followStatus.following) {
        await auth.unfollowUser(targetUser.id);
        setFollowStatus((s) => ({ ...s, following: false, followers: s.followers - 1 }));
      } else {
        await auth.followUser(targetUser.id);
        setFollowStatus((s) => ({ ...s, following: true, followers: s.followers + 1 }));
      }
    } catch (e: unknown) {
      alert((e as Error)?.message || "Failed");
    }
  };

  if (loading) {
    return (
      <div className="app">
        <Navbar />
        <div className="shell">
          <Sidebar />
          <main className="main">
            <div className="profile-root">
              <div className="skeleton-wrap">
                <div className="skeleton-line skeleton-lg" />
                <div className="skeleton-line skeleton-md" />
                <div className="skeleton-line skeleton-md" />
                <div className="skeleton-line" />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!targetUser) {
    return (
      <div className="app">
        <Navbar />
        <div className="shell shell-no-right">
          <Sidebar />
          <main className="main">
            <div className="profile-root">
              <div className="profile-empty">Profile not found.</div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const name = targetUser.full_name || targetUser.username || "User";
  const rep = targetUser.reputation || 0;
  const joined = fmtDate(targetUser.created_at);

  return (
    <div className="app">
      <Navbar />
      <div className="shell shell-no-right">
        <Sidebar />
        <main className="main">
          <div className="profile-root">
            <header className="profile-hero">
              <div className="profile-avatar-col">
                <div className="profile-avatar-halo">
                  {isOwner && editMode ? (
                    <label className="profile-avatar-edit">
                      <Avatar url={targetUser.avatar_url} name={name} size={104} />
                      <input type="file" accept="image/*" hidden onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const url = await auth.uploadAvatar(file);
                          setTargetUser({ ...targetUser, avatar_url: url });
                        } catch (err: unknown) {
                          alert((err as Error)?.message || "Upload failed");
                        }
                      }} />
                      <span className="profile-avatar-overlay">Change</span>
                    </label>
                  ) : (
                    <Avatar url={targetUser.avatar_url} name={name} size={104} />
                  )}
                </div>
                {presence && (
                  <div
                    className="profile-presence-pill"
                    title={presence.status === "online" ? "Online" : presence.last_seen_at}
                  >
                    <span
                      className={`profile-presence-dot ${
                        presence.status === "online" ? "is-online" : presence.status === "away" ? "is-away" : "is-offline"
                      }`}
                      aria-hidden
                    />
                    {presence.status === "online"
                      ? "Active"
                      : presence.status === "away"
                        ? "Away"
                        : `Seen ${fmtShortDate(presence.last_seen_at)}`}
                  </div>
                )}
              </div>
              <div className="profile-identity">
                {isOwner && editMode ? (
                  <>
                    <input type="text" className="profile-edit-input profile-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name" maxLength={64} />
                    <input type="text" className="profile-edit-input profile-edit-username" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="Username" maxLength={32} />
                  </>
                ) : (
                  <>
                    <h1 className="profile-name profile-name-row">
                      {name} <RoleBadge role={targetUser.role || "user"} size="md" />
                    </h1>
                    {targetUser.username && <div className="profile-username">@{targetUser.username}</div>}
                  </>
                )}
                <div className="profile-rep-row">
                  <span className="profile-rep-main">{fmtRep(rep)} reputation</span>
                </div>
                <div className="profile-joined">Member since {joined}</div>
                {!isOwner && auth.user && (
                  <div className="profile-social-meta">
                    <span><strong>{followStatus.followers}</strong> followers</span>
                    <span><strong>{followStatus.followingCount}</strong> following</span>
                    <span><strong>{connectionCount}</strong> connections</span>
                  </div>
                )}
                {isOwner && (
                  <div className="profile-social-meta">
                    <span><strong>{connectionCount}</strong> connections</span>
                  </div>
                )}
                {targetUser.status !== "active" && (
                  <div className={`profile-status mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${targetUser.status === "banned" ? "bg-red-50 text-red-700 border border-red-200" : targetUser.status === "suspended" ? "bg-orange-50 text-orange-700 border border-orange-200" : "bg-yellow-50 text-yellow-700 border border-yellow-200"}`}>
                    {targetUser.status}
                    {targetUser.status_reason && <span className="opacity-70">· {targetUser.status_reason}</span>}
                  </div>
                )}

                {isOwner ? (
                  <div className="profile-actions">
                    <button type="button" className="btn-secondary" onClick={() => {
                      if (editMode) handleSaveEdit();
                      setEditMode((v) => !v);
                    }}>{editMode ? (saving ? "Saving…" : "Done") : "Edit profile"}</button>
                    <div className="profile-dropdown">
                      <button type="button" className="btn-icon" onClick={() => auth.signOut().then(() => window.location.href = "/login")}>⋯</button>
                    </div>
                  </div>
                ) : auth.user ? (
                  <div className="profile-actions">
                    <ConnectionButton targetId={targetUser.id} />
                    <MessageButton targetId={targetUser.id} />
                    <button type="button" className={`${followStatus.following ? "btn-primary is-following" : "btn-secondary"}`} onClick={handleFollow}>{followStatus.following ? "Following" : "Follow"}</button>
                  </div>
                ) : null}
              </div>
            </header>

            {isOwner && editMode && (
              <div className="profile-bio-panel" style={{ marginBottom: 14 }}>
                <div className="profile-panel-kicker">Bio</div>
                <textarea className="auth-input" rows={4} maxLength={500} placeholder="Research interests, affiliations, what you like to work on…" value={editBio} onChange={(e) => setEditBio(e.target.value)} />
              </div>
            )}

            {!editMode && targetUser.bio && (
              <div className="profile-bio-panel">
                <div className="profile-panel-kicker">About</div>
                <p className="profile-bio-text">{targetUser.bio}</p>
              </div>
            )}

            <div className="profile-tabs" role="tablist" aria-label="Profile sections">
              {TAB_KEYS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  className={`profile-tab ${activeTab === tab ? "is-active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "about"
                    ? "Overview"
                    : tab === "questions"
                      ? "Questions"
                      : tab === "answers"
                        ? "Answers"
                        : tab === "activity"
                          ? "Reputation"
                          : "Saved"}
                </button>
              ))}
            </div>

            {activeTab === "about" && (
              <>
                <section className="profile-panel" aria-labelledby="profile-contrib-heading">
                  <div className="profile-panel-head">
                    <div>
                      <p id="profile-contrib-heading" className="profile-panel-kicker">Contribution rhythm</p>
                      <h2 className="profile-panel-title">Activity across recent weeks</h2>
                      <p className="profile-panel-hint">Each square is a day. Darker cells mean more posts that day (questions + answers).</p>
                    </div>
                  </div>
                  <div className="profile-heatmap-wrap">
                    <div className="profile-heatmap-dow" aria-hidden>
                      <span>Su</span>
                      <span>Mo</span>
                      <span>Tu</span>
                      <span>We</span>
                      <span>Th</span>
                      <span>Fr</span>
                      <span>Sa</span>
                    </div>
                    <div className="profile-heatmap-grid" role="img" aria-label="Contribution heatmap by day">
                      {Array.from({ length: HEATMAP_COLS }, (_, c) =>
                        contribGrid.map((row, r) => {
                          const cell = row[c];
                          return (
                            <div
                              key={`h-${r}-${c}`}
                              className={`profile-heat profile-heat--${cell.level} ${cell.isFuture ? "is-future" : ""}`}
                              title={cell.isFuture ? "" : `${cell.key}: ${cell.count} contribution${cell.count === 1 ? "" : "s"}`}
                            />
                          );
                        })
                      ).flat()}
                    </div>
                  </div>
                  <div className="profile-heatmap-legend">
                    <span>Less</span>
                    <div className="profile-heatmap-legend-scale" aria-hidden>
                      <span className="profile-heat profile-heat--0" />
                      <span className="profile-heat profile-heat--1" />
                      <span className="profile-heat profile-heat--2" />
                      <span className="profile-heat profile-heat--3" />
                      <span className="profile-heat profile-heat--4" />
                    </div>
                    <span>More</span>
                  </div>
                </section>

                <section className="profile-panel" aria-labelledby="profile-stats-heading">
                  <div className="profile-panel-head">
                    <div>
                      <p id="profile-stats-heading" className="profile-panel-kicker">Corpus</p>
                      <h2 className="profile-panel-title">Public footprint</h2>
                    </div>
                  </div>
                  <div className="profile-stats-grid" role="list">
                    <div className="profile-stat" role="listitem">
                      <div className="profile-stat-val">{stats.questions}</div>
                      <div className="profile-stat-lbl">Questions</div>
                    </div>
                    <div className="profile-stat" role="listitem">
                      <div className="profile-stat-val">{stats.answers}</div>
                      <div className="profile-stat-lbl">Answers</div>
                    </div>
                    <div className="profile-stat" role="listitem">
                      <div className="profile-stat-val">{stats.accepted}</div>
                      <div className="profile-stat-lbl">Accepted</div>
                    </div>
                    <div className="profile-stat" role="listitem">
                      <div className="profile-stat-val">{stats.votes}</div>
                      <div className="profile-stat-lbl">Votes cast</div>
                    </div>
                    <div className="profile-stat" role="listitem">
                      <div className="profile-stat-val">{connectionCount}</div>
                      <div className="profile-stat-lbl">Connections</div>
                    </div>
                  </div>
                </section>

                {(recentQs.length > 0 || recentAs.length > 0) && (
                  <section className="profile-panel" aria-labelledby="profile-recent-heading">
                    <div className="profile-panel-head">
                      <div>
                        <p id="profile-recent-heading" className="profile-panel-kicker">Trajectory</p>
                        <h2 className="profile-panel-title">Recent work</h2>
                        <p className="profile-panel-hint">Latest threads you shaped — questions you opened and answers you advanced.</p>
                      </div>
                    </div>
                    {recentQs.length > 0 && (
                      <>
                        <div className="profile-section-label" style={{ marginBottom: 8 }}>Questions</div>
                        <div className="profile-recent-list">
                          {recentQs.map((q) => (
                            <Link key={q.id} href={`/question/${q.id}`} className="profile-recent-row">
                              <div>
                                <div className="profile-recent-title">{q.title}</div>
                                <div className="profile-recent-meta">
                                  {q.created_at ? fmtShortDate(q.created_at) : ""}
                                  {q.created_at ? " · " : ""}
                                  {q.answer_count} answers · score {q.score}
                                </div>
                              </div>
                              <div className="profile-recent-badges">
                                <span className="profile-chip profile-chip--accent">Question</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </>
                    )}
                    {recentAs.length > 0 && (
                      <>
                        <div className="profile-section-label" style={{ marginTop: recentQs.length ? 18 : 0, marginBottom: 8 }}>Answers</div>
                        <div className="profile-recent-list">
                          {recentAs.map((a) => (
                            <Link key={a.id} href={a.question_id ? `/question/${a.question_id}` : "#"} className="profile-recent-row">
                              <div>
                                <div className="profile-recent-title">{a.qtitle}</div>
                                <div className="profile-recent-meta">
                                  {a.created_at ? fmtShortDate(a.created_at) : ""}
                                  {a.created_at ? " · " : ""}
                                  score {a.score}
                                  {a.accepted ? " · accepted" : ""}
                                </div>
                              </div>
                              <div className="profile-recent-badges">
                                {a.accepted ? <span className="profile-chip profile-chip--ok">Accepted</span> : null}
                                <span className="profile-chip profile-chip--accent">Answer</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                )}

                {topTags.length > 0 && (
                  <section className="profile-panel" aria-labelledby="profile-tags-heading">
                    <div className="profile-panel-head">
                      <div>
                        <p id="profile-tags-heading" className="profile-panel-kicker">Expertise</p>
                        <h2 className="profile-panel-title">Topic concentration</h2>
                        <p className="profile-panel-hint">Where this researcher spends attention, inferred from question tags.</p>
                      </div>
                    </div>
                    <div className="profile-expertise-list">
                      {topTags.map((t) => {
                        const denom = maxTagCount > 0 ? maxTagCount : 1;
                        const pct = Math.round((t.count / denom) * 100);
                        return (
                          <div key={t.tag} className="profile-expertise-row">
                            <div className="profile-expertise-name" title={t.tag}>{t.tag}</div>
                            <div className="profile-expertise-count">{t.count}</div>
                            <div className="profile-expertise-track">
                              <div className="profile-expertise-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {sharedTopics.length > 0 && (
                  <section className="profile-panel">
                    <div className="profile-panel-head">
                      <div>
                        <p className="profile-panel-kicker">Overlap</p>
                        <h2 className="profile-panel-title">Shared research interests</h2>
                      </div>
                    </div>
                    <div className="q-tags">
                      {sharedTopics.map((t) => (
                        <span key={t} className="tag">{t}</span>
                      ))}
                    </div>
                  </section>
                )}

                {!isOwner && auth.user && (
                  <section className="profile-panel">
                    <ConnectionsSection userId={targetUser.id} />
                  </section>
                )}
              </>
            )}

            {activeTab !== "about" && (
              <div>
                {items.length === 0 ? (
                  <div className="profile-empty">Nothing here yet.</div>
                ) : (
                  <div className="profile-feed">
                    {items.map((item, idx: number) => {
                      const id = typeof item.id === "string" ? item.id : String(idx);
                      const createdAt = typeof item.created_at === "string" ? item.created_at : "";
                      const score = typeof item.score === "number" ? item.score : 0;
                      const accepted = item.accepted === true;
                      const solved = item.solved === true;
                      const delta = typeof item.delta === "number" ? item.delta : typeof item.delta === "string" ? Number(item.delta) : null;

                      const postType = typeof item.post_type === "string" ? item.post_type : null;
                      const postId = typeof item.post_id === "string" ? item.post_id : null;
                      const questionId = typeof (item as Record<string, unknown>).question_id === "string" ? String((item as Record<string, unknown>).question_id) : null;

                      const qObj = (item as Record<string, unknown>).question;
                      const qTitle = (qObj && typeof qObj === "object" && "title" in qObj && typeof (qObj as Record<string, unknown>).title === "string")
                        ? String((qObj as Record<string, unknown>).title)
                        : null;
                      const title = typeof item.title === "string"
                        ? item.title
                        : qTitle
                          ? qTitle
                          : typeof item.reason === "string"
                            ? item.reason
                            : typeof item.body === "string"
                              ? item.body.slice(0, 80)
                              : "Item";

                      const sourceType = typeof (item as Record<string, unknown>).source_type === "string"
                        ? String((item as Record<string, unknown>).source_type)
                        : null;

                      let href = `/question/${id}`;
                      if (questionId) href = `/question/${questionId}`;
                      else if (postType === "question" && postId) href = `/question/${postId}`;
                      else if (postType === "answer" && postId) href = `/question/${postId}`;

                      return (
                        <div key={id} className="profile-row">
                          <div className="profile-row-main" style={{ minWidth: 0 }}>
                            <h3 className="profile-row-title">
                              <Link href={href}>{title}</Link>
                            </h3>
                            <div className="profile-row-meta">
                              {activeTab === "activity" && sourceType ? (
                                <span className="profile-row-src">{sourceType}</span>
                              ) : null}
                              {createdAt ? fmtShortDate(createdAt) : ""}{createdAt ? " · " : ""}Score {score}
                              {accepted ? " · Accepted" : ""}
                              {solved ? " · Solved" : ""}
                              {delta !== null && !Number.isNaN(delta) && delta !== 0 ? ` · Reputation ${delta > 0 ? "+" : ""}${delta}` : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="app">
        <Navbar />
        <div className="shell">
          <Sidebar />
          <main className="main">
            <div className="profile-root">
              <div className="skeleton-wrap">
                <div className="skeleton-line skeleton-lg" />
                <div className="skeleton-line skeleton-md" />
                <div className="skeleton-line skeleton-md" />
                <div className="skeleton-line" />
              </div>
            </div>
          </main>
        </div>
      </div>
    }>
      <ProfilePageInner />
    </Suspense>
  );
}
