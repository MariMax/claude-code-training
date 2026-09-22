"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import type { Currency } from "@/data/types"
import { CARD_CATEGORIES, CARD_CATEGORY_LABELS } from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

/** Radix Select cannot hold an empty value, so "no lock" gets a sentinel. */
const NO_LOCK = "none"
const EMPTY = { nickname: "", merchantId: "", limit: "", currency: "", category: NO_LOCK }
const errorText = "text-sm text-red-600 dark:text-red-500"

function Field(props: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={props.id} className="text-sm font-medium text-gray-900 dark:text-gray-50">
        {props.label}
      </label>
      {props.children}
    </div>
  )
}

export function IssueCardDrawer(props: {
  merchants: { id: string; name: string; currency: Currency }[]
  currencies: Currency[]
  maxNicknameLength: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [limitError, setLimitError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Held only while the success view is open; cleared on every close.
  const [issued, setIssued] = useState<{ nickname: string; number: string } | null>(null)
  // One key per form session: a retry or double click reuses it, so the
  // server issues at most one card.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const set = (changes: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...changes }))
  const merchant = props.merchants.find((m) => m.id === form.merchantId)
  const mismatch = Boolean(merchant && form.currency && form.currency !== merchant.currency)

  const onOpenChange = (next: boolean) => {
    // Closing mid-request would drop the one response that carries the number.
    if (!next && submitting) return
    setOpen(next)
    if (next) return
    if (issued) router.refresh()
    setForm(EMPTY)
    setLimitError(null)
    setError(null)
    setIssued(null)
    setIdempotencyKey(crypto.randomUUID())
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setError(null)
    setLimitError(null)
    if (!form.nickname.trim()) return setError("Nickname is required.")
    if (!merchant) return setError("Choose a merchant.")
    if (!form.currency) return setError("Choose a currency.")
    if (mismatch) return setError(`Issue this card in ${merchant.currency}.`)
    // Converted once, here, at the boundary. The server re-validates it.
    const spendLimit = parseAmountToMinorUnits(form.limit)
    if (!spendLimit) return setLimitError("Enter an amount like 250.00, greater than zero.")

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({
          nickname: form.nickname,
          merchantId: form.merchantId,
          spendLimit,
          currency: form.currency,
          categoryLock: form.category === NO_LOCK ? null : form.category,
        }),
      })
      const body = await response.json().catch(() => null)
      if (response.ok && body?.number) {
        setIssued({ nickname: body.card.nickname, number: body.number })
      } else {
        setError(body?.error ?? "The card could not be issued. Try again.")
      }
    } catch {
      setError("The card could not be issued. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{issued ? "Card issued" : "Issue card"}</DrawerTitle>
          <DrawerDescription>
            {issued
              ? "Copy the card number now."
              : "Create a virtual card with a spend limit for one merchant."}
          </DrawerDescription>
        </DrawerHeader>

        {issued ? (
          <>
            <DrawerBody className="flex flex-col gap-4 text-gray-900 dark:text-gray-50">
              <p className="font-medium">{issued.nickname}</p>
              <div>
                <p className="text-sm text-gray-500">Card number</p>
                <p className="font-mono text-lg tracking-wider">
                  {issued.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
                </p>
              </div>
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-400/10 dark:text-amber-400">
                This is the only time the full number is shown. It cannot be retrieved later.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
            <DrawerBody className="flex flex-col gap-4">
              <Field id="card-nickname" label="Nickname">
                <Input
                  id="card-nickname"
                  maxLength={props.maxNicknameLength}
                  value={form.nickname}
                  onChange={(e) => set({ nickname: e.target.value })}
                  placeholder="Ad spend — Q3"
                />
              </Field>

              <Field id="card-merchant" label="Merchant">
                <Select
                  value={form.merchantId}
                  onValueChange={(id) =>
                    set({ merchantId: id, currency: props.merchants.find((m) => m.id === id)!.currency })
                  }
                >
                  <SelectTrigger id="card-merchant">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {props.merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="card-limit" label={`Spend limit${form.currency ? ` (${form.currency})` : ""}`}>
                <Input
                  id="card-limit"
                  inputMode="decimal"
                  autoComplete="off"
                  value={form.limit}
                  onChange={(e) => set({ limit: e.target.value })}
                  placeholder="250.00"
                  hasError={limitError !== null}
                  aria-invalid={limitError !== null}
                  aria-describedby={limitError ? "card-limit-error" : undefined}
                />
                {limitError && <p id="card-limit-error" className={errorText}>{limitError}</p>}
              </Field>

              <Field id="card-currency" label="Currency">
                <Select value={form.currency} onValueChange={(currency) => set({ currency })}>
                  <SelectTrigger
                    id="card-currency"
                    hasError={mismatch}
                    aria-invalid={mismatch}
                    aria-describedby={mismatch ? "card-currency-error" : undefined}
                  >
                    <SelectValue placeholder="Choose a currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {props.currencies.map((code) => (
                      <SelectItem key={code} value={code}>{code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mismatch && (
                  <p id="card-currency-error" className={errorText}>
                    {merchant!.name} settles in {merchant!.currency}. Cards for this merchant must be
                    issued in {merchant!.currency}.
                  </p>
                )}
              </Field>

              <Field id="card-category" label="Merchant category lock">
                <Select value={form.category} onValueChange={(category) => set({ category })}>
                  <SelectTrigger id="card-category" aria-describedby="card-category-hint">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LOCK}>No lock</SelectItem>
                    {CARD_CATEGORIES.map((code) => (
                      <SelectItem key={code} value={code}>{CARD_CATEGORY_LABELS[code]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id="card-category-hint" className="text-sm text-gray-500">
                  Only spend in this category is allowed. Set at issue; it cannot be changed later.
                </p>
              </Field>

              {error && <p role="alert" className={errorText}>{error}</p>}
            </DrawerBody>
            <DrawerFooter>
              <Button
                type="submit"
                isLoading={submitting}
                loadingText="Issuing..."
                disabled={submitting || mismatch}
              >
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
