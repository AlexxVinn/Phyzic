"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { Conversation, Message } from "@/lib/messaging";
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  markConversationRead,
  togglePinConversation,
  ensureConversation,
  setPresence,
} from "@/lib/messaging";

export function useConversations() {
  const supabase = createClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchConversations();
      setConversations(data);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll every 5 seconds as a fallback alongside realtime
  useEffect(() => {
    const interval = setInterval(() => {
      load();
    }, 5000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session?.user) return;

      const userId = data.session.user.id;
      const topic = `messages:${userId}`;

      // Guard against creating a duplicate channel with the same topic (Supabase will reject adding handlers after subscribe).
      for (const ch of supabase.getChannels()) {
        if ((ch as any)?.topic?.includes(topic) || (ch as any)?.subTopic === topic) {
          await supabase.removeChannel(ch);
        }
      }

      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages" },
          () => load()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "conversation_participants" },
          () => load()
        )
        .subscribe();
    }

    init();
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const pin = useCallback(async (conversationId: string, pinned: boolean) => {
    await togglePinConversation(conversationId, pinned);
    setConversations((prev) =>
      prev
        .map((c) => (c.id === conversationId ? { ...c, pinned } : c))
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
          const ta = new Date(a.last_message?.created_at || a.updated_at).getTime();
          const tb = new Date(b.last_message?.created_at || b.updated_at).getTime();
          return tb - ta;
        })
    );
  }, []);

  return { conversations, loading, totalUnread, refresh: load, pin };
}

export function useMessages(conversationId: string | null) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const data = await fetchMessages(conversationId, 50);
      setMessages(data);
      setHasMore(data.length === 50);
      await markConversationRead(conversationId);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!conversationId) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session?.user) return;

      const topic = `conversation:${conversationId}`;

      for (const ch of supabase.getChannels()) {
        if ((ch as any)?.topic?.includes(topic) || (ch as any)?.subTopic === topic) {
          await supabase.removeChannel(ch);
        }
      }

      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new as unknown as Message];
            });
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }
        )
        .subscribe();
    }

    init();
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  // Poll every 5 seconds as a fallback alongside realtime
  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(() => {
      load();
    }, 5000);
    return () => clearInterval(interval);
  }, [conversationId, load]);

  const send = useCallback(
    async (body: string, metadata?: Record<string, unknown>) => {
      if (!conversationId || !body.trim()) return;
      await sendMessage(conversationId, body.trim(), metadata);
      await load();
    },
    [conversationId, load]
  );

  const loadMore = useCallback(async () => {
    if (!conversationId || !hasMore || messages.length === 0) return;
    const oldest = messages[0]?.created_at;
    const data = await fetchMessages(conversationId, 50, oldest);
    if (data.length === 0) {
      setHasMore(false);
      return;
    }
    setMessages((prev) => [...data, ...prev]);
    setHasMore(data.length === 50);
  }, [conversationId, hasMore, messages]);

  return { messages, loading, hasMore, send, loadMore, bottomRef, refresh: load };
}

export function useEnsureConversation() {
  const [creating, setCreating] = useState(false);

  const start = useCallback(async (otherUserId: string) => {
    setCreating(true);
    try {
      const id = await ensureConversation(otherUserId);
      return id;
    } finally {
      setCreating(false);
    }
  }, []);

  return { start, creating };
}

export function usePresenceHeartbeat() {
  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval>;

    function tick() {
      if (!active) return;
      if (document.visibilityState === "visible") {
        setPresence("online").catch(() => {});
      } else {
        setPresence("away").catch(() => {});
      }
    }

    tick();
    interval = setInterval(tick, 30000);

    const onBeforeUnload = () => {
      try {
        // Best-effort offline on close
        const supabase = createClient();
        supabase.auth.getSession().then(({ data }) => {
          if (data.session?.user) {
            supabase.from("user_presence").update({ status: "offline", last_seen_at: new Date().toISOString() }).eq("user_id", data.session.user.id).then(() => {});
          }
        });
      } catch {}
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);
}
