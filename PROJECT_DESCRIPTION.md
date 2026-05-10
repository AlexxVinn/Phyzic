# Phyzic — Physics Knowledge Exchange

Phyzic is a community-driven physics Q&A platform focused on rigorous problem solving and knowledge sharing, with first-class LaTeX support for math-heavy discussions.

## Core product
- **Question & answer publishing** with tags, sorting (newest/top/unanswered/solved), and search.
- **Voting + reputation system** across questions/answers (with user-facing leaderboards).
- **Threaded discussion** via comments on both questions and answers.
- **Solved/accepted answers** and contribution metrics (answers, accepted answers, views).
- **Drafting workflow** for questions (autosave locally and to the backend).

## User interaction & community systems
- **User profiles** (bio, avatar, reputation, role/status badges) and activity views.
- **Direct messaging** with a persistent “chat dock” UI, unread counts, pinning, and message embeds linking back to questions.
- **Presence/online status** (online/away/offline + last seen) maintained via heartbeat.
- **Social graph features** including connection requests (accept/decline/block), blocks, and follow/unfollow.
- **Notifications** with realtime updates and read/unread management.

## Moderation & governance
- **Role-based permissions** (admin/moderator/verified/contributor/user) and account status controls (active/warned/suspended/banned).
- **Reporting system** for questions/answers/comments.
- **Moderator panel** for content review, report handling, warnings, suspension, and soft-deletion.
- **Admin dashboard** for user management, role assignment, reputation adjustments, bans/unbans, and audit log visibility.

## Technical architecture & stack
- **Next.js (App Router) + React + TypeScript** frontend.
- **Tailwind CSS** styling alongside app-level UI components (cards, skeleton loaders, responsive shell layout).
- **Supabase as the backend**:
  - **Auth**: email/password and Google OAuth (PKCE), session persistence and token refresh.
  - **Database**: Postgres tables for core entities (profiles, questions, answers, comments, votes, drafts, reports, warnings, notifications, conversations/messages, connections, presence).
  - **Storage**: avatar uploads via Supabase Storage.
  - **Realtime**: Postgres change subscriptions power live-updating feeds, notifications, and chat.
- Uses **Supabase SSR helpers** for server-side client creation via cookies where needed.

## Notable UI/UX features
- **Math rendering** via MathJax with Markdown + inline/display LaTeX support.
- **Formula keyboard** for faster math entry in the ask flow.
- **Theme support** (light/dark) using persisted preference with OS fallback.
