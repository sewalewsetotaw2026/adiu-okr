import React, { useEffect, useState } from "react";
import {
  MdTrendingUp,
  MdCheckCircle,
  MdCalendarMonth,
  MdFlagCircle,
} from "react-icons/md";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import LoadingSkeleton from "../../../components/common/LoadingSkeleton";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { okrUnwrap } from "../../../utils/okrApi";
import { formatOkrCount, formatOkrNumber } from "../../../utils/okrNumber";

dayjs.extend(relativeTime);

interface OverviewData {
  summary: {
    avgProgress: number;
    totalObjectives: number;
    totalKRs: number;
    planningCompliance: {
      monthlyPlans: number;
      weeklyPlans: number;
      dailyPlans: number;
    };
  };
  confidenceStats: {
    on_track: number;
    at_risk: number;
    off_track: number;
    not_reported: number;
  };
  recentComments: Array<{
    id: number;
    comment: string;
    reviewerName: string;
    reviewerAvatar?: string;
    createdAt: string;
    entityType: string;
    entityTitle?: string | null;
    parentTitle?: string | null;
  }>;
  adoption: {
    adopted: number;
    personal: number;
  };
}

export default function EmployeeOverviewTab({
  cycleId,
}: {
  cycleId: number | string | null;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cycleId) return;
    const fetchOverview = async () => {
      try {
        setLoading(true);
        const res = await makeCall({
          method: "GET",
          route: apiRoutes.okr.dashboardEmployee(cycleId),
          isSecureRoute: true,
        });
        const parsed = okrUnwrap(res) as OverviewData;
        if (parsed) setData(parsed);
      } catch (err) {
        console.error("Failed to fetch overview", err);
      } finally {
        setLoading(false);
      }
    };
    void fetchOverview();
  }, [cycleId]);

  if (!cycleId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <MdFlagCircle size={48} className="text-slate-200 mb-4" />
        <p className="text-base font-black text-slate-700">No Active Cycle</p>
        <p className="text-sm text-slate-400 mt-1">
          Overview will appear once an OKR cycle is active.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton />
        <LoadingSkeleton />
      </div>
    );
  }

  const summary = data?.summary ?? {
    avgProgress: 0,
    totalObjectives: 0,
    totalKRs: 0,
    planningCompliance: { monthlyPlans: 0, weeklyPlans: 0, dailyPlans: 0 },
  };
  const confidenceStats = data?.confidenceStats ?? {
    on_track: 0,
    at_risk: 0,
    off_track: 0,
    not_reported: 0,
  };
  const compliance = summary.planningCompliance;
  const totalActivities =
    compliance.monthlyPlans + compliance.weeklyPlans + compliance.dailyPlans;
  const avgProgressDisplay = Math.round(Number(summary.avgProgress));
  const healthPct =
    summary.totalKRs > 0
      ? Math.round(
          ((confidenceStats.on_track + confidenceStats.at_risk) /
            summary.totalKRs) *
            100,
        )
      : 0;
  // Dynamic health status based on KR distribution
  const healthStatus =
    confidenceStats.off_track > 0
      ? "Off Track"
      : confidenceStats.at_risk > 0
        ? "At Risk"
        : "On Track";
  const healthBadge =
    confidenceStats.off_track > 0
      ? "Watch"
      : confidenceStats.at_risk > 0
        ? "Caution"
        : "Healthy";

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<MdTrendingUp />}
          label="Overall Progress"
          value={`${formatOkrNumber(avgProgressDisplay)}%`}
          subtext={`Across ${summary.totalObjectives} objective${summary.totalObjectives !== 1 ? "s" : ""}`}
          badge={
            avgProgressDisplay > 70
              ? "Excellent"
              : avgProgressDisplay > 40
                ? "On Track"
                : "Needs Focus"
          }
          color="primary"
        />
        <StatCard
          icon={<MdCheckCircle />}
          label="Key Result Health Score"
          value={`${formatOkrNumber(healthPct)}%`}
          subtext={`${healthStatus} · ${formatOkrCount(confidenceStats.on_track)} on track · ${formatOkrCount(confidenceStats.off_track)} off track`}
          badge={healthBadge}
          color="green"
        />
        <StatCard
          icon={<MdCalendarMonth />}
          label="Planning Activity"
          value={formatOkrCount(totalActivities)}
          subtext={`${formatOkrCount(compliance.monthlyPlans)}M · ${formatOkrCount(compliance.weeklyPlans)}W · ${formatOkrCount(compliance.dailyPlans)}D`}
          badge={totalActivities > 0 ? "Active" : "Pending"}
          color="amber"
        />
        <StatCard
          icon={<MdFlagCircle />}
          label="KR Status Distribution"
          value={`${formatOkrCount(confidenceStats.on_track + confidenceStats.at_risk + confidenceStats.off_track)}`}
          subtext={`${formatOkrCount(confidenceStats.on_track)}✓ · ${formatOkrCount(confidenceStats.at_risk)}⚠ · ${formatOkrCount(confidenceStats.off_track)}✗`}
          badge={healthStatus}
          color={
            confidenceStats.off_track > 0
              ? "red"
              : confidenceStats.at_risk > 0
                ? "amber"
                : "green"
          }
        />
      </div>

      {/* Middle Row: Goal Health + Recent Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Goal Health + Adoption */}
        {/* <div className="lg:col-span-4 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
              <div className="p-2 bg-primary-50 rounded-xl">
                <MdTimeline className="text-primary-600" size={20} />
              </div>
              Goal Health
            </h3>
            <div className="space-y-5">
              <HealthBar
                label="On Track"
                count={confidenceStats.on_track}
                total={summary.totalKRs}
                color="bg-emerald-500"
              />
              <HealthBar
                label="At Risk"
                count={confidenceStats.at_risk}
                total={summary.totalKRs}
                color="bg-amber-500"
              />
              <HealthBar
                label="Off Track"
                count={confidenceStats.off_track}
                total={summary.totalKRs}
                color="bg-rose-500"
              />
              <HealthBar
                label="Not Reported"
                count={confidenceStats.not_reported}
                total={summary.totalKRs}
                color="bg-slate-200"
              />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                Strategy Adoption
              </span>
              <span className="px-2 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black">
                {adoption.adopted + adoption.personal} OKRs
              </span>
            </div>
            <div className="flex gap-1 h-2.5 rounded-full overflow-hidden bg-slate-100">
              <div
                className="bg-primary-500 transition-all duration-1000"
                style={{
                  width: `${(adoption.adopted / Math.max(1, adoption.adopted + adoption.personal)) * 100}%`,
                }}
              />
              <div
                className="bg-primary-200 transition-all duration-1000"
                style={{
                  width: `${(adoption.personal / Math.max(1, adoption.adopted + adoption.personal)) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary-500" />
                <span className="text-[10px] font-bold text-slate-500">
                  Cascaded ({adoption.adopted})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary-200" />
                <span className="text-[10px] font-bold text-slate-500">
                  Individual ({adoption.personal})
                </span>
              </div>
            </div>
          </div>
        </div> */}

        {/* Recent Feedback */}
        {/* <div className="lg:col-span-8 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-xl">
                <MdComment className="text-indigo-600" size={20} />
              </div>
              Recent Feedback
            </h3>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
              Latest {recentComments.length} reviews
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 max-h-[420px] scrollbar-hide">
            {recentComments.length > 0 ? (
              <div className="space-y-6">
                {recentComments.map((comment) => (
                  <div key={comment.id} className="flex gap-4 group">
                    <div className="flex-shrink-0">
                      {comment.reviewerAvatar ? (
                        <img
                          src={comment.reviewerAvatar}
                          alt={comment.reviewerName}
                          className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-100"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-black text-base">
                          {comment.reviewerName.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-black text-slate-900 truncate">
                          {comment.reviewerName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap ml-4">
                          {dayjs(comment.createdAt).fromNow()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
                        {comment.comment}
                      </p>
                      <div className="mt-2 flex flex-col gap-1">
                        {comment.entityTitle ? (
                          <div className="flex items-start gap-1.5">
                            <span className={`shrink-0 mt-0.5 text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider border ${
                              comment.entityType === "EMPLOYEE_KR"
                                ? "bg-violet-50 text-violet-700 border-violet-200"
                                : "bg-primary-50 text-primary-700 border-primary-100"
                            }`}>
                              {comment.entityType === "EMPLOYEE_KR" ? "Key Result" : "Objective"}
                            </span>
                            <span className="text-xs font-semibold text-slate-700 leading-snug line-clamp-2">
                              {comment.entityTitle}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[9px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-black uppercase tracking-wider border border-slate-200 self-start">
                            {String(comment.entityType || "Update").replace(/_/g, " ")}
                          </span>
                        )}
                        {comment.parentTitle && comment.entityType === "EMPLOYEE_KR" && (
                          <div className="flex items-center gap-1.5 ml-0.5">
                            <span className="text-[9px] text-slate-400">under objective:</span>
                            <span className="text-[10px] font-semibold text-slate-500 line-clamp-1">{comment.parentTitle}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-52 flex flex-col items-center justify-center text-slate-400 space-y-3">
                <MdComment size={40} className="opacity-20" />
                <div className="text-center">
                  <p className="text-base font-black text-slate-700">
                    No Feedback Yet
                  </p>
                  <p className="text-sm text-slate-400">
                    Keep executing — feedback will appear here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div> */}
      </div>

      {/* Planning Activity — Bottom Section with real data */}
      {/* <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl">
                <MdFlagCircle className="text-emerald-600" size={20} />
              </div>
              Planning Activity
            </h3>
            <p className="text-xs text-slate-400 mt-1 ml-11">
              Plans created across all levels this cycle
            </p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {totalActivities} total plans
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PlanningCard
            icon={<MdCalendarMonth size={20} />}
            label="Monthly Plans"
            count={compliance.monthlyPlans}
            description="Monthly milestone breakdowns"
            colorClass="text-blue-600 bg-blue-50"
          />
          <PlanningCard
            icon={<MdDateRange size={20} />}
            label="Weekly Plans"
            count={compliance.weeklyPlans}
            description="Weekly execution tasks"
            colorClass="text-violet-600 bg-violet-50"
          />
          <PlanningCard
            icon={<MdToday size={20} />}
            label="Daily Plans"
            count={compliance.dailyPlans}
            description="Daily activity items"
            colorClass="text-emerald-600 bg-emerald-50"
          />
        </div>
      </div> */}
    </div>
  );
}

function StatCard({ icon, label, value, subtext, badge, color }: any) {
  const colorSchemes: Record<string, string> = {
    primary: "text-primary-600 bg-primary-50 border-primary-100",
    green: "text-emerald-600 bg-emerald-50 border-emerald-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    red: "text-rose-600 bg-rose-50 border-rose-100",
  };
  const badgeSchemes: Record<string, string> = {
    Excellent: "text-emerald-700 bg-emerald-50 border-emerald-200",
    "On Track": "text-primary-700 bg-primary-50 border-primary-200",
    "Off Track": "text-rose-700 bg-rose-50 border-rose-200",
    Caution: "text-amber-700 bg-amber-50 border-amber-200",
    "Needs Focus": "text-rose-700 bg-rose-50 border-rose-200",
    Healthy: "text-emerald-700 bg-emerald-50 border-emerald-200",
    Watch: "text-amber-700 bg-amber-50 border-amber-200",
    Active: "text-slate-700 bg-slate-50 border-slate-200",
    Pending: "text-slate-500 bg-slate-50 border-slate-200",
    None: "text-slate-400 bg-slate-50 border-slate-200",
  };
  const scheme = colorSchemes[color] || colorSchemes.primary;
  const badgeScheme =
    badgeSchemes[badge] || "text-slate-600 bg-slate-50 border-slate-200";
  return (
    <div className="group relative overflow-hidden rounded-4xl bg-white p-7 shadow-xl shadow-slate-200/40 border border-slate-100 transition-all hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1">
      <div className="flex justify-between items-start mb-6">
        <div
          className={`p-3 rounded-2xl ${scheme} transition-colors group-hover:scale-110 duration-300`}
        >
          {React.cloneElement(icon, { size: 24 })}
        </div>
        <div
          className={`text-[10px] font-black px-3 py-1 rounded-xl border ${badgeScheme} uppercase tracking-tight`}
        >
          {badge}
        </div>
      </div>
      <div className="space-y-1">
        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
          {label}
        </h4>
        <div className="text-4xl font-black text-slate-900 tracking-tighter">
          {value}
        </div>
        <p className="text-xs text-slate-400 font-bold">{subtext}</p>
      </div>
    </div>
  );
}

