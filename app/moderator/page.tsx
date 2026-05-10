"use client";

import { useEffect, useState, useCallback, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { usePermissions } from "@/hooks/usePermissions";
import Navbar from "@/components/Navbar";
import { fmtShortDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase";

const useMounted = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
};

interface ContentItem {
  id: string;
  type: "question" | "answer" | "comment";
  author_id: string;
  body: string;
  title?: string;
  score: number;
  created_at: string;
}

interface ReportItem {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
}

interface WarningItem {
  id: string;
  user_id: string;
  issued_by: string;
  reason: string;
  severity: number;
  acknowledged: boolean;
  created_at: string;
  expires_at: string | null;
}

export default function ModeratorPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const perms = usePermissions();
  const [tab, setTab] = useState<"content" | "reports" | "warnings">("content");
  const [content, setContent] = useState<ContentItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [warnings, setWarnings] = useState<WarningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentType, setContentType] = useState<"question" | "answer" | "comment">("question");
  const mounted = useMounted();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      if (tab === "content") {
        let res;
        if (contentType === "question") {
          res = await supabase.from("questions").select("id,author_id,title,body,score,created_at").order("created_at", { ascending: false }).limit(100);
        } else if (contentType === "answer") {
          res = await supabase.from("answers").select("id,author_id,body,score,created_at").order("created_at", { ascending: false }).limit(100);
        } else {
          res = await supabase.from("comments").select("id,author_id,body,score,created_at").order("created_at", { ascending: false }).limit(100);
        }
        const data = ((res?.data as Record<string, unknown>[]) || []).map((item) => ({ ...item, type: contentType })) as ContentItem[];
        setContent(data);
      } else if (tab === "reports") {
        const { data } = await supabase.from("reports").select("id,target_type,target_id,reason,details,status,created_at").order("created_at", { ascending: false }).limit(200);
        setReports((data as ReportItem[]) || []);
      } else if (tab === "warnings") {
        const { data } = await supabase.from("warnings").select("id,user_id,issued_by,reason,severity,acknowledged,created_at,expires_at").order("created_at", { ascending: false }).limit(200);
        setWarnings((data as WarningItem[]) || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tab, contentType]);

  useEffect(() => {
    if (!user) return;
    if (!perms.canModerate) {
      router.replace("/");
      return;
    }
    startTransition(() => { void loadData(); });
  }, [user, perms.canModerate, tab, contentType, loadData, router]);

  async function softDelete(item: ContentItem) {
    const reason = prompt("Deletion reason?");
    if (!reason) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("soft_delete_content", {
        p_table: item.type + "s",
        p_id: item.id,
        p_deleted_by: profile?.id,
        p_reason: reason,
      });
      if (error) throw error;
      setContent((prev) => prev.filter((c) => c.id !== item.id));
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  async function issueWarning(userId: string) {
    const reason = prompt("Warning reason?");
    if (!reason) return;
    const sevStr = prompt("Severity (1-3):", "1");
    const severity = parseInt(sevStr || "1", 10);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("issue_warning", {
        p_user_id: userId,
        p_reason: reason,
        p_severity: severity,
        p_issued_by: profile?.id,
      });
      if (error) throw error;
      alert("Warning issued");
      loadData();
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  async function suspendUser(userId: string) {
    const reason = prompt("Suspension reason?");
    if (!reason) return;
    const daysStr = prompt("Days:", "7");
    const days = parseInt(daysStr || "7", 10);
    const endsAt = new Date(Date.now() + days * 86400000).toISOString();
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("suspend_user", {
        p_user_id: userId,
        p_reason: reason,
        p_ends_at: endsAt,
        p_issued_by: profile?.id,
      });
      if (error) throw error;
      alert("User suspended");
      loadData();
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  async function resolveReport(reportId: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("reports").update({ status: "resolved", resolved_by: profile?.id, resolved_at: new Date().toISOString() }).eq("id", reportId);
      if (error) throw error;
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status: "resolved" } : r)));
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  async function dismissReport(reportId: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("reports").update({ status: "dismissed", resolved_by: profile?.id, resolved_at: new Date().toISOString() }).eq("id", reportId);
      if (error) throw error;
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status: "dismissed" } : r)));
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <p style={{ color: "var(--text-muted)" }}>Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Navbar />
      <main className="main max-w-6xl mx-auto pt-24 pb-12">
        <div className="feed-head">
          <div>
            <h1 className="feed-title">Moderation Panel</h1>
            <p className="feed-sub">Review content, reports, and warnings.</p>
          </div>
          <div className="editor-tabs">
            {(["content", "reports", "warnings"] as const).map((t) => (
              <button
                key={t}
                className={`editor-tab ${tab === t ? "is-active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {tab === "content" && (
          <>
            <div className="editor-tabs" style={{ marginBottom: "16px" }}>
              {(["question", "answer", "comment"] as const).map((t) => (
                <button
                  key={t}
                  className={`editor-tab ${contentType === t ? "is-active" : ""}`}
                  onClick={() => setContentType(t)}
                >
                  {t[0].toUpperCase() + t.slice(1)}s
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {content.map((item) => (
                <div key={item.id} className="card">
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {item.title && <div className="card-title" style={{ fontSize: "13px", textTransform: "none", letterSpacing: "normal", marginBottom: "4px" }}>{item.title}</div>}
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, lineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.body}</div>
                      <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                        <span>Score {item.score}</span>
                        <span>{fmtShortDate(item.created_at)}</span>
                        <span style={{ color: "var(--primary)" }}>{item.type}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <button className="btn-primary" style={{ height: "32px", padding: "0 10px", fontSize: "12px", background: "var(--danger)" }} onClick={() => softDelete(item)}>
                        Delete
                      </button>
                      <button className="btn-secondary" style={{ height: "32px", padding: "0 10px", fontSize: "12px" }} onClick={() => issueWarning(item.author_id)}>
                        Warn
                      </button>
                      <button className="btn-secondary" style={{ height: "32px", padding: "0 10px", fontSize: "12px" }} onClick={() => suspendUser(item.author_id)}>
                        Suspend
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "reports" && (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="card">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--primary)" }}>{r.target_type}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{r.target_id.slice(0, 12)}</span>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === "open" ? "bg-yellow-50 text-yellow-700" : r.status === "resolved" ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-700"}`}>
                        {r.status}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 500 }}>{r.reason}</div>
                    {r.details && <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>{r.details}</div>}
                    <div style={{ marginTop: "4px", fontSize: "11px", color: "var(--text-muted)" }}>{fmtShortDate(r.created_at)}</div>
                  </div>
                  <div className="admin-row-actions">
                    {r.status === "open" && (
                      <>
                        <button className="btn-primary" style={{ height: "32px", padding: "0 10px", fontSize: "12px" }} onClick={() => resolveReport(r.id)}>
                          Resolve
                        </button>
                        <button className="btn-secondary" style={{ height: "32px", padding: "0 10px", fontSize: "12px" }} onClick={() => dismissReport(r.id)}>
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "warnings" && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Reason</th>
                  <th>Severity</th>
                  <th>Ack</th>
                  <th>Issued</th>
                </tr>
              </thead>
              <tbody>
                {warnings.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <div className="lb-user">
                        <div className="lb-avatar-fallback">
                          {w.user_id?.slice(0, 1)?.toUpperCase() || "?"}
                        </div>
                        <span className="lb-name" style={{ fontFamily: "monospace", fontSize: "11px" }}>{w.user_id?.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td>{w.reason}</td>
                    <td>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${w.severity === 3 ? "bg-red-50 text-red-700" : w.severity === 2 ? "bg-orange-50 text-orange-700" : "bg-yellow-50 text-yellow-700"}`}>
                        {w.severity}
                      </span>
                    </td>
                    <td>{w.acknowledged ? "Yes" : "No"}</td>
                    <td style={{ fontSize: "11px", color: "var(--text-muted)" }}>{fmtShortDate(w.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loading && <div style={{ marginTop: "16px", fontSize: "13px", color: "var(--text-muted)" }}>Loading…</div>}
      </main>
    </div>
  );
}
