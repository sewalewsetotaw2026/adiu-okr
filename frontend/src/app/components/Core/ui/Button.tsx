import React, { forwardRef } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "link"
  | "danger"
  | "success"
  | "subtle"
  | "warning"
  | "white"
  | "ghost";

export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: React.ElementType;
  iconPosition?: "left" | "right";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      type = "button",
      disabled = false,
      fullWidth = false,
      icon: Icon,
      iconPosition = "left",
      loading = false,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseClasses =
      "relative inline-flex items-center justify-center gap-2 rounded-xl border-0 font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 disabled:cursor-not-allowed select-none";

    // Size tokens - sm for table/row actions, md as default CTA, lg for hero actions
    const sizeClasses: Record<ButtonSize, string> = {
      sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
      md: "h-10 px-5 text-sm",
      lg: "h-12 px-6 text-base",
    };

    const iconSizeClasses: Record<ButtonSize, string> = {
      sm: "text-base",
      md: "text-lg",
      lg: "text-xl",
    };

    const variantClasses: Record<ButtonVariant, string> = {
      primary:
        "text-white bg-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:hover:translate-y-0 disabled:hover:shadow-lg focus-visible:ring-primary/20",
      secondary:
        "text-k-dark-grey bg-white border-2 border-gray-200 shadow-md hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-lg disabled:hover:translate-y-0 disabled:hover:bg-gray-100 focus-visible:ring-gray-400/20",
      outline:
        "text-k-dark-grey bg-white border-2 border-primary shadow-md hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-lg disabled:hover:translate-y-0 disabled:hover:bg-white focus-visible:ring-primary/20",
      link: "text-primary bg-transparent p-0 h-auto font-medium shadow-none hover:text-k-dark-grey hover:underline focus-visible:ring-primary/20",
      danger:
        "text-white bg-error shadow-md hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg disabled:hover:translate-y-0 focus-visible:ring-error/20",
      success:
        "text-white bg-success shadow-md hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg disabled:hover:translate-y-0 focus-visible:ring-success/20",
      subtle:
        "text-k-dark-grey bg-gray-100 shadow-none hover:bg-gray-200 focus-visible:ring-gray-400/20",
      warning:
        "bg-secondary text-black hover:bg-secondary-light shadow-md hover:-translate-y-0.5 hover:shadow-lg disabled:hover:translate-y-0 disabled:hover:bg-secondary focus-visible:ring-secondary/20",
      white:
        "bg-white border-0 text-k-dark-grey font-semibold shadow-md hover:bg-white/90 hover:-translate-y-0.5 hover:shadow-lg disabled:hover:translate-y-0 disabled:hover:bg-white focus-visible:ring-white/20",
      ghost:
        "bg-transparent text-k-dark-grey shadow-none hover:bg-gray-100 focus-visible:ring-gray-400/20",
    };

    // Darker backgrounds for loading state to contrast with Keycha spinner (Orange/Yellow)
    const loadingClasses: Record<ButtonVariant, string> = {
      primary: "bg-primary-dark !text-transparent",
      secondary: "!bg-gray-200 !text-transparent",
      outline: "!bg-gray-100 !text-transparent",
      link: "!text-transparent",
      danger: "!bg-error !text-transparent",
      success: "!bg-success !text-transparent",
      subtle: "!bg-gray-300 !text-transparent",
      warning: "!bg-secondary-light !text-transparent",
      white: "!bg-gray-100 !text-transparent",
      ghost: "!bg-gray-100 !text-transparent",
    };

    const widthClass = fullWidth ? "w-full" : "";
    const opacityClass = disabled && !loading ? "opacity-55" : "";
    const isLinkVariant = variant === "link";

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`${baseClasses} ${!isLinkVariant ? sizeClasses[size] : ""} ${variantClasses[variant]
          } ${widthClass} ${loading ? loadingClasses[variant] : ""} ${opacityClass} ${className} ${loading ? "pointer-events-none" : ""
          }`}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 w-full h-full overflow-hidden rounded-xl">
            <div className="absolute inset-0 bg-black/10 z-10" />
            <div className="w-full h-full shimmer-bg opacity-60 relative z-20" />
          </span>
        )}
        {!loading && Icon && iconPosition === "left" && (
          <span className={`flex items-center ${iconSizeClasses[size]}`}>
            <Icon />
          </span>
        )}
        <span className={loading ? "opacity-0" : ""}>{children}</span>
        {!loading && Icon && iconPosition === "right" && (
          <span className={`flex items-center ${iconSizeClasses[size]}`}>
            <Icon />
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
