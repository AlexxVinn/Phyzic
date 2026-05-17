"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";
import Markdown from "./Markdown";
import UserHoverCard from "./UserHoverCard";
import { fmtRep, fmtShortDate } from "@/lib/utils";
import type { Question } from "@/lib/questions";
import type { AuthorFeedIdentity, FeedCardVariant, FeedThreadState } from "@/lib/feedPresentation";
import { classifyThreadStates, hasDisplayMath } from "@/lib/feedPresentation";

interface QuestionCardProps {
  question: Question;
  onTagClick?: (tag: string) => void;
  variant?: FeedCardVariant;
  states?: FeedThreadState[];
  authorIdentity?: AuthorFeedIdentity;
}

function compactPreview(source: string, maxLen = 280) {
  const text = (source || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) return "";

  let slice = text.slice(0, maxLen);
  const dollars = (slice.match(/\$/g) || []).length;
  if (dollars % 2 === 1) slice = slice.replace(/\$[^$]*$/, "");

  return slice;
}

const STATE_LABELS: Record<FeedThreadState, { label: string; className: string }> = {
  new: { label: "Recent", className: "qc-signal-new" },
  active: { label: "Active discussion", className: "qc-signal-live" },
  "recently-solved": { label: "Recently solved", className: "qc-signal-solved" },
  controversial: { label: "Controversial", className: "qc-signal-split" },
  bounty: { label: "Unanswered bounty", className: "qc-signal-bounty" },
  rising: { label: "Rising topic", className: "qc-signal-rise" },
  momentum: { label: "Building momentum", className: "qc-signal-momentum" },
};

export default function QuestionCard({
  question,
  onTagClick,
  variant = "standard",
  states: statesProp,
  authorIdentity,
}: QuestionCardProps) {
  const router = useRouter();
  const author = question.author;
  const name = author?.full_name || author?.username || "User";
  const states = statesProp ?? classifyThreadStates(question);
  const isFeatured = variant === "featured";
  const isCompact = variant === "compact";
  const mathForward = hasDisplayMath(question.body || "");

  const showSignals = states.length > 0 || (question.answer_count > 0 && !question.solved);

  const views =
    question.view_count >= 1000
      ? (question.view_count / 1000).toFixed(1).replace(/\.0$/, "") + "k"
      : String(question.view_count);

  const previewLen = isFeatured ? 320 : isCompact ? 120 : 240;
  const preview = compactPreview(question.body || "", previewLen);
  const scoreHot = question.score >= 4;

  const momentumHint =
    states.includes("momentum") || states.includes("active")
      ? `${question.answer_count} repl${question.answer_count === 1 ? "y" : "ies"} in thread`
      : null;

  const classNames = [
    "qc",
    question.solved ? "is-solved" : "",
    question.answer_count > 0 ? "has-answers" : "",
    states.includes("new") ? "qc--new" : "",
    states.includes("active") ? "qc--active" : "",
    scoreHot ? "qc--hot" : "",
    isFeatured ? "qc--featured" : "",
    isCompact ? "qc--compact" : "",
    mathForward ? "qc--math-forward" : "",
    states.includes("controversial") ? "qc--controversial" : "",
    states.includes("bounty") ? "qc--bounty" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={classNames}
      role="article"
      tabIndex={0}
      onClick={() => router.push(`/question/${question.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/question/${question.id}`);
        }
      }}
    >
      <div className="qc-rail" aria-hidden="true">
        <div className="qc-rail-accent" />
      </div>

      {!isCompact ? (
        <div className="qc-stats" aria-label="Question statistics">
          <div className={`qc-stat ${question.score > 0 ? "is-up" : ""} ${question.score < 0 ? "is-down" : ""} ${question.score !== 0 ? "has-val" : ""}`}>
            <div className="qc-stat-body">
              <span className="qc-stat-num">{question.score}</span>
              <span className="qc-stat-cap">votes</span>
            </div>
            <span className="qc-stat-ico" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5" />
                <path d="M6 11l6-6 6 6" />
              </svg>
            </span>
          </div>
          <div className={`qc-stat ${question.answer_count > 0 ? "has-val" : ""} ${question.solved ? "is-solved" : ""}`}>
            <div className="qc-stat-body">
              {question.solved && (
                <svg className="qc-check" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              <span className="qc-stat-num">{question.answer_count}</span>
              <span className="qc-stat-cap">{question.answer_count === 1 ? "answer" : "answers"}</span>
            </div>
            <span className="qc-stat-ico" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
          </div>
          <div className={`qc-stat qc-stat-views ${question.view_count >= 10 ? "has-val" : ""}`}>
            <div className="qc-stat-body">
              <span className="qc-stat-num">{views}</span>
              <span className="qc-stat-cap">views</span>
            </div>
            <span className="qc-stat-ico" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
          </div>
        </div>
      ) : (
        <div className="qc-stats-compact" aria-label="Question statistics">
          <span className={`qc-pip ${question.score > 0 ? "is-up" : ""}`}>{question.score}↑</span>
          <span className="qc-pip">{question.answer_count} ans</span>
          <span className="qc-pip qc-pip-muted">{views} views</span>
        </div>
      )}

      <div className="qc-content">
        {isFeatured && (
          <span className="qc-featured-kicker">High-signal thread</span>
        )}

        {showSignals && (
          <div className="qc-signals" aria-label="Activity">
            {states.slice(0, isCompact ? 2 : 4).map((s) => {
              const cfg = STATE_LABELS[s];
              return (
                <span key={s} className={`qc-signal ${cfg.className}`}>
                  {cfg.label}
                </span>
              );
            })}
            {!states.length && question.answer_count > 0 && !question.solved ? (
              <span className="qc-signal qc-signal-open">In discussion</span>
            ) : null}
          </div>
        )}

        <div className="qc-title-row">
          <h3 className="qc-title">
            <Link
              href={`/question/${question.id}`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {question.title}
            </Link>
          </h3>
          {question.solved ? (
            <span className="qc-badge qc-badge-solved">Solved</span>
          ) : question.answer_count > 0 ? (
            <span className="qc-badge qc-badge-answered">Answered</span>
          ) : null}
        </div>

        {momentumHint && !isCompact && (
          <p className="qc-momentum-hint">
            <span className="qc-momentum-dot" aria-hidden />
            {momentumHint}
            {states.includes("active") ? " · someone may be replying" : ""}
          </p>
        )}

        {preview ? (
          <div className="qc-preview" aria-label="Question preview">
            <Markdown text={preview} className="qc-preview-md" />
          </div>
        ) : null}

        <div className="qc-footer">
          <div className="qc-tags" aria-label="Tags">
            {(isCompact ? question.tags.slice(0, 2) : question.tags).map((t) => (
              <button
                key={t}
                className="qc-tag"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onTagClick?.(t);
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="qc-meta">
            <UserHoverCard
              user={
                author
                  ? {
                      id: author.id,
                      username: author.username,
                      full_name: author.full_name,
                      avatar_url: author.avatar_url,
                      reputation: author.reputation,
                      role: author.role,
                    }
                  : null
              }
            >
              <span className="qc-meta-author">
                <span className="qc-meta-avatar-wrap">
                  <Avatar url={author?.avatar_url || null} name={name} size={isCompact ? 16 : 20} />
                </span>
                <Link
                  href={`/profile?u=${encodeURIComponent(author?.username || "")}`}
                  className="qc-author"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {name}
                </Link>
              </span>
            </UserHoverCard>
            {authorIdentity?.notableLabel ? (
              <span className="qc-contributor-badge" title="Contributor standing">
                {authorIdentity.notableLabel}
              </span>
            ) : null}
            {author?.role && author.role !== "user" && <RoleBadge role={author.role} size="sm" />}
            <span className="qc-rep" aria-label="Author reputation">
              {fmtRep(author?.reputation || 0)}
            </span>
            {authorIdentity?.knownFor ? (
              <span className="qc-known-for" title="Topic expertise">
                known for {authorIdentity.knownFor}
              </span>
            ) : null}
            {authorIdentity?.streakDays && authorIdentity.streakDays >= 2 ? (
              <span className="qc-streak" title="Contribution streak">
                {authorIdentity.streakDays}d streak
              </span>
            ) : null}
            <span className="qc-dot" aria-hidden="true" />
            <time className="qc-time" dateTime={question.created_at} title={new Date(question.created_at).toLocaleString()}>
              {fmtShortDate(question.created_at)}
            </time>
          </div>
        </div>
      </div>
    </article>
  );
}
