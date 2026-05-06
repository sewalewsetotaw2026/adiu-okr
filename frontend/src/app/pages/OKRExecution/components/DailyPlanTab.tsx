import { useCallback, useEffect, useState, useMemo } from "react";
import { MdAdd } from "react-icons/md";
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
}

export default function DailyPlanTab({ krIds, refreshNonce, allowAdd = true }: DailyPlanTabProps) {
  const [loading, setLoading] = useState(false);
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([]);
  const [availableWeeklyPlans, setAvailableWeeklyPlans] = useState<WeeklyPlan[]>([]);

  // Modal states
  const [addOpen, setAddOpen] = useState(false);
  const [preSelectedDay, setPreSelectedDay] = useState<DayOfWeek | undefined>();
  const [editingPlan, setEditingPlan] = useState<DailyPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<DailyPlan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progressPlan, setProgressPlan] = useState<DailyPlan | null>(null);

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
        })
      );

      // 2. Fetch all weekly plans for these monthlies
      const allWeeklies: WeeklyPlan[] = [];
      await Promise.all(
        allMonthlies.map(async (mp) => {
          const res = await fetchWeeklyPlans(mp.id);
          allWeeklies.push(...res);
        })
      );

      // 3. Daily plans are public by default — fetch for ALL weekly plans
      //    (not just PUBLISHED ones — no approval gate for daily plans)
      const published = allWeeklies.filter((wp) =>
        ["PUBLISHED", "APPROVED", "SUBMITTED", "DRAFT"].includes(wp.plan_status)
      );
      setAvailableWeeklyPlans(published);

      // 4. Fetch daily plans for each available weekly plan
      const allDailies: DailyPlan[] = [];
      await Promise.all(
        published.map(async (wp) => {
          const res = await fetchDailyPlans(wp.id);
          const enriched = res.map((dp) => ({
            ...dp,
            _weeklyPlanTitle: wp.title,
          }));
          allDailies.push(...(enriched as any));
        })
      );

      setDailyPlans(allDailies);
    } catch (e) {
      console.error("Failed to load daily plans data", e);
      ToastService.error("Failed to load daily plans");
    } finally {
      setLoading(false);
    }
  }, [krIds]);

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
      if (groups[plan.completion_day]) {
        groups[plan.completion_day].push(plan);
      }
    });
    return groups;
  }, [dailyPlans]);

  const totalTasks = dailyPlans.length;
  const completedTasks = dailyPlans.filter((p) => p.status === "COMPLETED").length;

  const handleProgressSave = async (data: {
    current_value: number;
    status: DailyStatus;
    notes?: string;
  }) => {
    if (!progressPlan) return;
    try {
      // Update value + notes
      await updateDailyPlan(progressPlan.id, {
        current_value: data.current_value,
        notes: data.notes,
      });
      // Update status if changed
      if (data.status !== progressPlan.status) {
        await updateDailyStatus(progressPlan.id, data.status);
      }
      // Optimistic local update
      setDailyPlans((prev) =>
        prev.map((p) =>
          p.id === progressPlan.id
            ? {
                ...p,
                current_value: data.current_value,
                status: data.status,
                notes: data.notes,
                progress_pct: Math.min(
                  100,
                  Math.max(
                    0,
                    ((data.current_value - p.start_value) /
                      (p.target_value - p.start_value)) *
                      100
                  )
                ),
              }
            : p
        )
      );
      ToastService.success("Progress updated successfully");
    } catch (e) {
      ToastService.error("Failed to update progress");
      throw e;
    }
  };

  const handleStatusChange = async (id: string, status: DailyStatus) => {
    try {
      await updateDailyStatus(id, status);
      setDailyPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status } : p))
      );
      ToastService.success(
        `Task marked as ${status.toLowerCase().replace("_", " ")}`
      );
    } catch (e) {
      ToastService.error("Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!deletingPlan) return;
    setIsDeleting(true);
    try {
      await deleteDailyPlan(deletingPlan.id);
      setDailyPlans((prev) =>
        prev.filter((p) => p.id !== deletingPlan.id)
      );
      ToastService.success("Task deleted");
      setDeletingPlan(null);
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
          title={!allowAdd ? "Daily tasks are not enabled for your role" : undefined}
          onClick={() => {
            setPreSelectedDay(undefined);
            setAddOpen(true);
          }}
        >
          Add Task
        </Button>
      </div>

      {/* Responsive Day Grid — 1 col mobile, 2 col md, 3 col lg (Sunday on Row 3) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {DAYS.map((day) => {
          const dayTasks = groupedPlans[day];
          const dayCompleted = dayTasks.filter(
            (t) => t.status === "COMPLETED"
          ).length;

          return (
            <div
              key={day}
              className={`rounded-2xl border-2 ${DAY_COLORS[day]} overflow-hidden`}
            >
              {/* Day Header */}
              <div
                className={`flex items-center justify-between px-4 py-3 ${DAY_HEADER_COLORS[day]}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold">
                    {DAY_LABELS[day]}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-white/60 text-[10px] font-black">
                      {dayCompleted}/{dayTasks.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => openAddForDay(day)}
                  disabled={!allowAdd}
                  className={`p-1.5 rounded-lg transition-colors ${allowAdd ? 'hover:bg-white/40' : 'opacity-40 cursor-not-allowed'}`}
                  title={!allowAdd ? "Daily tasks are not enabled for your role" : `Add task for ${DAY_SHORT[day]}`}
                >
                  <MdAdd className="text-lg" />
                </button>
              </div>

              {/* Day Content */}
              <div className="p-3 space-y-3 min-h-[120px]">
                {dayTasks.length === 0 ? (
                  <div className="flex items-center justify-center h-[100px]">
                    <button
                      onClick={() => allowAdd && openAddForDay(day)}
                      disabled={!allowAdd}
                      className={`text-center transition-colors group ${allowAdd ? 'text-slate-400 hover:text-primary cursor-pointer' : 'text-slate-300 cursor-not-allowed opacity-50'}`}
                      title={!allowAdd ? "Daily tasks are not enabled for your role" : undefined}
                    >
                      <MdAdd className={`text-2xl mx-auto mb-1 transition-colors ${allowAdd ? 'text-slate-300 group-hover:text-primary' : 'text-slate-200'}`} />
                      <p className="text-[11px] font-semibold">
                        Add a task
                      </p>
                    </button>
                  </div>
                ) : (
                  dayTasks.map((plan) => (
                    <DailyTaskCard
                      key={plan.id}
                      plan={plan}
                      onOpenProgressModal={setProgressPlan}
                      onStatusChange={handleStatusChange}
                      onEdit={setEditingPlan}
                      onDelete={setDeletingPlan}
                    />
                  ))
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
