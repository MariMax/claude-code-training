# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Maxim
**Status:** done

## Problem

Ops asks the platform team for virtual cards over Slack, 12–20 times a week, and waits hours for each one. Last month two cards went out with the wrong spend limit because the request lived in a thread. Marcus (Head of Merchant Ops) wants ops to issue a card, see the cards they've issued, and open one to check it, all inside the console. Every card is single-merchant, virtual, and limited from the moment it exists.

## Current state

All paths are relative to `build-battle/merchant-console/`.

- `src/app/cards/`: does not exist. `CLAUDE.md` Layout says "Cards is NWP-201 and does not exist yet". There is no card type, store slice, route, or page anywhere in `src/`.
- `src/data/types.ts:1`: `Currency = "USD" | "EUR" | "GBP"`, which is exactly the ticket's allowlist, so reuse it. `Payment.last4` (line 33) sets the precedent of storing only the last four digits.
- `src/data/store.ts:16-34`: the in-memory `Store` is held on `globalThis` so dev reloads keep writes. It has no `cards` array.
- `src/data/generate.ts:20-35, 69-151`: deterministic seed through a module-level `mulberry32(SEED)` shared by every generator. **Risk:** drawing extra numbers from `rand()` before the payments loop would shift every seeded payment.
- `src/data/merchants.ts:7-90`: ten merchants, each with a settlement `currency` and IANA `timezone`, plus `merchantById`. This is the merchant allowlist.
- `src/data/queries.ts:18-36`: `parseFilters` is the house pattern for allowlisting input: validate, then return. The payment query builder (lines 45-106) is payments-only. Cards are not payments, so they need their own small store accessors, not a second *payment* builder.
- `src/lib/money.ts:15`: `formatMoney(minor, currency)` is the only formatter. `parseAmountToMinorUnits` (line 46) converts `"250.00"` to `25000` at the boundary. Use both; write neither again.
- `src/lib/dates.ts:22, 31`: `formatInZone` for merchant-local timestamps and `formatDate` for table dates (UTC).
- `src/app/api/payments/route.ts`, `src/app/api/payments/export/route.ts`: these are GET only, with no error responses. **No existing error shape**, so this ticket sets one (see Approach).
- `src/app/payments/page.tsx:93-104`: a written empty state in the table, which is the pattern to copy. `src/app/payments/[id]/page.tsx:127-140`: the `Field` detail layout, the `notFound()` handling, and the timeline list (lines 87-104) to reuse for card history.
- `src/components/ui/payments/StatusBadge.tsx:5-62`: a status badge keyed by `AnyStatus`. Extend it with the card statuses rather than adding a second badge.
- `src/components/Drawer.tsx`: the Radix dialog (focus trap, Escape, accessible title). **Doesn't match the docs:** `.claude/rules/components.md` lists a "Dialog", but no `Dialog.tsx` exists, so `Drawer` is the one to use. `Input.tsx`, `Select.tsx`, `Button.tsx` and `Badge.tsx` are all present.
- `src/app/siteConfig.ts:5-10` and `src/components/ui/navigation/AppSidebar.tsx:26-51`: the nav is driven by `baseLinks`. Cards needs an entry in both.
- `vitest.config.ts`: Node only, `src/**/*.test.ts`, and tests sit beside the code they cover (`src/lib/money.test.ts`).
- **Doesn't match the docs:** `CLAUDE.md` says "Seed data is JSON". It is actually generated in code (`src/data/generate.ts`); there are no JSON files in `src/`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`. No floats, no strings with currency symbols." | `CLAUDE.md` #1, ticket rule 1 | Limits drift, and 5,000,000 is misread |
| "Generated numbers use the `4242` test BIN and a valid Luhn check digit." | `CLAUDE.md` Card rules, ticket rule 4 | Something could resemble a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | Criterion 4 fails |
| "The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes." | `.claude/rules/cards.md` | Criterion 5 fails, and ORG-STANDARDS #8 is violated |
| "Store the last four and the generated number's reference." | ticket rule 2 | The full PAN sits in memory |
| "`active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server." | `.claude/rules/cards.md` | A cancelled card comes back to life through curl |
| "Reject a missing merchant, a zero or negative limit, a limit above 5,000,000 minor units, and any currency outside USD, EUR, GBP." | ticket, core | Criterion 6 fails |
| "Return the same error shape everywhere … a message safe to show a user." | `.claude/rules/api-routes.md` | The UI can't show the error consistently |
| "Storage and bucketing are UTC. Display converts to the merchant's timezone." | `CLAUDE.md` #2 | History timestamps are wrong for Berlin and London |
| Card currency defaults to the merchant's currency, with a warning on mismatch | Decided in planning | Ops picks the wrong currency unnoticed |

## Approach

The server does the work, and the UI only renders. A pure module, `src/lib/cards.ts`, holds the Luhn check digit, the number generator on BIN `4242` (16 digits, from Web Crypto `getRandomValues` with rejection sampling, so the module has no Node import and the mask can be shared with client code), the `•••• <last4>` mask, and the status transition table. Everything that touches card numbers or status goes through it, and it is unit-tested. `src/data/cards.ts` owns the card slice of the store. It has `parseIssueCard(body)`, an allowlist validator in the style of `parseFilters`, plus `issueCard`, `listCards`, `cardById` and `transitionCard`. `issueCard` generates the number, keeps only `last4` and a random `reference`, appends an `issued` event, and returns `{ card, number }`. That return is the one and only place the number exists. The routes are:

- `POST /api/cards` returns `201 { card, number }`
- `GET /api/cards` returns the list
- `GET /api/cards/[id]` returns one card
- `PATCH /api/cards/[id]` takes `{ status }` and runs the state machine. An illegal move returns 409

Every error is `{ error: string }` with a 400, 404 or 409 status. The API takes `spendLimit` as an integer number of minor units. The form converts the typed `"250.00"` once, with `parseAmountToMinorUnits`. The server checks `Number.isInteger`, `> 0` and `≤ 5_000_000`. Each card carries `spent` (minor units) and `events` (`issued | frozen | unfrozen | cancelled`, with UTC `at`). Six fixed seed cards are added in `generate.ts` (`generateCards`). They don't draw from `rand()` at all, so payments don't shift. They cover a spread of spend (one past 80%), one frozen card and one cancelled card. New cards start with `spent: 0`. The UI has three parts:

- **`/cards`**: a server page with a table and a written empty state. It has an "Issue card" button that opens a `Drawer` form, and per-row Freeze, Unfreeze and Cancel buttons. Each button calls PATCH, then `router.refresh()`, so the page never fully reloads.
- **The success view**: it shows the full number once. State is cleared when the drawer closes.
- **`/cards/[id]`**: a detail page with `Field`s, spend as "`formatMoney(spent)` of `formatMoney(limit)`", and the event history in the merchant's timezone.

**Considered and rejected:**

- Server actions instead of route handlers. The ticket's validation criterion is checked against a route (curl), and `api-routes.md` defines the error contract for route handlers.
- Accepting the limit as a decimal string on the API. That makes the server parse money strings, and the money rules say to convert once, at the boundary. The form is that boundary.
- Hard-rejecting a currency that doesn't match the merchant. Ops legitimately pays EUR vendors from USD merchants, so a warning is enough.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `CardEvent`, `VirtualCard` (`last4`, `reference`, `spendLimit`, `spent`, `currency`, `events`; no number field) |
| `src/lib/cards.ts` | add | Luhn digit and check, `generateCardNumber`, `maskCardNumber`, `canTransition` and the transition table |
| `src/lib/cards.test.ts` | add | Luhn validity, the `4242` prefix, 16 digits, the mask, and every legal and illegal transition |
| `src/data/store.ts` | change | Add a `cards: VirtualCard[]` slice |
| `src/data/generate.ts` | change | `generateCards()`: fixed seed cards that don't touch `rand()`, so payments stay identical |
| `src/data/cards.ts` | add | `parseIssueCard` (including the optional `categoryLock` allowlist), `parseIdempotencyKey`, `issueCard`, `issueCardOnce`, `listCards`, `cardById`, `transitionCard` |
| `src/data/cards.test.ts` | add | Every validation rejection and the reveal-once behaviour (the number is never on the stored record) |
| `src/app/api/cards/route.ts` | add | GET list, POST issue, with an optional `Idempotency-Key` header (a replay returns 409 without the number) |
| `src/app/api/cards/[id]/route.ts` | add | GET detail, PATCH status |
| `src/components/ui/payments/StatusBadge.tsx` | change | Add `active`, `frozen` and `cancelled` labels, dots and variants |
| `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx` | change | Cards nav entry |
| `src/app/cards/page.tsx` | add | Card list and empty state |
| `src/app/cards/issue-card-drawer.tsx` | add | Client form, currency mismatch warning, one-time reveal |
| `src/app/cards/card-actions.tsx` | add | Client freeze, unfreeze and cancel buttons, and the error message |
| `src/app/cards/[id]/page.tsx` | add | Detail, category lock, spend against the limit with a `<progress>` bar (amber past 80%), history |
| `src/app/cards/[id]/not-found.tsx`, `src/app/cards/error.tsx` | add | Written not-found and error pages instead of the framework defaults |

## Plan

1. **Types and `src/lib/cards.ts`, with tests.** Done when `npm test` passes for Luhn, BIN, mask and transitions.
2. **Store slice, seed cards, `src/data/cards.ts`, with tests.** Done when the validation tests pass and the existing payments tests are unchanged and still green.
3. **Routes.** Done when curl shows:
   - POST valid → 201 with `number`
   - GET list and GET detail contain no 16-digit number
   - Each bad input → 400 `{ error }`
   - PATCH on a cancelled card → 409
4. **Stop and read the server diff.** Check minor units, server validation, no PAN stored, and no duplicated helpers.
5. **`/cards` list, nav and badge.** Done when a screenshot shows the seed cards masked.
6. **Issue drawer with the reveal.** Done when a new card is issued in the browser, the number shows once, and after closing, the new row is masked.
7. **Row actions.** Done when freeze → unfreeze → cancel works without a reload and the Cancel button disappears.
8. **Detail page.** Done when it shows spend against the limit and the history in the merchant's timezone.
9. **Checks.** `org-standards` on the diff, then `/ship-ready`, then `/northwind-pr`.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: fill the drawer, submit, and the new row appears in `/cards` (screenshot) |
| Card list | Screenshot of `/cards` showing all six columns. `GET /api/cards` via curl |
| Card detail | Screenshot of `/cards/[id]` with spend against the limit. `GET /api/cards/[id]` via curl |
| Generated numbers | `src/lib/cards.test.ts`: 1,000 generated numbers all start with `4242`, are 16 digits and pass Luhn. The generator is only imported by `src/data/cards.ts` |
| Reveal once, mask forever | `src/data/cards.test.ts`: the stored record has no number field. curl: grep the list and detail output for `\d{16}` and find nothing. Browser: reopen the drawer and the number is gone |
| Server-side validation | `src/data/cards.test.ts`, plus curl for a missing merchant, `0`, `-1`, `5000001`, `"JPY"` and `2500.5`, each returning 400 |
| State machine (stretch) | Transition tests, curl PATCH on a cancelled card returning 409, and clicking through in the browser |
| Category lock (stretch) | `src/data/cards.test.ts` allowlist cases, curl with `"travel"` (201) and `"gambling"` (400), and the Category column and detail field in the browser |
| Double-submit guard (extra) | `issueCardOnce` tests, and curl sending the same `Idempotency-Key` twice (201, then 409 without a number, one card in the list) |
| Card history (extra) | Detail page after freeze and unfreeze shows three events in the merchant's timezone |

## Risks

- **Seed drift.** Pulling from the shared `rand()` would reshuffle every payment and break the other tickets' reproductions. Seed cards are fixed values and never call `rand()`.
- **PAN leaking through logs or state.** No `console.log` anywhere near `issueCard`, the reveal lives in local component state only, and it is cleared on close.
- **Double-submit.** A double click could issue two cards. The submit button is disabled while the request is in flight, and the server issues at most one card per `Idempotency-Key` (one key per form session). A replay gets 409 and the original card, never the number, so the reveal stays one-time.
- **Time.** Stop after step 8. Anything unfinished is left blank in the PR.

## Out of scope

- Persistence (NWP-203), auth and roles, network calls, and editing a limit (NWP-202).
- Enforcing the category lock on real spend. There is no card network (see above), so the lock is recorded and displayed, not applied to authorizations.
- Added in a second pass after the first PR: the amber spend bar, the merchant category lock, the server-side idempotency key, and written not-found and error pages.

## Open questions

- The mask. The ticket writes `•••• 4242`, and the rule says to store the last four. This spec reads it as `•••• <last4>`, which matches `•••• ${last4}` in `src/app/payments/page.tsx:123`, rather than always showing the BIN.
- Nickname limits aren't specified. Proposed: required, trimmed, 1–50 characters.
