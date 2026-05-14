"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";
import Markdown from "./Markdown";
import UserHoverCard from "./UserHoverCard";
import { fmtRep, fmtShortDate } from "@/lib/utils";
import type { Question } from "@/lib/questions";

interface QuestionCardProps {
  question: Question;
  onTagClick?: (tag: string) => void;
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

function compactCount(n: number): string {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v >= 1000) {
    const k = v / 1000;
    return k.toFixed(k >= 10 ? 0 : 1).replace(/\.0$/, "") + "k";
  }
  return String(v);
}

function isFresh(iso: string): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < 60 * 60 * 1000;
}

export default function QuestionCard({ question, onTagClick }: QuestionCardProps) {
  const router = useRouter();
  const author = question.author;
  const name = author?.full_name || author?.username || "User";

  const preview = compactPreview(question.body || "", 240);
  const hasAnswers = question.answer_count > 0;
  const fresh = isFresh(question.created_at);

  const scoreClass =
    question.score > 0 ? "is-positive" : question.score < 0 ? "is-negative" : "";

  return (
    <article
      className={`qc ${question.solved ? "is-solved" : ""} ${hasAnswers ? "has-answers" : ""} ${fresh ? "is-fresh" : ""}`}
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
      {/* Left stats rail */}
      <aside className="qc-rail" aria-label="Question statistics">
        <div
          className={`qc-rail-cell qc-rail-votes ${question.score !== 0 ? "has-val" : ""} ${scoreClass}`}
        >
          <span className="qc-rail-num">{question.score}</span>
          <span className="qc-rail-lbl">
            {Math.abs(question.score) === 1 ? "vote" : "votes"}
          </span>
        </div>
        <div
          className={`qc-rail-cell qc-rail-answers ${hasAnswers ? "has-val" : ""} ${question.solved ? "is-solved" : ""}`}
        >
          <span className="qc-rail-num">
            {question.solved && (
              <svg
                className="qc-rail-check"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {question.answer_count}
          </span>
          <span className="qc-rail-lbl">
            {question.solved
              ? "solved"
              : question.answer_count === 1
                ? "answer"
                : "answers"}
          </span>
        </div>
        <div className="qc-rail-cell qc-rail-views">
          <span className="qc-rail-num">{compactCount(question.view_count)}</span>
          <span className="qc-rail-lbl">
            {question.view_count === 1 ? "view" : "views"}
          </span>
        </div>
      </aside>

      {/* Right content */}
      <div className="qc-content">
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
          ) : hasAnswers ? (
            <span className="qc-badge qc-badge-answered">Answered</span>
          ) : (
            <span className="qc-badge qc-badge-open">Open</span>
          )}
        </div>

        {preview ? (
          <div className="qc-preview" aria-label="Question preview">
            <Markdown text={preview} className="qc-preview-md" />
          </div>
        ) : null}

        <div className="qc-footer">
          <div className="qc-tags" aria-label="Tags">
            {question.tags.map((t) => (
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
              <span className="qc-author-wrap">
                <Avatar url={author?.avatar_url || null} name={name} size={18} />
                <Link
                  href={`/profile?u=${encodeURIComponent(author?.username || "")}`}
                  className="qc-author"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {name}
                </Link>
                <span className="qc-rep" aria-label="Author reputation">
                  {fmtRep(author?.reputation || 0)}
                </span>
                {author?.role && author.role !== "user" && (
                  <RoleBadge role={author.role} size="sm" />
                )}
              </span>
            </UserHoverCard>
            <span className="qc-meta-sep" aria-hidden="true">·</span>
            <time className="qc-time" dateTime={question.created_at}>
              {fresh && <span className="qc-pulse" aria-hidden="true" />}
              {fmtShortDate(question.created_at)}
            </time>
          </div>
        </div>
      </div>
    </article>
  );
}
