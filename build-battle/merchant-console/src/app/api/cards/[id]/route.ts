import { cardById, parseCardStatus, transitionCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  const card = cardById((await params).id)
  if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 })
  return NextResponse.json({ card })
}

/** Status changes only; limit edits are NWP-202. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const parsed = parseCardStatus(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const result = transitionCard((await params).id, parsed.value)
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 409
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ card: result.card })
}
