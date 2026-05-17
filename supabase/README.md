# Supabase database

PostgreSQL schema and migrations for Phyzic. Apply in **chronological order** (filename sort).

## Migrations (`migrations/`)

| File | Purpose |
|------|---------|
| `20260210000000_profiles.sql` | Core Q&A: profiles, questions, answers, votes, reputation triggers |
| `20260510000000_profile_system.sql` | Follows, saved posts, badges |
| `20260511000000_role_system.sql` | Roles, moderation, audit, reports |
| `20260511000001_question_system.sql` | Views counter, answer count, accept-answer RPC |
| `20260512000000_complete_system.sql` | Notifications and notify triggers |
| `20260513000000_social_system.sql` | Connections, DMs, presence, blocks |

## Apply on a new project

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Run each file in `migrations/` in order (copy/paste full file → Run).
3. Confirm tables and RLS in **Table Editor**.

## Apply with Supabase CLI (optional)

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Requires [Supabase CLI](https://supabase.com/docs/guides/cli) and `supabase login`. Migrations in this folder follow the CLI naming convention.

## New migrations

Add files as:

```
supabase/migrations/YYYYMMDD000000_short_description.sql
```

Update `docs/database-schema.md` and `PROJECT_CONTEXT.md` when you add schema changes.
