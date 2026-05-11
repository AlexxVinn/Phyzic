# Routing

All routes use Next.js App Router (file-system based routing under `app/`).

## Route Map

| Path | Page | Auth | Notes |
|------|------|------|-------|
| `/` | `app/page.tsx` | Public | Home feed: questions, sidebar, leaderboard |
| `/ask` | `app/ask/page.tsx` | Required | Ask question form with live preview + math keyboard |
| `/login` | `app/login/page.tsx` | Guest | Email + Google sign-in |
| `/signup` | `app/signup/page.tsx` | Guest | Registration form |
| `/auth/callback` | `app/auth/callback/page.tsx` | — | OAuth PKCE redirect handler |
| `/profile` | `app/profile/page.tsx` | Public | User profile; query params: `?u=username` or `?id=userId` |
| `/question/[id]` | `app/question/[id]/page.tsx` | Public | Question detail + answers + comments + voting |
| `/question/[id]/edit` | `app/question/[id]/edit/page.tsx` | Owner/Mod | Edit question form |
| `/messages` | `app/messages/page.tsx` | Required | DM landing; query param: `?c=conversationId` |
| `/admin` | `app/admin/page.tsx` | Admin | User management, role assignment, reputation, bans, audit |
| `/moderator` | `app/moderator/page.tsx` | Mod+ | Content review, reports, warnings, suspension |
| `/leaderboard` | `app/leaderboard/page.tsx` | Public | Reputation leaderboard |
| `/settings` | `app/settings/page.tsx` | Required | User settings |

## URL Patterns

- **Profile**: `/profile?u=username` or `/profile?id=userId`
- **Question**: `/question/{id}`
- **Edit question**: `/question/{id}/edit`
- **Messages**: `/messages?c=conversationId`
- **Search**: no route — uses in-navbar popover (hook: `useSearch`)

## Auth Guards

No middleware-based route protection. Auth is handled at the component level:

- `AuthProvider` wraps the entire app — provides `user`/`profile` to all components
- `PermissionGuard` component can wrap page sections to restrict by role
- Individual pages check `useAuth()` and conditionally render or redirect
- Admin/moderator pages check role before rendering content

## Navigation

- **Sidebar** (`Sidebar.tsx`): Home, Ask, Leaderboard, Profile, Admin (if applicable)
- **Navbar** (`Navbar.tsx`): Search, theme toggle, notifications, connection requests, profile menu, chat dock toggle
- **Keyboard shortcuts**: `/` (search), `m` (chat dock), `Escape` (close overlays)
