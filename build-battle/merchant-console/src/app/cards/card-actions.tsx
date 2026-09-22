"use client"

import { Button } from "@/components/Button"
import type { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function CardActions({
  id,
  nickname,
  status,
}: {
  id: string
  nickname: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return <span className="text-gray-400 dark:text-gray-600">—</span>
  }

  const update = async (next: CardStatus) => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "The card could not be updated. Try again.")
        return
      }
      setConfirmingCancel(false)
      router.refresh()
    } catch {
      setError("The card could not be updated. Check your connection and try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        {status === "active" && !confirmingCancel && (
          <Button
            variant="secondary"
            className="py-1"
            disabled={pending}
            aria-label={`Freeze ${nickname}`}
            onClick={() => update("frozen")}
          >
            Freeze
          </Button>
        )}
        {status === "frozen" && !confirmingCancel && (
          <Button
            variant="secondary"
            className="py-1"
            disabled={pending}
            aria-label={`Unfreeze ${nickname}`}
            onClick={() => update("active")}
          >
            Unfreeze
          </Button>
        )}
        {confirmingCancel ? (
          <>
            <Button
              variant="secondary"
              className="py-1"
              disabled={pending}
              aria-label={`Keep ${nickname}`}
              onClick={() => setConfirmingCancel(false)}
            >
              Keep card
            </Button>
            <Button
              variant="destructive"
              className="py-1"
              disabled={pending}
              aria-label={`Confirm cancel ${nickname}`}
              onClick={() => update("cancelled")}
            >
              Confirm cancel
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            className="py-1 text-red-600 dark:text-red-500"
            disabled={pending}
            aria-label={`Cancel card ${nickname}`}
            onClick={() => {
              setError(null)
              setConfirmingCancel(true)
            }}
          >
            Cancel card
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
