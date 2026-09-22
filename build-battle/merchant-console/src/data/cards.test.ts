import { isValidLuhn } from "@/lib/cards"
import { describe, expect, it } from "vitest"
import {
  cardById,
  issueCard,
  issueCardOnce,
  listCards,
  parseCardStatus,
  parseIdempotencyKey,
  parseIssueCard,
  transitionCard,
} from "./cards"

// mch_01 settles in USD, mch_04 in GBP, mch_05 in EUR.
const valid = { nickname: "Ad spend", merchantId: "mch_01", spendLimit: 25000, currency: "USD" }
const input = { ...valid, currency: "USD" as const, categoryLock: null }
const errorFor = (changes: Record<string, unknown>) => {
  const parsed = parseIssueCard({ ...valid, ...changes })
  return parsed.ok ? null : parsed.error
}

describe("parseIssueCard", () => {
  it("accepts a valid request, trimming the nickname", () => {
    expect(parseIssueCard({ ...valid, nickname: " Ad spend " })).toEqual({
      ok: true,
      value: { ...valid, categoryLock: null },
    })
    expect(errorFor({ spendLimit: 5_000_000 })).toBeNull()
    expect(errorFor({ merchantId: "mch_05", currency: "EUR" })).toBeNull()
    expect(errorFor({ categoryLock: "advertising" })).toBeNull()
  })

  it.each([
    ["missing merchant", { merchantId: undefined }, /Merchant is required/],
    ["unknown merchant", { merchantId: "mch_99" }, /Merchant not found/],
    ["zero limit", { spendLimit: 0 }, /greater than zero/],
    ["negative limit", { spendLimit: -1 }, /greater than zero/],
    ["limit over 5,000,000", { spendLimit: 5_000_001 }, /cannot exceed/],
    ["fractional limit", { spendLimit: 250.5 }, /whole number/],
    ["string limit", { spendLimit: "$250.00" }, /whole number/],
    ["currency outside allowlist", { currency: "JPY" }, /one of USD, EUR, or GBP/],
    ["currency not the merchant's", { currency: "EUR" }, /settles in USD/],
    ["GBP merchant in USD", { merchantId: "mch_04" }, /settles in GBP/],
    ["unknown category", { categoryLock: "gambling" }, /Category/],
    ["blank nickname", { nickname: "  " }, /Nickname is required/],
    ["long nickname", { nickname: "x".repeat(51) }, /50 characters/],
  ])("rejects %s", (_, changes, message) => {
    expect(errorFor(changes)).toMatch(message)
  })

  it("rejects a body that is not an object", () => {
    expect(parseIssueCard(null)).toEqual({ ok: false, error: "Request body must be a JSON object." })
  })
})

it("allowlists statuses and idempotency keys", () => {
  expect(parseCardStatus({ status: "frozen" })).toEqual({ ok: true, value: "frozen" })
  expect(parseCardStatus({ status: "deleted" }).ok).toBe(false)
  expect(parseIdempotencyKey(null).ok && parseIdempotencyKey(crypto.randomUUID()).ok).toBe(true)
  expect(parseIdempotencyKey("short").ok || parseIdempotencyKey("has spaces here").ok).toBe(false)
})

describe("issueCard", () => {
  it("returns the full number once and stores only the last four", () => {
    const { card, number } = issueCard(input)
    expect(number).toMatch(/^4242\d{12}$/)
    expect(isValidLuhn(number)).toBe(true)
    expect(card).toMatchObject({ last4: number.slice(-4), status: "active", spent: 0 })
    const stored = JSON.stringify(cardById(card.id))
    expect(stored).not.toContain(number)
    expect(stored).not.toMatch(/\d{16}/)
    expect(listCards()).toContain(card)
  })

  it("issues once per idempotency key and never reveals the number twice", () => {
    const first = issueCardOnce(input, "key-double-click")
    const again = issueCardOnce(input, "key-double-click")
    expect(again).toEqual({ replayed: true, card: first.card })
    expect(listCards().filter((c) => c.id === first.card.id)).toHaveLength(1)
    expect(issueCardOnce(input, null).card.id).not.toBe(issueCardOnce(input, null).card.id)
  })
})

describe("transitionCard", () => {
  it("walks active → frozen → active → cancelled, recording each step", () => {
    const { card } = issueCard(input)
    for (const to of ["frozen", "active", "cancelled"] as const) {
      expect(transitionCard(card.id, to).ok).toBe(true)
    }
    expect(card.events.map((e) => e.type)).toEqual(["issued", "frozen", "unfrozen", "cancelled"])
  })

  it("keeps cancelled terminal and reports unknown cards", () => {
    const { card } = issueCard(input)
    transitionCard(card.id, "cancelled")
    expect(transitionCard(card.id, "active")).toMatchObject({ ok: false, reason: "illegal" })
    expect(card.status).toBe("cancelled")
    expect(transitionCard("card_nope", "frozen")).toMatchObject({ reason: "not_found" })
  })
})
