# Personal mode cleanup plan

## Outcome

Turn the public showcase-style interface into a quiet personal tool while preserving responsive viewing, free-form rows, sharing, and safe writes. The owner must be able to unlock and edit or delete every board, including the seeded movie board.

## Behavior lock

- Keep public board loading, direct URLs, category filtering, board creation, owner editing, row/item movement, validation, and mobile overflow protection.
- Add regression coverage before implementation for the compact home hierarchy and admin-key edit path.
- Keep the seeded movie contents unchanged during the cleanup.

## Scope

- UI: `AppShell`, `HomePage`, `BoardCard`, `BoardPage`, `BoardEditor`, `NewBoardPage`, `App.css`, `index.css`.
- Data boundary: `src/lib/boards.ts`, exports, one additive Supabase migration, database smoke tests.
- Tests/docs: relevant unit, Playwright, README, and DESIGN contract.

## Smells and passes

1. Delete showcase-only content: oversized hero, tilted sample, English eyebrows, slogan footer, repeated explanatory endnotes.
2. Reduce visual ceremony: large display type, excessive vertical whitespace, redundant metadata, featured-card treatment, and floating save panel.
3. Repair the edit boundary: preserve anonymous owner edits and add a separate high-entropy admin key path for all-board save/delete. Never ship the key in the browser bundle or repository.
4. Expose one compact edit action on every detail page; ask for the key only when the current browser is not already authorized.
5. Reinforce tests for invalid keys, admin RPC selection, compact content, deletion, and mobile layout.

## Fallback review

- No masking fallback or temporary bypass was found in the requested UI/data scope.
- `getReadableTextColor` intentionally returns ink for invalid colors; it is a tested display fail-safe and remains unchanged.
- The admin key is not a fallback around ownership. It is an explicit, separately validated personal-owner authorization boundary.

## Security decisions

- Generate a 256-bit random admin key outside the repository.
- Store only its SHA-256 digest in the private database schema.
- Keep the raw key only in the credentials vault and the owner's browser storage after successful verification.
- Validate all payloads and optimistic concurrency exactly as the existing owner RPC does.
- Do not grant direct table writes and do not add dependencies.

## Acceptance criteria

- Home opens directly with `티어표`, a compact create action, filters, and the board list; no marketing sample or slogan footer remains.
- Every detail page shows `수정`. Unauthorized browsers get a small key prompt; a valid key opens the full editor.
- Admin saves and deletes any board, including the seed; invalid keys cannot mutate data.
- Existing anonymous owners can still edit their own boards without the admin key.
- 320 px, 390 px, WebKit, and desktop layouts have no horizontal overflow and retain 44 px actions.
- Unit, E2E, lint, typecheck, build, audit, secret scan, database smoke, live deployment, and live admin mutation checks pass.
