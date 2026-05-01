import React, { useState, useEffect } from "react";
import carousel1 from "../../../assets/images/carousel/carousel-1.png";
import carousel2 from "../../../assets/images/carousel/carousel-2.png";
import carousel3 from "../../../assets/images/carousel/carousel-3.png";

const defaultSlides = [
  {
    title: "Streamline Your HR Operations",
    description:
      "Manage all HR tasks from leave requests to employee records in one unified platform.",
    bgImage: carousel1,
    gradientFrom: "#4A148C",
    gradientTo: "#6A1B9A",
  },
  {
    title: "Empower Your Team",
    description:
      "Give employees self-service access to their information, reducing administrative overhead.",
    bgImage: carousel2,
    gradientFrom: "#6A1B9A",
    gradientTo: "#7B1FA2",
  },
  {
    title: "Data-Driven Decisions",
    description:
      "Get insights and analytics to make informed decisions about your workforce.",
    bgImage: carousel3,
    gradientFrom: "#7B1FA2",
    gradientTo: "#8E24AA",
  },
];

export default function Carousel({ slides = defaultSlides }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [slides.length]);

  const goToSlide = (index) => {
    setCurrentIndex(index);
  };

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl">
      <div className="relative w-full h-full">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute top-0 left-0 w-full h-full transition-opacity duration-800 ease-in-out ${
              index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            {/* Background Image */}
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                backgroundImage: `url(${slide.bgImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />

            {/* Gradient Overlay */}
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                background: `linear-gradient(135deg, ${slide.gradientFrom}CC, ${slide.gradientTo}CC)`,
              }}
            />

            {/* Content */}
            <div className="relative w-full h-full flex items-center justify-center p-8">
              <div className="max-w-2xl text-center text-white animate-[slideUp_0.6s_ease-out]">
                <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight drop-shadow-lg">
                  {slide.title}
                </h2>
                <p className="text-lg md:text-xl leading-relaxed text-white/95 drop-shadow-md">
                  {slide.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-20">
        {slides.map((_, index) => (
          <button
            key={index}
            className={`h-1.5 border-0 rounded-full cursor-pointer transition-all duration-200 p-0 hover:bg-[#fecd30] ${
              index === currentIndex ? "bg-[#fecd30] w-12" : "w-10 bg-white/40"
            }`}
            onClick={() => goToSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>


    </div>
  );
}
