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
export const CARD_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]
/** 5,000,000 minor units: $50,000.00. */
export const MAX_SPEND_LIMIT = 5_000_000
export const MAX_NICKNAME_LENGTH = 50

export interface IssueCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  categoryLock: CardCategory | null
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * Anything from the client is checked against an allowlist before it reaches
 * the store. Route handlers call this rather than reading the body themselves.
 * Returns the first problem found, with a message safe to show a user.
 */
export function parseIssueCard(body: unknown): Parsed<IssueCardInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." }
  }
  const { nickname, merchantId, spendLimit, currency, categoryLock } = body as Record<
    string,
    unknown
  >

  const name = typeof nickname === "string" ? nickname.trim() : ""
  if (!name) return { ok: false, error: "Nickname is required." }
  if (name.length > MAX_NICKNAME_LENGTH) {
    return {
      ok: false,
      error: `Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer.`,
    }
  }

  if (typeof merchantId !== "string" || !merchantId) {
    return { ok: false, error: "Merchant is required." }
  }
  if (!merchantById(merchantId)) {
    return { ok: false, error: "Merchant not found." }
  }

  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return {
      ok: false,
      error: "Spend limit must be a whole number of minor units.",
    }
  }
  if (spendLimit <= 0) {
    return { ok: false, error: "Spend limit must be greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      error: `Spend limit cannot exceed ${MAX_SPEND_LIMIT.toLocaleString("en-US")} minor units.`,
    }
  }

  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return { ok: false, error: "Currency must be one of USD, EUR, or GBP." }
  }

  // Optional: absent or null issues an unlocked card.
  const category = categoryLock ?? null
  if (category !== null && !CARD_CATEGORIES.includes(category as CardCategory)) {
    return {
      ok: false,
      error: `Category must be one of ${CARD_CATEGORIES.join(", ")}, or omitted.`,
    }
  }

  return {
    ok: true,
    value: {
      nickname: name,
      merchantId,
      spendLimit,
      currency: currency as Currency,
      categoryLock: category as CardCategory | null,
    },
  }
}

export function parseCardStatus(body: unknown): Parsed<CardStatus> {
  const status = (body as Record<string, unknown> | null)?.status
  if (!CARD_STATUSES.includes(status as CardStatus)) {
    return {
      ok: false,
      error: "Status must be one of active, frozen, or cancelled.",
    }
  }
  return { ok: true, value: status as CardStatus }
}

/** Newest first. */
export function listCards(): VirtualCard[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): VirtualCard | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/**
 * Issues a card. The full number is generated here and returned alongside the
 * stored record exactly once; the record itself keeps only the last four and
 * an opaque reference.
 */
export function issueCard(input: IssueCardInput): {
  card: VirtualCard
  number: string
} {
  const number = generateCardNumber()
  const createdAt = new Date().toISOString()
  const card: VirtualCard = {
    id: `card_${crypto.randomUUID().slice(0, 8)}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4: number.slice(-4),
    reference: `cref_${crypto.randomUUID()}`,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    categoryLock: input.categoryLock,
    status: "active",
    createdAt,
    events: [{ type: "issued", at: createdAt }],
  }
  store.cards.push(card)
  return { card, number }
}

export type TransitionResult =
  | { ok: true; card: VirtualCard }
  | { ok: false; reason: "not_found" | "illegal"; error: string }

/** The only way a card's status changes. Guards the state machine. */
export function transitionCard(id: string, to: CardStatus): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, reason: "not_found", error: "Card not found." }
  if (!canTransition(card.status, to)) {
    return {
      ok: false,
      reason: "illegal",
      error:
        card.status === "cancelled"
          ? "This card is cancelled. Cancelled cards cannot be changed."
          : `A ${card.status} card cannot be moved to ${to}.`,
    }
  }
  card.events.push({
    type: eventForTransition(card.status, to),
    at: new Date().toISOString(),
  })
  card.status = to
  return { ok: true, card }
}
