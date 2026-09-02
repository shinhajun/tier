# Tier implementation plan

## Product slice

Ship one complete public-board workflow instead of a broad social platform:

1. Discover public boards from the home page.
2. Create a board from a title, category, optional description, and editable row labels.
3. Add entries and assign them to rows.
4. Edit the board from its detail page on the browser that created it.
5. Share the stable public URL.

## Architecture decision

### Decision

Use React 19 + TypeScript + Vite, Turnstile-gated Supabase anonymous Auth with RLS/RPC writes, and Cloudflare Pages deployed by GitHub Actions.

### Drivers

- Creation must not require a visible login flow.
- Public reads and creator-only writes need a database-enforced boundary.
- The current Cloudflare account token has a proven Pages path for the same zone.
- The repository should stay small enough to understand and maintain without a custom backend.

### Alternatives considered

- **Hashed edit tokens with security-definer RPCs:** preserves zero-auth creation, but adds a parallel authorization system and more security-critical SQL.
- **Email/social login:** strongest cross-device ownership, but adds friction and redirect/provider configuration beyond the requested MVP.
- **Cloudflare Worker API with Supabase secret key:** unnecessary server boundary for CRUD that RLS can safely enforce, and it increases secret and deployment surface.
- **Cloudflare Workers Static Assets:** current first-class Cloudflare path, but the available token and local delivery pattern are already proven for Pages. The app remains portable to Workers later.

### Consequences

- Clearing browser storage may lose the anonymous session's edit access. The UI explains this limitation without adding noisy account chrome.
- Direct table writes are revoked for browser roles; validated security-definer RPCs enforce ownership, quotas, and optimistic concurrency.
- The seeded movie table is system-owned, public, and read-only.

## Data model

- `tier_boards`: title, slug, category, description, owner UUID, public flag, timestamps.
- `tier_rows`: board FK, label, color, order.
- `tier_items`: board FK, row FK, title, note, numeric score, order.
- Public read policies expose only public boards and their children.
- Mutation RPCs require `auth.uid() = board.owner_id`; direct browser table writes are revoked.
- Create/save RPCs return the complete persisted board in the same transaction, avoiding ambiguous post-write reads.
- Save requires the caller's last `updated_at` and rejects a stale editor tab.

## Acceptance criteria

- Home shows the seeded movie board with all requested films and scores.
- A visitor can create letter tiers, numeric score rows, or arbitrary labels.
- Creator can add/delete/reorder rows and entries, move entries between rows, and save.
- Non-owners cannot change another board at the database layer.
- Detail URLs survive direct navigation and refresh.
- At 320×568 and 390×844, there is no horizontal document overflow; all primary controls meet a 44 px touch target.
- Keyboard focus is visible; forms have labels; status messages use appropriate live regions; reduced motion is respected.
- Unit/component tests, lint, TypeScript build, dependency audit, migration lint/dry-run where available, and production smoke all pass.
- No management/service-role/DB secret is committed or present in the built assets.

## Cleanup plan

After behavior is covered by tests:

1. Remove scaffold/dead styles and any duplicate board transforms.
2. Consolidate only repeated, stable validation and repository logic.
3. Replace fallback-like silent errors with explicit typed UI states.
4. Run copy, visual-density, mobile, accessibility, and secret scans.
5. Keep intentional external-service failure states visible; do not mask Supabase errors with fake local success.
