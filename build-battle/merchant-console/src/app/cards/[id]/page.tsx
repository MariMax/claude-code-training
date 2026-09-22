import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CARD_CATEGORY_LABELS, maskCardNumber, spendProgress } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

// Status changes at runtime through the API; never serve a stale render.
export const dynamic = "force-dynamic"

const EVENT_LABELS = {
  issued: "Card issued",
  frozen: "Frozen",
  unfrozen: "Unfrozen",
  cancelled: "Cancelled",
}
const heading = "mt-6 text-sm font-semibold text-gray-900 dark:text-gray-50"

export default async function CardDetail({ params }: { params: Promise<{ id: string }> }) {
  const card = cardById((await params).id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const money = (minor: number) => formatMoney(minor, card.currency)
  const { percent, nearLimit } = spendProgress(card.spent, card.spendLimit)
  const fields: [label: string, value: string, mono?: boolean][] = [
    ["Merchant", `${merchant.name} · ${merchant.country}`],
    ["Currency", card.currency],
    ["Category lock", card.categoryLock ? CARD_CATEGORY_LABELS[card.categoryLock] : "None: any category"],
    ["Spend limit", money(card.spendLimit)],
    ["Spent", money(card.spent)],
    ["Remaining", money(Math.max(0, card.spendLimit - card.spent))],
    ["Reference", card.reference, true],
    ["Created (UTC)", card.createdAt, true],
    [`Created (${merchant.timezone})`, formatInZone(card.createdAt, merchant.timezone)],
  ]

  return (
    <div className="p-4 sm:p-6">
      <Link href="/cards" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50">
        ← All cards
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{card.nickname}</h1>
        <StatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {maskCardNumber(card.last4)} · {card.id}
      </p>
      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([label, value, mono]) => (
          <div key={label}>
            <dt className="text-gray-500">{label}</dt>
            <dd className={cx("mt-1 tabular-nums text-gray-900 dark:text-gray-50", mono && "font-mono")}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <h2 className={heading}>Spend</h2>
      <p className="mt-2 text-sm tabular-nums text-gray-900 dark:text-gray-50">
        {money(card.spent)} of {money(card.spendLimit)} spent
        <span className="ml-2 text-gray-500">{percent}% used</span>
      </p>
      <progress
        value={percent}
        max={100}
        aria-label={`Spend against limit: ${percent}% used`}
        className={cx("mt-2 h-2 w-full max-w-md", nearLimit ? "accent-amber-500" : "accent-blue-500")}
      />
      {card.spent === 0 && (
        <p className="mt-2 text-sm text-gray-500">
          No spend recorded. The console is not connected to a card network yet, so spend stays at
          zero until authorizations exist.
        </p>
      )}

      <h2 className={heading}>History</h2>
      <ol className="mt-2 space-y-3 text-sm">
        {card.events.map((event, index) => (
          <li key={index}>
            <p className="text-gray-900 dark:text-gray-50">{EVENT_LABELS[event.type]}</p>
            <p className="text-gray-500">{formatInZone(event.at, merchant.timezone)}</p>
          </li>
        ))}
      </ol>
      {card.status === "cancelled" && (
        <p className="mt-6 text-sm text-gray-500">
          Cancelled cards are terminal and cannot be reactivated.
        </p>
      )}
    </div>
  )
}
