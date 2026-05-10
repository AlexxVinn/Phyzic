"use client";

interface VoteControlsProps {
  score: number;
  userVote: number;
  onVote: (v: 1 | -1) => void;
  size?: "sm" | "md" | "lg";
}

export default function VoteControls({ score, userVote, onVote, size = "md" }: VoteControlsProps) {
  const btnSize = size === "sm" ? 28 : size === "lg" ? 44 : 36;
  const iconSize = size === "sm" ? 14 : size === "lg" ? 22 : 18;
  const scoreSize = size === "sm" ? 14 : size === "lg" ? 24 : 18;

  return (
    <div className="vote-wrap">
      <button
        type="button"
        className={`vote-btn ${userVote === 1 ? "is-active-up" : ""}`}
        onClick={() => onVote(1)}
        aria-label="Upvote"
        style={{ width: btnSize, height: btnSize }}
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 15l-6-6-6 6"/>
        </svg>
      </button>
      <span className={`score-num ${userVote !== 0 ? "score-flash" : ""}`} style={{ fontSize: scoreSize }}>{score}</span>
      <button
        type="button"
        className={`vote-btn ${userVote === -1 ? "is-active-down" : ""}`}
        onClick={() => onVote(-1)}
        aria-label="Downvote"
        style={{ width: btnSize, height: btnSize }}
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
    </div>
  );
}
