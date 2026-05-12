"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useConversations, useMessages } from "@/hooks/useMessaging";
import { useAuth } from "./AuthProvider";
import Avatar from "./Avatar";
import { fmtRep, fmtShortDate, stripMarkdown } from "@/lib/utils";
import type { Conversation } from "@/lib/messaging";

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onPin,
  unreadTotal,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  unreadTotal: number;
}) {
  const [filter, setFilter] = useState("");
  const filtered = conversations.filter((c) => {
    const q = filter.toLowerCase();
    return c.participants.some((p) =>
      (p.username + " " + p.full_name).toLowerCase().includes(q)
    );
  });

  return (
    <div className="chat-dock-sidebar">
      <div className="chat-dock-head">
        <span className="chat-dock-title">Messages {unreadTotal > 0 && <span className="chat-dock-badge">{unreadTotal}</span>}</span>
      </div>
      <input
        type="search"
        className="chat-dock-search"
        placeholder="Search conversations…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="chat-dock-list">
        {filtered.map((c) => {
          const peer = c.participants[0];
          const isActive = c.id === activeId;
          const preview = c.last_message ? stripMarkdown(c.last_message.body).slice(0, 60) : "";
          return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              className={`chat-dock-item ${isActive ? "is-active" : ""}`}
              onClick={() => onSelect(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(c.id);
                }
              }}
            >
              <div className="chat-dock-item-row">
                <div className="chat-dock-avatar-wrap">
                  <Avatar url={peer?.avatar_url || null} name={peer?.username || "User"} size={32} />
                  {peer?.status === "online" && <span className="chat-dock-online" />}
                </div>
                <div className="chat-dock-meta">
                  <div className="chat-dock-name-row">
                    <span className="chat-dock-name">{peer?.username || "Unknown"}</span>
                    {c.pinned && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2l-5.5 9h11L12 2z"/><path d="M12 11v9"/><path d="M7 20h10"/>
                      </svg>
                    )}
                    {c.unread_count > 0 && <span className="chat-dock-unread">{c.unread_count}</span>}
                  </div>
                  <div className="chat-dock-preview">{preview}</div>
                </div>
              </div>
              <button
                type="button"
                className="chat-dock-pin"
                onClick={(e) => { e.stopPropagation(); onPin(c.id, !c.pinned); }}
                title={c.pinned ? "Unpin" : "Pin"}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l-5.5 9h11L12 2z"/><path d="M12 11v9"/><path d="M7 20h10"/>
                </svg>
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="chat-dock-empty">No conversations</div>
        )}
      </div>
    </div>
  );
}

function MessageThread({
  conversationId,
  onBack,
  peer,
}: {
  conversationId: string;
  onBack: () => void;
  peer?: Conversation["participants"][0];
}) {
  const { messages, send, bottomRef, hasMore, loadMore } = useMessages(conversationId);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const auth = useAuth();
  const prevMsgCountRef = useRef(0);

  // Autoscroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, bottomRef]);

  const handleSend = useCallback(async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await send(body);
      setBody("");
      // Scroll to bottom after sending
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } finally {
      setSending(false);
    }
  }, [body, sending, send, bottomRef]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const lastOnline = peer?.last_seen_at ? fmtShortDate(peer.last_seen_at) : "";

  return (
    <div className="chat-dock-thread">
      <div className="chat-dock-thread-head">
        <button type="button" className="chat-dock-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div className="chat-dock-thread-info">
          <span className="chat-dock-thread-name">{peer?.username || "Conversation"}</span>
          <span className="chat-dock-thread-status">
            {peer?.status === "online" ? "Online" : peer?.status === "away" ? "Away" : lastOnline ? `Last seen ${lastOnline}` : "Offline"}
          </span>
        </div>
        {peer && (
          <Link href={`/profile?u=${encodeURIComponent(peer.username)}`} className="chat-dock-profile-link">
            <Avatar url={peer.avatar_url || null} name={peer.username} size={22} />
          </Link>
        )}
      </div>

      <div className="chat-dock-messages" ref={scrollRef}>
        {hasMore && (
          <button type="button" className="chat-dock-load-more" onClick={loadMore}>
            Load earlier
          </button>
        )}
        {messages.map((m, i) => {
          const isMe = m.sender_id === auth.user?.id;
          const showTime =
            i === 0 ||
            new Date(m.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 600000;
          return (
            <div key={m.id} className={`chat-msg ${isMe ? "is-me" : ""}`}>
              {showTime && (
                <div className="chat-msg-time">{fmtShortDate(m.created_at)}</div>
              )}
              <div className="chat-msg-row">
                {!isMe && (
                  <Avatar
                    url={m.sender?.avatar_url || null}
                    name={m.sender?.username || "User"}
                    size={24}
                  />
                )}
                <div className="chat-msg-bubble">
                  <div className="chat-msg-body">{m.body}</div>
                  {typeof m.metadata?.question_id === "string" && (
                    <Link href={`/question/${m.metadata.question_id}`} className="chat-msg-embed">
                      <span className="chat-msg-embed-label">Question</span>
                      <span className="chat-msg-embed-title">{String(m.metadata.question_title || "View question")}</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-dock-input-area">
        <textarea
          className="chat-dock-input"
          rows={2}
          placeholder="Type a message… (Shift+Enter for newline)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKey}
        />
        <div className="chat-dock-input-actions">
          <span className="chat-dock-hint">Enter to send</span>
          <button
            type="button"
            className="chat-dock-send"
            onClick={handleSend}
            disabled={!body.trim() || sending}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatDock() {
  const { conversations, totalUnread, pin } = useConversations();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeConv = conversations.find((c) => c.id === activeId);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelSize, setPanelSize] = useState<{ w: number; h: number } | null>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    const handler = () => setOpen((v) => !v);
    window.addEventListener("phyzic-toggle-chat", handler);
    return () => window.removeEventListener("phyzic-toggle-chat", handler);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    const rect = panelRef.current?.getBoundingClientRect();
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: rect?.width || 320,
      h: rect?.height || 420,
    };
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const dx = dragStart.current.x - e.clientX;
      const dy = dragStart.current.y - e.clientY;
      const w = Math.min(560, Math.max(280, dragStart.current.w + dx));
      const h = Math.min(window.innerHeight * 0.8, Math.max(300, dragStart.current.h + dy));
      setPanelSize({ w, h });
    }
    function onMouseUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const panelStyle = panelSize
    ? { width: panelSize.w, height: panelSize.h }
    : undefined;

  return (
    <div className={`chat-dock ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="chat-dock-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close messages" : "Open messages"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        {totalUnread > 0 && <span className="chat-dock-toggle-badge">{totalUnread > 9 ? "9+" : totalUnread}</span>}
      </button>

      <div
        className="chat-dock-panel"
        ref={panelRef}
        style={panelStyle}
      >
        <button
          type="button"
          className="chat-dock-resize-btn"
          onMouseDown={onResizeMouseDown}
          title="Drag to resize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="9" y1="1" x2="1" y2="9" />
            <line x1="9" y1="4" x2="4" y2="9" />
            <line x1="9" y1="7" x2="7" y2="9" />
          </svg>
        </button>
        {activeId && activeConv ? (
          <MessageThread
            conversationId={activeId}
            peer={activeConv.participants[0]}
            onBack={() => setActiveId(null)}
          />
        ) : (
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={(id) => setActiveId(id)}
            onPin={pin}
            unreadTotal={totalUnread}
          />
        )}
      </div>
    </div>
  );
}
