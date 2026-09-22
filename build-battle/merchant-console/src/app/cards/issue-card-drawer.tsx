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
import type { CardCategory, Currency } from "@/data/types"
import { CARD_CATEGORIES, CARD_CATEGORY_LABELS } from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

/** Radix Select cannot hold an empty value, so "no lock" gets a sentinel. */
const NO_LOCK = "none"

type MerchantOption = { id: string; name: string; currency: Currency }

/** Held only while the success view is open; cleared on close. */
type Issued = { nickname: string; number: string }

const labelClass = "text-sm font-medium text-gray-900 dark:text-gray-50"

export function IssueCardDrawer({
  merchants,
  currencies,
  maxNicknameLength,
}: {
  merchants: MerchantOption[]
  currencies: Currency[]
  maxNicknameLength: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency | "">("")
  const [category, setCategory] = useState<CardCategory | typeof NO_LOCK>(NO_LOCK)
  const [limitError, setLimitError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [issued, setIssued] = useState<Issued | null>(null)
  // One key per form session: a retry or a double click reuses it, so the
  // server issues at most one card. A fresh form gets a fresh key.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const merchant = merchants.find((m) => m.id === merchantId)
  const mismatch = merchant && currency && currency !== merchant.currency

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("")
    setCategory(NO_LOCK)
    setLimitError(null)
    setError(null)
    setIssued(null)
    setIdempotencyKey(crypto.randomUUID())
  }

  const onOpenChange = (next: boolean) => {
    // Closing mid-request would drop the one response that carries the number.
    if (!next && submitting) return
    setOpen(next)
    if (!next) {
      const hadIssued = issued !== null
      reset()
      if (hadIssued) router.refresh()
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    setError(null)
    setLimitError(null)

    if (!nickname.trim()) return setError("Nickname is required.")
    if (!merchantId) return setError("Choose a merchant.")
    if (!currency) return setError("Choose a currency.")
    if (mismatch) return setError(`Issue this card in ${merchant.currency}.`)

    // Converted once, here, at the boundary. The server re-validates it.
    const spendLimit = parseAmountToMinorUnits(limit)
    if (spendLimit === null || spendLimit <= 0) {
      return setLimitError("Enter an amount like 250.00, greater than zero.")
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit,
          currency,
          categoryLock: category === NO_LOCK ? null : category,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.card || !body?.number) {
        setError(body?.error ?? "The card could not be issued. Try again.")
        return
      }
      setIssued({ nickname: body.card.nickname, number: body.number })
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
            <DrawerBody className="flex flex-col gap-4">
              <div>
                <p className="text-sm text-gray-500">Nickname</p>
                <p className="font-medium text-gray-900 dark:text-gray-50">
                  {issued.nickname}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Card number</p>
                <p className="font-mono text-lg tracking-wider text-gray-900 dark:text-gray-50">
                  {issued.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
                </p>
              </div>
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-400/10 dark:text-amber-400">
                This is the only time the full number is shown. It cannot be
                retrieved later.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
            <DrawerBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="card-nickname" className={labelClass}>
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  name="nickname"
                  required
                  maxLength={maxNicknameLength}
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ad spend — Q3"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="card-merchant" className={labelClass}>
                  Merchant
                </label>
                <Select
                  value={merchantId}
                  onValueChange={(id) => {
                    setMerchantId(id)
                    const picked = merchants.find((m) => m.id === id)
                    if (picked) setCurrency(picked.currency)
                  }}
                >
                  <SelectTrigger id="card-merchant">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="card-limit" className={labelClass}>
                  Spend limit
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="card-limit"
                    name="spendLimit"
                    inputMode="decimal"
                    autoComplete="off"
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    placeholder="250.00"
                    hasError={limitError !== null}
                    aria-invalid={limitError !== null}
                    aria-describedby={limitError ? "card-limit-error" : undefined}
                  />
                  <span className="w-10 shrink-0 text-sm text-gray-500">
                    {currency || "—"}
                  </span>
                </div>
                {limitError && (
                  <p
                    id="card-limit-error"
                    className="text-sm text-red-600 dark:text-red-500"
                  >
                    {limitError}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="card-currency" className={labelClass}>
                  Currency
                </label>
                <Select
                  value={currency}
                  onValueChange={(value) => setCurrency(value as Currency)}
                >
                  <SelectTrigger
                    id="card-currency"
                    hasError={Boolean(mismatch)}
                    aria-invalid={Boolean(mismatch)}
                    aria-describedby={mismatch ? "card-currency-error" : undefined}
                  >
                    <SelectValue placeholder="Choose a currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mismatch && (
                  <p
                    id="card-currency-error"
                    className="text-sm text-red-600 dark:text-red-500"
                  >
                    {merchant.name} settles in {merchant.currency}. Cards for
                    this merchant must be issued in {merchant.currency}.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="card-category" className={labelClass}>
                  Merchant category lock
                </label>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    setCategory(value as CardCategory | typeof NO_LOCK)
                  }
                >
                  <SelectTrigger
                    id="card-category"
                    aria-describedby="card-category-hint"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LOCK}>No lock</SelectItem>
                    {CARD_CATEGORIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {CARD_CATEGORY_LABELS[code]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id="card-category-hint" className="text-sm text-gray-500">
                  Only spend in this category is allowed. Set at issue; it
                  cannot be changed later.
                </p>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-500">
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <Button
                type="submit"
                isLoading={submitting}
                loadingText="Issuing..."
                disabled={submitting || Boolean(mismatch)}
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
