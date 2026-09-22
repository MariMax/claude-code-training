"use client"

import { Button } from "@/components/Button"

/** Shown when the card list or a card fails to load. */
export default function CardsError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="px-4 py-16 text-center sm:p-6">
      <h1 className="font-medium text-gray-900 dark:text-gray-50">
        Cards could not be loaded
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Nothing was changed. Try again, and if it keeps failing, ask the
        platform team.
      </p>
      <Button variant="secondary" className="mt-4 py-1.5" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
