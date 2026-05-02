import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  size?: "sm" | "lg";
}

export default function StatCard({
  title,
  value,
  icon,
  size = "sm",
}: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-md border border-gray-100
      flex items-center gap-5 transition-all hover:shadow-lg
      ${size === "lg" ? "p-6 md:p-8" : "p-4 md:p-5"}`}
    >
      <div
        className={`rounded-2xl bg-k-orange text-white flex items-center justify-center
        ${size === "lg" ? "p-5 text-4xl" : "p-3 text-2xl"}`}
      >
        {icon}
      </div>

      <div>
        <p className="text-gray-500 text-lg">{title}</p>
        <p
          className={`font-extrabold text-k-dark-grey ${
            size === "lg" ? "text-3xl" : "text-xl"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
