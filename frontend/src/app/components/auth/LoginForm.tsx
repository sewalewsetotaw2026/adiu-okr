import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import Input from "../common/Input";
import Button from "../Core/ui/Button";
import Checkbox from "../common/Checkbox";
import { MdEmail, MdLock } from "react-icons/md";
import { FiEye, FiEyeOff } from "react-icons/fi";
import toast from "react-hot-toast";
import { useAuthSlice } from "../../slice/authSlice";
import {
  selectAuthUser,
  selectAuthLoading,
  selectAuthIsError,
  selectAuthIsSuccess,
  selectAuthMessage,
} from "../../slice/authSlice/selectors";
import { useSelector } from "react-redux";
import onboardingService from "../../services/onboardingService";
import { SUPER_ADMIN_ROLES } from "../../../utils/constants";

interface LoginFormProps {
  title?: string;
  subtitle?: string;
  redirectPath?: string;
}

export default function LoginForm({
  title = "Welcome Back!",
  subtitle = "Login to your account",
  redirectPath,
}: LoginFormProps) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const toastShownRef = useRef(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { actions: authActions } = useAuthSlice();

  const user = useSelector(selectAuthUser);
  const isLoading = useSelector(selectAuthLoading);
  const isError = useSelector(selectAuthIsError);
  const isSuccess = useSelector(selectAuthIsSuccess);
  const message = useSelector(selectAuthMessage);

  useEffect(() => {
    if (isError && message) {
      toast.error(message);
      dispatch(authActions.reset());
    }

    if (isSuccess && user && !toastShownRef.current) {
      toastShownRef.current = true;
      const handleRedirect = async () => {
        // Show welcome message once
        toast.success(`Welcome back, ${user?.email || "User"}!`);

        // Determine redirect path based on user role_id
        let path = redirectPath;

        if (!path) {
          // If no custom redirect path, route based on role name
          const roleName = user?.role?.name || user?.role_name || "";
          const isAdminOrHr = ["Admin", "HR"].includes(roleName);
          const isSuperAdmin = SUPER_ADMIN_ROLES.includes(roleName);

          // Check for Platform Admin (Super Admin only)
          if (user?.company_code === "PLATFORM" && isSuperAdmin) {
            path = "/super-admin/companies";
            navigate(path);
            return;
          }

          if (isAdminOrHr || isSuperAdmin) {
            path = "/admin/dashboard";
            navigate(path);
          } else {
            // For employees, check onboarding status first
            try {
              const response = await onboardingService.getStatus();

              const status = response.data?.onboarding_status;

              if (status === "COMPLETED") {
                path = "/employee/dashboard";
              } else if (status === "PENDING_APPROVAL") {
                path = "/employee/waiting-approval";
              } else {
                path = "/employee/onboarding";
              }

              navigate(path);
            } catch (error: any) {
              // If status check fails, default to onboarding page
              console.error("Failed to check onboarding status:", error);
              path = "/employee/onboarding";
              navigate(path);
            }
          }
        } else {
          navigate(path);
        }

        dispatch(authActions.reset());
      };

      handleRedirect();
    }
  }, [
    user,
    isError,
    isSuccess,
    message,
    navigate,
    dispatch,
    redirectPath,
    authActions,
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please correct the errors in the form.");
      return;
    }

    dispatch(
      authActions.loginRequest({
        email: formData.email,
        password: formData.password,
      }),
    );
  };

  return (
    <div className="flex items-center justify-center px-6 py-8 lg:px-12 bg-transparent">
      <div className="w-full max-w-[380px]">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-k-dark-grey mb-2">{title}</h1>
          <p className="text-sm">{subtitle}</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="E-mail Address"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            icon={MdEmail}
            error={!!errors.email}
            helperText={errors.email}
            required
          />

          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            icon={MdLock}
            error={!!errors.password}
            helperText={errors.password}
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

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Checkbox
              label="Remember me"
              name="rememberMe"
              checked={formData.rememberMe}
              onChange={handleChange}
            />
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-k-orange hover:text-k-dark-grey transition-colors duration-200"
            >
              Reset Password?
            </Link>
          </div>

          <Button type="submit" variant="primary" fullWidth loading={isLoading}>
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
