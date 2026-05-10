-- Question system helpers

-- Increment view count (idempotent per session via client, but server allows any increment)
create or replace function public.increment_question_views(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.questions set view_count = view_count + 1 where id = p_question_id;
end;
$$;

-- Auto-update answer_count via trigger
create or replace function public.update_answer_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.questions set answer_count = answer_count + 1 where id = new.question_id;
  elsif tg_op = 'DELETE' then
    update public.questions set answer_count = answer_count - 1 where id = old.question_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_answer_changed on public.answers;
create trigger on_answer_changed
  after insert or delete on public.answers
  for each row execute function public.update_answer_count();

-- Accept answer helper (only question author or moderator/admin)
create or replace function public.accept_answer(p_answer_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id uuid;
  v_question_author uuid;
  v_answer_author uuid;
begin
  select question_id, author_id into v_question_id, v_answer_author from public.answers where id = p_answer_id;
  select author_id into v_question_author from public.questions where id = v_question_id;

  if v_question_author is null then raise exception 'Question not found'; end if;

  -- Allow question author, moderator, or admin
  if v_question_author != p_user_id and not public.is_mod_or_admin(p_user_id) then
    raise exception 'Not authorized';
  end if;

  -- Unaccept any previously accepted answer
  update public.answers set accepted = false where question_id = v_question_id and accepted = true;
  -- Accept the new one
  update public.answers set accepted = true where id = p_answer_id;
  -- Mark question solved
  update public.questions set solved = true where id = v_question_id;

  -- Reputation: +15 to answer author for accepted answer
  if v_answer_author is not null then
    perform public.apply_reputation(v_answer_author, 15, 'Accepted answer', 'answer', p_answer_id);
  end if;
end;
$$;

-- Unaccept answer
create or replace function public.unaccept_answer(p_answer_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id uuid;
  v_question_author uuid;
begin
  select question_id into v_question_id from public.answers where id = p_answer_id;
  select author_id into v_question_author from public.questions where id = v_question_id;

  if v_question_author is null then raise exception 'Question not found'; end if;

  if v_question_author != p_user_id and not public.is_mod_or_admin(p_user_id) then
    raise exception 'Not authorized';
  end if;

  update public.answers set accepted = false where id = p_answer_id;
  update public.questions set solved = false where id = v_question_id;
end;
$$;

-- Reputation for asking a question
create or replace function public.handle_new_question()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_reputation(new.author_id, 5, 'Asked a question', 'question', new.id);
  return new;
end;
$$;

drop trigger if exists on_question_inserted on public.questions;
create trigger on_question_inserted
  after insert on public.questions
  for each row execute function public.handle_new_question();

-- Reputation for posting an answer
create or replace function public.handle_new_answer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_reputation(new.author_id, 10, 'Posted an answer', 'answer', new.id);
  return new;
end;
$$;

drop trigger if exists on_answer_inserted on public.answers;
create trigger on_answer_inserted
  after insert on public.answers
  for each row execute function public.handle_new_answer();

-- Tag tracking table for suggestions
create table if not exists public.tags (
  name text primary key,
  question_count bigint not null default 0,
  created_at timestamptz not null default now()
);

-- Update tag counts when questions change
create or replace function public.update_tag_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_tags text[];
  v_new_tags text[];
  v_tag text;
begin
  if tg_op = 'INSERT' then
    foreach v_tag in array coalesce(new.tags, '{}') loop
      insert into public.tags (name, question_count) values (v_tag, 1)
      on conflict (name) do update set question_count = public.tags.question_count + 1;
    end loop;
  elsif tg_op = 'UPDATE' then
    v_old_tags := coalesce(old.tags, '{}');
    v_new_tags := coalesce(new.tags, '{}');
    foreach v_tag in array v_old_tags loop
      if not (v_tag = any(v_new_tags)) then
        update public.tags set question_count = greatest(0, question_count - 1) where name = v_tag;
      end if;
    end loop;
    foreach v_tag in array v_new_tags loop
      if not (v_tag = any(v_old_tags)) then
        insert into public.tags (name, question_count) values (v_tag, 1)
        on conflict (name) do update set question_count = public.tags.question_count + 1;
      end if;
    end loop;
  elsif tg_op = 'DELETE' then
    foreach v_tag in array coalesce(old.tags, '{}') loop
      update public.tags set question_count = greatest(0, question_count - 1) where name = v_tag;
    end loop;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_question_tags_changed on public.questions;
create trigger on_question_tags_changed
  after insert or update or delete on public.questions
  for each row execute function public.update_tag_counts();

-- Drafts table for autosave
create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  draft_type text not null check (draft_type in ('question','answer')),
  parent_id uuid, -- for answer drafts: question_id
  title text,
  body text,
  tags text[] default '{}',
  updated_at timestamptz not null default now(),
  unique (user_id, draft_type, parent_id)
);

create index if not exists drafts_user_idx on public.drafts (user_id, draft_type, updated_at desc);

alter table public.drafts enable row level security;

create policy "drafts_select_own"
  on public.drafts for select
  using (auth.uid() = user_id);

create policy "drafts_insert_own"
  on public.drafts for insert
  with check (auth.uid() = user_id);

create policy "drafts_update_own"
  on public.drafts for update
  using (auth.uid() = user_id);

create policy "drafts_delete_own"
  on public.drafts for delete
  using (auth.uid() = user_id);
