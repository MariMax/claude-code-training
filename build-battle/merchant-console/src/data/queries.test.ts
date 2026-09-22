import { expect, it } from "vitest"
import { sortPayments } from "./queries"
import type { Payment } from "./types"

it("sorts amounts numerically, not as strings", () => {
  const rows = [900, 10000, 25].map((amount) => ({ amount }) as Payment)
  const by = (dir: "asc" | "desc") =>
    sortPayments(rows, "amount", dir).map((p) => p.amount)
  expect(by("asc")).toEqual([25, 900, 10000])
  expect(by("desc")).toEqual([10000, 900, 25])
})
