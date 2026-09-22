import { cardById, parseCardStatus, transitionCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 })
  }
  return NextResponse.json({ card })
}

/** Status changes only. Limits are not editable after issue (NWP-202). */
export async function PATCH(request: NextRequest, { params }: Context) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = parseCardStatus(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const result = transitionCard(id, parsed.value)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.reason === "not_found" ? 404 : 409 },
    )
  }
  return NextResponse.json({ card: result.card })
}
