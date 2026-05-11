# Backend Architecture

## Supabase as the Entire Backend

Phyzic uses **no custom API routes**. All backend logic lives in Supabase (PostgreSQL + Auth + Realtime + Storage).

## Auth

- **Provider**: Supabase Auth
- **Methods**: Email/password + Google OAuth (PKCE flow)
- **Session**: `persistSession: true`, `autoRefreshToken: true`, `flowType: "pkce"`
- **Auto-profile creation**: DB trigger `on_auth_user_created` on `auth.users` inserts a `profiles` row on signup
- **OAuth callback**: `app/auth/callback/page.tsx` handles the PKCE redirect

### Client Setup

| Context | File | Method |
|---------|------|--------|
| Browser | `lib/supabase.ts` | `createBrowserClient()` from `@supabase/ssr` |
| Server | `lib/supabase-server.ts` | `createServerClient()` with cookie helpers |

Both use the same Supabase URL and anon key. The anon key is public (RLS protects data).

## Data Access Layer (`lib/`)

No ORM. All queries use the Supabase JS client directly.

| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Browser client factory |
| `lib/supase-server.ts` | Server client factory (cookie-based) |
| `lib/questions.ts` | Types: `Question`, `Answer`, `Comment`, `SortMode` |
| `lib/permissions.ts` | Role hierarchy + permission checks (`canVote`, `canPost`, `canModerate`, etc.) |
| `lib/connections.ts` | Connection API: send/accept/decline/block, fetch pending/accepted/peers |
| `lib/messaging.ts` | DM API: fetch conversations, messages, send, mark read, pin, ensure conversation, set presence |
| `lib/utils.ts` | `escapeHtml`, `fmtRep`, `fmtDate`, `fmtShortDate`, `stripMarkdown`, `initials`, `safeNumber` |

## Database Logic (PostgreSQL)

### Triggers & Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `handle_new_user()` | `on_auth_user_created` | Auto-create profile on signup |
| `handle_vote()` | `on_vote_inserted` | Update score + apply reputation on vote |
| `handle_vote_deleted()` | `on_vote_deleted` | Reverse score + reputation on vote removal |
| `handle_accepted_answer()` | `on_answer_updated` | +25 rep on accept, -25 on unaccept |
| `update_answer_count()` | `on_answer_changed` | Auto-maintain `answer_count` on questions |
| `notify_on_answer()` | After answer insert | Auto-create notification for question author |
| `notify_on_comment()` | After comment insert | Auto-create notification for parent owner |
| `notify_on_vote()` | After vote insert | Auto-create notification for content author |
| `notify_on_accept()` | After accept update | Auto-create notification for answer author |
| `accept_answer()` | Called via RPC | Security-definer: only question author or mod can accept |
| `increment_question_views()` | Called via RPC | Increment view count |
| `get_or_create_conversation()` | Called via RPC | Find or create 1:1 conversation between two users |
| `is_conversation_participant()` | Used in RLS | Security-definer check for conversation membership |
| `apply_reputation()` | Called by triggers | Atomic reputation update + history log |

### Reputation Values

| Event | Delta |
|-------|-------|
| Upvote received | +10 |
| Downvote received | -2 |
| Upvote removed | -10 |
| Downvote removed | +2 |
| Answer accepted | +25 |
| Answer unaccepted | -25 |

## Realtime

Supabase Realtime (`postgres_changes`) powers live updates:

- **Notifications** — new notification appears instantly
- **Connections** — pending requests update in real-time
- **Messages** — new messages stream into ChatDock
- **Presence** — heartbeat every 30s sets `user_presence` status

Pattern (in hooks):
```ts
const channel = supabase.channel('name')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'x', filter: ... }, callback)
  .subscribe();
// cleanup: supabase.removeChannel(channel)
```

## Storage

- **Avatar uploads**: Supabase Storage bucket, uploaded via `AuthProvider.uploadAvatar()`
- No other storage buckets currently

## Row Level Security (RLS)

Every table has RLS enabled. Key patterns:

- **Public read**: `profiles`, `questions`, `answers` (select all)
- **Own data only**: `votes`, `saved_posts`, `notifications` (user can see/modify only their own)
- **Participant-based**: `messages`, `conversation_participants` (only participants can read)
- **Role-gated**: `warnings`, `suspensions`, `audit_logs` (moderator+ or admin only)
- **System-only insert**: `notifications`, `reputation_history`, `audit_logs` (only via security-definer triggers/functions, direct INSERT denied)
