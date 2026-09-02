# Design

## Source of truth

- Status: Active
- Last refreshed: 2026-09-02
- Primary product surfaces: public gallery, board detail/editor, board creation
- Evidence reviewed: owner request, existing `games` mobile patterns, current React/Vite scaffold, Cloudflare/Supabase constraints

## Brand

- Personality: editorial, decisive, calm, slightly playful through color rather than decoration
- Trust signals: clear ownership state, explicit save status, stable share URL, honest empty/error states
- Avoid: purple-blue AI gradients, floating glass cards, emoji navigation, excessive shadows, tiny Korean copy, fake social proof

## Product goals

- Goals: make a table in under a minute; make rankings readable at a glance; make mobile editing unsurprising
- Non-goals: comments, follows, reactions, recommendation algorithms, poster scraping, real-time multi-user editing
- Success signals: completed board creation, successful saves, copied share links, readable 320 px layout

## Personas and jobs

- Primary personas: a casual curator ranking media; a viewer opening a shared link
- User jobs: create categories, place entries, revise an opinion, share the result, scan someone else's hierarchy
- Key contexts of use: one-handed phone editing, shared-link viewing, desktop batch entry

## Information architecture

- Primary navigation: wordmark/home, `새 티어표` primary action
- Core routes/screens: `/`, `/new`, `/t/:slug`
- Content hierarchy: board identity → rows and entries → edit/share actions → supporting metadata

## Design principles

- The table is the interface: surrounding chrome stays quiet.
- Color carries row identity, not surface decoration.
- Editing is explicit: view and edit modes do not blur together.
- Mobile uses tap targets and move controls; drag-and-drop is never the only path.
- Tradeoff: favor dense readable rows over poster-heavy cards.

## Visual language

- Color: warm paper background, ink foreground, vermilion accent, distinct muted row colors
- Typography: Korean-first system sans with tabular/monospace accents for scores and metadata
- Spacing/layout rhythm: 4/8 px base; narrow reading width around 1120 px; full-bleed table on small screens
- Shape/radius/elevation: 0–16 px radii, mostly 1 px borders, shadows only for modal/floating focus surfaces
- Motion: short 120–180 ms feedback; none for layout-critical changes; respect reduced motion
- Imagery/iconography: text-first; simple line icons only where a label would be redundant

## Components

- Existing components to reuse: none; new repository
- New/changed components: AppShell, BoardCard, TierTable, TierRow, ItemTile, BoardForm, EditToolbar, EmptyState
- Variants and states: owner/read-only, saved/saving/error, empty/populated, selected/unselected entry
- Token/component ownership: CSS custom properties in `src/index.css`; component-specific layout in `src/App.css`

## Accessibility

- Target standard: WCAG 2.2 AA for core flows
- Keyboard/focus behavior: visible `:focus-visible`; modal focus management; no pointer-only moves
- Contrast/readability: Korean body 14 px minimum; muted text remains contrast-compliant
- Screen-reader semantics: native headings/forms/buttons, row labels, live save status
- Reduced motion and sensory considerations: disable nonessential transitions under `prefers-reduced-motion`

## Responsive behavior

- Supported breakpoints/devices: 320 px phones through large desktop; current Chrome/Safari/Firefox/Edge
- Layout adaptations: single-column header and forms on phone; table row label becomes a full-width top strip; editor controls wrap rather than overflow
- Touch/hover differences: 44 px targets; hover is enhancement only; entry relocation has a tap/click menu

## Interaction states

- Loading: compact text and row skeletons; never block the whole shell with a spinner
- Empty: direct instruction plus one primary action
- Error: inline, specific, retryable; never silently substitute local data
- Success: short live-region confirmation and stable saved state
- Disabled: reason remains legible near the action
- Offline/slow network: preserve unsaved editor input in React state and show save failure; do not claim persistence

## Content voice

- Tone: direct, plain Korean, no marketing filler
- Terminology: `티어표`, `행`, `항목`, `점수`, `편집`, `공유`
- Microcopy rules: verbs first; avoid English unless it is the chosen row label; explain anonymous ownership once

## Implementation constraints

- Framework/styling system: React + TypeScript + Vite; plain CSS; Supabase JS
- Design-token constraints: one CSS variable layer, no component-library theme wrapper
- Performance constraints: no image API; route chunks kept small; no background polling
- Compatibility constraints: Cloudflare Pages SPA fallback; browser storage required for anonymous session continuity
- Test/screenshot expectations: component flows plus desktop/mobile production screenshots and overflow checks

## Open questions

- [ ] Optional account upgrade for cross-device editing / future scope / medium impact
- [ ] Poster or cover image integrations / future scope / low impact
