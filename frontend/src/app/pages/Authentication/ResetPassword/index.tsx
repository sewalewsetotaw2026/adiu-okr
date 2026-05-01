import Carousel from "../../../components/common/Carousel";
import loginBg from "../../../../assets/images/login_bg_image.jpg";
import ResetPasswordForm from "../../../components/auth/ResetPasswordForm";

export default function ResetPassword() {
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

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 w-full max-w-[1200px] h-[550px] bg-white/20 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden mx-4">
        <ResetPasswordForm />

        <div className="hidden lg:block relative h-full rounded-r-2xl overflow-hidden">
          <Carousel />
        </div>
      </div>
    </div>
  );
}
