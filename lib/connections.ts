import { createClient } from "./supabase";

export type ConnectionStatus = "pending" | "accepted" | "declined" | "blocked";

export interface Connection {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
  requester?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
    reputation: number;
  };
  addressee?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
    reputation: number;
  };
}

export interface PeerProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  reputation: number;
  role: string;
  specialization_tags?: string[];
  mutual_count?: number;
}

export async function fetchConnectionStatus(viewerId: string, targetId: string): Promise<{
  status: ConnectionStatus | null;
  direction: "outgoing" | "incoming" | null;
}> {
  const supabase = createClient();
  const { data } = await supabase
    .from("connections")
    .select("status, requester_id, addressee_id")
    .or(
      `and(requester_id.eq.${viewerId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${viewerId})`
    )
    .maybeSingle();
  if (!data) return { status: null, direction: null };
  const direction = data.requester_id === viewerId ? "outgoing" : "incoming";
  return { status: data.status as ConnectionStatus, direction };
}

export async function sendConnectionRequest(targetId: string) {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) throw new Error("Not authenticated");
  const { error } = await supabase.from("connections").insert({
    requester_id: session.session.user.id,
    addressee_id: targetId,
    status: "pending",
  });
  if (error) throw error;
}

export async function respondToRequest(connectionId: string, action: "accepted" | "declined" | "blocked") {
  const supabase = createClient();
  const { error } = await supabase
    .from("connections")
    .update({ status: action, updated_at: new Date().toISOString() })
    .eq("id", connectionId);
  if (error) throw error;
}

export async function removeConnection(targetId: string) {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) throw new Error("Not authenticated");
  const userId = session.session.user.id;
  const { error } = await supabase
    .from("connections")
    .delete()
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${userId})`
    );
  if (error) throw error;
}

export async function blockUser(targetId: string) {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) throw new Error("Not authenticated");
  const userId = session.session.user.id;
  // Upsert block, delete any existing connection
  await supabase
    .from("connections")
    .delete()
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${userId})`
    );
  const { error } = await supabase.from("blocks").insert({ blocker_id: userId, blocked_id: targetId });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function unblockUser(targetId: string) {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", session.session.user.id)
    .eq("blocked_id", targetId);
  if (error) throw error;
}

export async function fetchPendingRequests() {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) return [];
  const { data, error } = await supabase
    .from("connections")
    .select(
      `id, requester_id, addressee_id, status, created_at, updated_at,
      requester:profiles!connections_requester_id_fkey(id, username, full_name, avatar_url, reputation)`
    )
    .eq("addressee_id", session.session.user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data || []) as unknown as Connection[];
}

export async function fetchConnections(userId?: string) {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  const targetId = userId || session.session?.user?.id;
  if (!targetId) return [];
  const { data, error } = await supabase
    .from("connections")
    .select(
      `id, requester_id, addressee_id, status, created_at, updated_at,
      requester:profiles!connections_requester_id_fkey(id, username, full_name, avatar_url, reputation, role),
      addressee:profiles!connections_addressee_id_fkey(id, username, full_name, avatar_url, reputation, role)`
    )
    .eq("status", "accepted")
    .or(`requester_id.eq.${targetId},addressee_id.eq.${targetId}`)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = (data || []) as unknown as Connection[];
  return rows.map((r) => {
    const peer = r.requester_id === targetId ? r.addressee : r.requester;
    return {
      connectionId: r.id,
      peerId: peer?.id || "",
      username: peer?.username || "",
      fullName: peer?.full_name || "",
      avatarUrl: peer?.avatar_url || null,
      reputation: peer?.reputation || 0,
      role: (peer as any)?.role || "user",
      since: r.created_at,
    };
  });
}

export async function fetchPeers(userId: string): Promise<PeerProfile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("connections")
    .select(
      `requester_id, addressee_id,
      requester:profiles!connections_requester_id_fkey(id, username, full_name, avatar_url, reputation, role),
      addressee:profiles!connections_addressee_id_fkey(id, username, full_name, avatar_url, reputation, role)`
    )
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .limit(100);
  if (error) throw error;
  const rows = (data || []) as unknown as Connection[];
  return rows.map((r) => {
    const peer = r.requester_id === userId ? r.addressee : r.requester;
    return {
      id: peer?.id || "",
      username: peer?.username || "",
      full_name: peer?.full_name || "",
      avatar_url: peer?.avatar_url || null,
      reputation: peer?.reputation || 0,
      role: (peer as any)?.role || "user",
    };
  }).filter((p) => p.id);
}
