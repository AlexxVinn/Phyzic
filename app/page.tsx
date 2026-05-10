"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import QuestionCard from "@/components/QuestionCard";
import EmptyState from "@/components/EmptyState";
import RoleBadge from "@/components/RoleBadge";
import { useQuestionsFeed, useTags } from "@/hooks/useQuestions";
import { useAuth } from "@/components/AuthProvider";
import { fmtRep } from "@/lib/utils";
import type { SortMode } from "@/lib/questions";

const SORT_LABELS: Record<SortMode, string> = {
  newest: "Newest",
  top: "Top",
  unanswered: "Unanswered",
  solved: "Solved",
};

export default function HomePage() {
  const auth = useAuth();
  const [sort, setSort] = useState<SortMode>("newest");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { questions, loading, error, hasMore, loadMore, refresh } = useQuestionsFeed(sort, tagFilter, search || null);
  const { tags } = useTags();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("phyzic_sidebar_collapsed");
      if (saved === "true") setSidebarCollapsed(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (sidebarCollapsed) {
        document.documentElement.classList.add("sidebar-collapsed");
      } else {
        document.documentElement.classList.remove("sidebar-collapsed");
      }
      localStorage.setItem("phyzic_sidebar_collapsed", String(sidebarCollapsed));
    } catch {}
  }, [sidebarCollapsed]);

  const handleTagClick = useCallback((tag: string) => {
    setTagFilter((prev) => (prev === tag ? null : tag));
  }, []);

  const activeTags = tagFilter ? [tagFilter] : [];

  // Combine tags from loaded questions with tags from the API
  const questionTagMap = new Map<string, number>();
  questions.forEach((q) => {
    q.tags.forEach((t) => {
      questionTagMap.set(t, (questionTagMap.get(t) || 0) + 1);
    });
  });
  tags.forEach((t) => {
    if (!questionTagMap.has(t.name)) {
      questionTagMap.set(t.name, t.question_count);
    }
  });
  const allCombinedTags = Array.from(questionTagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const featuredDiscussions = [...questions]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 6);

  const trendingTopics = allCombinedTags.slice(0, 14);

  return (
    <div className="app">
      <Navbar onToggleSidebar={() => setSidebarCollapsed((v) => !v)} />
      <div className="shell">
        <Sidebar />
        <main className="main-feed">
          <div className="feed-head">
            <div className="feed-head-text">
              <h1 className="feed-title">Physics Knowledge Exchange</h1>
              <p className="feed-sub">Rigorous Q&A for physicists. Ask, answer, and learn.</p>
            </div>
            <Link href="/ask" className="btn-ask">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Ask question
            </Link>
          </div>

          <div className="feed-toolbar">
            <div className="feed-tabs">
              {(Object.keys(SORT_LABELS) as SortMode[]).map((k) => (
                <button
                  key={k}
                  className={`feed-tab ${sort === k ? "is-active" : ""}`}
                  onClick={() => setSort(k)}
                >
                  {SORT_LABELS[k]}
                </button>
              ))}
            </div>
            <div className="feed-toolbar-right">
              <input
                type="search"
                className="feed-search-input"
                placeholder="Search questions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {activeTags.length > 0 && (
            <div className="feed-filterbar" role="region" aria-label="Active filters">
              <span className="feed-filterbar-label">Filter</span>
              {activeTags.map((t) => (
                <button
                  key={t}
                  className="tag is-active"
                  onClick={() => setTagFilter(null)}
                  type="button"
                  aria-label={`Clear tag filter ${t}`}
                >
                  {t}
                  <span aria-hidden="true" className="feed-filterbar-x">×</span>
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded p-3 text-sm bg-surface border border-red-300 text-red-600 mb-4">
              {error}
              <button className="ml-2 underline font-medium" onClick={refresh}>Retry</button>
            </div>
          )}

          {loading && questions.length === 0 && (
            <div className="skeleton-wrap">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-line skeleton-lg" style={{ width: "60%" }} />
                  <div className="skeleton-line" style={{ width: "90%" }} />
                  <div className="skeleton-line" style={{ width: "40%" }} />
                </div>
              ))}
            </div>
          )}

          <div className="question-feed">
            {questions.map((q) => (
              <QuestionCard key={q.id} question={q} onTagClick={handleTagClick} />
            ))}
            {questions.length === 0 && !loading && (
              <div className="q-row q-row-empty">
                <EmptyState
                  title={search ? "No matches" : tagFilter ? `No "${tagFilter}" questions` : "No questions yet"}
                  message={search ? "Try a different search term." : tagFilter ? "Try another tag." : "Be the first to ask!"}
                />
              </div>
            )}
          </div>

          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                className="btn-secondary"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="spinner" />
                    Loading…
                  </span>
                ) : "Load more"}
              </button>
            </div>
          )}
        </main>

        <aside className="right-col">
          <div className="card">
            <div className="card-title">Featured</div>
            <div className="rc-list rc-list-compact">
              {featuredDiscussions.slice(0, 5).map((q) => (
                <div key={q.id} className="rc-item">
                  <Link href={`/question/${q.id}`} className="rc-item-title">{q.title}</Link>
                  <div className="rc-item-meta">
                    <span>{fmtRep(q.score)} votes</span>
                    <span>{q.answer_count} ans</span>
                    <span>{q.view_count >= 1000 ? (q.view_count / 1000).toFixed(1).replace(/\.0$/, "") + "k" : q.view_count} views</span>
                  </div>
                </div>
              ))}
              {featuredDiscussions.length === 0 && <div className="rc-muted">No featured questions yet</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Topics</div>
            <div className="rc-tag-grid">
              {trendingTopics.slice(0, 10).map((t) => (
                <button
                  key={t.name}
                  className="rc-tag"
                  type="button"
                  onClick={() => setTagFilter(t.name)}
                >
                  {t.name}
                  <span className="rc-tag-count">{t.count}</span>
                </button>
              ))}
              {trendingTopics.length === 0 && <div className="rc-muted">No tags yet</div>}
            </div>
          </div>

          <div className="card card-subtle">
            <div className="rc-list rc-list-compact">
              <div className="rc-guideline"><strong>Search first</strong> — avoid duplicates</div>
              <div className="rc-guideline"><strong>Define variables</strong> — include assumptions &amp; units</div>
              <div className="rc-guideline"><strong>Typeset math</strong> {"\u2014 use \\$…\\$ and \\$\\$…\\$\\$"}</div>
            </div>
          </div>

          {auth.profile && (
            <div className="card card-subtle">
              <div className="rc-list rc-list-compact">
                <div className="rc-kv"><span className="rc-k">Reputation</span><span className="rc-v">{fmtRep(auth.profile.reputation)}</span></div>
                <div className="rc-kv"><span className="rc-k">Role</span><span className="rc-v"><RoleBadge role={auth.profile.role} size="sm" /></span></div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
