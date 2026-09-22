"use client"

import { Button } from "@/components/Button"
import type { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/** Freeze, unfreeze and a two-step cancel. The server guards every transition. */
export function CardActions(props: { id: string; nickname: string; status: CardStatus }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (props.status === "cancelled") {
    return <span className="text-gray-400 dark:text-gray-600">—</span>
  }

  const update = async (status: CardStatus) => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${props.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        return setError(body?.error ?? "The card could not be updated. Try again.")
      }
      setConfirming(false)
      router.refresh()
    } catch {
      setError("The card could not be updated. Check your connection and try again.")
    } finally {
      setPending(false)
    }
  }

  const action = (
    label: string,
    name: string,
    onClick: () => void,
    variant: "secondary" | "ghost" | "destructive" = "secondary",
  ) => (
    <Button
      variant={variant}
      className={variant === "ghost" ? "py-1 text-red-600 dark:text-red-500" : "py-1"}
      disabled={pending}
      aria-label={`${name} ${props.nickname}`}
      onClick={onClick}
    >
      {label}
    </Button>
  )

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        {confirming ? (
          <>
            {action("Keep card", "Keep", () => setConfirming(false))}
            {action("Confirm cancel", "Confirm cancel", () => update("cancelled"), "destructive")}
          </>
        ) : (
          <>
            {props.status === "active"
              ? action("Freeze", "Freeze", () => update("frozen"))
              : action("Unfreeze", "Unfreeze", () => update("active"))}
            {action("Cancel card", "Cancel card", () => setConfirming(true), "ghost")}
          </>
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
