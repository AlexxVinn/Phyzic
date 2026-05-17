create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);

create index if not exists follows_follower_idx on public.follows (follower_id, created_at desc);
create index if not exists follows_following_idx on public.follows (following_id, created_at desc);

alter table public.follows enable row level security;

create policy "follows_select_all"
  on public.follows for select
  using (true);

create policy "follows_insert_own"
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy "follows_delete_own"
  on public.follows for delete
  using (auth.uid() = follower_id);

create table if not exists public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_type text not null check (post_type in ('question','answer')),
  post_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, post_type, post_id)
);

create index if not exists saved_posts_user_idx on public.saved_posts (user_id, created_at desc);

alter table public.saved_posts enable row level security;

create policy "saved_posts_select_own"
  on public.saved_posts for select
  using (auth.uid() = user_id);

create policy "saved_posts_insert_own"
  on public.saved_posts for insert
  with check (auth.uid() = user_id);

create policy "saved_posts_delete_own"
  on public.saved_posts for delete
  using (auth.uid() = user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);
create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at desc);

alter table public.messages enable row level security;

create policy "messages_select_participant"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "messages_insert_own"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "messages_update_recipient"
  on public.messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Reputation history is public for profile pages
drop policy if exists "reputation_history_select_own" on public.reputation_history;
create policy "reputation_history_select_all"
  on public.reputation_history for select
  using (true);

-- Badge tracking (badges-ready section)
create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_type text not null,
  badge_name text not null,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_type, badge_name)
);

create index if not exists user_badges_user_idx on public.user_badges (user_id, awarded_at desc);

alter table public.user_badges enable row level security;

create policy "user_badges_select_all"
  on public.user_badges for select
  using (true);
