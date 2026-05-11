"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import QuestionCard from "@/components/QuestionCard";
import EmptyState from "@/components/EmptyState";
import RoleBadge from "@/components/RoleBadge";
import Avatar from "@/components/Avatar";
import { useQuestionsFeed, useTags } from "@/hooks/useQuestions";
import { useAuth } from "@/components/AuthProvider";
import { fmtRep, fmtShortDate } from "@/lib/utils";
import type { SortMode, Question } from "@/lib/questions";

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

  const unansweredQuestions = questions.filter(q => q.answer_count === 0).slice(0, 5);
  const topContributors = Array.from(
    new Map<string, NonNullable<Question["author"]>>(
      questions
        .filter(q => q.author)
        .map(q => [q.author!.id, q.author!])
    ).values()
  ).slice(0, 5);

  return (
    <div className="app">
      <Navbar onToggleSidebar={() => setSidebarCollapsed((v) => !v)} />
      <div className="shell">
        <Sidebar />

        {/* ─── CENTER CONTENT ─── */}
        <main className="main-feed">
          <div className="feed-hero">
            <div className="feed-hero-text">
              <h1 className="feed-hero-title">Physics Knowledge Exchange</h1>
              <p className="feed-hero-sub">A rigorous Q&A platform for physicists, researchers, and students. Ask questions, share knowledge, and advance understanding.</p>
            </div>
            <Link href="/ask" className="feed-cta">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Ask Question
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
            <div className="feed-toolbar-actions">
              {activeTags.length > 0 && (
                <div className="feed-active-filters">
                  {activeTags.map((t) => (
                    <button
                      key={t}
                      className="feed-filter-tag is-active"
                      onClick={() => setTagFilter(null)}
                      type="button"
                    >
                      {t}
                      <span className="feed-filter-x">&times;</span>
                    </button>
                  ))}
                </div>
              )}
              <input
                type="search"
                className="feed-search"
                placeholder="Search questions\u2026"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="feed-error">
              {error}
              <button className="feed-error-retry" onClick={refresh}>Retry</button>
            </div>
          )}

          {loading && questions.length === 0 && (
            <div className="feed-skeletons">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="feed-skeleton">
                  <div className="feed-skeleton-stats">
                    <div className="feed-skeleton-stat" />
                    <div className="feed-skeleton-stat" />
                    <div className="feed-skeleton-stat" />
                  </div>
                  <div className="feed-skeleton-body">
                    <div className="feed-skeleton-line" style={{ width: "65%" }} />
                    <div className="feed-skeleton-line" style={{ width: "90%" }} />
                    <div className="feed-skeleton-line" style={{ width: "40%" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="feed-list">
            {questions.map((q) => (
              <QuestionCard key={q.id} question={q} onTagClick={handleTagClick} />
            ))}
            {questions.length === 0 && !loading && (
              <div className="feed-empty">
                <EmptyState
                  title={search ? "No matches" : tagFilter ? `No "${tagFilter}" questions` : "No questions yet"}
                  message={search ? "Try a different search term." : tagFilter ? "Try another tag." : "Be the first to ask!"}
                />
              </div>
            )}
          </div>

          {hasMore && (
            <div className="feed-pagination">
              <button
                className="feed-pagination-btn"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <span className="feed-loading-inline">
                    <span className="spinner" />
                    Loading\u2026
                  </span>
                ) : "Load more questions"}
              </button>
            </div>
          )}
        </main>

        {/* ─── RIGHT SIDEBAR ─── */}
        <aside className="right-col">
          {/* Top Tags */}
          <div className="rc-card">
            <div className="rc-card-title">Top Tags</div>
            <div className="rc-tags">
              {allCombinedTags.slice(0, 8).map((t) => (
                <button
                  key={t.name}
                  className="rc-tag-btn"
                  type="button"
                  onClick={() => setTagFilter(t.name)}
                >
                  <span className="rc-tag-name">{t.name}</span>
                  <span className="rc-tag-count">{t.count}</span>
                </button>
              ))}
              {allCombinedTags.length === 0 && <div className="rc-muted">No tags yet</div>}
            </div>
          </div>

          {/* Unanswered */}
          <div className="rc-card">
            <div className="rc-card-title">Unanswered</div>
            <div className="rc-list">
              {unansweredQuestions.length > 0 ? unansweredQuestions.map((q) => (
                <Link key={q.id} href={`/question/${q.id}`} className="rc-item">
                  <span className="rc-item-title">{q.title}</span>
                  <span className="rc-item-meta">{fmtRep(q.score)} votes &middot; {q.view_count} views</span>
                </Link>
              )) : (
                <div className="rc-muted">All questions have answers</div>
              )}
            </div>
          </div>

          {/* Contributors */}
          <div className="rc-card">
            <div className="rc-card-title">Top Contributors</div>
            <div className="rc-list">
              {topContributors.length > 0 ? topContributors.map((a) => (
                <Link key={a.id} href={`/profile?u=${encodeURIComponent(a.username || "")}`} className="rc-contributor">
                  <Avatar url={a.avatar_url || null} name={a.full_name || a.username || "User"} size={20} />
                  <div className="rc-contributor-info">
                    <span className="rc-contributor-name">{a.full_name || a.username}</span>
                    <span className="rc-contributor-rep">{fmtRep(a.reputation)} rep</span>
                  </div>
                  {a.role && a.role !== "user" && <RoleBadge role={a.role} size="sm" />}
                </Link>
              )) : (
                <div className="rc-muted">No contributors yet</div>
              )}
            </div>
          </div>

          {/* Guidelines */}
          <div className="rc-card rc-card-subtle">
            <div className="rc-card-title">Community Guidelines</div>
            <div className="rc-guidelines">
              <div className="rc-guideline"><strong>Search first</strong> &mdash; avoid duplicates</div>
              <div className="rc-guideline"><strong>Define variables</strong> &mdash; include assumptions &amp; units</div>
              <div className="rc-guideline"><strong>Typeset math</strong> &mdash; use $...$ and $$...$$</div>
              <div className="rc-guideline"><strong>Cite sources</strong> &mdash; reference papers &amp; textbooks</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
