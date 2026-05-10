create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  full_name text,
  bio text,
  avatar_url text,
  reputation bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists profiles_reputation_idx on public.profiles (reputation desc);

alter table public.profiles enable row level security;

create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create table if not exists public.reputation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta bigint not null,
  reason text not null,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists reputation_history_user_idx on public.reputation_history (user_id, created_at desc);

alter table public.reputation_history enable row level security;

create policy "reputation_history_select_own"
  on public.reputation_history for select
  using (auth.uid() = user_id);

create policy "reputation_history_insert_system"
  on public.reputation_history for insert
  with check (false);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  tags text[] default '{}',
  score bigint not null default 0,
  answer_count bigint not null default 0,
  view_count bigint not null default 0,
  solved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists questions_author_idx on public.questions (author_id);
create index if not exists questions_created_idx on public.questions (created_at desc);

alter table public.questions enable row level security;

create policy "questions_select_all"
  on public.questions for select
  using (true);

create policy "questions_insert_own"
  on public.questions for insert
  with check (auth.uid() = author_id);

create policy "questions_update_own"
  on public.questions for update
  using (auth.uid() = author_id);

create policy "questions_delete_own"
  on public.questions for delete
  using (auth.uid() = author_id);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  score bigint not null default 0,
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists answers_question_idx on public.answers (question_id);
create index if not exists answers_author_idx on public.answers (author_id);

alter table public.answers enable row level security;

create policy "answers_select_all"
  on public.answers for select
  using (true);

create policy "answers_insert_own"
  on public.answers for insert
  with check (auth.uid() = author_id);

create policy "answers_update_own"
  on public.answers for update
  using (auth.uid() = author_id);

create policy "answers_delete_own"
  on public.answers for delete
  using (auth.uid() = author_id);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('question','answer')),
  target_id uuid not null,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create index if not exists votes_target_idx on public.votes (target_type, target_id);

alter table public.votes enable row level security;

create policy "votes_select_own"
  on public.votes for select
  using (auth.uid() = user_id);

create policy "votes_insert_own"
  on public.votes for insert
  with check (auth.uid() = user_id);

create policy "votes_delete_own"
  on public.votes for delete
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, bio, avatar_url, reputation)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'username'), ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), ''),
    '',
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
    0
  )
  on conflict (id) do update set
    username = excluded.username,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.apply_reputation(
  p_user_id uuid,
  p_delta bigint,
  p_reason text,
  p_source_type text default null,
  p_source_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reputation_history (user_id, delta, reason, source_type, source_id)
  values (p_user_id, p_delta, p_reason, p_source_type, p_source_id);

  update public.profiles
  set reputation = reputation + p_delta,
      updated_at = now()
  where id = p_user_id;
end;
$$;

create or replace function public.handle_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_delta bigint;
  v_target_author uuid;
begin
  if new.target_type = 'question' then
    select author_id into v_target_author from public.questions where id = new.target_id;
    update public.questions set score = score + new.value where id = new.target_id;
  elsif new.target_type = 'answer' then
    select author_id into v_target_author from public.answers where id = new.target_id;
    update public.answers set score = score + new.value where id = new.target_id;
  end if;

  if v_target_author is not null and v_target_author != new.user_id then
    if new.value = 1 then
      v_delta := 10;
    else
      v_delta := -2;
    end if;
    perform public.apply_reputation(v_target_author, v_delta, 'Vote ' || case when new.value = 1 then 'up' else 'down' end, new.target_type, new.target_id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_vote_inserted on public.votes;
create trigger on_vote_inserted
  after insert on public.votes
  for each row execute function public.handle_vote();

create or replace function public.handle_vote_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_delta bigint;
begin
  if old.target_type = 'question' then
    select author_id into v_author_id from public.questions where id = old.target_id;
    update public.questions set score = score - old.value where id = old.target_id;
  elsif old.target_type = 'answer' then
    select author_id into v_author_id from public.answers where id = old.target_id;
    update public.answers set score = score - old.value where id = old.target_id;
  end if;

  if v_author_id is not null and v_author_id != old.user_id then
    if old.value = 1 then
      v_delta := -10;
    else
      v_delta := 2;
    end if;
    perform public.apply_reputation(v_author_id, v_delta, 'Vote removed', old.target_type, old.target_id);
  end if;

  return old;
end;
$$;

drop trigger if exists on_vote_deleted on public.votes;
create trigger on_vote_deleted
  after delete on public.votes
  for each row execute function public.handle_vote_deleted();

create or replace function public.handle_accepted_answer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.accepted = true and (old is null or old.accepted = false) then
    perform public.apply_reputation(new.author_id, 25, 'Accepted answer', 'answer', new.id);
  elsif old.accepted = true and new.accepted = false then
    perform public.apply_reputation(new.author_id, -25, 'Unaccepted answer', 'answer', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_answer_updated on public.answers;
create trigger on_answer_updated
  after update of accepted on public.answers
  for each row execute function public.handle_accepted_answer();