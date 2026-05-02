type Status = "draft" | "published" | "closed" | "open" | "planning";

const statusStyles: Record<Status, string> = {
  draft: "bg-yellow-100 text-yellow-700",
  published: "bg-green-100 text-green-700",
  closed: "bg-gray-200 text-gray-600",
  open: "bg-blue-100 text-blue-700",
  planning: "bg-purple-100 text-purple-700",
};

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center shrink-0 whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium capitalize leading-none ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}

// (Optional but recommended for reuse)
export type { Status };
