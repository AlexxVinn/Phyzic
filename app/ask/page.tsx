"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { usePermissions } from "@/hooks/usePermissions";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import Markdown from "@/components/Markdown";
import { createClient } from "@/lib/supabase";

const useMounted = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
};

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

const QUESTION_TYPES = [
  { value: "conceptual", label: "Conceptual" },
  { value: "calculation", label: "Calculation" },
  { value: "proof", label: "Proof / Derivation" },
  { value: "experimental", label: "Experimental" },
  { value: "resource", label: "Resource Request" },
];

const DIFFICULTY_LEVELS = [
  { value: "introductory", label: "Introductory" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "research", label: "Research-level" },
];

const POPULAR_TAGS = [
  "classical-mechanics", "quantum-mechanics", "electromagnetism",
  "thermodynamics", "relativity", "statistical-mechanics",
  "optics", "fluid-dynamics", "solid-state", "nuclear-physics",
];

function getLocalDraft(): { title: string; body: string; tags: string[] } {
  try {
    const raw = localStorage.getItem("phyzic_draft_question");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { title: "", body: "", tags: [] };
}

export default function AskPage() {
  const router = useRouter();
  const auth = useAuth();
  const perms = usePermissions();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [draftSaved, setDraftSaved] = useState(false);
  const [mathKeyboardOpen, setMathKeyboardOpen] = useState(false);
  const [activeMathCategory, setActiveMathCategory] = useState("greek");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [questionType, setQuestionType] = useState("conceptual");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [visibility, setVisibility] = useState("public");
  const [allowComments, setAllowComments] = useState(true);
  const [bountyEnabled, setBountyEnabled] = useState(false);
  const [bountyAmount, setBountyAmount] = useState(50);
  const [canonicalQuestion, setCanonicalQuestion] = useState(false);
  const [notifyFollowers, setNotifyFollowers] = useState(true);
  const [relatedSubject, setRelatedSubject] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const mounted = useMounted();

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      router.push("/login");
    }
  }, [auth.loading, auth.user, router]);

  useEffect(() => {
    if (!auth.user) return;
    const local = getLocalDraft();
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase
          .from("drafts")
          .select("title,body,tags")
          .eq("user_id", auth.user!.id)
          .eq("draft_type", "question")
          .maybeSingle();
        if (data) {
          setTitle(data.title || local.title || "");
          setBody(data.body || local.body || "");
          setTags(data.tags || local.tags || []);
        } else {
          setTitle(local.title);
          setBody(local.body);
          setTags(local.tags);
        }
      } catch {
        setTitle(local.title);
        setBody(local.body);
        setTags(local.tags);
      }
    })();
  }, [auth.user]);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("tags").select("name").order("question_count", { ascending: false }).limit(100).then(({ data }) => {
      setAllTags((data || []).map((t: { name: string }) => t.name));
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => {
      localStorage.setItem("phyzic_draft_question", JSON.stringify({ title, body, tags }));
      if (auth.user) {
        const supabase = createClient();
        (async () => {
          try {
            await supabase.from("drafts").upsert({
              user_id: auth.user!.id,
              draft_type: "question",
              title,
              body,
              tags,
            }, { onConflict: "user_id,draft_type,parent_id" });
            setDraftSaved(true);
            setTimeout(() => setDraftSaved(false), 2000);
          } catch {}
        })();
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [title, body, tags, auth.user, mounted]);

  const addTag = useCallback((tag: string) => {
    const t = tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags((prev) => [...prev, t]);
    }
    setTagInput("");
    setShowTagSuggestions(false);
  }, [tags]);

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag));

  const insertSymbol = (symbol: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const before = body.slice(0, cursorPosition);
    const after = body.slice(cursorPosition);
    const newBody = before + symbol + after;
    setBody(newBody);
    const newCursorPos = cursorPosition + symbol.length;
    setCursorPosition(newCursorPos);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const insertMathDelimiter = (delimiter: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.slice(start, end);
    const before = body.slice(0, start);
    const after = body.slice(end);
    const newBody = before + delimiter + selectedText + delimiter + after;
    setBody(newBody);
    const newCursorPos = start + delimiter.length + selectedText.length + delimiter.length;
    setCursorPosition(newCursorPos);

    setTimeout(() => {
      textarea.focus();
      if (!selectedText) {
        textarea.setSelectionRange(start + delimiter.length, start + delimiter.length);
      } else {
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleSubmit = async () => {
    if (!auth.user) return;
    if (!perms.canPost) { setError("You cannot post right now."); return; }
    if (!title.trim() || title.trim().length < 10) { setError("Title must be at least 10 characters."); return; }
    if (!body.trim() || body.trim().length < 20) { setError("Body must be at least 20 characters."); return; }
    if (tags.length === 0) { setError("Add at least one tag."); return; }

    setSubmitting(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.from("questions").insert({
        author_id: auth.user.id,
        title: title.trim(),
        body: body.trim(),
        tags,
      }).select().single();
      if (err) throw err;
      localStorage.removeItem("phyzic_draft_question");
      await supabase.from("drafts").delete().eq("user_id", auth.user.id).eq("draft_type", "question");
      router.push(`/question/${data.id}`);
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to post question");
    } finally {
      setSubmitting(false);
    }
  };

  const suggestions = tagInput.trim()
    ? allTags.filter((t) => t.includes(tagInput.trim().toLowerCase()) && !tags.includes(t)).slice(0, 8)
    : [];

  const activeCategoryData = MATH_CATEGORIES.find(cat => cat.id === activeMathCategory);

  if (!mounted) {
    return (
      <div className="app">
        <Navbar />
        <div className="shell">
          <Sidebar />
          <main className="main">
            <div className="skeleton-wrap p-6">
              <div className="skeleton-line skeleton-lg" style={{ width: "60%" }} />
              <div className="skeleton-line skeleton-md" style={{ width: "90%" }} />
              <div className="skeleton-line" style={{ width: "40%" }} />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Navbar />
      <div className="shell shell-no-right">
        <Sidebar />
        <main className="main">
          <div className="ask-page">
            {/* ─── Page Header ─── */}
            <div className="ask-header">
              <div className="ask-header-left">
                <h1 className="ask-title">Ask a Question</h1>
                <p className="ask-subtitle">Be specific. Include equations. Check for duplicates first.</p>
              </div>
              <div className="ask-header-right">
                {draftSaved && (
                  <span className="ask-draft-indicator">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                    Draft saved
                  </span>
                )}
              </div>
            </div>

            {error && <div className="ask-error" role="alert">{error}</div>}

            {/* ─── Two-Column Layout ─── */}
            <div className="ask-layout">
              {/* ─── Main Column ─── */}
              <div className="ask-main">
                {/* Title */}
                <div className="ask-section">
                  <input
                    type="text"
                    className="ask-title-input"
                    placeholder="What's your physics question? Be specific."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                  />
                  <div className="ask-title-meta">
                    <span className="ask-char-count">{title.length}/200</span>
                  </div>
                </div>

                {/* Editor Toolbar */}
                <div className="ask-editor-section">
                  <div className="ask-editor-toolbar">
                    <div className="ask-toolbar-left">
                      <div className="ask-editor-tabs">
                        <button
                          type="button"
                          className={`ask-editor-tab ${!preview ? "is-active" : ""}`}
                          onClick={() => setPreview(false)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Write
                        </button>
                        <button
                          type="button"
                          className={`ask-editor-tab ${preview ? "is-active" : ""}`}
                          onClick={() => setPreview(true)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          Preview
                        </button>
                      </div>
                    </div>
                    <div className="ask-toolbar-right">
                      <button
                        type="button"
                        className="ask-toolbar-btn"
                        onClick={() => insertMathDelimiter("$")}
                        title="Inline math ($...$)"
                      >
                        <span className="ask-toolbar-btn-icon">∑</span>
                        <span className="ask-toolbar-btn-label">Inline</span>
                      </button>
                      <button
                        type="button"
                        className="ask-toolbar-btn"
                        onClick={() => insertMathDelimiter("$$")}
                        title="Display math ($$...$$)"
                      >
                        <span className="ask-toolbar-btn-icon">∫</span>
                        <span className="ask-toolbar-btn-label">Display</span>
                      </button>
                      <div className="ask-toolbar-divider" />
                      <button
                        type="button"
                        className={`ask-math-keyboard-toggle ${mathKeyboardOpen ? "is-active" : ""}`}
                        onClick={() => setMathKeyboardOpen(!mathKeyboardOpen)}
                        title="Math keyboard"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="6" width="20" height="12" rx="2"/>
                          <path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h.01M12 16h.01M16 16h.01M6 8h12"/>
                        </svg>
                        <span>f(x)</span>
                      </button>
                    </div>
                  </div>

                  {/* Editor Content */}
                  {preview ? (
                    <div className="ask-editor-preview">
                      {body.trim() ? (
                        <Markdown text={body} />
                      ) : (
                        <div className="ask-preview-empty">
                          <p>Nothing to preview yet. Start writing your question.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="ask-editor-wrap">
                      <textarea
                        ref={textareaRef}
                        className="ask-editor-textarea"
                        placeholder="Explain your question in detail.&#10;&#10;Use **bold**, *italic*, `code`, and LaTeX for equations.&#10;Inline math: $E = mc^2$ · Display math: $$\int_0^\infty e^{-x^2} dx$$"
                        value={body}
                        onChange={(e) => { setBody(e.target.value); setCursorPosition((e.target as HTMLTextAreaElement).selectionStart || 0); }}
                        onSelect={(e) => setCursorPosition((e.target as HTMLTextAreaElement).selectionStart || 0)}
                      />
                      <div className="ask-editor-footer">
                        <span className="ask-editor-hint">
                          Markdown + LaTeX supported
                        </span>
                        <span className="ask-char-count">{body.length} chars</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="ask-section">
                  <label className="ask-label">Tags</label>
                  <div className="ask-tags-area">
                    {tags.length > 0 && (
                      <div className="ask-tags-list">
                        {tags.map((t) => (
                          <span key={t} className="ask-tag-chip">
                            {t}
                            <button type="button" className="ask-tag-remove" onClick={() => removeTag(t)}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="ask-tag-input-wrap">
                      <input
                        ref={tagInputRef}
                        type="text"
                        className="ask-tag-input"
                        placeholder={tags.length === 0 ? "Add at least one tag…" : "Add another tag…"}
                        value={tagInput}
                        onChange={(e) => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                        onFocus={() => setShowTagSuggestions(true)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
                      />
                      {showTagSuggestions && suggestions.length > 0 && (
                        <div className="ask-tag-suggestions">
                          {suggestions.map((s) => (
                            <button key={s} type="button" className="ask-tag-suggestion" onClick={() => addTag(s)}>
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {tags.length === 0 && (
                    <div className="ask-popular-tags">
                      <span className="ask-popular-tags-label">Popular:</span>
                      {POPULAR_TAGS.filter(t => !tags.includes(t)).slice(0, 6).map((t) => (
                        <button key={t} type="button" className="ask-popular-tag" onClick={() => addTag(t)}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="ask-tag-meta">
                    {tags.length}/5 tags · lowercase, numbers, hyphens only
                  </div>
                </div>

                {/* Actions */}
                <div className="ask-actions">
                  <button className="ask-btn-primary" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? (
                      <>
                        <span className="ask-spinner" />
                        Posting…
                      </>
                    ) : "Post question"}
                  </button>
                  <button className="ask-btn-secondary" onClick={() => router.push("/")} type="button">
                    Cancel
                  </button>
                </div>
              </div>

              {/* ─── Right Sidebar ─── */}
              <aside className="ask-sidebar">
                {/* Question Type */}
                <div className="ask-sidebar-section">
                  <div className="ask-sidebar-heading">Question type</div>
                  <div className="ask-sidebar-options">
                    {QUESTION_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        className={`ask-sidebar-option ${questionType === type.value ? "is-active" : ""}`}
                        onClick={() => setQuestionType(type.value)}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="ask-sidebar-section">
                  <div className="ask-sidebar-heading">Difficulty</div>
                  <div className="ask-sidebar-options ask-difficulty-options">
                    {DIFFICULTY_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        className={`ask-sidebar-option ask-difficulty-${level.value} ${difficulty === level.value ? "is-active" : ""}`}
                        onClick={() => setDifficulty(level.value)}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visibility */}
                <div className="ask-sidebar-section">
                  <div className="ask-sidebar-heading">Visibility</div>
                  <div className="ask-sidebar-options">
                    <button
                      type="button"
                      className={`ask-sidebar-option ${visibility === "public" ? "is-active" : ""}`}
                      onClick={() => setVisibility("public")}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      Public
                    </button>
                    <button
                      type="button"
                      className={`ask-sidebar-option ${visibility === "private" ? "is-active" : ""}`}
                      onClick={() => setVisibility("private")}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Private
                    </button>
                  </div>
                </div>

                {/* Toggles */}
                <div className="ask-sidebar-section">
                  <div className="ask-sidebar-heading">Options</div>
                  <div className="ask-sidebar-toggles">
                    <label className="ask-toggle-row">
                      <span className="ask-toggle-info">
                        <span className="ask-toggle-name">Allow comments</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={allowComments}
                        className={`ask-toggle-switch ${allowComments ? "is-on" : ""}`}
                        onClick={() => setAllowComments(!allowComments)}
                      />
                    </label>
                    <label className="ask-toggle-row">
                      <span className="ask-toggle-info">
                        <span className="ask-toggle-name">Bounty / Reward</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={bountyEnabled}
                        className={`ask-toggle-switch ${bountyEnabled ? "is-on" : ""}`}
                        onClick={() => setBountyEnabled(!bountyEnabled)}
                      />
                    </label>
                    {bountyEnabled && (
                      <div className="ask-bounty-amount">
                        <input
                          type="number"
                          className="ask-bounty-input"
                          value={bountyAmount}
                          onChange={(e) => setBountyAmount(Math.max(50, parseInt(e.target.value) || 50))}
                          min={50}
                          max={500}
                          step={50}
                        />
                        <span className="ask-bounty-label">reputation</span>
                      </div>
                    )}
                    <label className="ask-toggle-row">
                      <span className="ask-toggle-info">
                        <span className="ask-toggle-name">Canonical question</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={canonicalQuestion}
                        className={`ask-toggle-switch ${canonicalQuestion ? "is-on" : ""}`}
                        onClick={() => setCanonicalQuestion(!canonicalQuestion)}
                      />
                    </label>
                    <label className="ask-toggle-row">
                      <span className="ask-toggle-info">
                        <span className="ask-toggle-name">Notify followers</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={notifyFollowers}
                        className={`ask-toggle-switch ${notifyFollowers ? "is-on" : ""}`}
                        onClick={() => setNotifyFollowers(!notifyFollowers)}
                      />
                    </label>
                  </div>
                </div>

                {/* Related Subject */}
                <div className="ask-sidebar-section">
                  <div className="ask-sidebar-heading">Related subject</div>
                  <input
                    type="text"
                    className="ask-sidebar-input"
                    placeholder="e.g. Classical Mechanics"
                    value={relatedSubject}
                    onChange={(e) => setRelatedSubject(e.target.value)}
                  />
                </div>

                {/* Draft Info */}
                <div className="ask-sidebar-section">
                  <div className="ask-sidebar-heading">Draft</div>
                  <div className="ask-draft-info">
                    <div className="ask-draft-row">
                      <span className="ask-draft-label">Status</span>
                      <span className={`ask-draft-value ${draftSaved ? "is-saved" : ""}`}>
                        {draftSaved ? "Saved" : "Unsaved changes"}
                      </span>
                    </div>
                    <div className="ask-draft-row">
                      <span className="ask-draft-label">Autosave</span>
                      <span className="ask-draft-value">Every 3s</span>
                    </div>
                  </div>
                </div>

                {/* Guidelines */}
                <div className="ask-sidebar-section ask-guidelines">
                  <div className="ask-sidebar-heading">Posting guidelines</div>
                  <ul className="ask-guidelines-list">
                    <li>Be specific and include context</li>
                    <li>Show your work and attempts</li>
                    <li>Use LaTeX for equations</li>
                    <li>Check for duplicates first</li>
                    <li>Include relevant diagrams</li>
                  </ul>
                </div>
              </aside>
            </div>
          </div>
        </main>
      </div>

      {/* ─── Floating Math Keyboard ─── */}
      <div className={`ask-math-keyboard ${mathKeyboardOpen ? "is-open" : ""}`}>
        <div className="ask-mk-header">
          <div className="ask-mk-tabs">
            {MATH_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`ask-mk-tab ${activeMathCategory === cat.id ? "is-active" : ""}`}
                onClick={() => setActiveMathCategory(cat.id)}
                title={cat.name}
              >
                <span className="ask-mk-tab-icon">{cat.icon}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ask-mk-close"
            onClick={() => setMathKeyboardOpen(false)}
            aria-label="Close math keyboard"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="ask-mk-body">
          <div className="ask-mk-grid">
            {activeCategoryData?.symbols.map((item) => (
              <button
                key={item.label}
                type="button"
                className="ask-mk-key"
                onClick={() => insertSymbol(item.symbol)}
                title={item.label}
              >
                <span className="ask-mk-key-symbol">{item.symbol}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="ask-mk-footer">
          <span className="ask-mk-category-name">{activeCategoryData?.name}</span>
          <span className="ask-mk-hint">Click to insert at cursor</span>
        </div>
      </div>
    </div>
  );
}
