import { useNavigate, Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

interface BackButtonProps {
  label?: string;
  to?: string;
  fallbackTo?: string;
  className?: string; // Optional extra classes
}

/**
 * Standardized Back Button/Link for Admin Pages
 * Matches the "Back to Employees" style from the CreateEmployee page.
 */
export default function BackButton({
  label = "Back",
  to,
  fallbackTo,
  className = "",
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    if (to) return; // Let Link handle it if 'to' is provided
    
    e.preventDefault();
    if (window.history.length > 1) {
      navigate(-1);
    } else if (fallbackTo) {
      navigate(fallbackTo);
    }
  };

  const containerClasses = `flex items-center text-k-medium-grey hover:text-k-orange transition-colors mb-4 w-fit cursor-pointer ${className}`;

  if (to) {
    return (
      <Link to={to} className={containerClasses}>
        <FiArrowLeft className="mr-2" />
        {label}
      </Link>
    );
  }

  return (
    <div onClick={handleClick} className={containerClasses}>
      <FiArrowLeft className="mr-2" />
      {label}
    </div>
  );
}
