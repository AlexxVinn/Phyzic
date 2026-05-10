"use client";

import { useRouter } from "next/navigation";
import { useEnsureConversation } from "@/hooks/useMessaging";
import { useAuth } from "./AuthProvider";

interface MessageButtonProps {
  targetId: string;
  size?: "sm" | "md";
  onConversationReady?: (conversationId: string) => void;
}

export default function MessageButton({ targetId, size = "md", onConversationReady }: MessageButtonProps) {
  const auth = useAuth();
  const { start, creating } = useEnsureConversation();
  const router = useRouter();

  if (!auth.user || auth.user.id === targetId) return null;

  const height = size === "sm" ? 24 : 30;
  const pad = size === "sm" ? "0 8px" : "0 12px";
  const fontSize = size === "sm" ? 11 : 12;

  const handleClick = async () => {
    const id = await start(targetId);
    if (id) {
      if (onConversationReady) {
        onConversationReady(id);
      } else {
        router.push(`/messages?c=${id}`);
      }
    }
  };

  return (
    <button
      type="button"
      style={{
        height,
        padding: pad,
        borderRadius: 3,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: "var(--text)",
        font: "inherit",
        fontSize,
        fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        transition: "all 0.12s ease",
        whiteSpace: "nowrap",
      }}
      onClick={handleClick}
      disabled={creating}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      Message
    </button>
  );
}
