type Props = {
  label: string;
  variant?: "default" | "success" | "warning" | "danger";
};

export default function MetricTag({ label, variant = "default" }: Props) {
  const styles = {
    default: "bg-gray-100 text-gray-600",
    success: "bg-green-100 text-green-700",
    warning: "bg-yellow-100 text-yellow-700",
    danger: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`text-xs px-2.5 py-1 rounded-lg font-medium ${styles[variant]}`}
    >
      {label}
    </span>
  );
}
