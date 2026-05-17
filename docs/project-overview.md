# Phyzic — Project Overview

Physics-focused community Q&A with first-class LaTeX, messaging, and collaboration. **Product direction and UX stance:** [platform-identity.md](./platform-identity.md).

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.6 |
| UI | React | 19.2.4 |
| Language | TypeScript | 5 (strict) |
| Styling | Tailwind CSS + custom CSS | v4 |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) | JS client v2 |
| Math | MathJax 3 (CDN, tex-svg) | — |
| Fonts | Geist Sans + Geist Mono | Google Fonts |

## Architecture Summary

- **No REST API routes** — all data access via Supabase client directly from client/server components
- **No ORM** — raw Supabase queries via `@supabase/supabase-js`
- **No state library** — React `useState`/`useCallback` + Supabase realtime subscriptions
- **No form library** — native controlled inputs
- **SSR/CSR split** — server components use `lib/supabase-server.ts` (cookie-based auth); client components use `lib/supabase.ts` (browser client)

## Key Directories

```
app/           → Next.js App Router pages + styles/
components/    → Shared React components
hooks/         → Data-fetching hooks (Supabase + realtime)
lib/           → API wrappers, types, utilities
docs/          → Project documentation
public/        → Static assets
```

## Build & Dev

```bash
npm run dev      # Turbopack dev server
npm run build    # Production build (TypeScript strict)
npm run start    # Start production server
npm run lint     # ESLint
```

## Critical Notes

- **Next.js 16 has breaking changes** — always check `node_modules/next/dist/docs/` before using API patterns from training data
- **Migrations are manual** — run SQL files in Supabase SQL Editor, not auto-applied
- **MathJax is CDN-loaded** — do not npm-install it
- **Supabase client is created fresh per component** — intentional for SSR/CSR safety
- **RLS policies govern all data access** — check RLS first when debugging data access errors
