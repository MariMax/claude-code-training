import { utcDayKey } from "@/lib/dates"
import { afterEach, describe, expect, it } from "vitest"
import { dailyVolume } from "./metrics"
import { store } from "./store"

const originalTz = process.env.TZ
afterEach(() => void (process.env.TZ = originalTz))

const sumOn = (rows: { createdAt: string; amount: number }[], day: string) =>
  rows.filter((r) => utcDayKey(r.createdAt) === day).reduce((sum, r) => sum + r.amount, 0)

describe("dailyVolume", () => {
  it("buckets by UTC day in minor units, with refunds from the refund records", () => {
    // West of UTC, a local-date bucket moves evening-UTC payments a day back.
    process.env.TZ = "America/New_York"
    const captured = store.payments.filter((p) => p.status === "captured")
    const days = dailyVolume(30)
    expect(days).toHaveLength(30)
    for (const day of days) {
      expect(day.captured).toBe(sumOn(captured, day.date))
      expect(day.refunded).toBe(sumOn(store.refunds, day.date))
    }
  })
})
