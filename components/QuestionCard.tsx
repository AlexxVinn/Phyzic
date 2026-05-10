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

function compactPreview(source: string, maxLen = 320) {
  const text = (source || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) return "";

  let slice = text.slice(0, maxLen);
  // Avoid breaking inline math delimiters in a way that produces noisy typesetting.
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

  const preview = compactPreview(question.body || "", 220);

  return (
    <article
      className={`q-card ${question.solved ? "is-solved" : ""} ${question.answer_count > 0 ? "has-answers" : ""}`}
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
      <div className="q-card-stats" aria-label="Question statistics">
        <div className={`q-card-stat ${question.score !== 0 ? "has-score" : ""}`}>
          <span className="q-card-stat-val">{question.score}</span>
          <span className="q-card-stat-lbl">votes</span>
        </div>
        <div className={`q-card-stat ${question.answer_count > 0 ? "has-answers" : ""} ${question.solved ? "is-solved" : ""}`}>
          {question.solved && (
            <svg
              className="q-card-check"
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          <span className="q-card-stat-val">{question.answer_count}</span>
          <span className="q-card-stat-lbl">{question.solved ? "accepted" : question.answer_count === 1 ? "answer" : "answers"}</span>
        </div>
        <div className="q-card-stat q-card-stat-views">
          <span className="q-card-stat-val">{views}</span>
          <span className="q-card-stat-lbl">views</span>
        </div>
      </div>

      <div className="q-card-body">
        <div className="q-card-title-row">
          <h3 className="q-card-title">
            <Link
              href={`/question/${question.id}`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {question.title}
            </Link>
          </h3>
          {question.solved ? (
            <span className="q-card-chip q-card-chip-solved">Solved</span>
          ) : question.answer_count > 0 ? (
            <span className="q-card-chip q-card-chip-answered">Answered</span>
          ) : null}
        </div>

        {preview ? (
          <div className="q-card-preview" aria-label="Question preview">
            <Markdown text={preview} className="q-card-preview-md" />
          </div>
        ) : null}

        <div className="q-card-footer">
          <div className="q-card-tags" aria-label="Tags">
            {question.tags.map((t) => (
              <button
                key={t}
                className="q-card-tag"
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
          <div className="q-card-meta-row">
            <Avatar url={author?.avatar_url || null} name={name} size={14} />
            <Link
              href={`/profile?u=${encodeURIComponent(author?.username || "")}`}
              className="q-card-author"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {name}
            </Link>
            {author?.role && author.role !== "user" && <RoleBadge role={author.role} size="sm" />}
            <span className="q-card-rep" aria-label="Author reputation">
              {fmtRep(author?.reputation || 0)}
            </span>
            <span className="q-card-dot" aria-hidden="true" />
            <time className="q-card-time" dateTime={question.created_at}>
              {fmtShortDate(question.created_at)}
            </time>
          </div>
        </div>
      </div>
    </article>
  );
}
