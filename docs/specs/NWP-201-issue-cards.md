# SPEC · NWP-201 — Issue virtual cards

**Ticket:** [NWP-201](../tickets/NWP-201.md) · **Author:** Maxim · **Status:** done

## Problem

Ops asks the platform team for virtual cards over Slack 12–20 times a week, and last month two went out with the wrong limit. Ops needs to issue, list and open cards in the console.

## Current state

Paths under `build-battle/merchant-console/`.

- No cards code exists (`CLAUDE.md` Layout).
- `src/data/types.ts:1`: `Currency` is the ticket's allowlist.
- `src/data/store.ts:16-34`: the store is held on `globalThis`.
- `src/data/generate.ts:20-35`: one shared PRNG, so seed cards must not draw from it.
- `src/data/queries.ts:18`: `parseFilters` is the house allowlist pattern. `:45` is the one payment builder.
- Helpers to reuse:
  - `src/lib/money.ts:15,46`: `formatMoney`, `parseAmountToMinorUnits`
  - `src/lib/dates.ts:7,22`: `utcDayKey`, `formatInZone`
- No API error shape exists, so this ticket sets `{ error }`.
- Docs vs code:
  - `components.md` names a `Dialog` that doesn't exist, so `Drawer` is used.
  - Seed data is generated in code, not JSON.

## Domain rules

| Rule | Source |
| --- | --- |
| Integer minor units, formatted once | `CLAUDE.md` #1 |
| `4242` BIN, Luhn digit, generated on the server | `cards.md` |
| Full number only in the creation response; store `last4` and a reference | ticket rule 2 |
| `active ⇄ frozen`, either → `cancelled`, terminal, guarded on the server | `cards.md` |
| Reject missing merchant, limit ≤ 0 or > 5,000,000, currency outside USD/EUR/GBP | ticket |
| Currency must equal the merchant's; spend is 0 until authorizations exist | review |

## Approach

- `src/lib/cards.ts` is pure: Luhn, generator, mask, transitions, `spendProgress`, categories.
- `src/data/cards.ts` owns the logic: `parseIssueCard`, `issueCardOnce` (keyed by `Idempotency-Key`) and `transitionCard`.
- Routes: `GET/POST /api/cards` and `GET/PATCH /api/cards/[id]`.
- UI:
  - `/cards`: the table, an issue drawer, and row actions that refresh without a reload.
  - `/cards/[id]`: fields, spend and history.

**Rejected:**
- Server actions: validation is proven against a route.
- A decimal limit on the API: the server would have to parse money.
- A currency warning instead of rejection: it doesn't stop the mistake.
- Invented seed spend: it's spend with no source.

## File map

| File | Why |
| --- | --- |
| `src/lib/cards.ts` + test | Card rules |
| `src/data/cards.ts` + test | Validation, issue, transition |
| `types.ts`, `store.ts`, `generate.ts` | Card type, slice, seeds |
| `src/app/api/cards/**` | Routes |
| `src/app/cards/**` | List, drawer, actions, detail, not-found, error |
| `StatusBadge`, `siteConfig`, `AppSidebar` | Statuses, nav |

## Plan

1. Library and tests.
2. Store, seeds, data layer and tests.
3. Routes, checked with curl.
4. Review the server diff.
5. UI, checked in the browser.
6. `/ship-ready`, then the PR.

## Verification

| Criterion | Proof |
| --- | --- |
| Numbers | 1,000 generated numbers match `^4242\d{12}$` and pass Luhn |
| Reveal once | No number on the record; no 16-digit run in list or detail |
| Validation | Unit tests plus curl for each rejection |
| UI | Issue, freeze, unfreeze and cancel in the browser |

## Fixed in passing

- `src/data/metrics.ts` `dailyVolume`: fixed local-date buckets, float sums, and refunds taken from payments. It now uses `utcDayKey`, integer minor units, and `store.refunds`.
- `headlineMetrics` now goes through `filterPayments`.
- `MetricsCards` now derives the authorization fraction once.
- Left for other work:
  - The string sort and hand-built filters belong to NWP-101.
  - Cross-currency totals need a product decision.

## Out of scope

- Persistence (NWP-203).
- Auth.
- Card network calls.
- Editing a limit (NWP-202).
- Enforcing the category lock on real spend.
- Open question: the ticket's `•••• 4242` is read as `•••• <last4>`, as in `src/app/payments/page.tsx:123`.
