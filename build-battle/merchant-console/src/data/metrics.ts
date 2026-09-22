import { lastUtcDays, utcDayKey } from "@/lib/dates"
import { GENERATED_AT } from "./generate"
import { filterPayments } from "./queries"
import { store } from "./store"

/**
 * Dashboard metrics. Everything here is reported in USD minor units for the
 * headline figures, because the overview is an internal ops screen rather
 * than a merchant statement.
 */

export interface DailyVolume {
  date: string
  captured: number
  refunded: number
}

export function dailyVolume(days = 30): DailyVolume[] {
  const keys = lastUtcDays(days, GENERATED_AT)
  const buckets = new Map<string, DailyVolume>(
    keys.map((date) => [date, { date, captured: 0, refunded: 0 }]),
  )

  // Bucket by UTC day and accumulate integer minor units, never floats.
  for (const payment of filterPayments({ status: "captured" })) {
    const bucket = buckets.get(utcDayKey(payment.createdAt))
    if (bucket) bucket.captured += payment.amount
  }
  // Refunds land on the day they happened, for the amount actually refunded.
  for (const refund of store.refunds) {
    const bucket = buckets.get(utcDayKey(refund.createdAt))
    if (bucket) bucket.refunded += refund.amount
  }

  return [...buckets.values()]
}

/** Every lookup goes through the one query builder, never store.payments. */
export function headlineMetrics() {
  const all = filterPayments({})
  const captured = filterPayments({ status: "captured" })
  const refunded = filterPayments({ status: "refunded" })

  // Gross volume is everything that moved through the platform.
  const grossVolume =
    captured.reduce((sum, p) => sum + p.amount, 0) +
    refunded.reduce((sum, p) => sum + p.amount, 0)

  // Derived once: the rate and the "n/total" fraction both come from this count.
  const authorizedCount = all.length - filterPayments({ status: "failed" }).length
  const authRate = all.length ? authorizedCount / all.length : 0

  const openDisputes = store.disputes.filter(
    (d) => d.status === "needs_response" || d.status === "under_review",
  )

  return {
    grossVolume,
    authRate,
    authorizedCount,
    paymentCount: all.length,
    openDisputes: openDisputes.length,
    disputedAmount: openDisputes.reduce((sum, d) => sum + d.amount, 0),
  }
}
