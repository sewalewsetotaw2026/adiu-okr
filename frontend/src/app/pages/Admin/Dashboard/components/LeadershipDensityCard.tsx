import React, { useMemo } from "react";
import { FiUsers, FiBriefcase } from "react-icons/fi";

interface LeadershipDensityCardProps {
  title: string;
  data: { name: string; value: number; fill: string }[];
}

export default function LeadershipDensityCard({ title, data }: LeadershipDensityCardProps) {
  const { total, managerCount, staffCount, managerPercent, staffPercent, ratio } = useMemo(() => {
    const managers = data.find(d => d.name === "Managers")?.value || 0;
    const staff = data.find(d => d.name === "Staff")?.value || 0;
    const tot = managers + staff;
    const mPercent = tot > 0 ? (managers / tot) * 100 : 0;

    return {
      total: tot,
      managerCount: managers,
      staffCount: staff,
      managerPercent: mPercent,
      staffPercent: 100 - mPercent,
      ratio: managers > 0 ? (staff / managers).toFixed(1) : "0"
    };
  }, [data]);

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 flex flex-col h-full min-h-[400px]">
      <div className="mb-2">
        <h2 className="text-lg font-bold text-k-dark-grey">{title}</h2>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {/* Detailed Breakdown Cards */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/50 border border-purple-100 transition-colors hover:bg-purple-50 group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white text-k-purple flex items-center justify-center shadow-sm">
                <FiBriefcase className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">Managers</div>
                <div className="text-[10px] text-purple-400 font-bold uppercase">Decision Makers</div>
              </div>
            </div>
            <div className="text-lg font-bold text-gray-800">{managerCount}</div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 border border-gray-100 transition-colors hover:bg-gray-50 group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white text-gray-400 flex items-center justify-center shadow-sm">
                <FiUsers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">Staff Members</div>
                <div className="text-[10px] text-gray-400 font-bold uppercase">Individual Contributors</div>
              </div>
            </div>
            <div className="text-lg font-bold text-gray-800">{staffCount}</div>
          </div>
        </div>

        {/* The Premium Capsule Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
            <span className="text-k-purple">Management {Math.round(managerPercent)}%</span>
            <span className="text-gray-400">Staff {Math.round(staffPercent)}%</span>
          </div>

          <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex ring-1 ring-gray-200">
            <div
              style={{ width: `${managerPercent}%` }}
              className="h-full bg-gradient-to-r from-k-purple to-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)] relative group"
            >
              {/* Sheen effect */}
              <div className="absolute top-0 right-0 w-full h-full bg-white/20 skew-x-12 transform origin-bottom-left" />
            </div>
          </div>
        </div>

        {/* Main Metric - Centered & Big (Moved to End) */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-4 bg-purple-50 rounded-full mb-3 ring-4 ring-purple-50/50">
            <span className="text-4xl font-extrabold text-k-purple">{ratio}</span>
            <span className="text-sm font-bold text-purple-400 ml-1 mt-3">Staff / Mgr</span>
          </div>
          <p className="text-gray-500 font-medium text-sm">
            Ideal balanced ratio is typically 1:7 to 1:12
          </p>
        </div>
      </div>
    </div>
  );
}
