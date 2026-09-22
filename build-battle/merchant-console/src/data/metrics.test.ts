import { utcDayKey } from "@/lib/dates"
import { afterEach, describe, expect, it } from "vitest"
import { dailyVolume } from "./metrics"
import { store } from "./store"

const originalTz = process.env.TZ
afterEach(() => {
  process.env.TZ = originalTz
})

const sum = (amounts: number[]) => amounts.reduce((a, b) => a + b, 0)

describe("dailyVolume", () => {
  it("buckets by UTC day even when the server is not on UTC", () => {
    // New York is behind UTC, so a local-date bucket moves evening-UTC
    // payments to the previous day.
    process.env.TZ = "America/New_York"
    for (const { date, captured } of dailyVolume(30)) {
      const expected = sum(
        store.payments
          .filter((p) => p.status === "captured" && utcDayKey(p.createdAt) === date)
          .map((p) => p.amount),
      )
      expect(captured).toBe(expected)
    }
  })

  it("reports refunds on the day they happened, for the amount refunded", () => {
    for (const { date, refunded } of dailyVolume(30)) {
      const expected = sum(
        store.refunds
          .filter((r) => utcDayKey(r.createdAt) === date)
          .map((r) => r.amount),
      )
      expect(refunded).toBe(expected)
    }
  })

  it("returns integer minor units for every day in the window, oldest first", () => {
    const days = dailyVolume(30)
    expect(days).toHaveLength(30)
    expect(days.map((d) => d.date)).toEqual([...days.map((d) => d.date)].sort())
    for (const day of days) {
      expect(Number.isInteger(day.captured)).toBe(true)
      expect(Number.isInteger(day.refunded)).toBe(true)
    }
  })
})
