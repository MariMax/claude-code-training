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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Select"
import type { Currency } from "@/data/types"
import { CARD_CATEGORIES, CARD_CATEGORY_LABELS } from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

/** Radix Select cannot hold an empty value, so "no lock" gets a sentinel. */
const NO_LOCK = "none"
const EMPTY = { nickname: "", merchantId: "", limit: "", category: NO_LOCK }

/** A labelled control with an optional hint or error note. */
function Field(props: { id: string; label: string; note?: string | null; error?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label htmlFor={props.id} className="font-medium text-gray-900 dark:text-gray-50">
        {props.label}
      </label>
      {props.children}
      {props.note && (
        <p id={`${props.id}-note`} className={props.error ? "text-red-600 dark:text-red-500" : "text-gray-500"}>
          {props.note}
        </p>
      )}
    </div>
  )
}

function Choice(props: {
  id: string
  value: string
  onChange: (value: string) => void
  options: [value: string, label: string][]
  placeholder?: string
  noted?: boolean
}) {
  return (
    <Select value={props.value} onValueChange={props.onChange}>
      <SelectTrigger id={props.id} aria-describedby={props.noted ? `${props.id}-note` : undefined}>
        <SelectValue placeholder={props.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {props.options.map(([value, label]) => (
          <SelectItem key={value} value={value}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function IssueCardDrawer(props: {
  merchants: { id: string; name: string; currency: Currency }[]
  maxNicknameLength: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [limitError, setLimitError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // The number lives here only until the drawer closes.
  const [issued, setIssued] = useState<{ nickname: string; number: string } | null>(null)
  // One key per form: a retry or double click issues at most one card.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const set = (changes: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...changes }))
  // Cards spend in the merchant's currency; the server enforces it.
  const currency = props.merchants.find((m) => m.id === form.merchantId)?.currency

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
    if (!currency) return setError("Choose a merchant.")
    // Converted once, here, at the boundary. The server re-validates it.
    const spendLimit = parseAmountToMinorUnits(form.limit)
    if (!spendLimit) return setLimitError("Enter an amount like 250.00, greater than zero.")

    setSubmitting(true)
    try {
      const { nickname, merchantId, category } = form
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit,
          currency,
          categoryLock: category === NO_LOCK ? null : category,
        }),
      })
      const body = await response.json().catch(() => null)
      if (response.ok && body?.number) setIssued({ nickname: body.card.nickname, number: body.number })
      else setError(body?.error ?? "The card could not be issued. Try again.")
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
          <DrawerDescription>{issued ? "Copy the number now." : "One merchant, one limit."}</DrawerDescription>
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
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-400">
                The full number is shown only this once.
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
                />
              </Field>
              <Field
                id="card-merchant"
                label="Merchant"
                note={currency && `Issued in ${currency}, the merchant's settlement currency.`}
              >
                <Choice
                  id="card-merchant"
                  value={form.merchantId}
                  placeholder="Choose a merchant"
                  options={props.merchants.map((m) => [m.id, m.name])}
                  onChange={(merchantId) => set({ merchantId })}
                  noted={!!currency}
                />
              </Field>
              <Field id="card-limit" label={`Spend limit ${currency ?? ""}`} note={limitError} error>
                <Input
                  id="card-limit"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="250.00"
                  value={form.limit}
                  onChange={(e) => set({ limit: e.target.value })}
                  hasError={!!limitError}
                  aria-invalid={!!limitError}
                  aria-describedby={limitError ? "card-limit-note" : undefined}
                />
              </Field>
              <Field
                id="card-category"
                label="Merchant category lock"
                note="Only this category can spend. Fixed at issue."
              >
                <Choice
                  id="card-category"
                  value={form.category}
                  options={[[NO_LOCK, "No lock"], ...CARD_CATEGORIES.map((c) => [c, CARD_CATEGORY_LABELS[c]] as [string, string])]}
                  onChange={(category) => set({ category })}
                  noted
                />
              </Field>
              {error && <p role="alert" className="text-sm text-red-600 dark:text-red-500">{error}</p>}
            </DrawerBody>
            <DrawerFooter>
              <Button type="submit" isLoading={submitting} loadingText="Issuing..." disabled={submitting}>
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
