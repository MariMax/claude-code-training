import { lastUtcDays, utcDayKey } from "@/lib/dates"
import { GENERATED_AT } from "./generate"
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

  // UTC days, integer minor units.
  for (const payment of store.payments) {
    const bucket = buckets.get(utcDayKey(payment.createdAt))
    if (bucket && payment.status === "captured") bucket.captured += payment.amount
  }
  // Refunds on the day, and for the amount, they happened.
  for (const refund of store.refunds) {
    const bucket = buckets.get(utcDayKey(refund.createdAt))
    if (bucket) bucket.refunded += refund.amount
  }

  return [...buckets.values()]
}

export function headlineMetrics() {
  const captured = store.payments.filter((p) => p.status === "captured")
  const refunded = store.payments.filter((p) => p.status === "refunded")

  // Gross volume is everything that moved through the platform.
  const grossVolume =
    captured.reduce((sum, p) => sum + p.amount, 0) +
    refunded.reduce((sum, p) => sum + p.amount, 0)

  const authorized = store.payments.filter(
    (p) => p.status !== "failed",
  ).length
  const authRate = store.payments.length
    ? authorized / store.payments.length
    : 0

  const openDisputes = store.disputes.filter(
    (d) => d.status === "needs_response" || d.status === "under_review",
  )

  return {
    grossVolume,
    authRate,
    paymentCount: store.payments.length,
    openDisputes: openDisputes.length,
    disputedAmount: openDisputes.reduce((sum, d) => sum + d.amount, 0),
  }
}
