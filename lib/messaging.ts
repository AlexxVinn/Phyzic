import { createClient } from "./supabase";

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  metadata: Record<string, unknown>;
  created_at: string;
  edited_at: string | null;
  sender?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  unread_count: number;
  pinned: boolean;
  participants: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
    reputation: number;
    role: string;
    status?: string;
    last_seen_at?: string;
  }[];
  last_message?: {
    body: string;
    created_at: string;
    sender_id: string;
  };
}

export async function fetchConversations(): Promise<Conversation[]> {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) return [];
  const userId = session.session.user.id;

  const { data: cpData, error: cpError } = await supabase
    .from("conversation_participants")
    .select("conversation_id, unread_count, pinned")
    .eq("user_id", userId)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(50);
  if (cpError || !cpData?.length) return [];

  const conversationIds = cpData.map((c) => c.conversation_id);

  const [convRes, partRes, msgRes, presenceRes] = await Promise.all([
    supabase.from("conversations").select("id, created_at, updated_at").in("id", conversationIds),
    supabase
      .from("conversation_participants")
      .select(
        `conversation_id, user_id,
        user:profiles(id, username, full_name, avatar_url, reputation, role)`
      )
      .in("conversation_id", conversationIds),
    supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("user_presence").select("user_id, status, last_seen_at").in("user_id", [userId]),
  ]);

  const conversations = (convRes.data || []) as { id: string; created_at: string; updated_at: string }[];
  const participantsRaw = (partRes.data || []) as unknown as {
    conversation_id: string;
    user_id: string;
    user: { id: string; username: string; full_name: string; avatar_url: string | null; reputation: number; role: string };
  }[];
  const messagesRaw = (msgRes.data || []) as unknown as {
    id: string; conversation_id: string; sender_id: string; body: string; created_at: string;
  }[];
  const presenceMap = new Map<string, { status: string; last_seen_at: string }>();
  for (const p of (presenceRes.data || []) as unknown as { user_id: string; status: string; last_seen_at: string }[]) {
    presenceMap.set(p.user_id, { status: p.status, last_seen_at: p.last_seen_at });
  }

  const participantsByConv = new Map<string, Conversation["participants"]>()
  for (const row of participantsRaw) {
    const list = participantsByConv.get(row.conversation_id) || [];
    if (row.user_id !== userId) {
      const pres = presenceMap.get(row.user_id);
      list.push({
        id: row.user.id,
        username: row.user.username,
        full_name: row.user.full_name,
        avatar_url: row.user.avatar_url,
        reputation: row.user.reputation,
        role: row.user.role,
        status: pres?.status,
        last_seen_at: pres?.last_seen_at,
      });
    }
    participantsByConv.set(row.conversation_id, list);
  }

  const lastMessageByConv = new Map<string, { body: string; created_at: string; sender_id: string }>();
  for (const m of messagesRaw) {
    if (!lastMessageByConv.has(m.conversation_id)) {
      lastMessageByConv.set(m.conversation_id, { body: m.body, created_at: m.created_at, sender_id: m.sender_id });
    }
  }

  const cpMap = new Map(cpData.map((c) => [c.conversation_id, c]));

  return conversations
    .map((c) => ({
      id: c.id,
      created_at: c.created_at,
      updated_at: c.updated_at,
      unread_count: cpMap.get(c.id)?.unread_count || 0,
      pinned: cpMap.get(c.id)?.pinned || false,
      participants: participantsByConv.get(c.id) || [],
      last_message: lastMessageByConv.get(c.id),
    }))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      const ta = new Date(a.last_message?.created_at || a.updated_at).getTime();
      const tb = new Date(b.last_message?.created_at || b.updated_at).getTime();
      return tb - ta;
    });
}

export async function fetchMessages(conversationId: string, limit = 50, before?: string): Promise<Message[]> {
  const supabase = createClient();
  let q = supabase
    .from("messages")
    .select(
      `id, conversation_id, sender_id, body, metadata, created_at, edited_at,
      sender:profiles(id, username, full_name, avatar_url)`
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw error;
  return ((data || []) as unknown as Message[]).reverse();
}

export async function sendMessage(conversationId: string, body: string, metadata?: Record<string, unknown>) {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) throw new Error("Not authenticated");
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: session.session.user.id,
    body,
    metadata: metadata || {},
  });
  if (error) throw error;
}

export async function markConversationRead(conversationId: string) {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) return;
  await supabase
    .from("conversation_participants")
    .update({ unread_count: 0, last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", session.session.user.id);
}

export async function togglePinConversation(conversationId: string, pinned: boolean) {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("conversation_participants")
    .update({ pinned, updated_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", session.session.user.id);
  if (error) throw error;
}

export async function ensureConversation(otherUserId: string): Promise<string> {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) throw new Error("Not authenticated");
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    user_a: session.session.user.id,
    user_b: otherUserId,
  });
  if (error) throw error;
  return data as string;
}

export async function setPresence(status: "online" | "away" | "offline") {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) return;
  const { error } = await supabase
    .from("user_presence")
    .upsert({ user_id: session.session.user.id, status, last_seen_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) console.warn("setPresence:", error.message);
}
