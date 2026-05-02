import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MdLock } from "react-icons/md";
import { FiEye, FiEyeOff } from "react-icons/fi";
import Input from "../common/Input";
import Button from "../Core/ui/Button";
import toast from "react-hot-toast";
import authService from "../../services/authService";

interface ResetPasswordFormProps {
  title?: string;
  subtitle?: string;
  token?: string;
  showConfirmPassword?: boolean;
}

export default function ResetPasswordForm({
  title = "Reset Password",
  subtitle = "Enter a new password",
  token: propToken,
  showConfirmPassword = true,
}: ResetPasswordFormProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(
    () => propToken || searchParams.get("token") || "",
    [propToken, searchParams],
  );
  const didShowMissingTokenToast = useRef(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) return;
    if (didShowMissingTokenToast.current) return;
    toast.error("Reset token is missing. Please request a new reset link.");
    didShowMissingTokenToast.current = true;
  }, [token]);

  const validate = () => {
    const nextFieldErrors: {
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!token) {
      return {
        fieldErrors: nextFieldErrors,
        message: "Reset token is missing.",
      };
    }

    if (!password) {
      nextFieldErrors.password = "New password is required";
    } else if (password.length < 6) {
      nextFieldErrors.password = "Password must be at least 6 characters";
    }

    if (showConfirmPassword) {
      if (!confirmPassword) {
        nextFieldErrors.confirmPassword = "Please confirm your password";
      } else if (confirmPassword !== password) {
        nextFieldErrors.confirmPassword = "Passwords do not match";
      }
    }

    const firstError =
      nextFieldErrors.password || nextFieldErrors.confirmPassword || null;

    return {
      fieldErrors: nextFieldErrors,
      message: firstError,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const { fieldErrors: validationFieldErrors, message } = validate();
    setFieldErrors(validationFieldErrors);
    setError(message);
    if (message) {
      toast.error(message);
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({ token, password });
      setSuccess(true);
      toast.success("Password updated successfully");
      // backend returns JWT; authService stores it like login.
      // Clear auto-login token if consistent with user request to show login screen
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Token is invalid or has expired";

      const friendlyMessage =
        String(message).includes("invalid") ||
          String(message).includes("expired")
          ? "Link expired. Please request a new reset link."
          : message;

      setError(friendlyMessage);
      setFieldErrors({});
      toast.error(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex items-center justify-center px-6 py-8 lg:px-12 bg-transparent">
        <div className="w-full max-w-[380px]">
          <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl p-4 text-sm text-k-dark-grey">
            Reset token is missing. Please request a new reset link.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center px-6 py-8 lg:px-12 bg-transparent">
      <div className="w-full max-w-[380px]">

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-k-dark-grey mb-2">{title}</h1>
          <p className="text-sm">{subtitle}</p>
        </div>

        {success ? (
          <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl p-4 text-sm text-k-dark-grey">
            Password updated successfully. Redirecting…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="New Password"
              type={showPassword ? "text" : "password"}
              name="newPassword"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
                if (fieldErrors.password || fieldErrors.confirmPassword) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    password: undefined,
                    ...(showConfirmPassword
                      ? { confirmPassword: undefined }
                      : null),
                  }));
                }
              }}
              placeholder="Enter new password"
              icon={MdLock}
              error={
                !!fieldErrors.password || (!!error && !showConfirmPassword)
              }
              helperText={
                fieldErrors.password ||
                (!showConfirmPassword ? error || "" : "")
              }
              required
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-k-medium-grey hover:text-k-dark-grey transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              }
            />

            {showConfirmPassword && (
              <Input
                label="Confirm Password"
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError(null);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      confirmPassword: undefined,
                    }));
                  }
                }}
                placeholder="Confirm new password"
                icon={MdLock}
                error={!!fieldErrors.confirmPassword}
                helperText={fieldErrors.confirmPassword || ""}
                required
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-k-medium-grey hover:text-k-dark-grey transition-colors"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <FiEyeOff size={18} />
                    ) : (
                      <FiEye size={18} />
                    )}
                  </button>
                }
              />
            )}

            <Button type="submit" variant="primary" fullWidth loading={loading}>
              {title === "Setup Account"
                ? "Activate Account"
                : "Reset Password"}
            </Button>

            {error === "Link expired. Please request a new reset link." && (
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-sm font-medium text-k-orange hover:text-k-dark-grey transition-colors duration-200 text-left"
              >
                Back to Forgot Password
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
