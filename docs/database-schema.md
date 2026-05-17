# Database Schema

Supabase PostgreSQL. All tables have RLS enabled. Migration files live in `supabase/migrations/` and are applied in filename order (see `supabase/README.md`).

## Migration Files (chronological order)

| File | Contents |
|------|----------|
| `supabase/migrations/20260210000000_profiles.sql` | profiles, reputation_history, questions, answers, votes, handle_new_user trigger, vote/accept reputation triggers |
| `supabase/migrations/20260510000000_profile_system.sql` | follows, saved_posts, messages (simple), user_badges |
| `supabase/migrations/20260511000000_role_system.sql` | user_role/user_status enums, role+status columns on profiles, warnings, suspensions, audit_logs, deleted_content, reports |
| `supabase/migrations/20260511000001_question_system.sql` | increment_question_views, update_answer_count trigger, accept_answer RPC |
| `supabase/migrations/20260512000000_complete_system.sql` | notifications table + auto-notify triggers (answer, comment, vote, accept, connection, message) |
| `supabase/migrations/20260513000000_social_system.sql` | connections, conversations, conversation_participants, messages (replaces simple), user_presence, blocks, get_or_create_conversation RPC |

## Enums

```sql
user_role      → 'admin' | 'moderator' | 'verified' | 'contributor' | 'user'
user_status    → 'active' | 'warned' | 'suspended' | 'banned'
audit_action   → 'role_assign' | 'role_remove' | 'user_warn' | ... (18 values)
report_status  → 'open' | 'reviewing' | 'resolved' | 'dismissed'
report_reason  → 'spam' | 'harassment' | 'misinformation' | 'off_topic' | 'duplicate' | 'low_quality' | 'other'
```

## Tables

### Core Q&A

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `profiles` | id (uuid PK → auth.users), username (unique), full_name, bio, avatar_url, reputation, role, status, status_expires_at, status_reason, featured_post_id, is_shadow_moderated | Auto-created on signup via trigger |
| `questions` | id, author_id → profiles, title, body, tags[], score, answer_count, view_count, solved, search_text, created_at, updated_at | Public read; author-only write |
| `answers` | id, question_id → questions, author_id → profiles, body, score, accepted, created_at, updated_at | Public read; author-only write |
| `comments` | id, parent_type ('question'\|'answer'), parent_id, author_id → profiles, body, score, created_at, updated_at | — |
| `votes` | id, user_id → profiles, target_type ('question'\|'answer'), target_id, value (1\|-1), created_at | Unique per (user, target_type, target_id) |
| `tags` | id, name, question_count | — |

### Reputation & Notifications

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `reputation_history` | id, user_id, delta, reason, source_type, source_id, created_at | System-only insert (via triggers) |
| `notifications` | id, user_id, type, title, body, link, read, created_at | Types: answer, comment, vote, accept, mention, follow, report, system |
| `user_badges` | id, user_id, badge_type, badge_name, awarded_at | Unique per (user, badge_type, badge_name) |

### Social

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `follows` | follower_id → profiles, following_id → profiles, created_at | PK: (follower_id, following_id) |
| `connections` | id, requester_id → profiles, addressee_id → profiles, status ('pending'\|'accepted'\|'declined'\|'blocked'), created_at, updated_at | Unique: (requester_id, addressee_id) |
| `conversations` | id, created_at, updated_at | — |
| `conversation_participants` | id, conversation_id → conversations, user_id → profiles, unread_count, last_read_at, pinned, created_at, updated_at | Unique: (conversation_id, user_id) |
| `messages` | id, conversation_id → conversations, sender_id → profiles, body, metadata (jsonb), created_at, edited_at | Replaces earlier simple messages table |
| `user_presence` | user_id (PK) → profiles, status ('online'\|'away'\|'offline'), last_seen_at | Upserted by heartbeat |
| `blocks` | id, blocker_id → profiles, blocked_id → profiles, created_at | Unique: (blocker_id, blocked_id) |

### Moderation & Admin

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `warnings` | id, user_id, issued_by, reason, severity (1-3), acknowledged, acknowledged_at, created_at, expires_at | Users see own; mods see all |
| `suspensions` | id, user_id, issued_by, reason, starts_at, ends_at, lifted_at, lifted_by, created_at | Users see own; mods see all |
| `audit_logs` | id, actor_id, action (audit_action), target_type, target_id, old_value (jsonb), new_value (jsonb), reason, ip_address, created_at | Staff-only read; system-only insert |
| `reports` | id, reporter_id, target_type, target_id, reason (report_reason), details, status (report_status), created_at | — |
| `deleted_content` | id, original_table, original_id, original_data (jsonb), deleted_by, deletion_reason, restored_at, restored_by, created_at | Soft-delete archive |

### Saved Content

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `saved_posts` | id, user_id, post_type ('question'\|'answer'), post_id, created_at | Unique: (user_id, post_type, post_id) |

## Entity Relationships

```
auth.users ──1:1── profiles
profiles ──1:N── questions (author)
profiles ──1:N── answers (author)
profiles ──1:N── comments (author)
profiles ──1:N── votes (user)
profiles ──1:N── notifications (user)
profiles ──1:N── warnings (user)
profiles ──1:N── suspensions (user)
profiles ──1:N── reputation_history (user)
profiles ──1:N── saved_posts (user)
profiles ──1:N── user_badges (user)

questions ──1:N── answers
questions ──1:N── comments (parent_type='question')
answers ──1:N── comments (parent_type='answer')

conversations ──1:N── conversation_participants ──N:1── profiles
conversations ──1:N── messages

profiles ──M:N── follows (follower/following)
profiles ──M:N── connections (requester/addressee)
profiles ──M:N── blocks (blocker/blocked)
```
