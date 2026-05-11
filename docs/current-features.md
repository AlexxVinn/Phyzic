# Current Features

## Q&A System
- Question publishing with title, body (Markdown + LaTeX), tags
- Answer publishing with Markdown + LaTeX
- Comments on both questions and answers
- Sort modes: newest, top, unanswered, solved
- Tag filtering and global search
- View count tracking (incremented via RPC)
- Solved/accepted answer marking (only question author or mod)
- Draft autosave (local + backend)

## Voting & Reputation
- Upvote/downvote on questions and answers
- One vote per user per target (unique constraint)
- Vote removal (unvote)
- Reputation auto-updated via DB triggers: +10 upvote, -2 downvote, +25 accepted answer
- Reputation history with reason tracking
- Leaderboard page

## User Profiles
- Profile page: about, questions, answers, activity, saved posts, connections
- Bio, avatar (upload to Supabase Storage), reputation display
- Role and status badges
- Follow/unfollow system
- Profile lookup by username or user ID

## Social System
- **Connections**: send/accept/decline/block colleague requests
- **Direct messaging**: conversation-based DMs with ChatDock UI
  - Unread counts, pinning, message embeds
  - Real-time message delivery via Supabase Realtime
- **Presence**: online/away/offline status with 30s heartbeat
- **Blocks**: block/unblock users

## Notifications
- Auto-created by DB triggers on: answers, comments, votes, accepts, follows, connections, messages
- Types: answer, comment, vote, accept, mention, follow, report, system
- Real-time delivery via Supabase Realtime
- Read/unread management, mark all read

## Moderation & Admin
- **Role hierarchy**: admin > moderator > verified > contributor > user
- **Account status**: active, warned, suspended, banned
- **Warnings**: issued by mods, severity 1-3, acknowledgment tracking
- **Suspensions**: time-bounded, liftable by admin
- **Reports**: spam, harassment, misinformation, off-topic, duplicate, low_quality, other
- **Soft delete**: deleted_content table preserves original data
- **Audit logs**: all moderation actions tracked with old/new values
- **Admin dashboard**: user management, role assignment, reputation adjustments, bans/unbans
- **Moderator dashboard**: content review, report handling, warnings, suspension

## Content & Math
- Custom Markdown renderer (no library dependency)
- MathJax 3 (CDN, tex-svg) for LaTeX rendering
- Inline math (`$...$`, `\(...\)`) and display math (`$$...$$`, `\[...\]`)
- Formula keyboard for math entry in ask flow
- Code blocks with syntax highlighting classes

## UI/UX
- **Theme**: light/dark with OS fallback, persisted in localStorage
- **Responsive**: 3-column (desktop) → 2-column (≤1100px) → 1-column (≤720px)
- **Collapsible sidebar** (200px → 48px)
- **Keyboard shortcuts**: `/` search, `m` chat dock, `Escape` close overlays
- **Skeleton loaders** for loading states
- **Empty states** component
- **User hover cards** for profile previews
