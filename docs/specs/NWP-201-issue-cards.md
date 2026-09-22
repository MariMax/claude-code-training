# SPEC · NWP-201 — Issue virtual cards

**Ticket:** [NWP-201](../tickets/NWP-201.md) · **Author:** Maxim · **Status:** done

## Problem

Ops requests cards over Slack 12–20 times a week, and two went out with the wrong limit last month. They need to issue, list and open cards in the console.

## Current state (under `build-battle/merchant-console/`)

- There are no cards yet (`CLAUDE.md` Layout).
- `src/data/types.ts:1`: `Currency` is the allowlist.
- `store.ts:16`: the store lives on `globalThis`.
- `generate.ts:20`: a shared PRNG, so seeds must not use it.
- `queries.ts:18`: `parseFilters` is the validation pattern. `:45` is the one payment builder.
- Reuse `money.ts:15,46` and `dates.ts:7,22`.
- No API error shape exists.
- Docs vs code:
  - `.claude/rules/components.md` names a `Dialog` that doesn't exist, so `Drawer` is used.
  - Seeds are code, not JSON.

## Domain rules

Sources: `build-battle/merchant-console/CLAUDE.md` ("Card rules"), `build-battle/merchant-console/.claude/rules/cards.md` ("Generate on the server", "Reveal once", "Guard the transition on the server"), and the ticket. The last two bullets were added after review.

- Money is integer minor units.
- `4242` BIN with a Luhn digit, generated on the server.
- The number appears once. Store `last4` and a reference.
- `active ⇄ frozen`, either can go to `cancelled`, and `cancelled` is terminal. The server guards it.
- Reject:
  - a missing merchant
  - a limit ≤ 0 or > 5,000,000
  - a currency outside USD/EUR/GBP
  - a currency other than the merchant's
- Spend stays 0 until authorizations exist.

## Approach

- `src/lib/cards.ts` holds the pure rules.
- `src/data/cards.ts` holds validation, `issueCardOnce` (keyed by `Idempotency-Key`) and `transitionCard`.
- Routes: `/api/cards` and `/api/cards/[id]`, returning `{ error }` with 400/404/409.
- UI: `/cards` (drawer and actions) and `/cards/[id]`.

**Rejected:**
- Server actions.
- A decimal limit on the API.
- Warn-only currency.
- Invented seed spend.

## Files and plan

1. `src/lib/cards.ts` + test.
2. `types`, `store`, `generate`, then `src/data/cards.ts` + test.
3. Routes: check each status with curl.
4. Review the diff.
5. `src/app/cards/**`, nav and badge: check in the browser.
6. `/ship-ready`, then the PR.

## Verification

Unit tests cover Luhn, the BIN, reveal-once, each rejection and the transitions. curl checks each status code. The UI flows are checked in the browser.

## Fixed in passing

- `metrics.ts` `dailyVolume` used local-date buckets, float sums and refunds taken from payments. It now uses UTC, minor units and `store.refunds`.
- `sortPayments` compared amounts as strings; it now compares numbers. Hand-built filters are left to NWP-101.
- Left for later: the overview's cross-currency totals, and metrics that read `store.payments` directly.

## Out of scope

Persistence (NWP-203), auth, network calls, limit edits (NWP-202) and enforcing the category lock. `•••• 4242` is read as `•••• <last4>`, as in `payments/page.tsx:123`.
