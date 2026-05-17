# Phyzic — Project Context for AI Assistants

## 1. Overview

Phyzic is a **physics-focused Q&A and academic collaboration platform** — discussion-led threads and math at the center; DMs and connections support collaboration without replacing the forum. Product vision, positioning, and UX anti-patterns: `docs/platform-identity.md`. It supports LaTeX/MathJax, reputation, roles, moderation, real-time direct messaging, peer connections, and notifications.

- **Repo**: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **No ORM**: Raw Supabase client queries via `@supabase/supabase-js`

---

## 2. Critical Rules

### Next.js 16 is NOT standard Next.js
This is **Next.js 16.2.6** with breaking changes. Before writing any Next.js API code, read `node_modules/next/dist/docs/` for current conventions. Heed deprecation notices.

### Do NOT assume standard Next.js patterns
- App Router is used, but APIs/conventions differ from training data.
- Always check existing files before adding new routing/API patterns.

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.6 (App Router) |
| React | 19.2.4 |
| Styling | Tailwind CSS v4 + custom CSS files in `app/styles/` |
| Fonts | Geist Sans + Geist Mono (Google Fonts) |
| Backend | Supabase (PostgreSQL, Auth, Realtime) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Realtime | Supabase Realtime (postgres_changes subscriptions) |
| Types | TypeScript 5 (strict) |

---

## 4. File Architecture

```
app/
  layout.tsx           # Root layout: fonts, ThemeScript, MathJaxLoader, AuthProvider, PresenceProvider
  globals.css          # Tailwind imports + custom theme variables
  page.tsx             # Home: question feed, featured discussions, leaderboard sidebar
  ask/page.tsx         # Ask question form
  login/page.tsx       # Sign in (email + Google)
  signup/page.tsx      # Sign up
  profile/page.tsx     # User profile (about, questions, answers, activity, saved, connections)
  question/[id]/       # Question detail + answers + comments
  question/[id]/edit/  # Edit question
  messages/page.tsx    # DM landing page (chat dock is the real UI)
  admin/page.tsx       # Admin dashboard
  moderator/page.tsx   # Moderator dashboard
  leaderboard/page.tsx # Reputation leaderboard
  settings/page.tsx    # User settings
  styles/              # Custom CSS (NOT Tailwind)
    variables.css      # Light/dark theme tokens
    layout.css         # App shell, responsive grid
    header.css         # Navbar styles
    feed.css           # Question feed cards
    question.css       # Question detail page
    profile.css        # Profile page
    chat.css           # Chat dock, messages, formula keyboard
    leaderboard.css
    settings.css
    utilities.css
    sidebar.css

components/
  AuthProvider.tsx     # Auth context: user, session, profile, signIn/Out, profile CRUD
  Navbar.tsx           # Sticky header: search, theme toggle, notifs, connection requests, profile menu, ChatDock
  Sidebar.tsx          # Left nav: home, ask, leaderboard, profile, admin links
  QuestionCard.tsx     # Feed question card
  VoteControls.tsx     # Up/downvote widget
  Avatar.tsx           # Avatar with fallback initials
  RoleBadge.tsx        # Role/status badges
  Markdown.tsx         # Markdown renderer
  MathJaxLoader.tsx    # MathJax script injection
  ThemeScript.tsx      # Prevents FOUC for dark mode
  ConnectionButton.tsx # "Add colleague" / connection management
  MessageButton.tsx    # "Message" button (creates DM)
  ConnectionRequestsPopover.tsx # Pending requests dropdown in navbar
  ChatDock.tsx         # Collapsible bottom-right messaging panel
  PresenceProvider.tsx # Presence heartbeat wrapper
  PermissionGuard.tsx  # Route guards based on role
  EmptyState.tsx

lib/
  supabase.ts          # Browser Supabase client (createClient)
  supabase-server.ts   # Server-side Supabase client
  utils.ts             # fmtRep, fmtDate, fmtShortDate, stripMarkdown, escapeHtml, initials
  questions.ts         # Question/Answer/Comment types + SortMode
  permissions.ts       # Role/status permission functions
  connections.ts       # Connection/Friend system API
  messaging.ts         # DM/Chat system API

hooks/
  useQuestions.ts      # useQuestionsFeed, useQuestion, useTags, useVote
  useNotifications.ts  # Notification polling + realtime
  usePermissions.ts    # Role-based permission hooks
  useSearch.ts         # Global search hook
  useConnections.ts    # Connection status, pending requests, peers
  useMessaging.ts      # Conversations, messages, presence heartbeat

supabase/
  migrations/          # SQL migrations (run in filename order — see supabase/README.md)
  README.md

docs/                  # Architecture and design documentation
```

---

## 5. Supabase Configuration

The browser client is hardcoded in `lib/supabase.ts`:
- URL: `https://gysfiojtcvjejkhrqgky.supabase.co`
- Auth: PKCE flow, persistSession, autoRefreshToken

**Do NOT commit secrets**. The anon key is already present but is considered public. For server-side operations use `supabase-server.ts`.

---

## 6. Database Schema (Key Tables)

### Core Q&A
- `profiles` — id, username, full_name, bio, avatar_url, reputation, role, status, created_at, updated_at
- `questions` — id, author_id, title, body, tags[], score, answer_count, view_count, solved, search_text, created_at, updated_at
- `answers` — id, question_id, author_id, body, score, accepted, created_at, updated_at
- `comments` — id, parent_type ('question'|'answer'), parent_id, author_id, body, created_at, updated_at
- `votes` — id, user_id, target_type ('question'|'answer'), target_id, value (1|-1), created_at
- `saved_posts` — id, user_id, post_type, post_id, created_at
- `tags` — id, name, question_count
- `reports` — id, reporter_id, target_type, target_id, reason, details, status, created_at

### Reputation & Notifications
- `reputation_history` — id, user_id, delta, reason, source_type, source_id, created_at
- `notifications` — id, user_id, type, title, body, link, read, created_at
  - Types: `answer`, `comment`, `vote`, `accept`, `mention`, `follow`, `report`, `system`
  - Auto-created by triggers on answers, comments, votes, accepts, connections, messages

### Social System (new)
- `connections` — id, requester_id, addressee_id, status ('pending'|'accepted'|'declined'|'blocked'), created_at, updated_at
- `conversations` — id, created_at, updated_at
- `conversation_participants` — id, conversation_id, user_id, unread_count, last_read_at, pinned, created_at, updated_at
- `messages` — id, conversation_id, sender_id, body, metadata (jsonb), created_at, edited_at
- `user_presence` — user_id (PK), status ('online'|'away'|'offline'), last_seen_at
- `blocks` — id, blocker_id, blocked_id, created_at

### Roles & Status
- `user_role` enum: `admin`, `moderator`, `verified`, `contributor`, `user`
- `user_status` enum: `active`, `warned`, `suspended`, `banned`

---

## 7. Key Patterns & Conventions

### Auth
- All data fetching goes through Supabase client. No REST API routes.
- Server components use `supabase-server.ts` with cookie-based auth.
- Client components use `lib/supabase.ts` (browser client).
- `AuthProvider` wraps the app and exposes: user, session, profile, signInEmail, signUpEmail, signInGoogle, signOut, updateProfile, uploadAvatar, fetchProfile, etc.

### Realtime Subscriptions
- Pattern: get session → get userId → create channel → subscribe → cleanup on unmount.
- Always remove channels on cleanup to avoid leaks.
- See `hooks/useNotifications.ts`, `hooks/useConnections.ts`, `hooks/useMessaging.ts` for the exact pattern.

### Styling
- Tailwind v4 with `@theme inline` in `globals.css`.
- Custom CSS lives in `app/styles/*.css`.
- CSS variables handle light/dark mode via `data-theme` attribute on `<html>`.
- Theme toggle saves to `localStorage` key `phyzic_theme`.
- Dark mode values are in `variables.css` under `:root[data-theme="dark"]`.

### Components
- UI is extremely dense, compact, and technical.
- No cards with large shadows. No bubbly chat UIs. No social-media gradients.
- Buttons are small (~24-30px height), text is 11-13px.
- Borders are subtle (`1px solid var(--border)`).
- Use existing component patterns (Avatar, RoleBadge, VoteControls) before inventing new ones.

### Error Handling
- Client-side: `try/catch` around Supabase calls, `alert()` for user-facing errors.
- No global error boundary currently.

### URL Patterns
- Profile: `/profile?u=username` or `/profile?id=userId`
- Question: `/question/{id}`
- Messages: `/messages?c=conversationId`
- Search: no route, uses in-navbar popover

---

## 8. Important Hooks Reference

| Hook | Purpose |
|------|---------|
| `useAuth()` | Current user, profile, session, auth actions |
| `usePermissions()` | Derived booleans: canPost, canEditAnyContent, canDeleteAnyContent, isStaff, etc. |
| `useNotifications()` | Notifications array + unreadCount + markRead/markAllRead + realtime |
| `useQuestionsFeed(sort, tag, search)` | Infinite-scroll question list |
| `useQuestion(id)` | Single question + answers + comments + votes |
| `useVote()` | vote(type, id, value) / unvote(type, id) |
| `useSearch(query)` | Global search results |
| `useConnectionStatus(viewerId, targetId)` | Connection state between two users |
| `usePendingRequests()` | Incoming pending connection requests + realtime |
| `useConnections(userId?)` | Accepted connections list |
| `usePeers(userId)` | Peer profiles for a user |
| `useConversations()` | DM conversation list + unread + pinning + realtime |
| `useMessages(conversationId)` | Messages for a thread + send + loadMore + realtime |
| `useEnsureConversation()` | Creates 1:1 conversation with another user |
| `usePresenceHeartbeat()` | Sets online/away/offline every 30s |

---

## 9. Keyboard Shortcuts (implemented)

| Key | Action |
|-----|--------|
| `/` | Focus global search |
| `m` | Toggle chat dock |
| `Escape` | Close all popovers/search/chat |

---

## 10. Build & Dev

```bash
npm run dev      # Turbopack dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

---

## 11. Adding New Features — Checklist

Before implementing anything new:
1. Check if a Supabase table already exists in the migrations.
2. Check `lib/` for existing API functions (e.g., `lib/connections.ts`, `lib/messaging.ts`).
3. Check `hooks/` for existing data hooks.
4. Check `components/` for reusable UI pieces.
5. Match existing visual style: compact, dense, technical, minimal borders.
6. If adding DB tables, add `supabase/migrations/YYYYMMDD000000_feature.sql` and document it in `docs/database-schema.md`.
7. If modifying DB schema, also update `lib/` and `hooks/` types.
8. Run `npm run build` before declaring done — TypeScript is strict.

---

## 12. Known Quirks

- **Supabase client is created fresh in many components** rather than passed down. This is intentional for SSR/CSR safety.
- **Avatar component uses inline styles**, not Tailwind classes, for precise sizing.
- **MathJax is loaded via CDN** in `MathJaxLoader.tsx` — do not npm-install MathJax.
- **No form library** — all forms use native controlled inputs.
- **No state management library** — all state is React `useState`/`useCallback` + Supabase realtime.
- **Migration files are NOT run automatically** — must be executed manually in the Supabase SQL Editor.

---

## 13. Contact / Support

- For Supabase issues: check RLS policies first — most data access errors are policy-related.
- For build errors: this is Next.js 16, not standard Next.js 14/15. Check `node_modules/next/dist/docs/`.
