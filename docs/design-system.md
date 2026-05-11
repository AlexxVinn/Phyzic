# Design System

## Theme

Light/dark mode via `data-theme` attribute on `<html>`. Persisted in `localStorage` key `phyzic_theme`. OS preference fallback via `prefers-color-scheme`.

### CSS Variable Architecture

All colors and tokens defined in `app/styles/variables.css`, consumed via CSS custom properties.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--primary` | `#3b49df` | `#8b9cf7` | Links, active states, accents |
| `--primary-hover` | `#2f3abf` | `#a5b0fa` | Hover on primary elements |
| `--bg` | `#f5f6f8` | `#0e0e10` | Page background |
| `--surface` | `#ffffff` | `#18181b` | Cards, inputs |
| `--surface-2` | `#f0f1f3` | `#1f1f23` | Subtle backgrounds, headers |
| `--surface-3` | `#e4e6e9` | `#28282d` | Code blocks, chips, math inline bg |
| `--text` | `#1a1a1a` | `#d1d1d6` | Primary text |
| `--text-muted` | `#5c6370` | `#71717a` | Secondary text, labels |
| `--border` | `#d0d4d9` | `#2e2e33` | Borders |
| `--border-subtle` | `#e2e5e9` | `#25252a` | Subtle dividers |
| `--vote-up` | `#2f6f44` | `#3fb950` | Upvote color |
| `--vote-down` | `#9b4d4d` | `#f85149` | Downvote color |
| `--solved` | `#2f6f44` | `#3fb950` | Accepted/solved |
| `--danger` | `#c53030` | `#f85149` | Destructive actions |
| `--warning` | `#b45309` | `#d29922` | Warning states |

### Spacing & Radius

| Token | Value |
|-------|-------|
| `--radius` | `5px` |
| `--radius-sm` | `3px` |

### Shadows

| Token | Light | Dark |
|-------|-------|------|
| `--shadow` | `0 1px 3px rgba(0,0,0,0.04)` | `0 1px 3px rgba(0,0,0,0.2)` |
| `--shadow-hover` | `0 2px 8px rgba(0,0,0,0.06)` | `0 2px 8px rgba(0,0,0,0.3)` |
| `--shadow-popover` | `0 4px 16px rgba(0,0,0,0.1)` | `0 4px 20px rgba(0,0,0,0.4)` |

## Typography

- **Base font size**: 14px (set on `html`)
- **Font family**: `var(--font-geist-sans)` (Geist Sans) with system fallbacks
- **Mono font**: `var(--font-geist-mono)` (Geist Mono)
- **Line height**: 1.5 (body), 1.7 (content), 1.75 (markdown body)

### Type Scale (in practice)

| Context | Size | Weight |
|---------|------|--------|
| Page title | 24px | 700 |
| Section heading | 20px | 700 |
| Body text | 15px | 400 |
| Small text / meta | 13px | 400 |
| Labels / badges | 11-12px | 500-700 |
| Right column | 10-11px | 400-700 |

## Layout

### App Shell (3-column grid)

```
.shell {
  grid-template-columns: 200px minmax(0, 1fr) 280px;
  max-width: 1600px;
}
```

- **Sidebar**: 200px (collapsed: 48px, toggled by `html.sidebar-collapsed`)
- **Main content**: flexible
- **Right column**: 280px (hidden below 1100px)

### Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| ≤1100px | Right column hidden, 2-column layout |
| ≤720px | Sidebar hidden, single column, reduced padding |

## Tailwind Integration

Tailwind v4 with `@theme inline` in `globals.css` maps CSS variables to Tailwind tokens:

```css
@theme inline {
  --color-primary: var(--primary);
  --color-surface: var(--surface);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  /* ... */
}
```

Usage: `bg-[var(--surface)]`, `text-[var(--text)]`, or Tailwind utilities like `bg-primary`, `text-text-muted` via the mapped tokens.

## Custom CSS Files

| File | Scope |
|------|-------|
| `variables.css` | Theme tokens (light/dark) |
| `layout.css` | App shell, responsive grid, math defaults |
| `header.css` | Navbar styles |
| `sidebar.css` | Sidebar navigation |
| `feed.css` | Question feed cards |
| `question.css` | Question detail page, math rendering overrides |
| `profile.css` | Profile page |
| `chat.css` | Chat dock, messages, formula keyboard |
| `leaderboard.css` | Leaderboard page |
| `settings.css` | Settings page |
| `ask.css` | Ask question form + live preview + math keyboard |
| `utilities.css` | Utility classes |

## Math Rendering Styles

Two layers of math styling exist (potential for double-box if not carefully overridden):

1. **Global** (`layout.css`): `mjx-container[display="true"]` gets border, padding, background
2. **Page-specific** (e.g., `question.css`): `.md-body .md-math-display` wrapper gets its own border/background, then overrides `mjx-container` inside to `border: 0; padding: 0; background: transparent`

When adding new pages with math, ensure the inner `mjx-container` override is present to avoid double-box.

## Role Badge Colors

| Role | Color | Background | Border |
|------|-------|------------|--------|
| Admin | `#c0392b` | `#fdf2f2` | `#f5c6cb` |
| Moderator | `#27ae60` | `#eafaf1` | `#c3e6cb` |
| Verified | `#1da1f2` | `#e8f7fe` | `#b8e0f7` |
| Contributor | `#f39c12` | `#fef5e7` | `#f9d89d` |
| User | `#7f8c8d` | `#f4f6f7` | `#d5dbdb` |
