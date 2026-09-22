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
