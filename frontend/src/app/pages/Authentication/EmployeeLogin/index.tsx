import LoginForm from "../../../components/auth/LoginForm";
import Carousel from "../../../components/common/Carousel";
import loginBg from "../../../../assets/images/login_bg_image.jpg";
import carousel1 from "../../../../assets/images/carousel/carousel-1.png";
import carousel2 from "../../../../assets/images/carousel/carousel-2.png";
import carousel3 from "../../../../assets/images/carousel/carousel-3.png";

export default function EmployeeLogin() {
  const employeeCarouselSlides = [
    {
      title: "Your Personal HR Portal",
      description:
        "Access your profile, view payslips, request time off, and manage your work schedule all in one place.",
      bgImage: carousel1,
      gradientFrom: "#4A148C",
      gradientTo: "#6A1B9A",
    },
    {
      title: "Stay Connected & Informed",
      description:
        "Get real-time notifications about company updates, policy changes, and important announcements.",
      bgImage: carousel2,
      gradientFrom: "#6A1B9A",
      gradientTo: "#7B1FA2",
    },
    {
      title: "Self-Service Made Easy",
      description:
        "Update your information, download documents, and submit requests without waiting for HR assistance.",
      bgImage: carousel3,
      gradientFrom: "#7B1FA2",
      gradientTo: "#8E24AA",
    },
  ];

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
      {/* Blur overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-black/10"></div>

      {/* Login container */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 w-full max-w-[1200px] h-[550px] bg-white/20 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden mx-4">
        {/* Left Side - Login Form */}
        <LoginForm
          title="Employee Portal"
          subtitle="Login to access your account"
        />

        {/* Right Side - Carousel */}
        <div className="hidden lg:block relative h-full rounded-r-2xl overflow-hidden">
          <Carousel slides={employeeCarouselSlides} />
        </div>
      </div>
    </div>
  );
}
