import {
  CARD_CATEGORIES,
  canTransition,
  eventForTransition,
  generateCardNumber,
} from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import { CardCategory, CardStatus, Currency, VirtualCard } from "./types"

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]
/** 5,000,000 minor units: $50,000.00. */
export const MAX_SPEND_LIMIT = 5_000_000
export const MAX_NICKNAME_LENGTH = 50
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/

export type IssueCardInput = Pick<
  VirtualCard,
  "nickname" | "merchantId" | "spendLimit" | "currency" | "categoryLock"
>
type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string) => ({ ok: false as const, error })

/** Allowlists client input before the store, like `parseFilters`. */
export function parseIssueCard(body: unknown): Parsed<IssueCardInput> {
  if (typeof body !== "object" || body === null) {
    return fail("Request body must be a JSON object.")
  }
  const { nickname, merchantId, spendLimit, currency, categoryLock } =
    body as Record<string, unknown>

  const name = typeof nickname === "string" ? nickname.trim() : ""
  if (!name) return fail("Nickname is required.")
  if (name.length > MAX_NICKNAME_LENGTH) {
    return fail(`Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer.`)
  }
  if (typeof merchantId !== "string" || !merchantId) {
    return fail("Merchant is required.")
  }
  const merchant = merchantById(merchantId)
  if (!merchant) return fail("Merchant not found.")

  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return fail("Spend limit must be a whole number of minor units.")
  }
  if (spendLimit <= 0) return fail("Spend limit must be greater than zero.")
  if (spendLimit > MAX_SPEND_LIMIT) {
    return fail("Spend limit cannot exceed 5,000,000 minor units.")
  }
  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return fail("Currency must be one of USD, EUR, or GBP.")
  }
  // A card spends in its merchant's settlement currency.
  if (currency !== merchant.currency) {
    const code = merchant.currency
    return fail(`${merchant.name} settles in ${code}. Issue this card in ${code}.`)
  }
  const category = (categoryLock ?? null) as CardCategory | null
  if (category !== null && !CARD_CATEGORIES.includes(category)) {
    return fail(`Category must be one of ${CARD_CATEGORIES.join(", ")}, or omitted.`)
  }

  return {
    ok: true,
    value: {
      nickname: name,
      merchantId,
      spendLimit,
      currency: merchant.currency,
      categoryLock: category,
    },
  }
}

export function parseCardStatus(body: unknown): Parsed<CardStatus> {
  const status = (body as { status?: unknown } | null)?.status as CardStatus
  if (!STATUSES.includes(status)) {
    return fail("Status must be one of active, frozen, or cancelled.")
  }
  return { ok: true, value: status }
}

export function parseIdempotencyKey(key: string | null): Parsed<string | null> {
  if (key !== null && !IDEMPOTENCY_KEY.test(key)) {
    return fail("Idempotency-Key must be 8 to 100 letters, digits, - or _.")
  }
  return { ok: true, value: key }
}

/** Newest first. */
export const listCards = () =>
  [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export const cardById = (id: string) =>
  store.cards.find((card) => card.id === id) ?? null

/**
 * The only place a full number exists: returned once beside the stored
 * record, which keeps just the last four and an opaque reference.
 */
export function issueCard(input: IssueCardInput) {
  const number = generateCardNumber()
  const createdAt = new Date().toISOString()
  const card: VirtualCard = {
    ...input,
    id: `card_${crypto.randomUUID().slice(0, 8)}`,
    last4: number.slice(-4),
    reference: `cref_${crypto.randomUUID()}`,
    spent: 0,
    status: "active",
    createdAt,
    events: [{ type: "issued", at: createdAt }],
  }
  store.cards.push(card)
  return { card, number }
}

/**
 * At most one card per idempotency key, so a double click or retry cannot
 * issue twice. A replay gets the original card, never the number again.
 */
export function issueCardOnce(input: IssueCardInput, key: string | null) {
  const existing = key ? cardById(store.cardIssueKeys.get(key) ?? "") : null
  if (existing) return { replayed: true as const, card: existing }

  const { card, number } = issueCard(input)
  if (key) store.cardIssueKeys.set(key, card.id)
  return { replayed: false as const, card, number }
}

/** The only way a card's status changes. Guards the state machine. */
export function transitionCard(id: string, to: CardStatus) {
  const card = cardById(id)
  if (!card) return { ...fail("Card not found."), reason: "not_found" as const }
  if (!canTransition(card.status, to)) {
    const error =
      card.status === "cancelled"
        ? "This card is cancelled. Cancelled cards cannot be changed."
        : `A ${card.status} card cannot be moved to ${to}.`
    return { ...fail(error), reason: "illegal" as const }
  }
  card.events.push({ type: eventForTransition(card.status, to), at: new Date().toISOString() })
  card.status = to
  return { ok: true as const, card }
}
