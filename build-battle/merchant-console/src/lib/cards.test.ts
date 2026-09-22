import { describe, expect, it } from "vitest"
import {
  CARD_CATEGORIES,
  CARD_CATEGORY_LABELS,
  canTransition,
  eventForTransition,
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
  maskCardNumber,
  spendProgress,
} from "./cards"

describe("luhnCheckDigit", () => {
  it("completes the 4242 test number", () => {
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })
})

describe("isValidLuhn", () => {
  it("accepts valid numbers and rejects a wrong check digit", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
    expect(isValidLuhn("4242424242424241")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isValidLuhn("4242 4242 4242 4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("is 16 digits on the 4242 BIN with a valid check digit", () => {
    for (let i = 0; i < 1000; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^4242\d{12}$/)
      expect(isValidLuhn(number)).toBe(true)
    }
  })

  it("uses the injected digit source for the body", () => {
    expect(generateCardNumber(() => 0)).toBe(
      "424200000000000" + luhnCheckDigit("424200000000000"),
    )
  })
})

describe("maskCardNumber", () => {
  it("shows only the last four", () => {
    expect(maskCardNumber("1234")).toBe("•••• 1234")
  })
})

describe("status transitions", () => {
  it("allows active ⇄ frozen", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either live state to cancel", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects no-op transitions", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })

  it("names the event each transition records", () => {
    expect(eventForTransition("active", "frozen")).toBe("frozen")
    expect(eventForTransition("frozen", "active")).toBe("unfrozen")
    expect(eventForTransition("frozen", "cancelled")).toBe("cancelled")
  })
})

describe("card categories", () => {
  it("labels every category in the allowlist", () => {
    expect(CARD_CATEGORIES.length).toBeGreaterThan(0)
    for (const category of CARD_CATEGORIES) {
      expect(CARD_CATEGORY_LABELS[category]).toBeTruthy()
    }
  })
})

describe("spendProgress", () => {
  it("is zero and calm for an unspent card", () => {
    expect(spendProgress(0, 25000)).toEqual({ percent: 0, nearLimit: false })
  })

  it("warns only strictly past 80% of the limit", () => {
    expect(spendProgress(20000, 25000)).toEqual({ percent: 80, nearLimit: false })
    expect(spendProgress(20001, 25000).nearLimit).toBe(true)
  })

  it("decides the warning on exact spend, not the rounded percent", () => {
    expect(spendProgress(8040, 10000)).toEqual({ percent: 80, nearLimit: true })
    expect(spendProgress(7999, 10000).nearLimit).toBe(false)
  })

  it("caps the percentage at 100 and handles a zero limit", () => {
    expect(spendProgress(30000, 25000)).toEqual({ percent: 100, nearLimit: true })
    expect(spendProgress(100, 0)).toEqual({ percent: 0, nearLimit: false })
  })
})
