# Frontend Architecture

## App Router Structure

All pages live under `app/` using Next.js App Router conventions.

```
app/
  layout.tsx              → Root layout: fonts, ThemeScript, MathJaxLoader, AuthProvider, PresenceProvider
  globals.css             → Tailwind imports + @theme inline mapping + style sheet imports
  page.tsx                → Home: question feed, sidebar, leaderboard
  ask/page.tsx            → Ask question form with live preview
  login/page.tsx          → Sign in (email + Google OAuth)
  signup/page.tsx         → Sign up
  auth/callback/page.tsx  → OAuth callback handler
  profile/page.tsx        → User profile (about, questions, answers, activity, saved, connections)
  question/[id]/page.tsx  → Question detail + answers + comments
  question/[id]/edit/     → Edit question
  messages/page.tsx       → DM landing (chat dock is the real UI)
  admin/page.tsx          → Admin dashboard
  moderator/page.tsx      → Moderator dashboard
  leaderboard/page.tsx    → Reputation leaderboard
  settings/page.tsx       → User settings
  styles/                 → Custom CSS (NOT Tailwind utilities)
```

## Component Tree

```
RootLayout
  ThemeScript (inline, prevents FOUC)
  MathJaxLoader (injects MathJax CDN script)
  AuthProvider (context: user, session, profile, auth actions)
    PresenceProvider (heartbeat: online/away/offline every 30s)
      [page content]
        Navbar (sticky, search, theme toggle, notifs, chat dock)
        Sidebar (left nav, collapsible)
        [page-specific content]
```

## Components (`components/`)

| Component | Purpose |
|-----------|---------|
| `AuthProvider` | React context: `useAuth()` — user, session, profile, signIn/Out, profile CRUD, follow/unfollow |
| `Navbar` | Sticky header: search, theme toggle, notifications, connection requests, profile menu, ChatDock |
| `Sidebar` | Left nav: home, ask, leaderboard, profile, admin links; collapsible |
| `QuestionCard` | Feed question card with vote, tags, meta |
| `VoteControls` | Up/downvote widget (inline in question detail + cards) |
| `Avatar` | Avatar with fallback initials, inline styles for precise sizing |
| `RoleBadge` | Role/status badge rendering |
| `Markdown` | Custom MD→HTML renderer + MathJax typesetting |
| `MathJaxLoader` | Injects MathJax 3 CDN script with config |
| `ThemeScript` | Inline script to set `data-theme` before paint (prevents FOUC) |
| `ConnectionButton` | "Add colleague" / connection management |
| `MessageButton` | "Message" button (creates DM via `ensureConversation`) |
| `ConnectionRequestsPopover` | Pending requests dropdown in navbar |
| `ChatDock` | Collapsible bottom-right messaging panel |
| `PresenceProvider` | Heartbeat wrapper (sets presence every 30s) |
| `PermissionGuard` | Route guards based on role |
| `EmptyState` | Reusable empty state display |
| `UserHoverCard` | User preview on hover |

## Hooks (`hooks/`)

| Hook | Returns |
|------|---------|
| `useAuth()` | `{ user, session, profile, loading, signInEmail, signUpEmail, signInGoogle, signOut, ... }` |
| `useQuestionsFeed(sort, tag, search)` | `{ questions, loading, error, hasMore, loadMore, refresh }` |
| `useQuestion(id)` | Single question + answers + comments + votes |
| `useTags()` | `{ tags }` — popular tags with counts |
| `useVote()` | `vote(type, id, value)` / `unvote(type, id)` |
| `useNotifications()` | Notifications + unreadCount + markRead/markAllRead + realtime |
| `usePermissions()` | Derived booleans: canPost, canEditAnyContent, isStaff, etc. |
| `useSearch(query)` | Global search results |
| `useConnectionStatus(viewerId, targetId)` | Connection state between two users |
| `usePendingRequests()` | Incoming pending requests + realtime |
| `useConnections(userId?)` | Accepted connections list |
| `usePeers(userId)` | Peer profiles |
| `useConversations()` | DM list + unread + pinning + realtime |
| `useMessages(conversationId)` | Messages + send + loadMore + realtime |
| `useEnsureConversation()` | Creates 1:1 conversation with another user |
| `usePresenceHeartbeat()` | Sets online/away/offline every 30s |

## Data Flow Pattern

1. **Client components** call `createClient()` from `lib/supabase.ts` directly
2. **Server components** call `createServerSupabase()` from `lib/supabase-server.ts` (cookie-based)
3. **Hooks** wrap Supabase queries + `useState`/`useCallback` + optional realtime subscriptions
4. **Realtime pattern**: get session → get userId → `supabase.channel()` → subscribe → cleanup on unmount
5. **No global state store** — each hook manages its own state

## Markdown & Math Rendering

- `Markdown.tsx` parses text with regex: code blocks, inline code, `$$...$$`, `$...$`, `\[...\]`, `\(...\)`, bold, italic, links, blockquotes, headings, lists
- Display math wrapped in `<div class="md-math md-math-display">` with `\[...\]`
- Inline math wrapped in `<span class="md-math md-math-inline">` with `\(...\)`
- After setting `innerHTML`, calls `MathJax.typesetPromise([node])` to render
- Polls for MathJax load (200ms interval, 10s timeout)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus global search |
| `m` | Toggle chat dock |
| `Escape` | Close all popovers/search/chat |
