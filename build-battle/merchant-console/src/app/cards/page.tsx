import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { listCards, MAX_NICKNAME_LENGTH } from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { CARD_CATEGORY_LABELS, maskCardNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CardActions } from "./card-actions"
import { IssueCardDrawer } from "./issue-card-drawer"

export const dynamic = "force-dynamic"

const COLUMNS = ["Card", "Merchant", "Number", "Category", "Spend limit", "Status", "Created", ""]

export default function CardsPage() {
  const cards = listCards()

  return (
    <section aria-label="Virtual cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Virtual cards</h1>
        <IssueCardDrawer merchants={merchants} maxNicknameLength={MAX_NICKNAME_LENGTH} />
      </div>

      <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHeaderCell key={column} className={column === "Spend limit" ? "text-right" : ""}>
                  {column || <span className="sr-only">Actions</span>}
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">No cards issued yet</p>
                  <p className="mt-1 text-gray-500">
                    Use Issue card to create a virtual card for a merchant.
                  </p>
                </TableCell>
              </TableRow>
            )}
            {cards.map((card) => (
              <TableRow key={card.id}>
                <TableCell>
                  <Link
                    href={`/cards/${card.id}`}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-500"
                  >
                    {card.nickname}
                  </Link>
                </TableCell>
                <TableCell>{merchantById(card.merchantId)?.name}</TableCell>
                <TableCell className="font-mono">{maskCardNumber(card.last4)}</TableCell>
                <TableCell className="text-gray-500">
                  {card.categoryLock ? CARD_CATEGORY_LABELS[card.categoryLock] : "Any"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                  {formatMoney(card.spendLimit, card.currency)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={card.status} />
                </TableCell>
                <TableCell>{formatDate(card.createdAt)}</TableCell>
                <TableCell>
                  <CardActions id={card.id} nickname={card.nickname} status={card.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableRoot>

      <p className="px-4 py-4 text-sm text-gray-500 sm:px-6">
        {cards.length} {cards.length === 1 ? "card" : "cards"}
      </p>
    </section>
  )
}
