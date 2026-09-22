import { CardCategory, CardEvent, CardStatus } from "@/data/types"

/**
 * Card number rules. Every generated number is on the 4242 test BIN with a
 * valid Luhn check digit, so nothing here can ever resemble a real card.
 * Generation happens only in `src/data/cards.ts`: a number generated in the
 * browser is a bug. The mask and the transition table are safe anywhere.
 */

export const TEST_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16

/** The digit that makes `partial` + digit pass the Luhn check. */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  for (let i = 0; i < partial.length; i++) {
    // Walking from the right, the digit next to the check digit is doubled.
    let digit = Number(partial[partial.length - 1 - i])
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

export function isValidLuhn(number: string): boolean {
  if (!/^\d{2,}$/.test(number)) return false
  return luhnCheckDigit(number.slice(0, -1)) === Number(number.slice(-1))
}

/** A uniformly random decimal digit from the platform CSPRNG. */
function randomDigit(): number {
  const byte = new Uint8Array(1)
  // Reject 250-255 so every digit is equally likely.
  do crypto.getRandomValues(byte)
  while (byte[0] >= 250)
  return byte[0] % 10
}

/** A fresh 16-digit number on the test BIN. `digit` is injectable for tests. */
export function generateCardNumber(digit: () => number = randomDigit): string {
  let partial = TEST_BIN
  while (partial.length < CARD_NUMBER_LENGTH - 1) partial += String(digit())
  return partial + String(luhnCheckDigit(partial))
}

/** The only way a card number is ever displayed after creation. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** Past this share of the limit, spend is shown as a warning. */
export const SPEND_WARNING_PERCENT = 80

/**
 * Spend against a limit, for display: a whole percentage capped at 100, and
 * whether it is past the warning threshold. Both inputs are minor units.
 */
export function spendProgress(
  spent: number,
  limit: number,
): { percent: number; nearLimit: boolean } {
  if (limit <= 0) return { percent: 0, nearLimit: false }
  const percent = Math.min(100, Math.round((spent * 100) / limit))
  return { percent, nearLimit: spent * 100 > limit * SPEND_WARNING_PERCENT }
}

/** The category allowlist, in display order, with the label ops sees. */
export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software & subscriptions",
  contractor_tools: "Contractor tools",
  travel: "Travel",
  office_supplies: "Office supplies",
}

export const CARD_CATEGORIES = Object.keys(
  CARD_CATEGORY_LABELS,
) as CardCategory[]

/** active ⇄ frozen, either to cancelled, and cancelled is terminal. */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** The history entry a legal transition records. */
export function eventForTransition(
  from: CardStatus,
  to: CardStatus,
): CardEvent["type"] {
  if (to === "cancelled") return "cancelled"
  if (to === "frozen") return "frozen"
  return from === "frozen" ? "unfrozen" : "issued"
}
