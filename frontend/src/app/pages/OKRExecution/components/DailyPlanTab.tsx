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
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const weekNum = Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
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
          const enriched = res.map((dp) => {
            const plannedDate = cycleStartDate
              ? getPlannedDailyDate(
                  cycleStartDate,
                  Number(wp.week_number) || 1,
                  dp.completion_day,
                )
              : null;

            return {
              ...dp,
              _weeklyPlanTitle: wp.title,
              _weeklyPlanNumber: wp.week_number,
              _monthlyPlanNumber: wp.parent_monthly_plan?.month_number,
              _plannedDate: plannedDate
                ? formatReadableDate(plannedDate.toISOString())
                : undefined,
            };
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
      // Filter by selected week if parent weekly plan is available
      if (plan.weeklyPlan && plan.weeklyPlan.week_number !== selectedWeek)
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

      {/* Responsive Day Grid — 1 col mobile, 2 col md, 3 col lg (Sunday on Row 3) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {DAYS.map((day) => {
          const dayTasks = groupedPlans[day];
          const dayCompleted = dayTasks.filter(
            (t) => t.status === "COMPLETED",
          ).length;
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

          return (
            <div
              key={day}
              className={`rounded-2xl border-2 ${DAY_COLORS[day]} overflow-hidden ${isToday ? "md:col-span-2 lg:col-span-3 order-first ring-2 ring-primary/20 shadow-lg shadow-primary/5" : ""}`}
            >
              {/* Day Header */}
              <div
                className={`flex items-center justify-between px-4 py-3 ${DAY_HEADER_COLORS[day]} ${isToday ? "border-b border-primary/10 bg-white/70" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-extrabold leading-none">
                      {displayDayLabel}
                    </span>
                    {plannedDate && (
                      <span className="text-[10px] font-bold opacity-60 mt-0.5">
                        {
                          formatReadableDate(
                            formatDateInput(plannedDate),
                          ).split(",")[0]
                        }{" "}
                        {/* Just Month Day */}
                      </span>
                    )}
                  </div>
                  {isToday && (
                    <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-black uppercase tracking-wider">
                      Today
                    </span>
                  )}
                  {dayTasks.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-white/60 text-[10px] font-black">
                      {dayCompleted}/{dayTasks.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => openAddForDay(day)}
                  disabled={!allowAdd}
                  className={`p-1.5 rounded-lg transition-colors ${allowAdd ? "hover:bg-white/40" : "opacity-40 cursor-not-allowed"}`}
                  title={
                    !allowAdd
                      ? "Daily tasks are not enabled for your role"
                      : `Add task for ${displayDayShort}`
                  }
                >
                  <MdAdd className="text-lg" />
                </button>
              </div>

              {/* Day Content */}
              <div className={`${isToday ? "p-4 min-h-50" : "p-3 min-h-30"}`}>
                {dayTasks.length === 0 ? (
                  <div className="flex items-center justify-center h-25">
                    <button
                      onClick={() => allowAdd && openAddForDay(day)}
                      disabled={!allowAdd}
                      className={`text-center transition-colors group ${allowAdd ? "text-slate-400 hover:text-primary cursor-pointer" : "text-slate-300 cursor-not-allowed opacity-50"}`}
                      title={
                        !allowAdd
                          ? "Daily tasks are not enabled for your role"
                          : undefined
                      }
                    >
                      <MdAdd
                        className={`text-2xl mx-auto mb-1 transition-colors ${allowAdd ? "text-slate-300 group-hover:text-primary" : "text-slate-200"}`}
                      />
                      <p className="text-[11px] font-semibold">Add a task</p>
                    </button>
                  </div>
                ) : (
                  <div
                    className={
                      isToday
                        ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"
                        : "space-y-3"
                    }
                  >
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
