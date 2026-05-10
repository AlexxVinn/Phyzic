"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { Connection, ConnectionStatus, PeerProfile } from "@/lib/connections";
import {
  fetchConnectionStatus,
  sendConnectionRequest,
  respondToRequest,
  removeConnection,
  blockUser,
  unblockUser,
  fetchPendingRequests,
  fetchConnections,
  fetchPeers,
} from "@/lib/connections";

export function useConnectionStatus(viewerId: string | undefined, targetId: string | undefined) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [direction, setDirection] = useState<"outgoing" | "incoming" | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!viewerId || !targetId) return;
    setLoading(true);
    try {
      const res = await fetchConnectionStatus(viewerId, targetId);
      setStatus(res.status);
      setDirection(res.direction);
    } finally {
      setLoading(false);
    }
  }, [viewerId, targetId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    if (!targetId) return;
    await sendConnectionRequest(targetId);
    await refresh();
  }, [targetId, refresh]);

  const remove = useCallback(async () => {
    if (!targetId) return;
    await removeConnection(targetId);
    setStatus(null);
    setDirection(null);
  }, [targetId]);

  const block = useCallback(async () => {
    if (!targetId) return;
    await blockUser(targetId);
    setStatus("blocked");
  }, [targetId]);

  const unblock = useCallback(async () => {
    if (!targetId) return;
    await unblockUser(targetId);
    setStatus(null);
  }, [targetId]);

  return { status, direction, loading, refresh, connect, remove, block, unblock };
}

export function usePendingRequests() {
  const supabase = createClient();
  const [requests, setRequests] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPendingRequests();
      setRequests(data);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session?.user) return;
      channel = supabase
        .channel(`connections:${data.session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "connections",
            filter: `addressee_id=eq.${data.session.user.id}`,
          },
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

  const respond = useCallback(
    async (id: string, action: "accepted" | "declined") => {
      await respondToRequest(id, action);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    },
    []
  );

  return { requests, loading, respond, refresh: load };
}

export function useConnections(userId?: string) {
  const [connections, setConnections] = useState<Awaited<ReturnType<typeof fetchConnections>>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchConnections(userId);
      setConnections(data);
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { connections, loading, refresh: load };
}

export function usePeers(userId: string) {
  const [peers, setPeers] = useState<PeerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchPeers(userId)
      .then((data) => {
        if (active) setPeers(data);
      })
      .catch(() => setPeers([]))
      .finally(() => setLoading(false));
    return () => { active = false; };
  }, [userId]);

  return { peers, loading };
}
