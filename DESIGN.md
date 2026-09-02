# Design

## Source of truth

- Status: Active
- Last refreshed: 2026-09-02
- Primary product surfaces: compact board list, board detail/editor, board creation, personal edit unlock
- Evidence reviewed: owner request for a mostly personal and less decorative tool, current production UI, mobile tests, Cloudflare/Supabase constraints

## Brand

- Personality: quiet, practical, compact; row colors provide the only strong visual accent
- Trust signals: visible edit action, explicit save status, stable share URL, honest permission/error states
- Avoid: marketing heroes, showcase samples, slogans, English eyebrow labels, oversized display type, decorative rotation, excessive shadows, tiny Korean copy

## Product goals

- Goals: open a board with minimal navigation; edit any personal board safely; make rankings readable at a glance; keep mobile editing unsurprising
- Non-goals: comments, follows, reactions, recommendation algorithms, poster scraping, real-time multi-user editing
- Success signals: completed board creation, successful saves, copied share links, readable 320 px layout

## Personas and jobs

- Primary personas: the owner maintaining personal rankings; an occasional viewer opening a shared link
- User jobs: open a saved table, revise any entry or row, create another table, optionally share a link
- Key contexts of use: frequent one-handed phone edits, desktop batch entry, occasional shared-link viewing

## Information architecture

- Primary navigation: compact wordmark/home, `새 티어표` action
- Core routes/screens: `/`, `/new`, `/t/:slug`
- Content hierarchy: board list or identity → rows and entries → edit/share actions; supporting metadata is secondary

## Design principles

- The table is the interface: surrounding chrome stays quiet.
- Personal utility beats product marketing: start with the saved boards, not an introduction.
- Color carries row identity, not surface decoration.
- Editing is explicit: view and edit modes do not blur together.
- Mobile uses tap targets and move controls; drag-and-drop is never the only path.
- Tradeoff: favor dense readable rows over poster-heavy cards.

## Visual language

- Color: warm paper background, ink foreground, vermilion accent, distinct muted row colors
- Typography: Korean-first system sans; modest hierarchy; monospace only for scores where useful
- Spacing/layout rhythm: 4/8 px base; compact 960 px work area; full-bleed table only where it helps small screens
- Shape/radius/elevation: 0–16 px radii, mostly 1 px borders, shadows only for modal/floating focus surfaces
- Motion: short 120–180 ms feedback; none for layout-critical changes; respect reduced motion
- Imagery/iconography: text-first; simple line icons only where a label would be redundant

## Components

- Existing components to reuse: AppShell, BoardCard, TierTable, BoardEditor, TurnstileGate
- New/changed components: compact home/shell, edit-key prompt, editor delete action
- Variants and states: owner/admin/locked, saved/saving/error, empty/populated, selected/unselected entry
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

- Tone: short, direct Korean, no marketing filler or slogans
- Terminology: `티어표`, `행`, `항목`, `점수`, `편집`, `공유`
- Microcopy rules: verbs first; avoid English unless it is user content; explain permissions only when an action requires it

## Implementation constraints

- Framework/styling system: React + TypeScript + Vite; plain CSS; Supabase JS
- Design-token constraints: one CSS variable layer, no component-library theme wrapper
- Performance constraints: no image API; route chunks kept small; no background polling
- Compatibility constraints: Cloudflare Pages SPA fallback; browser storage retains anonymous ownership and a successfully verified personal admin key
- Test/screenshot expectations: component flows plus desktop/mobile production screenshots and overflow checks

## Open questions

- [ ] Optional account-based key recovery / future scope / low impact
