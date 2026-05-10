"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    const userId = sessionData.session.user.id;
    const { data, error } = await supabase
      .from("notifications")
      .select("id,user_id,type,title,body,link,read,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) {
      const list = (data || []) as Notification[];
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.read).length);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
        
      if (!active || !data.session?.user) return;
        
      const userId = data.session.user.id;
        
      const existing = supabase.getChannels();
        
      for (const ch of existing) {
        await supabase.removeChannel(ch);
      }
    
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            load();
          }
        )
        .subscribe();
    }

    init();

    return () => {
      active = false;

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, load]);

  const markRead = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (!error) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    },
    [supabase]
  );

  const markAllRead = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", sessionData.session.user.id)
      .eq("read", false);
    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  }, [supabase]);

  return { notifications, unreadCount, loading, markRead, markAllRead, refresh: load };
}
