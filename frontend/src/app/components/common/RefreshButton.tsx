import { MdRefresh } from "react-icons/md";
import Button from "../Core/ui/Button";

interface RefreshButtonProps {
  onClick: () => void | Promise<void>;
  loading?: boolean;
  className?: string;
  label?: string;
}

export default function RefreshButton({
  onClick,
  loading = false,
  className = "",
  label = "Refresh",
}: RefreshButtonProps) {
  return (
    <Button
      variant="white"
      size="sm"
      icon={MdRefresh}
      onClick={onClick}
      disabled={loading}
      className={`shadow-sm ring-1 ring-gray-200 hover:ring-gray-300 transition-all ${className}`}
    >
      {loading ? "Refreshing..." : label}
    </Button>
  );
}
