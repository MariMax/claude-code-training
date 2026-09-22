import {
  issueCardOnce,
  listCards,
  parseIdempotencyKey,
  parseIssueCard,
} from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/** Every issued card. Stored records carry the last four only, never a number. */
export function GET() {
  return NextResponse.json({ cards: listCards() })
}

/**
 * Issues a card. This is the one response in the app that carries a full card
 * number; nothing can read it back afterwards. An optional Idempotency-Key
 * header makes retries safe: a repeated key gets 409 and the original card,
 * without the number.
 */
export async function POST(request: NextRequest) {
  const key = parseIdempotencyKey(request.headers.get("idempotency-key"))
  if (!key.ok) {
    return NextResponse.json({ error: key.error }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = parseIssueCard(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const result = issueCardOnce(parsed.value, key.value)
  if (result.replayed) {
    return NextResponse.json(
      {
        error:
          "This card was already issued by an earlier request. Its number is not shown again.",
        card: result.card,
      },
      { status: 409 },
    )
  }

  const { card, number } = result
  return NextResponse.json(
    { card, number },
    { status: 201, headers: { "cache-control": "no-store" } },
  )
}
