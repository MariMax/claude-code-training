import Link from "next/link"

export default function CardNotFound() {
  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>
      <div className="py-16 text-center">
        <h1 className="font-medium text-gray-900 dark:text-gray-50">
          This card does not exist
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Check the link, or find the card in the list. Cards issued before the
          console last restarted are not kept.
        </p>
      </div>
    </div>
  )
}
