import { useCallback, useEffect, useState, useMemo } from "react";
import { MdAdd, MdCalendarToday, MdHistory } from "react-icons/md";
import Button from "../../../components/Core/ui/Button";
import LoadingSkeleton from "../../../components/common/LoadingSkeleton";
import ToastService from "../../../../utils/ToastService";
import {
  fetchDailyPlans,
  fetchWeeklyPlans,
  fetchMonthlyPlans,
  deleteDailyPlan,
  updateDailyStatus,
  updateDailyPlan,
} from "../../../services/okr-execution.api";
import type {
  DailyPlan,
  WeeklyPlan,
  MonthlyPlan,
  DayOfWeek,
  DailyStatus,
} from "../../../../types/okr.types";
import DailyTaskCard from "./DailyTaskCard";
import AddDailyTaskModal from "./AddDailyTaskModal";
import EditDailyTaskModal from "./EditDailyTaskModal";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import DailyPlanProgressModal from "./modals/DailyPlanProgressModal";
import FeedbackBanner from "./FeedbackBanner";
import {
  formatReadableDate,
  getPlannedDailyDate,
  parseLocalDate,
  formatDateInput,
  formatConciseDateRange,
} from "../utils/calendarDates";

const DAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

const DAY_SHORT: Record<DayOfWeek, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

const DAY_COLORS: Record<DayOfWeek, string> = {
  MONDAY: "border-blue-200 bg-blue-50/50",
  TUESDAY: "border-violet-200 bg-violet-50/50",
  WEDNESDAY: "border-emerald-200 bg-emerald-50/50",
  THURSDAY: "border-amber-200 bg-amber-50/50",
  FRIDAY: "border-rose-200 bg-rose-50/50",
  SATURDAY: "border-slate-200 bg-slate-50/50",
  SUNDAY: "border-slate-200 bg-slate-50/50",
};

const DAY_HEADER_COLORS: Record<DayOfWeek, string> = {
  MONDAY: "text-blue-700 bg-blue-100",
  TUESDAY: "text-violet-700 bg-violet-100",
  WEDNESDAY: "text-emerald-700 bg-emerald-100",
  THURSDAY: "text-amber-700 bg-amber-100",
  FRIDAY: "text-rose-700 bg-rose-100",
  SATURDAY: "text-slate-600 bg-slate-100",
  SUNDAY: "text-slate-600 bg-slate-100",
};

export interface DailyPlanTabProps {
  /** KR ids belonging to the user's quarterly objectives. */
  krIds: string[];
  /** Optional nonce to trigger a refresh from the parent. */
  refreshNonce?: number;
  /** Whether adding daily tasks is allowed by cadence configuration. */
  allowAdd?: boolean;
  /** Cycle boundaries used to render calendar-aware labels. */
  cycleStartDate?: string | null;
  cycleEndDate?: string | null;
  /**
   * Called after any progress-affecting change (value update, status change,
   * task create/delete) so parent can refresh weekly/monthly tabs.
   */
  onProgressUpdated?: () => void;
}

export default function DailyPlanTab({
  krIds,
  refreshNonce,
  allowAdd = true,
  cycleStartDate,
  cycleEndDate,
  onProgressUpdated,
}: DailyPlanTabProps) {
  const [loading, setLoading] = useState(false);
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([]);
  const [availableWeeklyPlans, setAvailableWeeklyPlans] = useState<
    WeeklyPlan[]
  >([]);

  // Modal states
  const [addOpen, setAddOpen] = useState(false);
  const [preSelectedDay, setPreSelectedDay] = useState<DayOfWeek | undefined>();
  const [editingPlan, setEditingPlan] = useState<DailyPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<DailyPlan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progressPlan, setProgressPlan] = useState<DailyPlan | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [isHistoryRevealed, setIsHistoryRevealed] = useState(false);

  // Auto-set selected week to current week on mount
  useEffect(() => {
    if (!cycleStartDate) return;
    const start = parseLocalDate(cycleStartDate);
    if (!start) return;

    // Align to Monday of first week for consistent week numbering
    const day = start.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const mondayOfFirstWeek = new Date(start);
    mondayOfFirstWeek.setDate(start.getDate() + diffToMonday);

    const now = new Date();
    // Use the difference from MondayOfFirstWeek to determine which week we are in
    const diff = now.getTime() - mondayOfFirstWeek.getTime();
    const weekNum = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;

    // Limit to 13 weeks for a quarter
    setSelectedWeek(Math.min(13, Math.max(1, weekNum)));
  }, [cycleStartDate]);

  const loadData = useCallback(async () => {
    if (krIds.length === 0) return;
    setLoading(true);
    try {
      // 1. Fetch all monthly plans for these KRs
      const allMonthlies: MonthlyPlan[] = [];
      await Promise.all(
        krIds.map(async (krId) => {
          const res = await fetchMonthlyPlans(krId);
          allMonthlies.push(...res);
        }),
      );

      // 2. Fetch all weekly plans for these monthlies
      const allWeeklies: WeeklyPlan[] = [];
      await Promise.all(
        allMonthlies.map(async (mp) => {
          const res = await fetchWeeklyPlans(mp.id);
          allWeeklies.push(...res);
        }),
      );

      // 3. Daily plans are public by default — fetch for ALL weekly plans
      //    (not just PUBLISHED ones — no approval gate for daily plans)
      const published = allWeeklies.filter((wp) =>
        ["PUBLISHED", "APPROVED", "SUBMITTED", "DRAFT", "REJECTED"].includes(
          wp.plan_status,
        ),
      );
      setAvailableWeeklyPlans(published);

      // 4. Fetch daily plans for each available weekly plan
      const allDailies: DailyPlan[] = [];
      await Promise.all(
        published.map(async (wp) => {
          const res = await fetchDailyPlans(wp.id);
          const monthNum = wp.parent_monthly_plan?.month_number || 1;
          const weekInMonth = wp.week_number || 1;
          const absoluteWeek = (monthNum - 1) * 4 + weekInMonth;

          const enriched = res.map((dp) => {
            const plannedDate = cycleStartDate
              ? getPlannedDailyDate(
                  cycleStartDate,
                  absoluteWeek,
                  dp.completion_day,
                )
              : null;
            
            const isToday = plannedDate?.toDateString() === new Date().toDateString();

            return {
              ...dp,
              _absoluteWeek: absoluteWeek,
              _weeklyPlanTitle: wp.title,
              _weeklyPlanNumber: wp.week_number,
              _monthlyPlanNumber: monthNum,
              _plannedDate: plannedDate
                ? formatReadableDate(plannedDate.toISOString())
                : undefined,
              _isToday: isToday,
              // Adding this back so groupedPlans can use it if it expects the object
              weeklyPlan: wp, 
            } as any;
          });
          allDailies.push(...(enriched as any));
        }),
      );

      setDailyPlans(allDailies);
    } catch (e) {
      console.error("Failed to load daily plans data", e);
      ToastService.error("Failed to load daily plans");
    } finally {
      setLoading(false);
    }
  }, [krIds, cycleStartDate]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshNonce]);

  const groupedPlans = useMemo(() => {
    const groups: Record<DayOfWeek, DailyPlan[]> = {
      MONDAY: [],
      TUESDAY: [],
      WEDNESDAY: [],
      THURSDAY: [],
      FRIDAY: [],
      SATURDAY: [],
      SUNDAY: [],
    };
    dailyPlans.forEach((plan) => {
      // Filter by absolute week
      const planAbsWeek = (plan as any)._absoluteWeek;
      if (planAbsWeek && planAbsWeek !== selectedWeek)
        return;
      
      // Fallback to legacy weeklyPlan object check if _absoluteWeek is missing
      if (!planAbsWeek && plan.weeklyPlan && plan.weeklyPlan.week_number !== selectedWeek)
        return;

      if (groups[plan.completion_day]) {
        groups[plan.completion_day].push(plan);
      }
    });
    return groups;
  }, [dailyPlans, selectedWeek]);

  const totalTasks = dailyPlans.length;
  const completedTasks = dailyPlans.filter(
    (p) => p.status === "COMPLETED",
  ).length;

  const handleProgressSave = async (data: {
    current_value: number;
    status: DailyStatus;
    notes?: string;
  }) => {
    if (!progressPlan) return;
    try {
      // Update value + notes (triggers backend rollup: daily → weekly → monthly)
      await updateDailyPlan(progressPlan.id, {
        current_value: data.current_value,
        notes: data.notes,
      });
      // Update status if changed (also triggers rollup)
      if (data.status !== progressPlan.status) {
        await updateDailyStatus(progressPlan.id, data.status);
      }
      // Reload from backend to get the recalculated values
      // instead of relying on optimistic local updates.
      await loadData();
      ToastService.success("Progress updated successfully");
      // Notify parent to refresh weekly/monthly tabs
      onProgressUpdated?.();
    } catch (e) {
      ToastService.error("Failed to update progress");
      throw e;
    }
  };

  const handleStatusChange = async (id: string, status: DailyStatus) => {
    try {
      await updateDailyStatus(id, status);
      // Reload from backend to get recalculated rollup values
      await loadData();
      ToastService.success(
        `Task marked as ${status.toLowerCase().replace("_", " ")}`,
      );
      // Notify parent to refresh weekly/monthly tabs
      onProgressUpdated?.();
    } catch (e) {
      ToastService.error("Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!deletingPlan) return;
    setIsDeleting(true);
    try {
      await deleteDailyPlan(deletingPlan.id);
      setDailyPlans((prev) => prev.filter((p) => p.id !== deletingPlan.id));
      ToastService.success("Task deleted");
      setDeletingPlan(null);
      // Notify parent to refresh weekly/monthly tabs
      onProgressUpdated?.();
    } catch (e) {
      ToastService.error("Failed to delete task");
    } finally {
      setIsDeleting(false);
    }
  };

  const openAddForDay = (day: DayOfWeek) => {
    setPreSelectedDay(day);
    setAddOpen(true);
  };

  if (loading && dailyPlans.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {DAYS.slice(0, 3).map((day) => (
          <div key={day} className="space-y-4">
            <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            <LoadingSkeleton count={2} height={140} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {cycleStartDate && cycleEndDate && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-tight shadow-sm">
            <MdCalendarToday className="text-slate-400" size={14} />
            <span className="opacity-70">Cycle:</span>
            <span className="text-slate-700">
              {formatConciseDateRange(cycleStartDate, cycleEndDate)}
            </span>
          </div>
        </div>
      )}

      {/* Feedback Banners for Weekly Plans */}
      {(() => {
        const plansWithFeedback = availableWeeklyPlans.filter(
          (wp) => wp.reviewer_note || wp.rejection_reason || wp.feedback_note,
        );
        if (plansWithFeedback.length === 0) return null;

        const hasAnyPublishedOrApproved = plansWithFeedback.some(
          (wp) => wp.plan_status === "APPROVED" || wp.plan_status === "PUBLISHED",
        );

        return (
          <div className="space-y-3">
            {hasAnyPublishedOrApproved && !isHistoryRevealed && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setIsHistoryRevealed(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-all text-[11px] font-bold uppercase tracking-wider group cursor-pointer shadow-sm active:scale-95"
                >
                  <MdHistory className="text-sm group-hover:rotate-[-45deg] transition-transform duration-300" />
                  View Feedback History
                </button>
              </div>
            )}

            <div className="space-y-3">
              {plansWithFeedback.map((wp) => {
                const isHidden =
                  wp.plan_status === "APPROVED" || wp.plan_status === "PUBLISHED";
                if (isHidden && !isHistoryRevealed) return null;

                return (
                  <FeedbackBanner
                    key={wp.id}
                    status={wp.plan_status}
                    reviewerName={wp.reviewer_name}
                    reviewerNote={
                      wp.reviewer_note || wp.rejection_reason || wp.feedback_note
                    }
                    rejectionReason={wp.rejection_reason}
                    feedback_note={wp.feedback_note}
                    rejectedAt={wp.published_at || wp.submitted_at}
                    isRevealed={true}
                    onDismiss={() => setIsHistoryRevealed(false)}
                  />
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Daily Execution</h2>
          <p className="text-slate-500 text-sm">
            Track your daily tasks and progress
            {totalTasks > 0 && (
              <span className="ml-2 text-slate-400">
                · {completedTasks}/{totalTasks} completed
              </span>
            )}
          </p>
        </div>
        <Button
          variant="primary"
          icon={MdAdd}
          disabled={!allowAdd}
          title={
            !allowAdd ? "Daily tasks are not enabled for your role" : undefined
          }
          onClick={() => {
            setPreSelectedDay(undefined);
            setAddOpen(true);
          }}
        >
          Add Task
        </Button>
      </div>

      {/* Week Selector */}
      <div className="flex items-center gap-4 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
        <span className="text-sm font-bold text-slate-500 uppercase tracking-widest font-space">
          Week
        </span>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 13 }, (_, i) => i + 1).map((w) => {
            const isSelected = w === selectedWeek;
            const hasTasks = dailyPlans.some(
              (p) => p.weeklyPlan?.week_number === w,
            );
            return (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`w-9 h-9 rounded-xl text-sm font-black transition-all flex items-center justify-center relative ${
                  isSelected
                    ? "bg-primary text-white shadow-lg shadow-primary/20 scale-110 z-10"
                    : hasTasks
                      ? "bg-white text-slate-600 hover:bg-primary/5 border border-slate-200"
                      : "bg-slate-100/50 text-slate-300 border border-transparent"
                }`}
              >
                {w}
                {hasTasks && !isSelected && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary/40" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modern Day Sections — One day per row, tasks in a grid inside */}
      <div className="flex flex-col gap-10">
        {DAYS.map((day) => {
          const dayTasks = groupedPlans[day];
          const dayCompleted = dayTasks.filter(
            (t) => t.status === "COMPLETED",
          ).length;
          const totalTasks = dayTasks.length;
          const completionRate = totalTasks > 0 ? Math.round((dayCompleted / totalTasks) * 100) : 0;
          
          const plannedDate = cycleStartDate
            ? getPlannedDailyDate(cycleStartDate, selectedWeek, day)
            : null;
          const displayDayLabel = plannedDate
            ? plannedDate.toLocaleDateString(undefined, { weekday: "long" })
            : DAY_LABELS[day];
          const displayDayShort = plannedDate
            ? plannedDate.toLocaleDateString(undefined, { weekday: "short" })
            : DAY_SHORT[day];
          const todayKey = formatDateInput(new Date());
          const fallbackTodayDay =
            DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] ??
            "MONDAY";
          const isToday = plannedDate 
            ? formatDateInput(plannedDate) === todayKey 
            : day === fallbackTodayDay;

          if (totalTasks === 0 && !isToday) return null;

          return (
            <div
              key={day}
              className={`relative rounded-[2.5rem] border-2 transition-all duration-500 overflow-hidden ${
                isToday 
                  ? "border-primary/20 bg-white shadow-[0_20px_50px_rgba(var(--primary-rgb),0.08)] order-first ring-4 ring-primary/5" 
                  : "border-slate-100 bg-slate-50/30 hover:border-slate-200 shadow-sm"
              }`}
            >
              {/* Day Header with Stats */}
              <div
                className={`px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b ${
                  isToday ? "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/10" : "bg-white/50 border-slate-100"
                }`}
              >
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-lg transition-transform hover:scale-110 duration-300 ${
                    isToday ? "bg-primary text-white shadow-primary/30" : "bg-white text-slate-400 border border-slate-100"
                  }`}>
                    <span className="text-[10px] font-black uppercase tracking-tighter opacity-80">{displayDayShort}</span>
                    <span className="text-xl font-black leading-none mt-0.5">
                      {plannedDate ? plannedDate.getDate() : "?"}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                      {displayDayLabel}
                      {isToday && (
                        <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest animate-pulse">
                          Today
                        </span>
                      )}
                    </h3>
                    <p className="text-sm font-semibold text-slate-400">
                      {plannedDate ? formatReadableDate(plannedDate.toISOString()) : "No date set"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="hidden sm:block text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Daily Progress</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-1000" 
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                      <span className="text-sm font-black text-slate-700 tabular-nums">{completionRate}%</span>
                    </div>
                  </div>
                  
                  <div className="h-10 w-px bg-slate-100 mx-2 hidden sm:block" />

                  <div className="flex items-center gap-2">
                    <div className="text-center px-4 py-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-lg font-black text-slate-700 tabular-nums">{dayCompleted}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block -mt-1">Done</span>
                    </div>
                    <div className="text-center px-4 py-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-lg font-black text-slate-700 tabular-nums">{totalTasks}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block -mt-1">Tasks</span>
                    </div>
                    
                    <button
                      onClick={() => openAddForDay(day)}
                      disabled={!allowAdd}
                      className={`ml-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        allowAdd 
                          ? "bg-primary/10 text-primary hover:bg-primary hover:text-white shadow-sm" 
                          : "bg-slate-50 text-slate-300 cursor-not-allowed"
                      }`}
                      title={!allowAdd ? "Daily tasks not enabled" : `Add task for ${displayDayLabel}`}
                    >
                      <MdAdd className="text-xl" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Day Content */}
              <div className="p-8">
                {dayTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/20">
                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-slate-300 shadow-sm mb-4">
                      <MdAdd className="text-3xl" />
                    </div>
                    <p className="text-slate-400 font-bold mb-4">No tasks planned for {displayDayLabel}</p>
                    {allowAdd && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openAddForDay(day)}
                      >
                        Create Your First Task
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-8">
                    {dayTasks.map((plan) => (
                      <DailyTaskCard
                        key={plan.id}
                        plan={plan}
                        onOpenProgressModal={setProgressPlan}
                        onStatusChange={handleStatusChange}
                        onEdit={setEditingPlan}
                        onDelete={setDeletingPlan}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Task Modal */}
      {addOpen && (
        <AddDailyTaskModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSuccess={() => {
            setAddOpen(false);
            void loadData();
          }}
          publishedWeeklyPlans={availableWeeklyPlans}
          initialDay={preSelectedDay}
          selectedWeek={selectedWeek}
        />
      )}

      {/* Edit Task Modal */}
      {editingPlan && (
        <EditDailyTaskModal
          open={!!editingPlan}
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSuccess={() => {
            setEditingPlan(null);
            void loadData();
          }}
        />
      )}

      {/* Progress Update Modal */}
      {progressPlan && (
        <DailyPlanProgressModal
          isOpen={!!progressPlan}
          onClose={() => setProgressPlan(null)}
          plan={progressPlan as any}
          onSave={handleProgressSave}
        />
      )}

      {/* Delete Confirmation */}
      {deletingPlan && (
        <ConfirmationModal
          isOpen={!!deletingPlan}
          title="Delete Daily Task"
          message={`Are you sure you want to delete "${deletingPlan.title}"? This action cannot be undone.`}
          confirmText="Delete Task"
          type="danger"
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onClose={() => setDeletingPlan(null)}
        />
      )}
    </div>
  );
}
