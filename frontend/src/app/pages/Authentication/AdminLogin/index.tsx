import LoginForm from "../../../components/auth/LoginForm";
import Carousel from "../../../components/common/Carousel";
import loginBg from "../../../../assets/images/login_bg_image.jpg";
import carousel1 from "../../../../assets/images/carousel/carousel-1.png";
import carousel2 from "../../../../assets/images/carousel/carousel-2.png";
import carousel3 from "../../../../assets/images/carousel/carousel-3.png";

export default function AdminLogin() {
  const hrCarouselSlides = [
    {
      title: "Manage Your Workforce Efficiently",
      description:
        "Access powerful HR tools to manage employees, track performance, and streamline operations from one central dashboard.",
      bgImage: carousel1,
      gradientFrom: "#4A148C",
      gradientTo: "#6A1B9A",
    },
    {
      title: "Data-Driven HR Insights",
      description:
        "Make informed decisions with comprehensive analytics and reporting tools to optimize your HR processes.",
      bgImage: carousel2,
      gradientFrom: "#6A1B9A",
      gradientTo: "#7B1FA2",
    },
    {
      title: "Complete Control & Oversight",
      description:
        "Monitor all HR activities, manage permissions, and ensure compliance across your organization.",
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
          title="HR Admin Portal"
          subtitle="Login to manage your organization"
        />

        {/* Right Side - Carousel */}
        <div className="hidden lg:block relative h-full rounded-r-2xl overflow-hidden">
          <Carousel slides={hrCarouselSlides} />
        </div>
      </div>
    </div>
  );
}
