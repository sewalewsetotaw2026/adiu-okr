type Type = "score" | "value" | "required";

type Props = {
  type: Type;
};

const styles: Record<Type, string> = {
  score: "bg-blue-100 text-blue-700",
  value: "bg-purple-100 text-purple-700",
  required: "bg-red-100 text-red-700",
};

const labels: Record<Type, string> = {
  score: "Score",
  value: "Value",
  required: "Required",
};

export function ContributionChip({ type }: Props) {
  return (
    <span
      className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[type]}`}
    >
      {labels[type]}
    </span>
  );
}
