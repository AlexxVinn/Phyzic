"use client";

import { useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import RoleBadge from "@/components/RoleBadge";
import Avatar from "@/components/Avatar";
import VoteControls from "@/components/VoteControls";
import Markdown from "@/components/Markdown";
import { useAuth } from "@/components/AuthProvider";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuestion, useVote } from "@/hooks/useQuestions";
import { fmtRep, fmtShortDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { ensureConversation, sendMessage } from "@/lib/messaging";
import type { Comment } from "@/lib/questions";

/* ─── Math Keyboard Data ─── */
const MATH_CATEGORIES = [
  { id: "greek", name: "Greek", icon: "αβγ", symbols: [
    { symbol: "α", label: "alpha" }, { symbol: "β", label: "beta" }, { symbol: "γ", label: "gamma" },
    { symbol: "δ", label: "delta" }, { symbol: "ε", label: "epsilon" }, { symbol: "ζ", label: "zeta" },
    { symbol: "η", label: "eta" }, { symbol: "θ", label: "theta" }, { symbol: "ι", label: "iota" },
    { symbol: "κ", label: "kappa" }, { symbol: "λ", label: "lambda" }, { symbol: "μ", label: "mu" },
    { symbol: "ν", label: "nu" }, { symbol: "ξ", label: "xi" }, { symbol: "π", label: "pi" },
    { symbol: "ρ", label: "rho" }, { symbol: "σ", label: "sigma" }, { symbol: "τ", label: "tau" },
    { symbol: "φ", label: "phi" }, { symbol: "χ", label: "chi" }, { symbol: "ψ", label: "psi" },
    { symbol: "ω", label: "omega" }, { symbol: "Δ", label: "Delta" }, { symbol: "Γ", label: "Gamma" },
    { symbol: "Θ", label: "Theta" }, { symbol: "Λ", label: "Lambda" }, { symbol: "Σ", label: "Sigma" },
    { symbol: "Φ", label: "Phi" }, { symbol: "Ψ", label: "Psi" }, { symbol: "Ω", label: "Omega" },
    { symbol: "∇", label: "nabla" }, { symbol: "∂", label: "partial" }, { symbol: "ℏ", label: "hbar" },
  ]},
  { id: "operators", name: "Operators", icon: "±×÷", symbols: [
    { symbol: "+", label: "plus" }, { symbol: "−", label: "minus" }, { symbol: "×", label: "times" },
    { symbol: "÷", label: "divide" }, { symbol: "±", label: "plusminus" }, { symbol: "=", label: "equals" },
    { symbol: "≠", label: "neq" }, { symbol: "≈", label: "approx" }, { symbol: "≡", label: "equiv" },
    { symbol: "≤", label: "leq" }, { symbol: "≥", label: "geq" }, { symbol: "∝", label: "propto" },
    { symbol: "≪", label: "ll" }, { symbol: "≫", label: "gg" }, { symbol: "∘", label: "compose" },
    { symbol: "!", label: "factorial" }, { symbol: "!!", label: "dfactorial" }, { symbol: "∞", label: "infinity" },
  ]},
  { id: "calculus", name: "Calculus", icon: "∫∑", symbols: [
    { symbol: "∫", label: "integral" }, { symbol: "∬", label: "double int" }, { symbol: "∭", label: "triple int" },
    { symbol: "∮", label: "contour int" }, { symbol: "∑", label: "sum" }, { symbol: "∏", label: "product" },
    { symbol: "lim", label: "limit" }, { symbol: "∂", label: "partial" }, { symbol: "∇", label: "nabla" },
    { symbol: "Δ", label: "Delta" }, { symbol: "dx", label: "dx" }, { symbol: "dy", label: "dy" },
    { symbol: "dz", label: "dz" }, { symbol: "dt", label: "dt" }, { symbol: "dθ", label: "dtheta" },
    { symbol: "dr", label: "dr" }, { symbol: "dV", label: "dV" }, { symbol: "dS", label: "dS" },
  ]},
  { id: "functions", name: "Functions", icon: "f(x)", symbols: [
    { symbol: "sin", label: "sin" }, { symbol: "cos", label: "cos" }, { symbol: "tan", label: "tan" },
    { symbol: "cot", label: "cot" }, { symbol: "sec", label: "sec" }, { symbol: "csc", label: "csc" },
    { symbol: "arcsin", label: "arcsin" }, { symbol: "arccos", label: "arccos" }, { symbol: "arctan", label: "arctan" },
    { symbol: "sinh", label: "sinh" }, { symbol: "cosh", label: "cosh" }, { symbol: "tanh", label: "tanh" },
    { symbol: "log", label: "log" }, { symbol: "ln", label: "ln" }, { symbol: "exp", label: "exp" },
    { symbol: "max", label: "max" }, { symbol: "min", label: "min" }, { symbol: "abs", label: "abs" },
    { symbol: "ceil", label: "ceil" }, { symbol: "floor", label: "floor" }, { symbol: "sign", label: "sign" },
    { symbol: "Re", label: "Re" }, { symbol: "Im", label: "Im" }, { symbol: "arg", label: "arg" },
  ]},
  { id: "physics", name: "Physics", icon: "F=ma", symbols: [
    { symbol: "F", label: "Force" }, { symbol: "E", label: "Energy" }, { symbol: "m", label: "mass" },
    { symbol: "v", label: "velocity" }, { symbol: "a", label: "acceleration" }, { symbol: "p", label: "momentum" },
    { symbol: "λ", label: "wavelength" }, { symbol: "ν", label: "frequency" }, { symbol: "ρ", label: "density" },
    { symbol: "τ", label: "torque" }, { symbol: "ω", label: "angular freq" }, { symbol: "Φ", label: "flux" },
    { symbol: "Ψ", label: "wavefunction" }, { symbol: "ℏ", label: "hbar" }, { symbol: "c", label: "speed of light" },
    { symbol: "G", label: "gravitational" }, { symbol: "g", label: "gravity" }, { symbol: "k_B", label: "Boltzmann" },
    { symbol: "ε₀", label: "permittivity" }, { symbol: "μ₀", label: "permeability" }, { symbol: "σ", label: "Stefan-Boltzmann" },
    { symbol: "T", label: "temperature" }, { symbol: "S", label: "entropy" }, { symbol: "Q", label: "heat" },
  ]},
  { id: "arrows", name: "Arrows", icon: "→⇒", symbols: [
    { symbol: "→", label: "right arrow" }, { symbol: "←", label: "left arrow" }, { symbol: "↔", label: "left-right arrow" },
    { symbol: "⇒", label: "double right" }, { symbol: "⇐", label: "double left" }, { symbol: "⇔", label: "double left-right" },
    { symbol: "↑", label: "up arrow" }, { symbol: "↓", label: "down arrow" }, { symbol: "↗", label: "up-right arrow" },
    { symbol: "↘", label: "down-right arrow" }, { symbol: "↙", label: "down-left arrow" }, { symbol: "↖", label: "up-left arrow" },
    { symbol: "⟶", label: "long right" }, { symbol: "⟵", label: "long left" }, { symbol: "⟷", label: "long left-right" },
    { symbol: "↦", label: "maps to" }, { symbol: "⇀", label: "right harpoon" }, { symbol: "⇁", label: "left harpoon" },
  ]},
  { id: "sets", name: "Sets", icon: "∈⊂", symbols: [
    { symbol: "∈", label: "in" }, { symbol: "∉", label: "not in" }, { symbol: "⊂", label: "subset" },
    { symbol: "⊃", label: "superset" }, { symbol: "⊆", label: "subset eq" }, { symbol: "⊇", label: "superset eq" },
    { symbol: "∪", label: "union" }, { symbol: "∩", label: "intersection" }, { symbol: "∅", label: "empty set" },
    { symbol: "ℝ", label: "reals" }, { symbol: "ℂ", label: "complex" }, { symbol: "ℤ", label: "integers" },
    { symbol: "ℕ", label: "naturals" }, { symbol: "ℚ", label: "rationals" }, { symbol: "∀", label: "for all" },
    { symbol: "∃", label: "exists" }, { symbol: "∄", label: "not exists" }, { symbol: "∴", label: "therefore" },
    { symbol: "∵", label: "because" }, { symbol: "⊥", label: "perp" }, { symbol: "∥", label: "parallel" },
    { symbol: "∠", label: "angle" }, { symbol: "°", label: "degree" }, { symbol: "¬", label: "not" },
  ]},
  { id: "templates", name: "Templates", icon: "{ }", symbols: [
    { symbol: "\\frac{}{}", label: "fraction" }, { symbol: "\\sqrt{}", label: "sqrt" }, { symbol: "\\sqrt[]{}", label: "nth root" },
    { symbol: "^{}", label: "superscript" }, { symbol: "_{}", label: "subscript" }, { symbol: "^{}_{}", label: "super+sub" },
    { symbol: "\\binom{}{}", label: "binomial" }, { symbol: "\\hat{}", label: "hat" }, { symbol: "\\vec{}", label: "vec" },
    { symbol: "\\bar{}", label: "bar" }, { symbol: "\\dot{}", label: "dot" }, { symbol: "\\ddot{}", label: "ddot" },
    { symbol: "\\tilde{}", label: "tilde" }, { symbol: "\\widehat{}", label: "wide hat" }, { symbol: "\\overline{}", label: "overline" },
    { symbol: "\\underline{}", label: "underline" }, { symbol: "\\overrightarrow{}", label: "right arrow over" }, { symbol: "\\mathbf{}", label: "bold math" },
  ]},
];

/* ─── Comment Item ─── */
function CommentItem({ comment, onDelete }: { comment: Comment; onDelete?: () => void }) {
  const auth = useAuth();
  const perms = usePermissions();
  const isOwner = auth.user?.id === comment.author_id;
  const canDelete = isOwner || perms.canDeleteAnyContent;
  const author = comment.author;
  const name = author?.full_name || author?.username || "User";

  return (
    <div className="comment-item">
      <div className="comment-body"><Markdown text={comment.body || ""} /></div>
      <div className="comment-head">
        <Avatar url={author?.avatar_url || null} name={name} size={16} />
        <span className="comment-author">{name}</span>
        {author?.role && author.role !== "user" && <RoleBadge role={author.role} size="sm" />}
        <span className="comment-date">{fmtShortDate(comment.created_at)}</span>
        {canDelete && (
          <button className="comment-action" onClick={onDelete} type="button">delete</button>
        )}
      </div>
    </div>
  );
}

/* ─── Report Button ─── */
function ReportButton({ targetType, targetId }: { targetType: string; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("other");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const auth = useAuth();

  const handleSubmit = async () => {
    if (!auth.user) return;
    setSending(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.from("reports").insert({
        reporter_id: auth.user.id,
        target_type: targetType,
        target_id: targetId,
        reason: reason as any,
        details: details || null,
      });
      if (error) throw error;
      setOpen(false);
      setDetails("");
      alert("Report submitted.");
    } catch (e: any) {
      alert(e.message || "Failed to submit report");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button type="button" className="qd-action-link" onClick={() => setOpen((v) => !v)}>Report</button>
      <div className={`report-dropdown ${open ? "is-open" : ""}`}>
        <div className="text-xs font-semibold mb-2">Report content</div>
        <select className="auth-input w-full text-xs mb-2" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="spam">Spam</option>
          <option value="harassment">Harassment</option>
          <option value="misinformation">Misinformation</option>
          <option value="off_topic">Off topic</option>
          <option value="duplicate">Duplicate</option>
          <option value="low_quality">Low quality</option>
          <option value="other">Other</option>
        </select>
        <textarea className="auth-input w-full text-xs mb-2" rows={2} placeholder="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
        <div className="flex gap-2 justify-end">
          <button type="button" className="text-xs" style={{ color: "var(--text-muted)" }} onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="text-xs font-semibold" style={{ color: "var(--danger)" }} onClick={handleSubmit} disabled={sending}>{sending ? "…" : "Submit"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Formula Keyboard ─── */
function FormulaKeyboard({ onInsert, visible }: { onInsert: (sym: string) => void; visible: boolean }) {
  const [activeCategory, setActiveCategory] = useState("greek");
  if (!visible) return null;
  const category = MATH_CATEGORIES.find((c) => c.id === activeCategory) || MATH_CATEGORIES[0];
  return (
    <div className="fk-panel" style={{ marginBottom: 0, borderRadius: 0, borderLeft: "none", borderRight: "none" }}>
      <div className="fk-tabs">
        {MATH_CATEGORIES.map((cat) => (
          <button key={cat.id} type="button" className={`fk-tab ${activeCategory === cat.id ? "is-active" : ""}`} onClick={() => setActiveCategory(cat.id)}>
            <span style={{ fontSize: 10, marginRight: 3 }}>{cat.icon}</span> {cat.name}
          </button>
        ))}
      </div>
      <div className="fk-grid">
        {category.symbols.map((s) => (
          <button key={s.label} type="button" className="fk-key" onClick={() => onInsert(s.symbol)} title={s.label}>
            <span className="fk-key-symbol">{s.symbol}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function QuestionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const auth = useAuth();
  const perms = usePermissions();
  const {
    question, answers, comments, answerComments, userVotes, setUserVotes,
    loading, error, refresh, addAnswer, removeAnswer, addComment, removeComment,
  } = useQuestion(id);
  const { vote, unvote } = useVote();

  const [answerBody, setAnswerBody] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [answerCommentBodies, setAnswerCommentBodies] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [editingAnswer, setEditingAnswer] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");
  const [mathKeyboardOpen, setMathKeyboardOpen] = useState(false);
  const answerTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleVote = useCallback(async (type: "question" | "answer", targetId: string, value: 1 | -1) => {
    if (!auth.user) { router.push("/login"); return; }
    const key = `${type}:${targetId}`;
    const current = userVotes[key] || 0;
    try {
      if (current === value) {
        await unvote(type, targetId);
        setUserVotes((prev) => ({ ...prev, [key]: 0 }));
      } else {
        if (current !== 0) await unvote(type, targetId);
        await vote(type, targetId, value);
        setUserVotes((prev) => ({ ...prev, [key]: value }));
      }
      refresh();
    } catch (e: unknown) { alert((e as Error).message); }
  }, [auth.user, router, vote, unvote, userVotes, setUserVotes, refresh]);

  const handleSubmitAnswer = async () => {
    if (!auth.user || !question || !answerBody.trim()) return;
    if (!perms.canPost) { alert("You cannot post right now."); return; }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.from("answers").insert({
        question_id: question.id, author_id: auth.user.id, body: answerBody.trim(),
      }).select().single();
      if (err) throw err;
      addAnswer({ ...data, author: auth.profile } as unknown as import("@/lib/questions").Answer);
      setAnswerBody("");
      setEditorTab("write");
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setSubmitting(false); }
  };

  const handleSubmitComment = async (parentType: "question" | "answer", parentId: string, body: string) => {
    if (!auth.user || !question || !body.trim()) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.from("comments").insert({
        parent_type: parentType, parent_id: parentId, author_id: auth.user.id, body: body.trim(),
      }).select().single();
      if (err) throw err;
      addComment({ ...data, author: auth.profile } as unknown as Comment);
      if (parentType === "answer") setAnswerCommentBodies((prev) => ({ ...prev, [parentId]: "" }));
      else setCommentBody("");
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setSubmitting(false); }
  };

  const handleDeleteComment = async (commentId: string, parentType: "question" | "answer", parentId: string) => {
    if (!confirm("Delete this comment?")) return;
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from("comments").delete().eq("id", commentId);
      if (err) throw err;
      removeComment(commentId, parentType, parentId);
    } catch (e: unknown) { alert((e as Error).message); }
  };

  const handleDeleteAnswer = async (answerId: string) => {
    if (!confirm("Delete this answer?")) return;
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from("answers").delete().eq("id", answerId);
      if (err) throw err;
      removeAnswer(answerId);
    } catch (e: unknown) { alert((e as Error).message); }
  };

  const handleEditAnswer = async (answerId: string) => {
    if (!editBody.trim()) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from("answers").update({ body: editBody.trim(), updated_at: new Date().toISOString() }).eq("id", answerId);
      if (err) throw err;
      setEditingAnswer(null);
      refresh();
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setSubmitting(false); }
  };

  const handleAcceptAnswer = async (answerId: string) => {
    if (!question || !perms.canEditAnyContent && auth.user?.id !== question.author_id) return;
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from("questions").update({ solved: true }).eq("id", question.id);
      if (err) throw err;
      const { error: err2 } = await supabase.from("answers").update({ accepted: false }).eq("question_id", question.id);
      if (err2) throw err2;
      const { error: err3 } = await supabase.from("answers").update({ accepted: true }).eq("id", answerId);
      if (err3) throw err3;
      refresh();
    } catch (e: unknown) { alert((e as Error).message); }
  };

  const insertMathSymbol = useCallback((sym: string) => {
    const textarea = answerTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = answerBody.slice(0, start);
    const after = answerBody.slice(end);
    const insertStr = `$${sym}$`;
    const newBody = before + insertStr + after;
    setAnswerBody(newBody);
    requestAnimationFrame(() => {
      const cursorPos = start + insertStr.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
      textarea.focus();
    });
  }, [answerBody]);

  if (loading && !question) {
    return (
      <div className="app">
        <Navbar />
        <div className="shell shell-no-right">
          <Sidebar />
          <main className="main">
            <div className="skeleton-wrap p-6">
              <div className="skeleton-line skeleton-lg" style={{ width: "70%" }} />
              <div className="skeleton-line skeleton-md" style={{ width: "90%" }} />
              <div className="skeleton-line" style={{ width: "50%" }} />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="app">
        <Navbar />
        <div className="shell shell-no-right">
          <Sidebar />
          <main className="main">
            <div className="p-6 text-sm text-muted">
              {error || "Question not found."}
              <button className="ml-2 underline font-medium" onClick={refresh}>Retry</button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const qAuthor = question.author;
  const qName = qAuthor?.full_name || qAuthor?.username || "User";
  const isOwner = auth.user?.id === question.author_id;
  const canEdit = isOwner || perms.canEditAnyContent;
  const canDelete = isOwner || perms.canDeleteAnyContent;

  return (
    <div className="app">
      <Navbar />
      <div className="shell shell-no-right">
        <Sidebar />
        <main className="main">
          <div className="question-detail">
            {/* ─── Question ─── */}
            <div className="qd-question">
              <div className="qd-layout">
                <VoteControls
                  score={question.score}
                  userVote={userVotes[`question:${question.id}`] || 0}
                  onVote={(v) => handleVote("question", question.id, v)}
                  size="lg"
                />
                <div className="qd-content">
                  <div className="qd-head">
                    <h1 className="qd-title">{question.title}</h1>
                    <div className="qd-actions">
                      {canEdit && (
                        <Link href={`/question/${question.id}/edit`} className="qd-action-link">edit</Link>
                      )}
                      {canDelete && (
                        <button className="qd-action-link qd-action-danger" onClick={async () => {
                          if (!confirm("Delete this question?")) return;
                          const supabase = createClient();
                          await supabase.from("questions").delete().eq("id", question.id);
                          router.push("/");
                        }}>delete</button>
                      )}
                    </div>
                  </div>

                  <div className="qd-meta">
                    <span className="qd-meta-item">Asked {fmtShortDate(question.created_at)}</span>
                    <span className="qd-meta-dot" />
                    <span className="qd-meta-item">{question.view_count} views</span>
                    <span className="qd-meta-dot" />
                    <span className="qd-meta-item">{question.answer_count} {question.answer_count === 1 ? "answer" : "answers"}</span>
                    {question.solved && <><span className="qd-meta-dot" /><span className="qd-solved-badge">Solved</span></>}
                  </div>

                  <div className="qd-body">
                    <Markdown text={question.body || ""} />
                  </div>

                  <div className="qd-footer">
                    <div className="qd-tags">
                      {question.tags.map((t) => (
                        <Link key={t} href={`/?tag=${encodeURIComponent(t)}`} className="qd-tag">{t}</Link>
                      ))}
                    </div>
                    <div className="qd-author-card">
                      <div className="qd-author-label">asked {fmtShortDate(question.created_at)}</div>
                      <div className="qd-author-row">
                        <Avatar url={qAuthor?.avatar_url || null} name={qName} size={24} />
                        <Link href={`/profile?u=${encodeURIComponent(qAuthor?.username || "")}`} className="qd-author-name">{qName}</Link>
                        {qAuthor?.role && qAuthor.role !== "user" && <RoleBadge role={qAuthor.role} size="sm" />}
                        <span className="qd-author-rep">{fmtRep(qAuthor?.reputation || 0)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="qd-comments">
                    {comments.map((c) => (
                      <CommentItem key={c.id} comment={c} onDelete={() => handleDeleteComment(c.id, "question", question.id)} />
                    ))}
                    {auth.user && (
                      <div className="qd-comment-form">
                        <input
                          type="text"
                          className="qd-comment-input"
                          placeholder="Add a comment…"
                          value={commentBody}
                          onChange={(e) => setCommentBody(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmitComment("question", question.id, commentBody); }}}
                        />
                        <button className="qd-comment-btn" onClick={() => handleSubmitComment("question", question.id, commentBody)} disabled={submitting || !commentBody.trim()}>Post</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Answers ─── */}
            <div className="qd-answers">
              <h2 className="qd-answers-title">{answers.length} {answers.length === 1 ? "Answer" : "Answers"}</h2>

              {answers.map((a) => {
                const aAuthor = a.author;
                const aName = aAuthor?.full_name || aAuthor?.username || "User";
                const aIsOwner = auth.user?.id === a.author_id;
                const aCanEdit = aIsOwner || perms.canEditAnyContent;
                const aCanDelete = aIsOwner || perms.canDeleteAnyContent;
                const aComments = answerComments[a.id] || [];

                return (
                  <div key={a.id} className={`qd-answer ${a.accepted ? "is-accepted" : ""}`}>
                    <div className="qd-layout">
                      <VoteControls
                        score={a.score}
                        userVote={userVotes[`answer:${a.id}`] || 0}
                        onVote={(v) => handleVote("answer", a.id, v)}
                        size="md"
                      />
                      <div className="qd-content">
                        {a.accepted && (
                          <div className="qd-accepted-banner">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            Accepted answer
                          </div>
                        )}

                        {editingAnswer === a.id ? (
                          <div className="qd-edit-block">
                            <textarea className="editor-textarea" rows={6} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                            <div className="qd-edit-actions">
                              <button className="btn-primary" onClick={() => handleEditAnswer(a.id)} disabled={submitting}>Save</button>
                              <button className="btn-secondary" onClick={() => setEditingAnswer(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="qd-body">
                            <Markdown text={a.body || ""} />
                          </div>
                        )}

                        <div className="qd-footer">
                          <div className="qd-answer-actions">
                            {(isOwner || perms.canEditAnyContent) && !a.accepted && (
                              <button className="qd-action-link" onClick={() => handleAcceptAnswer(a.id)}>accept</button>
                            )}
                            {aCanEdit && (
                              <button className="qd-action-link" onClick={() => { setEditingAnswer(a.id); setEditBody(a.body); }}>edit</button>
                            )}
                            {aCanDelete && (
                              <button className="qd-action-link qd-action-danger" onClick={() => handleDeleteAnswer(a.id)}>delete</button>
                            )}
                            {auth.user && !aIsOwner && a.author_id && (
                              <button className="qd-action-link" onClick={async () => {
                                try {
                                  const convId = await ensureConversation(a.author_id);
                                  await sendMessage(convId, `Discussing answer on: ${question.title}`, { question_id: question.id });
                                  router.push(`/messages?c=${convId}`);
                                } catch (e: unknown) { alert((e as Error).message); }
                              }}>message</button>
                            )}
                            <ReportButton targetType="answer" targetId={a.id} />
                          </div>
                          <div className="qd-author-card qd-author-card-answer">
                            <div className="qd-author-label">answered {fmtShortDate(a.created_at)}</div>
                            <div className="qd-author-row">
                              <Avatar url={aAuthor?.avatar_url || null} name={aName} size={20} />
                              <Link href={`/profile?u=${encodeURIComponent(aAuthor?.username || "")}`} className="qd-author-name">{aName}</Link>
                              {aAuthor?.role && aAuthor.role !== "user" && <RoleBadge role={aAuthor.role} size="sm" />}
                              <span className="qd-author-rep">{fmtRep(aAuthor?.reputation || 0)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="qd-comments">
                          {aComments.map((c) => (
                            <CommentItem key={c.id} comment={c} onDelete={() => handleDeleteComment(c.id, "answer", a.id)} />
                          ))}
                          {auth.user && (
                            <div className="qd-comment-form">
                              <input
                                type="text"
                                className="qd-comment-input"
                                placeholder="Add a comment…"
                                value={answerCommentBodies[a.id] || ""}
                                onChange={(e) => setAnswerCommentBodies((prev) => ({ ...prev, [a.id]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmitComment("answer", a.id, answerCommentBodies[a.id] || ""); }}}
                              />
                              <button className="qd-comment-btn" onClick={() => handleSubmitComment("answer", a.id, answerCommentBodies[a.id] || "")} disabled={submitting || !(answerCommentBodies[a.id]?.trim())}>Post</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ─── Write Answer ─── */}
            {auth.user ? (
              <div className="qd-write-answer">
                <div className="qd-write-header">
                  <h3 className="qd-write-title">Your Answer</h3>
                  <button
                    type="button"
                    className={`qd-math-toggle ${mathKeyboardOpen ? "is-active" : ""}`}
                    onClick={() => setMathKeyboardOpen((v) => !v)}
                  >
                    ∑ Math
                  </button>
                </div>

                <div className="qd-editor-toolbar">
                  <div className="qd-toolbar-left">
                    <div className="qd-editor-tabs">
                      <button type="button" className={`qd-editor-tab ${editorTab === "write" ? "is-active" : ""}`} onClick={() => setEditorTab("write")}>Write</button>
                      <button type="button" className={`qd-editor-tab ${editorTab === "preview" ? "is-active" : ""}`} onClick={() => setEditorTab("preview")}>Preview</button>
                    </div>
                    <div className="qd-toolbar-divider" />
                    <button type="button" className="qd-toolbar-btn" onClick={() => insertMathSymbol("\\frac{}{}")}>
                      <span className="ask-toolbar-btn-icon">a/b</span>
                    </button>
                    <button type="button" className="qd-toolbar-btn" onClick={() => insertMathSymbol("\\sqrt{}")}>
                      <span className="ask-toolbar-btn-icon">√</span>
                    </button>
                    <button type="button" className="qd-toolbar-btn" onClick={() => insertMathSymbol("^{}")}>
                      <span className="ask-toolbar-btn-icon">xⁿ</span>
                    </button>
                    <button type="button" className="qd-toolbar-btn" onClick={() => insertMathSymbol("_{}")}>
                      <span className="ask-toolbar-btn-icon">xₙ</span>
                    </button>
                    <button type="button" className="qd-toolbar-btn" onClick={() => insertMathSymbol("\\vec{}")}>
                      <span className="ask-toolbar-btn-icon">v⃗</span>
                    </button>
                  </div>
                  <div className="qd-toolbar-right">
                    <button
                      type="button"
                      className={`qd-math-toggle ${mathKeyboardOpen ? "is-active" : ""}`}
                      onClick={() => setMathKeyboardOpen((v) => !v)}
                    >
                      ∑ Formula Keyboard
                    </button>
                  </div>
                </div>

                <FormulaKeyboard visible={mathKeyboardOpen} onInsert={insertMathSymbol} />

                {!perms.canPost && (
                  <div className="auth-alert auth-alert-error" role="alert" style={{ margin: "10px 16px" }}>You cannot post right now.</div>
                )}

                {editorTab === "write" ? (
                  <textarea
                    ref={answerTextareaRef}
                    className="editor-textarea"
                    rows={8}
                    placeholder="Write your answer using Markdown and LaTeX ($...$ for inline, $$...$$ for display equations)."
                    value={answerBody}
                    onChange={(e) => setAnswerBody(e.target.value)}
                    disabled={!perms.canPost}
                  />
                ) : (
                  <div className="qd-editor-preview">
                    {answerBody.trim() ? (
                      <Markdown text={answerBody} />
                    ) : (
                      <div className="qd-preview-empty"><p>Nothing to preview</p></div>
                    )}
                  </div>
                )}

                <div className="qd-write-footer">
                  <span className="qd-write-hint">Supports Markdown + LaTeX</span>
                  <div className="flex items-center gap-2">
                    <ReportButton targetType="question" targetId={question.id} />
                    <button
                      className="btn-primary"
                      onClick={handleSubmitAnswer}
                      disabled={submitting || !answerBody.trim() || !perms.canPost}
                    >
                      {submitting ? "Posting…" : "Post answer"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="qd-signin-prompt">
                <p className="text-muted" style={{ marginBottom: 12 }}>Sign in to answer this question.</p>
                <Link href="/login" className="btn-primary">Sign in</Link>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Floating math button */}
      {auth.user && (
        <button
          type="button"
          className="qd-float-math"
          onClick={() => setMathKeyboardOpen((v) => !v)}
          title="Formula keyboard"
        >
          ∑
        </button>
      )}
    </div>
  );
}
