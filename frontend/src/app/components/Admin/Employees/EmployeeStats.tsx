import React from "react";
import {
  FiUsers,
  FiUserCheck,
  FiUserX,
  FiCalendar,
  FiLayers,
} from "react-icons/fi";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  change?: { value: string; trend: "up" | "down" };
}

function StatCard({ icon, label, value, helper, change }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-xl bg-gray-50 text-primary">{icon}</div>
        {change && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${change.trend === "up"
                ? "bg-green-50 text-green-600"
                : "bg-red-50 text-red-600"
              }`}
          >
            {change.value}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-2xl font-bold text-k-dark-grey mb-1">{value}</h3>
        <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
        <p className="text-xs text-gray-500">{helper}</p>
      </div>
    </div>
  );
}

interface StaffStatsProps {
  totalStaff: number;
  activeCount: number;
  inactiveCount: number;
  departmentsCount?: number;
  onLeaveCount?: number;
  newJoinersCount?: number;
}

export function EmployeeStats({
  totalStaff,
  activeCount,
  inactiveCount,
  departmentsCount = 4,
  onLeaveCount = 2,
}: StaffStatsProps) {
  return (
    <section className="grid gap-4 mb-8 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
      <StatCard
        icon={<FiUsers className="h-6 w-6" />}
        label="Total Staff"
        value={totalStaff.toString()}
        helper="All team members"
        change={{ value: "+12%", trend: "up" }}
      />
      <StatCard
        icon={<FiUserCheck className="h-6 w-6" />}
        label="Active"
        value={activeCount.toString()}
        helper="Currently working"
      />
      <StatCard
        icon={<FiUserX className="h-6 w-6" />}
        label="Inactive"
        value={inactiveCount.toString()}
        helper="Disabled accounts"
      />
      <StatCard
        icon={<FiLayers className="h-6 w-6" />}
        label="Departments"
        value={departmentsCount.toString()}
        helper="Across organization"
      />
      <StatCard
        icon={<FiCalendar className="h-6 w-6" />}
        label="On Leave"
        value={onLeaveCount.toString()}
        helper="Currently away"
      />
    </section>
  );
}
