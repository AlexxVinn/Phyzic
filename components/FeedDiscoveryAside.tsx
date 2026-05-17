"use client";

import Link from "next/link";
import { fmtRep, fmtShortDate } from "@/lib/utils";
import type { Question } from "@/lib/questions";
import { discoverySlices, hasDisplayMath } from "@/lib/feedPresentation";

type SliceProps = {
  title: string;
  subtitle: string;
  accentClass: string;
  items: { id: string; label: string; meta: string; href: string }[];
  empty: string;
};

function DiscoverySlice({ title, subtitle, accentClass, items, empty }: SliceProps) {
  return (
    <div className={`rc-card rc-card-discovery ${accentClass}`}>
      <div className="rc-card-head">
        <div className="rc-card-title">{title}</div>
        <p className="rc-card-sub">{subtitle}</p>
      </div>
      <div className="rc-discovery-list">
        {items.length > 0 ? (
          items.map((item) => (
            <Link key={item.id} href={item.href} className="rc-discovery-item">
              <span className="rc-discovery-label">{item.label}</span>
              <span className="rc-discovery-meta">{item.meta}</span>
            </Link>
          ))
        ) : (
          <div className="rc-muted">{empty}</div>
        )}
      </div>
    </div>
  );
}

export default function FeedDiscoveryAside({
  questions,
  allCombinedTags,
  onTagClick,
  feedPulseStats,
  loading,
}: {
  questions: Question[];
  allCombinedTags: { name: string; count: number }[];
  onTagClick: (tag: string) => void;
  feedPulseStats: { authors: number; openThreads: number; unanswered: number };
  loading: boolean;
}) {
  const slices = discoverySlices(questions);

  return (
    <aside className="right-col rc-feed-aside" aria-label="Discovery">
      <div className="rc-pulse">
        <span className="rc-pulse-dot" aria-hidden="true" />
        <div className="rc-pulse-body">
          <span className="rc-pulse-kicker">Network pulse</span>
          <span className="rc-pulse-title">Thinking in motion</span>
          <span className="rc-pulse-meta">
            {questions.length === 0 && !loading ? (
              "Scanning the field…"
            ) : (
              <>
                <span className="rc-pulse-line">
                  {feedPulseStats.authors} researcher{feedPulseStats.authors === 1 ? "" : "s"} ·{" "}
                  {feedPulseStats.openThreads} open thread{feedPulseStats.openThreads === 1 ? "" : "s"}
                </span>
                <span className="rc-pulse-line rc-pulse-line-dim">
                  {feedPulseStats.unanswered} awaiting a first reply
                  {loading ? " · syncing" : ""}
                </span>
              </>
            )}
          </span>
        </div>
      </div>

      <DiscoverySlice
        accentClass="rc-card-debate"
        title="Active debates"
        subtitle="Threads with competing lines of thought"
        empty="No heated threads in view"
        items={slices.activeDebates.map((q) => ({
          id: q.id,
          href: `/question/${q.id}`,
          label: q.title,
          meta: `${q.answer_count} voices · ${fmtRep(q.score)} score`,
        }))}
      />

      <DiscoverySlice
        accentClass="rc-card-disagree"
        title="Physicists disagree"
        subtitle="Split votes, multiple answers, no consensus yet"
        empty="Consensus forming elsewhere"
        items={slices.controversial.map((q) => ({
          id: q.id,
          href: `/question/${q.id}`,
          label: q.title,
          meta: `${q.answer_count} answers · score ${q.score}`,
        }))}
      />

      <DiscoverySlice
        accentClass="rc-card-unresolved"
        title="Unresolved problems"
        subtitle="Hard questions still open on the board"
        empty="Nothing stuck in the queue"
        items={slices.unresolved.map((q) => ({
          id: q.id,
          href: `/question/${q.id}`,
          label: q.title,
          meta: `${q.view_count} views · ${q.tags[0] || "general"}`,
        }))}
      />

      <DiscoverySlice
        accentClass="rc-card-derive"
        title="Rising derivations"
        subtitle="Equation-heavy threads gaining traction"
        empty="No derivations surfacing"
        items={slices.risingDerivations.map((q) => ({
          id: q.id,
          href: `/question/${q.id}`,
          label: q.title,
          meta: hasDisplayMath(q.body)
            ? `Display math · ${fmtShortDate(q.created_at)}`
            : fmtShortDate(q.created_at),
        }))}
      />

      <DiscoverySlice
        accentClass="rc-card-insight"
        title="Unexpected insights"
        subtitle="Recently resolved with visible impact"
        empty="Quiet resolution spell"
        items={slices.unexpected.map((q) => ({
          id: q.id,
          href: `/question/${q.id}`,
          label: q.title,
          meta: `Solved · ${q.view_count} views`,
        }))}
      />

      <div className="rc-card rc-card-tags">
        <div className="rc-card-head">
          <div className="rc-card-title">Topic gravity</div>
          <p className="rc-card-sub">Where attention clusters — not the same as the feed</p>
        </div>
        <div className="rc-tags">
          {allCombinedTags.slice(0, 8).map((t) => (
            <button key={t.name} className="rc-tag-btn" type="button" onClick={() => onTagClick(t.name)}>
              <span className="rc-tag-name">{t.name}</span>
              <span className="rc-tag-count">{t.count}</span>
            </button>
          ))}
          {allCombinedTags.length === 0 && <div className="rc-muted">No tags yet</div>}
        </div>
      </div>

      <div className="rc-card rc-card-subtle">
        <div className="rc-card-head">
          <div className="rc-card-title">Field notes</div>
        </div>
        <div className="rc-guidelines">
          <div className="rc-guideline"><strong>Disagree well</strong> — cite assumptions, not vibes</div>
          <div className="rc-guideline"><strong>Show the math</strong> — derivations belong in the thread</div>
        </div>
      </div>
    </aside>
  );
}

