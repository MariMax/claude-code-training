import { issueCard, listCards, parseIssueCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/** Every issued card. Stored records carry the last four only, never a number. */
export function GET() {
  return NextResponse.json({ cards: listCards() })
}

/**
 * Issues a card. This is the one response in the app that carries a full card
 * number; nothing can read it back afterwards.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = parseIssueCard(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { card, number } = issueCard(parsed.value)
  return NextResponse.json(
    { card, number },
    { status: 201, headers: { "cache-control": "no-store" } },
  )
}
