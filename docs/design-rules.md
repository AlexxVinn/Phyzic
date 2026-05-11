# Design Rules

## Visual Identity

- **Academic aesthetic** — engineering-oriented, not social-media
- **Border-first design** — borders over shadows for structure
- **Compact spacing** — dense, information-rich layouts
- **Minimal glow** — no bright gradients, no glassmorphism
- **Max card height**: 140px (feed cards)
- **Rounded corners**: `var(--radius)` = 5px, `var(--radius-sm)` = 3px

## What to Avoid

- Bright gradients
- Glassmorphism / blur effects
- Oversized shadows
- Bubbly chat UIs
- Social-media aesthetics
- Random colors
- Inconsistent paddings
- Overly flashy effects
- Large hero sections
- Excessive whitespace

## What to Prioritize

- Spacing consistency
- Typography hierarchy (11px labels → 15px body → 24px titles)
- Clean layouts with subtle borders
- Good empty states
- Smooth hover/focus states (`transition: all 0.1-0.15s ease`)
- Accessibility (focus-visible outlines)
- Responsive behavior (3 → 2 → 1 column)
- Reduced visual clutter

## Component Sizing

- **Buttons**: small, ~24-30px height
- **Text**: 11-13px for meta/labels, 15px for body
- **Borders**: `1px solid var(--border)` or `var(--border-subtle)`
- **Padding**: tight — 3-8px on small elements, 12-16px on sections
- **Gap**: 4-8px between items, 12-16px between sections

## Color Usage

- **Primary** (`--primary`): links, active states, accents
- **Danger** (`--danger`): destructive actions, errors
- **Solved** (`--solved`): accepted answers, solved badges
- **Muted** (`--text-muted`): labels, secondary info, timestamps
- Use `color-mix(in oklab, ...)` for semi-transparent variants instead of hardcoded rgba

## Interaction States

- **Hover**: subtle background change + color shift, `0.1-0.15s ease` transition
- **Focus**: `1.5px solid color-mix(in oklab, var(--primary) 50%, transparent)` outline
- **Active/selected**: `var(--primary)` background, white text
- **Disabled**: `opacity: 0.5`, `cursor: not-allowed`

## Math Display

- Display math: centered block with subtle border + left accent bar
- Inline math: subtle chip background (`var(--surface-3)` mix)
- Always override `mjx-container` inside `.md-math-display` to prevent double-box

## Adding New UI

1. Check existing components first (`Avatar`, `RoleBadge`, `VoteControls`, etc.)
2. Match existing visual style: compact, dense, technical, minimal borders
3. Use CSS variables, never hardcoded colors
4. Add responsive rules at 1100px and 720px breakpoints
5. Test both light and dark themes