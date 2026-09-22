import Link from "next/link"

export default function CardNotFound() {
  return (
    <div className="p-4 py-16 text-center sm:p-6">
      <h1 className="font-medium text-gray-900 dark:text-gray-50">This card does not exist</h1>
      <p className="mt-1 text-sm text-gray-500">
        Check the link, or <Link href="/cards" className="text-blue-600 hover:underline dark:text-blue-500">find it in the list</Link>.
        Cards issued before the console last restarted are not kept.
      </p>
    </div>
  )
}
