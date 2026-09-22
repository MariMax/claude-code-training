import { CardCategory, CardEvent, CardStatus } from "@/data/types"

/** Card rules on the 4242 test BIN. Only `src/data/cards.ts` generates numbers. */
export const TEST_BIN = "4242"

/** The digit that makes `partial` + digit pass the Luhn check. */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  for (let i = 0; i < partial.length; i++) {
    // From the right, the digit beside the check digit is doubled.
    let digit = Number(partial[partial.length - 1 - i])
    if (i % 2 === 0) digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

export const isValidLuhn = (number: string) =>
  /^\d{2,}$/.test(number) && luhnCheckDigit(number.slice(0, -1)) === Number(number.slice(-1))

/** A uniform decimal digit from the platform CSPRNG (rejects 250-255). */
function randomDigit(): number {
  const byte = new Uint8Array(1)
  do crypto.getRandomValues(byte)
  while (byte[0] >= 250)
  return byte[0] % 10
}

/** A 16-digit number on the test BIN; `digit` is injectable. */
export function generateCardNumber(digit: () => number = randomDigit): string {
  let partial = TEST_BIN
  while (partial.length < 15) partial += digit()
  return partial + luhnCheckDigit(partial)
}

/** The only way a card number is displayed after creation. */
export const maskCardNumber = (last4: string) => `•••• ${last4}`

/** Spend against a limit (minor units): whole percent, capped, and past 80%. */
export function spendProgress(spent: number, limit: number) {
  if (limit <= 0) return { percent: 0, nearLimit: false }
  const percent = Math.min(100, Math.round((spent * 100) / limit))
  return { percent, nearLimit: spent * 100 > limit * 80 }
}

export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software & subscriptions",
  contractor_tools: "Contractor tools",
  travel: "Travel",
  office_supplies: "Office supplies",
}
export const CARD_CATEGORIES = Object.keys(CARD_CATEGORY_LABELS) as CardCategory[]

/** active ⇄ frozen, either to cancelled, and cancelled is terminal. */
const TRANSITIONS: Record<CardStatus, CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export const canTransition = (from: CardStatus, to: CardStatus) =>
  TRANSITIONS[from].includes(to)

/** The history entry a legal transition records. */
export function eventForTransition(from: CardStatus, to: CardStatus): CardEvent["type"] {
  if (to === "active") return from === "frozen" ? "unfrozen" : "issued"
  return to
}
