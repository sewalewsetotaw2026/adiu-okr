import { useState, type ChangeEvent, type FormEvent } from "react";
import { MdEmail } from "react-icons/md";
import Input from "../common/Input";
import Button from "../Core/ui/Button";
import toast from "react-hot-toast";
import authService from "../../services/authService";

interface ForgotPasswordFormProps {
  title?: string;
  subtitle?: string;
}

export default function ForgotPasswordForm({
  title = "Forgot Password?",
  subtitle = "Enter your email and we’ll send a reset link",
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = () => {
    if (!email) return "Email is required";
    if (!/\S+@\S+\.\S+/.test(email)) return "Please enter a valid email";
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const validationError = validate();
    setError(validationError);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword({ email });
      toast.success(
        "If an account exists for this email, we sent a reset link.",
      );
    } catch {
      // Always show a generic confirmation message to avoid account enumeration.
      toast.success(
        "If an account exists for this email, we sent a reset link.",
      );
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center px-6 py-8 lg:px-12 bg-transparent">
      <div className="w-full max-w-[380px]">

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-k-dark-grey mb-2">{title}</h1>
          <p className="text-sm">{subtitle}</p>
        </div>

        {submitted ? (
          <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl p-4 text-sm text-k-dark-grey">
            If an account exists for this email, we sent a reset link. Please
            check your email.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="E-mail Address"
              type="email"
              name="email"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="you@example.com"
              icon={MdEmail}
              error={!!error}
              helperText={error || ""}
              required
            />

            <Button type="submit" variant="primary" fullWidth loading={loading}>
              Send Reset Link
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
