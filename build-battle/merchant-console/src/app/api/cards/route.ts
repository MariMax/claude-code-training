import { issueCardOnce, listCards, parseIdempotencyKey, parseIssueCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/** Stored cards carry the last four only, never a number. */
export function GET() {
  return NextResponse.json({ cards: listCards() })
}

/** The one response with a full number. A replayed key gets 409 without it. */
export async function POST(request: NextRequest) {
  const key = parseIdempotencyKey(request.headers.get("idempotency-key"))
  if (!key.ok) return NextResponse.json({ error: key.error }, { status: 400 })
  const parsed = parseIssueCard(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const result = issueCardOnce(parsed.value, key.value)
  if (result.replayed) {
    const error = "This card was already issued. Its number is not shown again."
    return NextResponse.json({ error, card: result.card }, { status: 409 })
  }

  const { card, number } = result
  return NextResponse.json({ card, number }, { status: 201, headers: { "cache-control": "no-store" } })
}
