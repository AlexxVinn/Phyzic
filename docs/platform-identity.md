# Phyzic — platform identity

Single source of truth for **what the product is**, **how it should feel**, and **what to avoid**. Tactical tokens live in [design-system.md](./design-system.md) and [design-rules.md](./design-rules.md).

---

## Product vision

Build a **physics-first knowledge exchange**: precise questions, readable threads, and durable answers that help the next person who lands here. Reasoning quality and notation matter more than post volume or vanity metrics.

---

## Platform positioning

| Is | Is not |
|----|--------|
| Discussion-led Q&A with math at the center | A generic SaaS “workspace” or ticket queue |
| A place for researchers, students, and serious hobbyists | A content mill or SEO farm |
| Reputation and roles as **trust signals**, not the product | A leaderboard game disconnected from learning |
| Side channels (DMs, connections) supporting collaboration | Chat as the primary surface over threads |

---

## Design philosophy

1. **Signal over chrome** — UI recedes; equations, definitions, and thread structure carry the weight.
2. **Warm precision** — Dense and legible, not sterile; subtle motion and hierarchy because **people** are present, not to mimic consumer social apps.
3. **One instrument** — Light/dark, type scale, and spacing read as a coherent system (tokens), not a reskin.

---

## UI / UX principles

- **One primary action** per view (ask, submit answer, save, filter) — secondary actions stay visually quieter.
- **Reading order** — Title → body / preview → engagement metadata → tags / author; do not scramble scan path for layout novelty.
- **Math and code are first-class** — Never sacrifice legibility for decoration; layout must tolerate block and inline math.
- **Empty and error states** — Short, instructive copy (“what to do next”), not marketing slogans.
- **Affordance without noise** — Hover, focus, and loading states are clear; avoid gratuitous animation and parallax.
- **Human authorship visible** — Author, time, and thread state stay prominent; nothing should read as bot-generated bulk.

---

## Visual identity direction

| Axis | Direction |
|------|-----------|
| **Physics-inspired** | Structure from grids, alignment, and restrained accent lines (diagram-like clarity). Avoid literal atom clipart and neon “science” gradients. |
| **Modern academic** | Neutral grotesk (Geist), strong tabular numerals for counts/dates, `color-mix` / OKLch-friendly ramps — not random accent colors per screen. |
| **Alive, not loud** | Cards and feeds can breathe and lift slightly on interaction; energy comes from **hierarchy and motion**, not mascot-heavy branding. |
| **Intellectual** | Favor understatement, clear type hierarchy, and generous line height where prose is read at length. |

---

## Community atmosphere

- **Curious and exacting** — Push for definitions, units, and assumptions; that is the norm, not rudeness.
- **Good-faith argument** — Disagreement is expected; drive-by dismissals and unexplained downvotes are out of character.
- **Expertise through clarity** — Authority shows in explanation, not gatekeeping jargon or status flex.

---

## Anti-patterns

| Avoid | Why |
|-------|-----|
| Generic SaaS dashboards (KPI tiles, mystery icons, “workspace” copy) | Reads as internal tooling, not a research-facing forum |
| Stack Overflow **clone** visuals and patterns (vote gutter as the only identity, gray-on-gray sameness) | Phyzic is not SE with a different logo |
| Dead forum layouts (undifferentiated rows, buried authors, no thread “temperature”) | Signals abandonment; contradicts “alive” |
| AI-wrapper positioning (assistant-first chrome, implied auto-answers) | Undermines trust and human credit |
| Growth-hack filler (“revolutionary,” “seamless,” “unlock”) | Cheapens an intellectual product |
| Decorative physics fluff with no structural role | Noise; prefer meaningful alignment and type |

When in doubt: **more clarity, less category startup language.**
