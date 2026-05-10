-- Professional academic interaction system: connections, messaging, presence, blocks
-- Tables first, then indexes, then policies, then functions, then triggers.

-- Drop any partially-created tables from earlier failed runs (safe: these are new tables)
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversation_participants CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.connections CASCADE;
DROP TABLE IF EXISTS public.user_presence CASCADE;
DROP TABLE IF EXISTS public.blocks CASCADE;

-- 1) Connections (peer/collaborator relationships)
CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending','accepted','declined','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

-- 2) Conversations (direct message threads)
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Conversation participants
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  unread_count int NOT NULL DEFAULT 0,
  last_read_at timestamptz,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- 4) Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);

-- 5) User presence (online status)
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('online','away','offline')) DEFAULT 'offline',
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- 6) Blocks
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS connections_requester_idx ON public.connections (requester_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS connections_addressee_idx ON public.connections (addressee_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS connections_pair_idx ON public.connections (requester_id, addressee_id);

CREATE INDEX IF NOT EXISTS conversation_participants_user_idx ON public.conversation_participants (user_id, pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversation_participants_conversation_idx ON public.conversation_participants (conversation_id);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON public.messages (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS blocks_blocker_idx ON public.blocks (blocker_id);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON public.blocks (blocked_id);

-- Row Level Security: enable on all tables
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- Policies: connections
CREATE POLICY "connections_select_own"
  ON public.connections FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "connections_insert_own"
  ON public.connections FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "connections_update_own"
  ON public.connections FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "connections_delete_own"
  ON public.connections FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Helper: avoid RLS recursion by checking participation via SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO authenticated;

-- Policies: conversations
CREATE POLICY "conversations_select_participant"
  ON public.conversations FOR SELECT
  USING (public.is_conversation_participant(public.conversations.id));

-- Policies: conversation_participants
CREATE POLICY "conversation_participants_select_own"
  ON public.conversation_participants FOR SELECT
  USING (public.is_conversation_participant(conversation_participants.conversation_id));

CREATE POLICY "conversation_participants_insert_own"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversation_participants_update_own"
  ON public.conversation_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies: messages
CREATE POLICY "messages_select_participant"
  ON public.messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
  ));

CREATE POLICY "messages_insert_sender"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "messages_update_sender"
  ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "messages_delete_sender"
  ON public.messages FOR DELETE
  USING (auth.uid() = sender_id);

-- Policies: presence
CREATE POLICY "presence_select_all"
  ON public.user_presence FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "presence_update_own"
  ON public.user_presence FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "presence_insert_own"
  ON public.user_presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies: blocks
CREATE POLICY "blocks_select_own"
  ON public.blocks FOR SELECT
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

CREATE POLICY "blocks_insert_own"
  ON public.blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "blocks_delete_own"
  ON public.blocks FOR DELETE
  USING (auth.uid() = blocker_id);

-- Helper function to get or create 1:1 conversation
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(user_a uuid, user_b uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid;
BEGIN
  SELECT cp1.conversation_id INTO v_conversation_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = user_a AND cp2.user_id = user_b
    AND (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = cp1.conversation_id) = 2
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO v_conversation_id;
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (v_conversation_id, user_a);
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (v_conversation_id, user_b);

  RETURN v_conversation_id;
END;
$$;

-- Function to get mutual connections count
CREATE OR REPLACE FUNCTION public.get_mutual_connections(viewer_id uuid, target_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM (
    SELECT addressee_id AS peer FROM connections WHERE requester_id = viewer_id AND status = 'accepted'
    UNION
    SELECT requester_id AS peer FROM connections WHERE addressee_id = viewer_id AND status = 'accepted'
  ) viewer_peers
  INNER JOIN (
    SELECT addressee_id AS peer FROM connections WHERE requester_id = target_id AND status = 'accepted'
    UNION
    SELECT requester_id AS peer FROM connections WHERE addressee_id = target_id AND status = 'accepted'
  ) target_peers ON viewer_peers.peer = target_peers.peer;
$$;

-- Trigger: update conversation updated_at and unread counts on new message
CREATE OR REPLACE FUNCTION public.on_message_update_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = new.conversation_id;
  UPDATE public.conversation_participants
  SET unread_count = unread_count + 1, updated_at = now()
  WHERE conversation_id = new.conversation_id AND user_id != new.sender_id;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_message_conversation ON public.messages;
CREATE TRIGGER on_message_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.on_message_update_conversation();

-- Trigger: auto-notify on connection request / accept
CREATE OR REPLACE FUNCTION public.notify_on_connection_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_username text;
BEGIN
  IF new.status = 'pending' THEN
    SELECT username INTO v_requester_username FROM public.profiles WHERE id = new.requester_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      new.addressee_id,
      'follow',
      'New connection request',
      coalesce(v_requester_username, 'Someone') || ' wants to connect',
      '/profile?id=' || new.requester_id
    );
  ELSIF new.status = 'accepted' AND old.status = 'pending' THEN
    SELECT username INTO v_requester_username FROM public.profiles WHERE id = new.addressee_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      new.requester_id,
      'follow',
      'Connection accepted',
      coalesce(v_requester_username, 'Someone') || ' accepted your request',
      '/profile?id=' || new.addressee_id
    );
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_connection_notify ON public.connections;
CREATE TRIGGER on_connection_notify
  AFTER INSERT OR UPDATE OF status ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_connection_request();

-- Trigger: auto-notify on new message
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name text;
  v_recipient_id uuid;
BEGIN
  SELECT username INTO v_sender_name FROM public.profiles WHERE id = new.sender_id;
  FOR v_recipient_id IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = new.conversation_id AND user_id != new.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      v_recipient_id,
      'mention',
      'New message',
      coalesce(v_sender_name, 'Someone') || ': ' || left(new.body, 120),
      '/messages?c=' || new.conversation_id
    );
  END LOOP;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_message_notify ON public.messages;
CREATE TRIGGER on_message_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();
