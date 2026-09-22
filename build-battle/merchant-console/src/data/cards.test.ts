import { isValidLuhn } from "@/lib/cards"
import { describe, expect, it } from "vitest"
import {
  cardById,
  issueCard,
  listCards,
  MAX_SPEND_LIMIT,
  parseCardStatus,
  parseIssueCard,
  transitionCard,
} from "./cards"

const valid = {
  nickname: "Ad spend",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
}

const input = { ...valid, currency: "USD" as const, categoryLock: null }

const errorFor = (body: unknown) => {
  const parsed = parseIssueCard(body)
  return parsed.ok ? null : parsed.error
}

describe("parseIssueCard", () => {
  it("accepts a valid request and trims the nickname", () => {
    expect(parseIssueCard({ ...valid, nickname: "  Ad spend  " })).toEqual({
      ok: true,
      value: { ...valid, nickname: "Ad spend", categoryLock: null },
    })
  })

  it("accepts an optional category lock from the allowlist", () => {
    const parsed = parseIssueCard({ ...valid, categoryLock: "advertising" })
    expect(parsed.ok && parsed.value.categoryLock).toBe("advertising")
    expect(errorFor({ ...valid, categoryLock: null })).toBeNull()
  })

  it("rejects a category outside the allowlist", () => {
    expect(errorFor({ ...valid, categoryLock: "gambling" })).toMatch(/category/i)
    expect(errorFor({ ...valid, categoryLock: "" })).toMatch(/category/i)
  })

  it("rejects a missing or unknown merchant", () => {
    expect(errorFor({ ...valid, merchantId: undefined })).toMatch(/merchant/i)
    expect(errorFor({ ...valid, merchantId: "" })).toMatch(/merchant/i)
    expect(errorFor({ ...valid, merchantId: "mch_99" })).toMatch(/merchant/i)
  })

  it("rejects a zero or negative limit", () => {
    expect(errorFor({ ...valid, spendLimit: 0 })).toMatch(/greater than zero/)
    expect(errorFor({ ...valid, spendLimit: -1 })).toMatch(/greater than zero/)
  })

  it("rejects a limit above 5,000,000 minor units and accepts exactly that", () => {
    expect(errorFor({ ...valid, spendLimit: MAX_SPEND_LIMIT + 1 })).toMatch(
      /exceed/,
    )
    expect(errorFor({ ...valid, spendLimit: MAX_SPEND_LIMIT })).toBeNull()
  })

  it("rejects limits that are not integer minor units", () => {
    expect(errorFor({ ...valid, spendLimit: 250.5 })).toMatch(/whole number/)
    expect(errorFor({ ...valid, spendLimit: "25000" })).toMatch(/whole number/)
    expect(errorFor({ ...valid, spendLimit: "$250.00" })).toMatch(/whole number/)
  })

  it("rejects any currency outside USD, EUR, GBP", () => {
    expect(errorFor({ ...valid, currency: "JPY" })).toMatch(/currency/i)
    expect(errorFor({ ...valid, currency: "usd" })).toMatch(/currency/i)
    expect(errorFor({ ...valid, currency: undefined })).toMatch(/currency/i)
  })

  it("rejects a missing nickname and a non-object body", () => {
    expect(errorFor({ ...valid, nickname: "   " })).toMatch(/nickname/i)
    expect(errorFor({ ...valid, nickname: "x".repeat(51) })).toMatch(/nickname/i)
    expect(errorFor(null)).toMatch(/object/)
  })
})

describe("parseCardStatus", () => {
  it("allowlists statuses", () => {
    expect(parseCardStatus({ status: "frozen" })).toEqual({
      ok: true,
      value: "frozen",
    })
    expect(parseCardStatus({ status: "deleted" }).ok).toBe(false)
    expect(parseCardStatus(null).ok).toBe(false)
  })
})

describe("issueCard", () => {
  it("returns the full number once and stores only the last four", () => {
    const { card, number } = issueCard(input)

    expect(number).toMatch(/^4242\d{12}$/)
    expect(isValidLuhn(number)).toBe(true)
    expect(card.last4).toBe(number.slice(-4))
    expect(card.status).toBe("active")
    expect(card.spent).toBe(0)
    expect(card.events.map((e) => e.type)).toEqual(["issued"])

    const stored = JSON.stringify(cardById(card.id))
    expect(stored).not.toContain(number)
    expect(stored).not.toMatch(/\d{16}/)
    expect(listCards().some((c) => c.id === card.id)).toBe(true)
  })
})

describe("transitionCard", () => {
  it("walks active → frozen → active → cancelled and records each step", () => {
    const { card } = issueCard(input)

    expect(transitionCard(card.id, "frozen").ok).toBe(true)
    expect(transitionCard(card.id, "active").ok).toBe(true)
    expect(transitionCard(card.id, "cancelled").ok).toBe(true)
    expect(cardById(card.id)!.events.map((e) => e.type)).toEqual([
      "issued",
      "frozen",
      "unfrozen",
      "cancelled",
    ])
  })

  it("refuses to bring a cancelled card back", () => {
    const { card } = issueCard(input)
    transitionCard(card.id, "cancelled")

    const result = transitionCard(card.id, "active")
    expect(result).toMatchObject({ ok: false, reason: "illegal" })
    expect(cardById(card.id)!.status).toBe("cancelled")
  })

  it("reports an unknown card", () => {
    expect(transitionCard("card_nope", "frozen")).toMatchObject({
      ok: false,
      reason: "not_found",
    })
  })
})
