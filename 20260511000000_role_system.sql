-- Role & Permission System Migration
-- Enums

create type public.user_role as enum ('admin', 'moderator', 'verified', 'contributor', 'user');
create type public.user_status as enum ('active', 'warned', 'suspended', 'banned');
create type public.audit_action as enum (
  'role_assign', 'role_remove', 'user_warn', 'user_suspend', 'user_ban', 'user_unban',
  'content_delete', 'content_restore', 'content_feature', 'content_unfeature',
  'report_resolve', 'report_dismiss', 'reputation_adjust', 'announcement_create',
  'tag_merge', 'tag_remove', 'settings_change'
);
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.report_reason as enum (
  'spam', 'harassment', 'misinformation', 'off_topic', 'duplicate', 'low_quality', 'other'
);

-- Extend profiles with role and status
alter table public.profiles
  add column if not exists role public.user_role not null default 'user',
  add column if not exists status public.user_status not null default 'active',
  add column if not exists status_expires_at timestamptz,
  add column if not exists status_reason text,
  add column if not exists featured_post_id uuid,
  add column if not exists is_shadow_moderated boolean not null default false;

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);

-- Warnings table
 create table if not exists public.warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  issued_by uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  severity smallint not null default 1 check (severity between 1 and 3),
  acknowledged boolean not null default false,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists warnings_user_idx on public.warnings (user_id, created_at desc);
create index if not exists warnings_issued_by_idx on public.warnings (issued_by, created_at desc);

alter table public.warnings enable row level security;

-- Users can see their own warnings; moderators+ can see all
create policy "warnings_select_own_or_mod"
  on public.warnings for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

create policy "warnings_insert_mod"
  on public.warnings for insert
  with check (
    exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

-- Suspensions table (keeps history)
create table if not exists public.suspensions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  issued_by uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  lifted_at timestamptz,
  lifted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists suspensions_user_idx on public.suspensions (user_id, created_at desc);

alter table public.suspensions enable row level security;

create policy "suspensions_select_mod"
  on public.suspensions for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

create policy "suspensions_insert_mod"
  on public.suspensions for insert
  with check (
    exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

create policy "suspensions_update_admin"
  on public.suspensions for update
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action public.audit_action not null,
  target_type text not null,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_target_idx on public.audit_logs (target_type, target_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action, created_at desc);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_admin"
  on public.audit_logs for select
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

create policy "audit_logs_insert_system"
  on public.audit_logs for insert
  with check (false); -- only via security definer functions

-- Soft delete support for questions, answers, comments
create table if not exists public.deleted_content (
  id uuid primary key default gen_random_uuid(),
  original_table text not null,
  original_id uuid not null,
  original_data jsonb not null,
  deleted_by uuid not null references public.profiles (id) on delete set null,
  deletion_reason text,
  restored_at timestamptz,
  restored_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists deleted_content_table_id_idx on public.deleted_content (original_table, original_id);

alter table public.deleted_content enable row level security;

create policy "deleted_content_select_mod"
  on public.deleted_content for select
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

create policy "deleted_content_insert_mod"
  on public.deleted_content for insert
  with check (
    exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

-- Reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('question','answer','comment','profile')),
  target_id uuid not null,
  reason public.report_reason not null,
  details text,
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at desc);

alter table public.reports enable row level security;

create policy "reports_select_own_or_mod"
  on public.reports for select
  using (
    auth.uid() = reporter_id
    or exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

create policy "reports_insert_own"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

create policy "reports_update_mod"
  on public.reports for update
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

-- Comments table (needed for moderation)
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  parent_type text not null check (parent_type in ('question','answer')),
  parent_id uuid not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  score bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_parent_idx on public.comments (parent_type, parent_id, created_at desc);
create index if not exists comments_author_idx on public.comments (author_id, created_at desc);

alter table public.comments enable row level security;

create policy "comments_select_all"
  on public.comments for select
  using (true);

create policy "comments_insert_own"
  on public.comments for insert
  with check (auth.uid() = author_id);

create policy "comments_update_own_or_mod"
  on public.comments for update
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

create policy "comments_delete_own_or_mod"
  on public.comments for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

-- Update questions/answers policies to allow moderator delete

-- Questions: allow mod/admin to update/delete any
drop policy if exists "questions_update_own" on public.questions;
drop policy if exists "questions_delete_own" on public.questions;

create policy "questions_update_own_or_mod"
  on public.questions for update
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

create policy "questions_delete_own_or_mod"
  on public.questions for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

-- Answers: allow mod/admin to update/delete any
drop policy if exists "answers_update_own" on public.answers;
drop policy if exists "answers_delete_own" on public.answers;

create policy "answers_update_own_or_mod"
  on public.answers for update
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

create policy "answers_delete_own_or_mod"
  on public.answers for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')
    )
  );

-- Profiles: allow admin to update any profile (role, status)
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (
    auth.uid() = id
    or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Reputation: allow admin to insert reputation history
drop policy if exists "reputation_history_insert_system" on public.reputation_history;

create policy "reputation_history_insert_admin"
  on public.reputation_history for insert
  with check (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Helper: is_user_mod_or_admin
create or replace function public.is_mod_or_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = user_id and role in ('admin','moderator')
  );
$$;

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = user_id and role = 'admin'
  );
$$;

create or replace function public.get_user_role(user_id uuid)
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = user_id;
$$;

-- Audit log helper
create or replace function public.log_audit(
  p_actor_id uuid,
  p_action public.audit_action,
  p_target_type text,
  p_target_id uuid,
  p_old_value jsonb default null,
  p_new_value jsonb default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, target_type, target_id, old_value, new_value, reason)
  values (p_actor_id, p_action, p_target_type, p_target_id, p_old_value, p_new_value, p_reason);
end;
$$;

-- Soft delete helper
create or replace function public.soft_delete_content(
  p_table text,
  p_id uuid,
  p_deleted_by uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb;
begin
  if p_table = 'questions' then
    select to_jsonb(t.*) into v_data from public.questions t where id = p_id;
    delete from public.questions where id = p_id;
  elsif p_table = 'answers' then
    select to_jsonb(t.*) into v_data from public.answers t where id = p_id;
    delete from public.answers where id = p_id;
  elsif p_table = 'comments' then
    select to_jsonb(t.*) into v_data from public.comments t where id = p_id;
    delete from public.comments where id = p_id;
  else
    raise exception 'Unsupported table for soft delete: %', p_table;
  end if;

  insert into public.deleted_content (original_table, original_id, original_data, deleted_by, deletion_reason)
  values (p_table, p_id, v_data, p_deleted_by, p_reason);

  perform public.log_audit(p_deleted_by, 'content_delete', p_table, p_id, v_data, null, p_reason);
end;
$$;

-- Restore helper
create or replace function public.restore_content(
  p_deleted_content_id uuid,
  p_restored_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec public.deleted_content%rowtype;
begin
  select * into v_rec from public.deleted_content where id = p_deleted_content_id;
  if not found then return; end if;

  if v_rec.original_table = 'questions' then
    insert into public.questions
    select * from jsonb_populate_record(null::public.questions, v_rec.original_data);
  elsif v_rec.original_table = 'answers' then
    insert into public.answers
    select * from jsonb_populate_record(null::public.answers, v_rec.original_data);
  elsif v_rec.original_table = 'comments' then
    insert into public.comments
    select * from jsonb_populate_record(null::public.comments, v_rec.original_data);
  end if;

  update public.deleted_content
  set restored_at = now(), restored_by = p_restored_by
  where id = p_deleted_content_id;

  perform public.log_audit(p_restored_by, 'content_restore', v_rec.original_table, v_rec.original_id, null, v_rec.original_data, 'Restored from soft delete');
end;
$$;

-- Role assignment helper (admin only)
create or replace function public.assign_role(
  p_target_id uuid,
  p_new_role public.user_role,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.user_role;
begin
  if not public.is_admin(p_actor_id) then
    raise exception 'Admin required';
  end if;

  select role into v_old from public.profiles where id = p_target_id;
  if not found then raise exception 'User not found'; end if;

  update public.profiles set role = p_new_role, updated_at = now() where id = p_target_id;
  perform public.log_audit(p_actor_id, 'role_assign', 'profile', p_target_id, jsonb_build_object('role', v_old), jsonb_build_object('role', p_new_role));
end;
$$;

-- Warning helper
create or replace function public.issue_warning(
  p_user_id uuid,
  p_reason text,
  p_severity smallint,
  p_issued_by uuid,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_mod_or_admin(p_issued_by) then
    raise exception 'Moderator or admin required';
  end if;

  insert into public.warnings (user_id, issued_by, reason, severity, expires_at)
  values (p_user_id, p_issued_by, p_reason, p_severity, p_expires_at);

  update public.profiles set status = 'warned', status_reason = p_reason, updated_at = now() where id = p_user_id;

  perform public.log_audit(p_issued_by, 'user_warn', 'profile', p_user_id, null, jsonb_build_object('reason', p_reason, 'severity', p_severity));
end;
$$;

-- Suspend helper
create or replace function public.suspend_user(
  p_user_id uuid,
  p_reason text,
  p_ends_at timestamptz,
  p_issued_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_mod_or_admin(p_issued_by) then
    raise exception 'Moderator or admin required';
  end if;

  insert into public.suspensions (user_id, issued_by, reason, ends_at)
  values (p_user_id, p_issued_by, p_reason, p_ends_at);

  update public.profiles
  set status = 'suspended', status_expires_at = p_ends_at, status_reason = p_reason, updated_at = now()
  where id = p_user_id;

  perform public.log_audit(p_issued_by, 'user_suspend', 'profile', p_user_id, null, jsonb_build_object('reason', p_reason, 'ends_at', p_ends_at));
end;
$$;

-- Ban helper (admin only)
create or replace function public.ban_user(
  p_user_id uuid,
  p_reason text,
  p_issued_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(p_issued_by) then
    raise exception 'Admin required';
  end if;

  update public.profiles
  set status = 'banned', status_expires_at = null, status_reason = p_reason, updated_at = now()
  where id = p_user_id;

  perform public.log_audit(p_issued_by, 'user_ban', 'profile', p_user_id, null, jsonb_build_object('reason', p_reason));
end;
$$;

-- Unban helper (admin only)
create or replace function public.unban_user(
  p_user_id uuid,
  p_lifted_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(p_lifted_by) then
    raise exception 'Admin required';
  end if;

  update public.profiles
  set status = 'active', status_expires_at = null, status_reason = null, updated_at = now()
  where id = p_user_id;

  perform public.log_audit(p_lifted_by, 'user_unban', 'profile', p_user_id, null, null);
end;
$$;

-- Reputation adjustment helper (admin only)
create or replace function public.adjust_reputation(
  p_user_id uuid,
  p_delta bigint,
  p_reason text,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(p_actor_id) then
    raise exception 'Admin required';
  end if;

  perform public.apply_reputation(p_user_id, p_delta, p_reason, 'admin_adjustment', null);
  perform public.log_audit(p_actor_id, 'reputation_adjust', 'profile', p_user_id, null, jsonb_build_object('delta', p_delta, 'reason', p_reason));
end;
$$;

-- Feature post helper (admin only)
create or replace function public.feature_post(
  p_post_type text,
  p_post_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(p_actor_id) then
    raise exception 'Admin required';
  end if;

  -- Store in a features table for scalability
  insert into public.featured_posts (post_type, post_id, featured_by)
  values (p_post_type, p_post_id, p_actor_id)
  on conflict (post_type, post_id) do nothing;

  perform public.log_audit(p_actor_id, 'content_feature', p_post_type, p_post_id, null, null);
end;
$$;

-- Featured posts table
create table if not exists public.featured_posts (
  id uuid primary key default gen_random_uuid(),
  post_type text not null check (post_type in ('question','answer')),
  post_id uuid not null,
  featured_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_type, post_id)
);

create index if not exists featured_posts_created_idx on public.featured_posts (created_at desc);

alter table public.featured_posts enable row level security;

create policy "featured_posts_select_all"
  on public.featured_posts for select
  using (true);

create policy "featured_posts_insert_admin"
  on public.featured_posts for insert
  with check (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "featured_posts_delete_admin"
  on public.featured_posts for delete
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Rate limiting table (lightweight; cleanup via cron)
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  window_start timestamptz not null default now(),
  count int not null default 1
);

create index if not exists rate_limits_user_action_idx on public.rate_limits (user_id, action, window_start desc);

alter table public.rate_limits enable row level security;

create policy "rate_limits_select_own"
  on public.rate_limits for select
  using (auth.uid() = user_id);

create policy "rate_limits_insert_own"
  on public.rate_limits for insert
  with check (auth.uid() = user_id);

-- Update handle_new_user to set default role
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, bio, avatar_url, reputation, role, status)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'username'), ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), ''),
    '',
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
    0,
    'user',
    'active'
  )
  on conflict (id) do update set
    username = excluded.username,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$;
