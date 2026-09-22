import { describe, expect, it } from "vitest"
import {
  canTransition,
  eventForTransition,
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
  maskCardNumber,
  spendProgress,
} from "./cards"

describe("card numbers", () => {
  it("computes and checks the Luhn digit", () => {
    expect(luhnCheckDigit("424242424242424")).toBe(2)
    expect(isValidLuhn("4242424242424242")).toBe(true)
    expect(isValidLuhn("4242424242424241")).toBe(false)
    expect(isValidLuhn("4242 4242 4242 4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })

  it("generates 16 digits on the 4242 BIN with a valid check digit", () => {
    for (let i = 0; i < 1000; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^4242\d{12}$/)
      expect(isValidLuhn(number)).toBe(true)
    }
    const zeros = "424200000000000"
    expect(generateCardNumber(() => 0)).toBe(zeros + luhnCheckDigit(zeros))
  })

  it("masks to the last four", () => {
    expect(maskCardNumber("1234")).toBe("•••• 1234")
  })
})

describe("status transitions", () => {
  it.each([
    ["active", "frozen", true],
    ["frozen", "active", true],
    ["active", "cancelled", true],
    ["frozen", "cancelled", true],
    ["cancelled", "active", false],
    ["cancelled", "frozen", false],
    ["cancelled", "cancelled", false],
    ["active", "active", false],
    ["frozen", "frozen", false],
  ] as const)("%s → %s allowed: %s", (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed)
  })

  it("names the event each transition records", () => {
    expect(eventForTransition("active", "frozen")).toBe("frozen")
    expect(eventForTransition("frozen", "active")).toBe("unfrozen")
    expect(eventForTransition("frozen", "cancelled")).toBe("cancelled")
  })
})

describe("spendProgress", () => {
  it.each([
    [0, 25000, 0, false],
    [20000, 25000, 80, false], // exactly 80% is not past it
    [20001, 25000, 80, true],
    [8040, 10000, 80, true], // decided on exact spend, not the rounded percent
    [30000, 25000, 100, true],
    [100, 0, 0, false],
  ])("%i of %i → %i%%, near limit %s", (spent, limit, percent, nearLimit) => {
    expect(spendProgress(spent, limit)).toEqual({ percent, nearLimit })
  })
})
