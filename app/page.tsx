"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import QuestionCard from "@/components/QuestionCard";
import EmptyState from "@/components/EmptyState";
import FeedDiscoveryAside from "@/components/FeedDiscoveryAside";
import { useQuestionsFeed, useTags } from "@/hooks/useQuestions";
import { buildAuthorIdentities, buildFeedLayout, classifyThreadStates } from "@/lib/feedPresentation";
import type { SortMode } from "@/lib/questions";

const SORT_LABELS: Record<SortMode, string> = {
  newest: "Newest",
  top: "Top",
  unanswered: "Unanswered",
  solved: "Solved",
};

export default function HomePage() {
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

  const authorIdentities = useMemo(() => buildAuthorIdentities(questions), [questions]);

  const { featured, items: feedItems } = useMemo(() => buildFeedLayout(questions), [questions]);

  const feedPulseStats = useMemo(() => {
    const authorIds = new Set<string>();
    questions.forEach((q) => {
      if (q.author) authorIds.add(q.author.id);
    });
    return {
      authors: authorIds.size,
      openThreads: questions.filter((q) => q.answer_count > 0).length,
      unanswered: questions.filter((q) => q.answer_count === 0).length,
    };
  }, [questions]);

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

          <div className="feed-stream">
            {featured && questions.length > 0 && (
              <section className="feed-featured-block" aria-label="Featured thread">
                <p className="feed-section-kicker">High-signal thread</p>
                <QuestionCard
                  question={featured}
                  variant="featured"
                  states={classifyThreadStates(featured)}
                  authorIdentity={
                    featured.author ? authorIdentities.get(featured.author.id) : undefined
                  }
                  onTagClick={handleTagClick}
                />
              </section>
            )}

            <div className="feed-list">
              {feedItems.map((item) => (
                <QuestionCard
                  key={item.question.id}
                  question={item.question}
                  variant={item.variant}
                  states={item.states}
                  authorIdentity={
                    item.question.author
                      ? authorIdentities.get(item.question.author.id)
                      : undefined
                  }
                  onTagClick={handleTagClick}
                />
              ))}
            </div>

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

        <FeedDiscoveryAside
          questions={questions}
          allCombinedTags={allCombinedTags}
          onTagClick={handleTagClick}
          feedPulseStats={feedPulseStats}
          loading={loading}
        />
      </div>
    </div>
  );
}
