"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { usePermissions } from "@/hooks/usePermissions";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import Markdown from "@/components/Markdown";
import { createClient } from "@/lib/supabase";

export default function EditQuestionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const auth = useAuth();
  const perms = usePermissions();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    supabase.from("questions").select("*").eq("id", id).single().then(({ data, error }) => {
      if (error || !data) {
        router.push("/");
        return;
      }
      const isOwner = auth.user?.id === data.author_id;
      if (!isOwner && !perms.canEditAnyContent) {
        router.push(`/question/${id}`);
        return;
      }
      setTitle(data.title || "");
      setBody(data.body || "");
      setTags(data.tags || []);
      setLoading(false);
    });
  }, [id, auth.user, perms.canEditAnyContent, router]);

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (t && !tags.includes(t) && tags.length < 5) setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag));

  const handleSubmit = async () => {
    if (!title.trim() || title.trim().length < 10) { setError("Title must be at least 10 characters."); return; }
    if (!body.trim() || body.trim().length < 20) { setError("Body must be at least 20 characters."); return; }
    if (tags.length === 0) { setError("Add at least one tag."); return; }

    setSubmitting(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from("questions").update({
        title: title.trim(),
        body: body.trim(),
        tags,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (err) throw err;
      router.push(`/question/${id}`);
    } catch (e: any) {
      setError(e.message || "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="app">
        <Navbar />
        <div className="shell">
          <Sidebar />
          <main className="main">
            <div className="skeleton-wrap p-6">
              <div className="skeleton-line skeleton-lg" />
              <div className="skeleton-line skeleton-md" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Navbar />
      <div className="shell">
        <Sidebar />
        <main className="main">
          <div className="feed-head">
            <div className="feed-head-text">
              <h1 className="feed-title">Edit Question</h1>
            </div>
          </div>
          {error && <div className="auth-alert auth-alert-error" role="alert">{error}</div>}
          <div className="settings-form" style={{ maxWidth: 720 }}>
            <div>
              <label className="auth-label">Title</label>
              <input type="text" className="auth-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </div>
            <div>
              <label className="auth-label">Body</label>
              <div className="editor-tabs">
                <button type="button" className={`editor-tab ${!preview ? "is-active" : ""}`} onClick={() => setPreview(false)}>Edit</button>
                <button type="button" className={`editor-tab ${preview ? "is-active" : ""}`} onClick={() => setPreview(true)}>Preview</button>
              </div>
              {preview ? (
                <div className="editor-preview">
                  <Markdown text={body} />
                </div>
              ) : (
                <textarea className="editor-textarea" rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
              )}
            </div>
            <div>
              <label className="auth-label">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((t) => (
                  <span key={t} className="tag is-active flex items-center gap-1">
                    {t}
                    <button type="button" className="text-muted hover:text-danger" onClick={() => removeTag(t)} style={{ marginLeft: 2 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </span>
                ))}
              </div>
              <input type="text" className="auth-input w-full" placeholder="Add tag (Enter)…" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }} />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>{submitting ? "Saving…" : "Save"}</button>
              <button className="btn-secondary" onClick={() => router.push(`/question/${id}`)} type="button">Cancel</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
