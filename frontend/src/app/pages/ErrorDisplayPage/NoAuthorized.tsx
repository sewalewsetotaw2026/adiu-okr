import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import loginBg from "../../../assets/images/login_bg_image.jpg";
const kachaLogo = "/kacha-logo.jpg";
import Button from "../../components/Core/ui/Button";
import {
  selectAuthToken,
  selectAuthUser,
} from "../../slice/authSlice/selectors";

export default function NoAuthorized() {
  const navigate = useNavigate();
  const token = useSelector(selectAuthToken);
  const user = useSelector(selectAuthUser);

  const primaryPath = useMemo(() => {
    if (token && user) {
      const roleName = user?.role?.name || user?.role_name || '';
      return ['Admin', 'HR'].includes(roleName)
        ? "/admin/dashboard"
        : "/employee/dashboard";
    }
    return "/login";
  }, [token, user]);

  return (
    <div
      className="min-h-screen flex items-center justify-center relative"
      style={{
        backgroundImage: `url(${loginBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 backdrop-blur-sm bg-black/10"></div>

      <div className="relative z-10 w-full max-w-[520px] mx-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-white/70 backdrop-blur-sm p-8">
          <div className="flex justify-center mb-6">
            <img
              src={user?.company?.logo_url || kachaLogo}
              alt={`${user?.company?.company_code || "Kacha"} Logo`}
              className="h-24 md:h-32 lg:h-40 w-auto object-contain mx-auto transition-all"
            />
          </div>

          <div className="text-center">
            <h1 className="text-5xl font-bold text-k-dark-grey mb-2">403</h1>
            <p className="text-sm text-k-medium-grey mb-6">Access denied</p>
            <p className="text-sm text-k-medium-grey mb-8">
              You don’t have permission to view this page.
            </p>

            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate(primaryPath, { replace: true })}
            >
              Go back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
