-- Complete system migration: notifications, missing indexes, and fixes

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('answer','comment','vote','accept','mention','follow','report','system')),
  title text NOT NULL,
  body text NOT NULL,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON public.notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_system"
  ON public.notifications FOR INSERT
  WITH CHECK (false); -- only via security definer triggers/functions

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to auto-create notification on answer
CREATE OR REPLACE FUNCTION public.notify_on_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question_author uuid;
  v_question_title text;
BEGIN
  SELECT author_id, title INTO v_question_author, v_question_title
  FROM public.questions WHERE id = new.question_id;

  IF v_question_author IS NOT NULL AND v_question_author != new.author_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      v_question_author,
      'answer',
      'New answer on your question',
      left(new.body, 200),
      '/question/' || new.question_id
    );
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_answer_notify ON public.answers;
CREATE TRIGGER on_answer_notify
  AFTER INSERT ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_answer();

-- Trigger to auto-create notification on comment to question
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
  v_link text;
BEGIN
  IF new.parent_type = 'question' THEN
    SELECT author_id INTO v_author_id FROM public.questions WHERE id = new.parent_id;
    v_link := '/question/' || new.parent_id;
  ELSE
    SELECT q.author_id INTO v_author_id
    FROM public.answers a
    JOIN public.questions q ON q.id = a.question_id
    WHERE a.id = new.parent_id;
    v_link := '/question/' || (SELECT question_id FROM public.answers WHERE id = new.parent_id);
  END IF;

  IF v_author_id IS NOT NULL AND v_author_id != new.author_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      v_author_id,
      'comment',
      'New comment on your post',
      left(new.body, 200),
      v_link
    );
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_notify ON public.comments;
CREATE TRIGGER on_comment_notify
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- Trigger to notify on vote (only for upvotes on questions/answers)
CREATE OR REPLACE FUNCTION public.notify_on_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
  v_link text;
BEGIN
  IF new.value != 1 THEN RETURN new; END IF;

  IF new.target_type = 'question' THEN
    SELECT author_id INTO v_author_id FROM public.questions WHERE id = new.target_id;
    v_link := '/question/' || new.target_id;
  ELSIF new.target_type = 'answer' THEN
    SELECT author_id INTO v_author_id FROM public.answers WHERE id = new.target_id;
    v_link := '/question/' || (SELECT question_id FROM public.answers WHERE id = new.target_id);
  ELSE
    RETURN new;
  END IF;

  IF v_author_id IS NOT NULL AND v_author_id != new.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      v_author_id,
      'vote',
      'Your ' || new.target_type || ' received an upvote',
      '',
      v_link
    );
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_vote_notify ON public.votes;
CREATE TRIGGER on_vote_notify
  AFTER INSERT ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_vote();

-- Trigger to notify on accepted answer
CREATE OR REPLACE FUNCTION public.notify_on_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question_id uuid;
  v_link text;
BEGIN
  IF new.accepted = true THEN
    SELECT question_id INTO v_question_id FROM public.answers WHERE id = new.id;
    v_link := '/question/' || v_question_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      new.author_id,
      'accept',
      'Your answer was accepted',
      '',
      v_link
    );
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_accept_notify ON public.answers;
CREATE TRIGGER on_accept_notify
  AFTER UPDATE OF accepted ON public.answers
  FOR EACH ROW WHEN (new.accepted = true AND (old.accepted = false OR old.accepted IS NULL))
  EXECUTE FUNCTION public.notify_on_accept();

-- Ensure all profiles have role and status columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS status public.user_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_reason text;

-- Ensure comments table exists with updated_at
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Full-text search helper using simple ilike (no pg_trgm extension assumption)
-- Add search vector column to questions and maintain it via trigger (generated columns require immutable expressions)
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS search_text text;

CREATE OR REPLACE FUNCTION public.compute_question_search_text(
  p_title text,
  p_body text,
  p_tags text[]
) RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(p_title, '') || ' ' || coalesce(p_body, '') || ' ' || coalesce(array_to_string(p_tags, ' '), '');
$$;

CREATE OR REPLACE FUNCTION public.update_question_search_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  new.search_text := public.compute_question_search_text(new.title, new.body, new.tags);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_question_search_text ON public.questions;
CREATE TRIGGER on_question_search_text
  BEFORE INSERT OR UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.update_question_search_text();

-- Backfill existing rows
UPDATE public.questions
SET search_text = public.compute_question_search_text(title, body, tags)
WHERE search_text IS NULL;

-- Enable trigram extension for GIN search (safe to run even if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS questions_search_idx ON public.questions USING gin(search_text gin_trgm_ops);

-- Ensure tags have indexes
CREATE INDEX IF NOT EXISTS tags_name_idx ON public.tags (name);

-- Ensure answers have updated_at
ALTER TABLE public.answers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Function to update updated_at columns automatically
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_question_updated ON public.questions;
CREATE TRIGGER on_question_updated
  BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_answer_updated_at ON public.answers;
CREATE TRIGGER on_answer_updated_at
  BEFORE UPDATE ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_comment_updated ON public.comments;
CREATE TRIGGER on_comment_updated
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Comment votes support (extend votes table check)
-- votes table already allows question/answer; we keep that but can extend via RPC if needed
-- For simplicity, comments use score column but no separate vote table in this version

-- Get user top tags helper
CREATE OR REPLACE FUNCTION public.get_user_top_tags(p_user_id uuid)
RETURNS TABLE(tag text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT unnest(q.tags)::text, count(*)::bigint
  FROM public.questions q
  WHERE q.author_id = p_user_id AND q.tags IS NOT NULL
  GROUP BY unnest(q.tags)
  ORDER BY count(*) DESC
  LIMIT 10;
END;
$$;

-- Recent activity helper for sidebar
CREATE OR REPLACE FUNCTION public.get_recent_activity(limit_count int DEFAULT 5)
RETURNS TABLE(id text, text text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id::text,
    (COALESCE(p.username, 'Someone') || ' asked "' || LEFT(q.title, 60) || '"')::text,
    q.created_at
  FROM public.questions q
  JOIN public.profiles p ON p.id = q.author_id
  ORDER BY q.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Soft delete content function
CREATE OR REPLACE FUNCTION public.soft_delete_content(
  p_table text,
  p_id uuid,
  p_deleted_by uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data jsonb;
BEGIN
  IF p_table = 'questions' THEN
    SELECT to_jsonb(q.*) INTO v_data FROM public.questions q WHERE q.id = p_id;
    DELETE FROM public.questions WHERE id = p_id;
  ELSIF p_table = 'answers' THEN
    SELECT to_jsonb(a.*) INTO v_data FROM public.answers a WHERE a.id = p_id;
    DELETE FROM public.answers WHERE id = p_id;
  ELSIF p_table = 'comments' THEN
    SELECT to_jsonb(c.*) INTO v_data FROM public.comments c WHERE c.id = p_id;
    DELETE FROM public.comments WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Unsupported table: %', p_table;
  END IF;

  INSERT INTO public.deleted_content (original_table, original_id, original_data, deleted_by, deletion_reason)
  VALUES (p_table, p_id, v_data, p_deleted_by, p_reason);

  PERFORM public.log_audit(p_deleted_by, 'content_delete', p_table, p_id, v_data, null, p_reason);
END;
$$;
