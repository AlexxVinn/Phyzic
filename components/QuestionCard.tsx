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

export default function QuestionCard({ question, onTagClick }: QuestionCardProps) {
  const router = useRouter();
  const author = question.author;
  const name = author?.full_name || author?.username || "User";

  const views =
    question.view_count >= 1000
      ? (question.view_count / 1000).toFixed(1).replace(/\.0$/, "") + "k"
      : String(question.view_count);

  const preview = compactPreview(question.body || "", 240);

  return (
    <article
      className={`qc ${question.solved ? "is-solved" : ""} ${question.answer_count > 0 ? "has-answers" : ""}`}
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
      {/* Main content */}
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
          ) : question.answer_count > 0 ? (
            <span className="qc-badge qc-badge-answered">Answered</span>
          ) : null}
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
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Avatar url={author?.avatar_url || null} name={name} size={16} />
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
            {author?.role && author.role !== "user" && <RoleBadge role={author.role} size="sm" />}
            <span className="qc-rep" aria-label="Author reputation">
              {fmtRep(author?.reputation || 0)}
            </span>
            <span className="qc-dot" aria-hidden="true" />
            <time className="qc-time" dateTime={question.created_at}>
              {fmtShortDate(question.created_at)}
            </time>
          </div>
        </div>

        <div className="qc-divider" aria-hidden="true" />

        {/* Stats row */}
        <div className="qc-stats" aria-label="Question statistics">
          <div className={`qc-stat ${question.score !== 0 ? "has-val" : ""}`}>
            <span className="qc-stat-num">{question.score}</span>
            <span className="qc-stat-lbl" aria-label="Votes" title="Votes">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5" />
                <path d="M6 11l6-6 6 6" />
              </svg>
            </span>
          </div>
          <div className={`qc-stat ${question.answer_count > 0 ? "has-val" : ""} ${question.solved ? "is-solved" : ""}`}>
            {question.solved && (
              <svg className="qc-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            <span className="qc-stat-num">{question.answer_count}</span>
            <span className="qc-stat-lbl" aria-label="Answers" title="Answers">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
          </div>
          <div className={`qc-stat qc-stat-views ${question.view_count >= 1000 ? "has-val" : ""}`}>
            <span className="qc-stat-num">{views}</span>
            <span className="qc-stat-lbl" aria-label="Views" title="Views">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
