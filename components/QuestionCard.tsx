"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";
import Markdown from "./Markdown";
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
      {/* Stats row */}
      <div className="qc-stats" aria-label="Question statistics">
        <div className={`qc-stat ${question.score !== 0 ? "has-val" : ""}`}>
          <span className="qc-stat-num">{question.score}</span>
          <span className="qc-stat-lbl">votes</span>
        </div>
        <div className={`qc-stat ${question.answer_count > 0 ? "has-val" : ""} ${question.solved ? "is-solved" : ""}`}>
          {question.solved && (
            <svg className="qc-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          <span className="qc-stat-num">{question.answer_count}</span>
          <span className="qc-stat-lbl">{question.solved ? "accepted" : question.answer_count === 1 ? "answer" : "answers"}</span>
        </div>
        <div className={`qc-stat qc-stat-views ${question.view_count >= 1000 ? "has-val" : ""}`}>
          <span className="qc-stat-num">{views}</span>
          <span className="qc-stat-lbl">views</span>
        </div>
      </div>

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
            <Avatar url={author?.avatar_url || null} name={name} size={16} />
            <Link
              href={`/profile?u=${encodeURIComponent(author?.username || "")}`}
              className="qc-author"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {name}
            </Link>
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
      </div>
    </article>
  );
}
