"use client";

import { useEffect, useState, useCallback, Suspense, startTransition } from "react";
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
      <div className="card-title">Mutual collaborators</div>
      <div className="flex flex-wrap gap-2">
        {connections.map((c) => (
          <Link key={c.peerId} href={`/profile?u=${encodeURIComponent(c.username)}`} className="flex items-center gap-2" style={{ padding: "4px 8px", borderRadius: 3, border: "1px solid var(--border-subtle)", background: "var(--surface-2)" }}>
            <Avatar url={c.avatarUrl} name={c.username} size={20} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{c.username}</span>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmtRep(c.reputation)}</span>
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        <div className="shell">
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
      <div className="shell">
        <Sidebar />
        <main className="main">
          <div className="profile-root">
            <div className="profile-header">
              <div className="profile-avatar-wrap">
                {isOwner && editMode ? (
                  <label className="profile-avatar-edit">
                    <Avatar url={targetUser.avatar_url} name={name} size={96} />
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
                  <Avatar url={targetUser.avatar_url} name={name} size={96} />
                )}
              </div>
              <div className="profile-info">
                {isOwner && editMode ? (
                  <>
                    <input type="text" className="profile-edit-input profile-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name" maxLength={64} />
                    <input type="text" className="profile-edit-input profile-edit-username" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="Username" maxLength={32} />
                  </>
                ) : (
                  <>
                    <h2 className="profile-name flex items-center gap-2">{name} <RoleBadge role={targetUser.role || "user"} size="md" /></h2>
                    {targetUser.username && <div className="profile-username">@{targetUser.username}</div>}
                  </>
                )}
                <div className="profile-rep">{fmtRep(rep)} reputation</div>
                <div className="profile-joined">Joined {joined}</div>
                {presence && (
                  <div className="profile-joined flex items-center gap-1" style={{ fontSize: 11 }}>
                    <span className={`inline-block rounded-full ${presence.status === "online" ? "bg-green-500" : presence.status === "away" ? "bg-yellow-500" : "bg-gray-400"}`} style={{ width: 6, height: 6 }} />
                    {presence.status === "online" ? "Online" : presence.status === "away" ? "Away" : `Last seen ${fmtShortDate(presence.last_seen_at)}`}
                  </div>
                )}
                {targetUser.status !== "active" && (
                  <div className={`profile-status mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${targetUser.status === "banned" ? "bg-red-50 text-red-700 border border-red-200" : targetUser.status === "suspended" ? "bg-orange-50 text-orange-700 border border-orange-200" : "bg-yellow-50 text-yellow-700 border border-yellow-200"}`}>
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
            </div>

            {isOwner && editMode && (
              <div className="profile-header" style={{ marginBottom: 10 }}>
                <textarea className="auth-input" rows={4} maxLength={500} placeholder="A short bio…" value={editBio} onChange={(e) => setEditBio(e.target.value)} />
              </div>
            )}

            {!editMode && targetUser.bio && (
              <div className="profile-header" style={{ marginBottom: 10 }}>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{targetUser.bio}</p>
              </div>
            )}

            <div className="profile-tabs">
              {TAB_KEYS.map((tab) => (
                <button key={tab} className={`profile-tab ${activeTab === tab ? "is-active" : ""}`} onClick={() => setActiveTab(tab)}>
                  {tab[0].toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {activeTab === "about" && (
              <div className="card">
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
                    <div className="profile-stat-val">{connectionCount}</div>
                    <div className="profile-stat-lbl">Connections</div>
                  </div>
                </div>

                {topTags.length > 0 && (
                  <div className="profile-top-tags">
                    <div className="card-title">Specialization</div>
                    <div className="q-tags">
                      {topTags.map((t) => (
                        <span key={t.tag} className="tag">{t.tag} · {t.count}</span>
                      ))}
                    </div>
                  </div>
                )}

                {sharedTopics.length > 0 && (
                  <div className="profile-top-tags">
                    <div className="card-title">Shared interests</div>
                    <div className="q-tags">
                      {sharedTopics.map((t) => (
                        <span key={t} className="tag">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {!isOwner && auth.user && (
                  <ConnectionsSection userId={targetUser.id} />
                )}
              </div>
            )}

            {activeTab !== "about" && (
              <div>
                {items.length === 0 ? (
                  <div className="profile-empty">Nothing here yet.</div>
                ) : (
                  <div className="question-feed">
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

                      let href = `/question/${id}`;
                      if (questionId) href = `/question/${questionId}`;
                      else if (postType === "question" && postId) href = `/question/${postId}`;
                      else if (postType === "answer" && postId) href = `/question/${postId}`;

                      return (
                        <div key={id} className="q-row">
                          <div className="q-main" style={{ minWidth: 0 }}>
                            <div className="q-title-row">
                              <h3 className="q-title">
                                <Link href={href}>{title}</Link>
                              </h3>
                            </div>
                            <div className="q-meta">
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
