import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import {
  MdAdd,
  MdChevronRight,
  MdSend,
  MdPublish,
  MdCheckCircle,
  MdPlayCircle,
  MdHistory,
  MdSchedule,
} from "react-icons/md";
import Button from "../../../components/Core/ui/Button";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import LoadingSkeleton from "../../../components/common/LoadingSkeleton";
import ToastService from "../../../../utils/ToastService";
import {
  deleteWeeklyPlan,
  fetchMonthlyPlans,
  fetchWeeklyAvailableWeight,
  fetchWeeklyPlans,
  publishWeeklyPeriod,
  submitWeeklyPeriod,
  updateWeeklyPlan,
} from "../../../services/okr-execution.api";
import type {
  AvailableWeight,
  MonthlyPlan,
  WeeklyPlan,
} from "../../../../types/okr.types";
import AddWeeklyPlanModal from "./AddWeeklyPlanModal";
import EditWeeklyPlanModal from "./EditWeeklyPlanModal";
import PlanStatusBanner from "./PlanStatusBanner";
import WeeklyPlanCard from "./WeeklyPlanCard";
import EditOkrChangeRequestModal from "../../Admin/OKR/components/modals/EditOkrChangeRequestModal";
import RealignmentBanner from "../../Admin/OKR/components/RealignmentBanner";
import WeeklyPlanProgressModal from "./modals/WeeklyPlanProgressModal";
import {
  formatReadableDate,
  getWeekAvailability,
  getCycleWeekRange,
  type PeriodAvailability,
} from "../utils/calendarDates";

const NON_DRAFT_LIFECYCLE = new Set([
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PUBLISHED",
]);
const EDITABLE_LIFECYCLE = new Set(["DRAFT", "REJECTED"]);

export interface WeeklyPlanTabProps {
  /** KR ids belonging to the user's quarterly objectives. */
  krIds: string[];
  /**
   * Optional: pass weeks-in-current-month so the tab knows whether to render
   * a Week 5 section. Defaults to 4 if not provided. The tab will also force
   * Week 5 visible if any plan has week_number === 5.
   */
  weeksInMonth?: number;
  /** Auto-expand a specific week section on mount (deep link support). */
  initialExpandWeek?: number;
  /**
   * Called whenever a plan is created/edited/deleted/submitted so the
   * dashboard can refresh the Monthly tab's per-plan weekly allocation.
   */
  onAllocationsChanged?: () => void;
  /** Optional nonce to trigger a refresh from the parent. */
  refreshNonce?: number;
  /** Whether adding weekly plans is allowed by cadence configuration. */
  allowAdd?: boolean;
  /** The current OKR cycle ID. */
  cycleId?: string | number | null;
  /** Cycle boundaries used to render calendar-aware labels. */
  cycleStartDate?: string | null;
  cycleEndDate?: string | null;
  /** The user's role level. */
  userRoleLevel?: "CEO" | "DIRECTOR" | "MANAGER_TEAM_LEADER" | "EMPLOYEE";
  /** Level-based cadence configuration for all roles. */
  levelConfig?: Record<
    string,
    { allow_monthly: boolean; allow_weekly: boolean; allow_daily: boolean }
  > | null;
  /** Callback to trigger a post-publish edit request. */
  onPostPublishEdit?: (plan: WeeklyPlan) => void;
  /** Whether the user can update progress at the weekly level based on cadence. */
  allowUpdateProgress?: boolean;
}

interface PeriodSubmissionState {
  isSubmitted: boolean;
  canShowSubmit: boolean;
  canShowPublish: boolean;
  totalWeight: number;
  bannerStatus?: WeeklyPlan["plan_status"];
  reviewerName?: string;
  feedbackNote?: string;
  feedbackItems: any[]; // List of specific feedback items
  submittedAt?: string;
  approvedAt?: string;
  publishedAt?: string;
  // Track the parent monthly plan id used for submit-period.
  // If multiple monthlies feed this week, we cannot submit the period as
  // one batch — the API requires a single monthly_plan_id.
  parentMonthlyPlanIds: string[];
}

export default function WeeklyPlanTab({
  krIds,
  weeksInMonth = 4,
  initialExpandWeek,
  onAllocationsChanged,
  refreshNonce,
  allowAdd = true,
  cycleId,
  cycleStartDate,
  cycleEndDate,
  userRoleLevel,
  levelConfig,
  onPostPublishEdit,
  allowUpdateProgress = false,
}: WeeklyPlanTabProps) {
  const authUser = useSelector(selectAuthUser);
  const currentUserId = authUser?.employee_id
    ? String(authUser.employee_id)
    : authUser?.id
      ? String(authUser.id)
      : null;
  const [monthlyPlans, setMonthlyPlans] = useState<MonthlyPlan[]>([]);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [allocations, setAllocations] = useState<
    Record<string, AvailableWeight | null>
  >({});
  const [loading, setLoading] = useState(false);

  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    const active = (() => {
      if (initialExpandWeek) return initialExpandWeek;
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const dayOfMonth = now.getDate();
      const firstDow = firstDayOfMonth.getDay();
      return Math.min(Math.ceil((dayOfMonth + firstDow) / 7), weeksInMonth);
    })();
    return {
      1: active === 1,
      2: active === 2,
      3: active === 3,
      4: active === 4,
      5: active === 5,
    };
  });
  const [addForWeek, setAddForWeek] = useState<number | null>(null);
  const [editing, setEditing] = useState<WeeklyPlan | null>(null);
  const [deleting, setDeleting] = useState<WeeklyPlan | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [submitConfirm, setSubmitConfirm] = useState<{
    weekNumber: number;
    monthlyPlanId: string;
    warning?: string;
  } | null>(null);
  const [submittingPeriod, setSubmittingPeriod] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState<{
    weekNumber: number;
    monthlyPlanId: string;
  } | null>(null);
  const [publishingPeriod, setPublishingPeriod] = useState(false);
  // Top-level batch CTA loaders
  const [publishAllLoading, setPublishAllLoading] = useState(false);
  const [submitAllLoading, setSubmitAllLoading] = useState(false);
  const [postPublishEditing, setPostPublishEditing] =
    useState<WeeklyPlan | null>(null);
  const [progressPlan, setProgressPlan] = useState<WeeklyPlan | null>(null);

  // ── Loaders ────────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    if (krIds.length === 0) {
      setMonthlyPlans([]);
      setPlans([]);
      setAllocations({});
      return;
    }
    setLoading(true);
    try {
      // 1. Monthly plans across all the user's KRs.
      const monthlyLists = await Promise.all(
        krIds.map((id) =>
          fetchMonthlyPlans(id).catch(() => [] as MonthlyPlan[]),
        ),
      );
      const allMonthly = monthlyLists.flat();
      setMonthlyPlans(allMonthly);

      // 2. Weekly plans only for PUBLISHED monthly plans (per spec).
      const publishedMonthly = allMonthly.filter(
        (m) => m.plan_status === "PUBLISHED",
      );
      const weeklyLists = await Promise.all(
        publishedMonthly.map((mp) =>
          fetchWeeklyPlans(mp.id).catch(() => [] as WeeklyPlan[]),
        ),
      );
      setPlans(weeklyLists.flat());

      // 3. Weekly allocation per monthly plan (used to gate the CTA).
      const allocs: Record<string, AvailableWeight | null> = {};
      await Promise.all(
        allMonthly.map(async (mp) => {
          try {
            allocs[mp.id] = await fetchWeeklyAvailableWeight(mp.id);
          } catch {
            allocs[mp.id] = null;
          }
        }),
      );
      setAllocations(allocs);
    } finally {
      setLoading(false);
    }
  }, [krIds, refreshNonce]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!initialExpandWeek) return;
    setExpanded((prev) => ({ ...prev, [initialExpandWeek]: true }));
  }, [initialExpandWeek]);

  // ── Derived state ──────────────────────────────────────────────────────

  // Determine how many week slots to render: at least `weeksInMonth`, and
  // always include any week that already has a plan.
  const slots = useMemo<number[]>(() => {
    const max = Math.max(
      4,
      Math.min(5, weeksInMonth),
      ...plans.map((p) => Number(p.week_number) || 0),
    );
    const out: number[] = [];
    for (let i = 1; i <= Math.min(5, max); i++) out.push(i);
    return out;
  }, [weeksInMonth, plans]);

  const plansByWeek = useMemo(() => {
    const map: Record<number, WeeklyPlan[]> = {};
    for (const w of slots) map[w] = [];
    for (const p of plans) {
      const w = Number(p.week_number);
      if (w >= 1 && w <= 5) {
        if (!map[w]) map[w] = [];
        map[w].push(p);
      }
    }
    return map;
  }, [plans, slots]);

  const periodMeta = useMemo<Record<number, PeriodSubmissionState>>(() => {
    const out: Record<number, PeriodSubmissionState> = {} as any;
    for (const w of slots) {
      const list = plansByWeek[w] ?? [];
      const total = list.reduce((acc, p) => acc + Number(p.weight_pct || 0), 0);
      const isSubmitted = list.some((p) =>
        NON_DRAFT_LIFECYCLE.has(p.plan_status),
      );
      const canShowSubmit =
        list.length > 0 &&
        list.some((p) => EDITABLE_LIFECYCLE.has(p.plan_status));
      const order: WeeklyPlan["plan_status"][] = [
        "REJECTED",
        "SUBMITTED",
        "UNDER_REVIEW",
        "APPROVED",
        "PUBLISHED",
      ];
      const banner = order.find((s) => list.some((p) => p.plan_status === s));
      const bannerPlan = banner
        ? list.find((p) => p.plan_status === banner)
        : undefined;
      const parentIds = Array.from(
        new Set(list.map((p) => p.parent_monthly_id).filter(Boolean)),
      );

      // Find ALL plans with feedback (Legacy + History)
      const feedbackItems: any[] = [];
      list.forEach((p) => {
        const planFeedback: any[] = [];

        // 1. Add historical comments
        if (p.comments && (p.comments as any[]).length > 0) {
          (p.comments as any[]).forEach((c: any) => {
            planFeedback.push({
              status: p.plan_status,
              reviewerName: c.author_name,
              feedbackNote: c.content,
              targetTitle: p.title,
              timestamp: c.created_at,
            });
          });
        }

        // 2. Add legacy note if not already covered by comments
        const legacyNote =
          p.feedback_note || p.rejection_reason || p.reviewer_note;
        if (legacyNote) {
          const alreadyAdded = planFeedback.some(
            (f) => f.feedbackNote === legacyNote,
          );
          if (!alreadyAdded) {
            planFeedback.push({
              status: p.plan_status,
              reviewerName: p.reviewer_name,
              feedbackNote: legacyNote,
              targetTitle: p.title,
              timestamp: p.approved_at || p.submitted_at,
            });
          }
        }
        feedbackItems.push(...planFeedback);
      });

      // Sort by timestamp descending
      feedbackItems.sort(
        (a, b) =>
          new Date(b.timestamp || 0).getTime() -
          new Date(a.timestamp || 0).getTime(),
      );

      // Find plan with feedback (REJECTED takes priority)
      const feedbackPlan =
        list.find((p) => p.plan_status === "REJECTED") ||
        list.find(
          (p) => p.feedback_note || p.rejection_reason || p.reviewer_note,
        );

      const canShowPublish =
        list.length > 0 && list.some((p) => p.plan_status === "APPROVED");
      out[w] = {
        isSubmitted,
        canShowSubmit,
        canShowPublish,
        totalWeight: Math.round(total * 100) / 100,
        bannerStatus: bannerPlan?.plan_status,
        submittedAt: bannerPlan?.submitted_at,
        approvedAt: bannerPlan?.approved_at,
        publishedAt: bannerPlan?.published_at,
        reviewerName: feedbackPlan?.reviewer_name || bannerPlan?.reviewer_name,
        feedbackNote:
          feedbackPlan?.feedback_note ||
          feedbackPlan?.rejection_reason ||
          feedbackPlan?.reviewer_note,
        feedbackItems,
        parentMonthlyPlanIds: parentIds,
      };
    }
    return out;
  }, [plansByWeek, slots]);

  const allFullyAllocated = useMemo(() => {
    if (monthlyPlans.length === 0) return true;
    return monthlyPlans.every((mp) => {
      const aw = allocations[mp.id];
      const remaining = aw ? aw.remaining_pct : 100;
      const progress = Number(mp.progress_pct ?? 0);
      // Block CTA if no published monthly plan has remaining capacity.
      return (
        mp.plan_status !== "PUBLISHED" || remaining <= 0 || progress >= 100
      );
    });
  }, [monthlyPlans, allocations]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleCreated = (created: WeeklyPlan[]) => {
    setPlans((prev) => [...prev, ...created]);
    void refreshAllocations();
    onAllocationsChanged?.();
    if (created.length === 1) {
      ToastService.success(
        `Weekly plan created for Week ${created[0].week_number}.`,
      );
    } else {
      ToastService.success(`${created.length} weekly plans created.`);
    }
  };

  const handleEdited = (updated: WeeklyPlan) => {
    setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    ToastService.success("Weekly plan updated.");
  };

  const refreshAllocations = useCallback(async () => {
    if (monthlyPlans.length === 0) return;
    const next: Record<string, AvailableWeight | null> = { ...allocations };
    await Promise.all(
      monthlyPlans.map(async (mp) => {
        try {
          next[mp.id] = await fetchWeeklyAvailableWeight(mp.id);
        } catch {
          next[mp.id] = null;
        }
      }),
    );
    setAllocations(next);
  }, [monthlyPlans, allocations]);

  const onConfirmDelete = async () => {
    if (!deleting) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteWeeklyPlan(deleting.id);
      setPlans((prev) => prev.filter((p) => p.id !== deleting.id));
      void refreshAllocations();
      onAllocationsChanged?.();
      setDeleting(null);
      ToastService.success("Weekly plan deleted.");
    } catch (err: any) {
      setDeleteError(
        err?.data?.message ||
          err?.message ||
          "Could not delete plan. Try again.",
      );
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const startSubmitPeriod = (w: number) => {
    const list = plansByWeek[w] ?? [];
    const errors: string[] = [];

    // Filter to only editable plans (draft/rejected) for validation
    const editablePlans = list.filter((p) =>
      EDITABLE_LIFECYCLE.has(p.plan_status),
    );

    if (editablePlans.length === 0) {
      errors.push("No editable plans found for submission.");
    }
    editablePlans.forEach((p) => {
      if (!Number(p.target_value)) errors.push(`"${p.title}" has no target.`);
      if (!Number(p.weight_pct)) errors.push(`"${p.title}" has no weight.`);
    });
    if (errors.length > 0) {
      ToastService.error(errors.join(" "));
      return;
    }

    const meta = periodMeta[w];
    if (meta.parentMonthlyPlanIds.length === 0) {
      ToastService.error("No plans found to submit.");
      return;
    }
    setSubmitConfirm({
      weekNumber: w,
      monthlyPlanId: meta.parentMonthlyPlanIds[0], // dummy for type safety
      warning: undefined, // Removed the 100% validation as it's not required for weekly plans
    });
  };

  const onConfirmSubmitPeriod = async () => {
    if (!submitConfirm) return;
    setSubmittingPeriod(true);
    try {
      const meta = periodMeta[submitConfirm.weekNumber];
      const parentIds = meta.parentMonthlyPlanIds;

      // Only submit editable plans (draft/rejected) for review
      const plansForWeek = plansByWeek[submitConfirm.weekNumber] ?? [];
      const editablePlans = plansForWeek.filter((p) =>
        EDITABLE_LIFECYCLE.has(p.plan_status),
      );

      if (editablePlans.length === 0) {
        ToastService.error("No editable plans found for submission.");
        return;
      }

      const editablePlanIds = editablePlans.map((p) => p.id);

      await Promise.all(
        parentIds.map((id) =>
          submitWeeklyPeriod(submitConfirm.weekNumber, id, editablePlanIds),
        ),
      );

      ToastService.success(
        `Week ${submitConfirm.weekNumber} plan submitted for review.`,
      );
      setSubmitConfirm(null);
      await reload();
      onAllocationsChanged?.();
    } catch (err: any) {
      ToastService.error(
        err?.data?.message ||
          err?.message ||
          "Could not submit weekly plans for review.",
      );
    } finally {
      setSubmittingPeriod(false);
    }
  };

  const onConfirmPublishPeriod = async () => {
    if (!publishConfirm) return;
    setPublishingPeriod(true);
    try {
      await publishWeeklyPeriod(
        publishConfirm.weekNumber,
        publishConfirm.monthlyPlanId,
      );
      ToastService.success(
        `Week ${publishConfirm.weekNumber} plan published successfully.`,
      );
      setPublishConfirm(null);
      await reload();
      onAllocationsChanged?.();
    } catch (err: any) {
      ToastService.error(
        err?.data?.message || err?.message || "Could not publish weekly plans.",
      );
    } finally {
      setPublishingPeriod(false);
    }
  };

  const hasAnyApproved = useMemo(
    () => plans.some((p) => p.plan_status === "APPROVED"),
    [plans],
  );

  const hasAnyDraft = useMemo(
    () => plans.some((p) => EDITABLE_LIFECYCLE.has(p.plan_status)),
    [plans],
  );

  // Calendar-driven availability per week slot.
  const weekAvailability = useMemo<Record<number, PeriodAvailability>>(() => {
    const out: Record<number, PeriodAvailability> = {};
    for (const w of slots) {
      out[w] = getWeekAvailability(w, cycleStartDate, cycleEndDate);
    }
    return out;
  }, [slots, cycleStartDate, cycleEndDate]);

  // Active week = the current calendar week within the cycle.
  // Falls back to last week with plans, then first slot.
  const activeWeek = useMemo(() => {
    if (initialExpandWeek) return initialExpandWeek;
    const current = slots.find((w) => weekAvailability[w] === "current");
    if (current) return current;
    for (const w of [...slots].reverse()) {
      if ((plansByWeek[w] ?? []).length > 0) return w;
    }
    return slots[0] ?? 1;
  }, [initialExpandWeek, weekAvailability, plansByWeek, slots]);

  // No longer needed — future weeks greyed out automatically.
  const nextUnlockedWeek = null;

  // Auto-expand the active week whenever it changes (driven by plan data).
  useEffect(() => {
    if (initialExpandWeek) {
      setExpanded((prev) => ({ ...prev, [initialExpandWeek]: true }));
      return;
    }
    setExpanded((prev) => ({ ...prev, [activeWeek]: true }));
  }, [activeWeek, initialExpandWeek]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <RealignmentBanner />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Weekly Plans</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Decompose each published monthly plan into weekly executions.
            {cycleStartDate && cycleEndDate ? (
              <span className="ml-2 font-semibold text-slate-400">
                {formatReadableDate(cycleStartDate)} -{" "}
                {formatReadableDate(cycleEndDate)}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasAnyApproved && (
            <Button
              variant="outline"
              size="sm"
              icon={MdPublish}
              loading={publishAllLoading}
              onClick={async () => {
                const approvedWeeks = slots.filter(
                  (w) => periodMeta[w]?.canShowPublish,
                );
                if (approvedWeeks.length === 0) return;

                setPublishAllLoading(true);
                try {
                  await Promise.all(
                    approvedWeeks.flatMap((w) => {
                      const meta = periodMeta[w];
                      return meta.parentMonthlyPlanIds.map((id) =>
                        publishWeeklyPeriod(w, id),
                      );
                    }),
                  );
                  ToastService.success(
                    "Approved plans published successfully.",
                  );
                  await reload();
                  onAllocationsChanged?.();
                } catch (err: any) {
                  ToastService.error(
                    err?.message || "Failed to publish approved plans.",
                  );
                } finally {
                  setPublishAllLoading(false);
                }
              }}
            >
              Publish Approved
            </Button>
          )}
          {hasAnyDraft && (
            <Button
              variant="outline"
              size="sm"
              icon={MdSend}
              loading={submitAllLoading}
              onClick={async () => {
                const draftWeeks = slots.filter(
                  (w) => periodMeta[w]?.canShowSubmit,
                );
                if (draftWeeks.length === 0) return;

                setSubmitAllLoading(true);
                try {
                  await Promise.all(
                    draftWeeks.flatMap((w) => {
                      const meta = periodMeta[w];
                      const draftPlanIds = (plansByWeek[w] ?? [])
                        .filter((p) => EDITABLE_LIFECYCLE.has(p.plan_status))
                        .map((p) => p.id);
                      if (draftPlanIds.length === 0) return [];
                      return meta.parentMonthlyPlanIds.map((id) =>
                        submitWeeklyPeriod(w, id, draftPlanIds),
                      );
                    }),
                  );
                  ToastService.success("Draft plans submitted for review.");
                  await reload();
                  onAllocationsChanged?.();
                } catch (err: any) {
                  ToastService.error(
                    err?.message || "Failed to submit draft plans.",
                  );
                } finally {
                  setSubmitAllLoading(false);
                }
              }}
            >
              Submit Drafts
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={MdAdd}
            disabled={allFullyAllocated || krIds.length === 0 || !allowAdd}
            title={
              !allowAdd
                ? "Weekly plans are not enabled for your role"
                : allFullyAllocated
                  ? "All published monthly plans are fully allocated"
                  : undefined
            }
            onClick={() => setAddForWeek(0)}
          >
            Add Weekly Plan
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : (
        slots.map((w) => (
          <WeekSection
            key={w}
            weekNumber={w}
            plans={plansByWeek[w] ?? []}
            meta={periodMeta[w]}
            expanded={!!expanded[w]}
            isActive={w === activeWeek}
            isNextUnlocked={w === nextUnlockedWeek}
            availability={weekAvailability[w]}
            dateRange={(() => {
              if (!cycleStartDate || !cycleEndDate) return undefined;
              const range = getCycleWeekRange(cycleStartDate, w);
              if (!range) return undefined;
              const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              return `${fmt(range.start)} – ${fmt(range.end)}`;
            })()}
            onToggle={() => {
              if (weekAvailability[w] === "future") return;
              setExpanded((prev) => ({ ...prev, [w]: !prev[w] }));
            }}
            onAdd={() => setAddForWeek(w)}
            onEdit={(p) => setEditing(p)}
            onDelete={(p) => setDeleting(p)}
            onPostPublishEdit={onPostPublishEdit}
            onSubmit={() => startSubmitPeriod(w)}
            onPublish={() => {
              const meta = periodMeta[w];
              if (meta.parentMonthlyPlanIds.length > 0) {
                setPublishConfirm({
                  weekNumber: w,
                  monthlyPlanId: meta.parentMonthlyPlanIds[0],
                });
              }
            }}
            allowAdd={allowAdd}
            onUpdateProgress={
              allowUpdateProgress
                ? (plan) => {
                    const ownerId = String(plan.owner_id ?? "");
                    if (!currentUserId || ownerId !== currentUserId) return;
                    setProgressPlan(plan);
                  }
                : undefined
            }
          />
        ))
      )}

      <AddWeeklyPlanModal
        isOpen={addForWeek !== null}
        onClose={() => setAddForWeek(null)}
        krIds={krIds}
        weeksInMonth={weeksInMonth}
        onCreated={handleCreated}
        preselectedWeekNumber={addForWeek ? addForWeek : undefined}
        cycleId={cycleId ?? undefined}
        userRoleLevel={userRoleLevel}
        levelConfig={levelConfig}
      />

      <EditWeeklyPlanModal
        isOpen={!!editing}
        plan={editing}
        onClose={() => setEditing(null)}
        onSaved={handleEdited}
      />

      <EditOkrChangeRequestModal
        isOpen={!!postPublishEditing}
        entity={postPublishEditing}
        entityType="WEEKLY_PLAN"
        companyId={Number(localStorage.getItem("companyId") || 1)}
        cycleId={Number(cycleId) || 0}
        onClose={() => setPostPublishEditing(null)}
        onSuccess={() => {
          setPostPublishEditing(null);
          void reload();
        }}
      />

      {progressPlan && (
        <WeeklyPlanProgressModal
          isOpen={!!progressPlan}
          plan={progressPlan}
          onClose={() => setProgressPlan(null)}
          onSave={async (data) => {
            try {
              await updateWeeklyPlan(progressPlan.id, data);
              setProgressPlan(null);
              void reload();
            } catch (err: any) {
              ToastService.error("Failed to update progress");
            }
          }}
        />
      )}

      <ConfirmationModal
        isOpen={!!deleting}
        onClose={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
        onConfirm={() => void onConfirmDelete()}
        title="Delete this weekly plan?"
        message={
          deleteError
            ? deleteError
            : "Deleting removes all daily plans under it and recalculates parent monthly plan progress. This cannot be undone."
        }
        confirmText="Delete"
        cancelText="Keep plan"
        type="danger"
        isLoading={deleteSubmitting}
      />

      <ConfirmationModal
        isOpen={!!submitConfirm}
        onClose={() => setSubmitConfirm(null)}
        onConfirm={() => void onConfirmSubmitPeriod()}
        title={`Submit Week ${submitConfirm?.weekNumber ?? ""} plan for review?`}
        message={
          submitConfirm?.warning
            ? `${submitConfirm.warning} Once submitted you cannot edit until reviewed.`
            : "Once submitted you cannot edit until reviewed."
        }
        confirmText="Submit for review"
        cancelText="Not yet"
        type={submitConfirm?.warning ? "warning" : "info"}
        isLoading={submittingPeriod}
      />

      <ConfirmationModal
        isOpen={!!publishConfirm}
        onClose={() => setPublishConfirm(null)}
        onConfirm={() => void onConfirmPublishPeriod()}
        title={`Publish Week ${publishConfirm?.weekNumber ?? ""} plan?`}
        message="Publishing makes this plan live and active. This action cannot be undone."
        confirmText="Publish"
        cancelText="Cancel"
        type="info"
        isLoading={publishingPeriod}
      />
    </div>
  );
}

// ── Week Section ─────────────────────────────────────────────────────────

function WeekSection({
  weekNumber,
  plans,
  meta,
  expanded,
  isActive: _isActive,
  isNextUnlocked: _isNextUnlocked,
  availability,
  dateRange,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
  onPostPublishEdit,
  onUpdateProgress,
  onSubmit,
  onPublish,
  allowAdd = true,
}: {
  weekNumber: number;
  plans: WeeklyPlan[];
  meta: PeriodSubmissionState;
  expanded: boolean;
  isActive: boolean;
  isNextUnlocked: boolean;
  availability: PeriodAvailability;
  dateRange?: string;
  onToggle: () => void;
  onAdd: () => void;
  onEdit: (plan: WeeklyPlan) => void;
  onDelete: (plan: WeeklyPlan) => void;
  onPostPublishEdit?: (plan: WeeklyPlan) => void;
  onUpdateProgress?: (plan: WeeklyPlan) => void;
  onSubmit: () => void;
  onPublish: () => void;
  allowAdd?: boolean;
}) {
  const isCompleted =
    meta.bannerStatus === "PUBLISHED" || meta.bannerStatus === "APPROVED";
  const isFuture = availability === "future";
  const isPast = availability === "past";
  const isCurrent = availability === "current" || availability === "no-cycle";

  const cardBorder = isFuture
    ? "border-slate-100"
    : isCurrent
      ? "border-primary/50 ring-2 ring-primary/15"
      : isCompleted
        ? "border-emerald-300"
        : isPast
          ? "border-slate-300"
          : "border-slate-200";

  const headerBg = isFuture
    ? "bg-slate-50/60"
    : isCurrent
      ? "bg-gradient-to-r from-primary/5 to-primary/10"
      : isCompleted
        ? "bg-gradient-to-r from-emerald-50 to-emerald-50/60"
        : isPast
          ? "bg-slate-50"
          : "bg-white";

  const badgeBg = isFuture
    ? "bg-slate-100 text-slate-300"
    : isCurrent
      ? "bg-primary text-white shadow-md shadow-primary/30"
      : isCompleted
        ? "bg-emerald-500 text-white"
        : isPast
          ? "bg-slate-200 text-slate-500"
          : "bg-slate-100 text-slate-500";

  return (
    <section
      className={`rounded-3xl border-2 bg-white overflow-hidden transition-all duration-200 ${
        isFuture ? "opacity-50" : "shadow-md hover:shadow-lg"
      } ${cardBorder}`}
    >
      {/* Card Header */}
      <div
        role="button"
        tabIndex={isFuture ? -1 : 0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (!isFuture && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onToggle();
          }
        }}
        className={`w-full flex items-center justify-between gap-4 px-6 py-5 text-left transition-colors ${
          isFuture ? "cursor-not-allowed" : "hover:bg-black/2 cursor-pointer"
        } ${headerBg}`}
      >
        {/* Left: badge + title */}
        <div className="flex items-center gap-4 min-w-0">
          <span
            className={`h-12 w-12 rounded-2xl font-black text-base flex items-center justify-center shrink-0 transition-all ${badgeBg}`}
          >
            W{weekNumber}
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-slate-800">
                Week {weekNumber}
              </span>
              {dateRange && (
                <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                  {dateRange}
                </span>
              )}
              {isCurrent && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-wide">
                  <MdPlayCircle className="text-xs" />
                  Active
                </span>
              )}
              {isCompleted && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">
                  <MdCheckCircle className="text-xs" />
                  {meta.bannerStatus === "PUBLISHED" ? "Published" : "Approved"}
                </span>
              )}
              {isPast && !isCompleted && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wide">
                  <MdHistory className="text-xs" />
                  Past
                </span>
              )}
              {isFuture && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wide">
                  <MdSchedule className="text-xs" />
                  Upcoming
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {isFuture
                ? "Not yet available — becomes active when this week begins"
                : isPast && plans.length === 0
                  ? "No plans were created for this period"
                  : plans.length === 0
                    ? "No plans yet — click Add to start"
                    : `${plans.length} plan${plans.length === 1 ? "" : "s"} · ${meta.isSubmitted ? "Submitted" : isPast ? "Past" : "In progress"}`}
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-3 shrink-0">
          {isFuture ? (
            <span className="text-xs text-slate-400 font-medium">Not yet available</span>
          ) : (
            <>
              {isCurrent && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={MdAdd}
                  disabled={!allowAdd}
                  title={
                    !allowAdd
                      ? "Weekly plans are not enabled for your role"
                      : undefined
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                  }}
                >
                  Add
                </Button>
              )}
              {isPast && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-semibold uppercase tracking-wide">
                  Read-only
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                {expanded ? "Collapse" : "Expand"}
                <MdChevronRight
                  className={`text-lg transition-transform ${expanded ? "rotate-90" : ""}`}
                />
              </span>
            </>
          )}
        </div>
      </div>

      {/* Future period overlay */}
      {isFuture && (
        <div className="px-6 py-6 border-t border-slate-100 bg-slate-50/60">
          <div className="flex flex-col items-center justify-center gap-3 py-4">
            <MdSchedule className="text-slate-300" style={{ fontSize: 48 }} />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-400">
                Week {weekNumber} hasn't started yet
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                This period will become available when the current calendar week begins.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Past period read-only notice */}
      {isPast && !expanded && plans.length > 0 && (
        <div className="px-6 py-2 border-t border-slate-100 bg-amber-50/40">
          <p className="text-xs text-amber-700 font-medium">
            This period has ended. Plans are read-only.
          </p>
        </div>
      )}

      {/* Expanded content */}
      {!isFuture && expanded && (
        <div className="border-t border-slate-100 p-6 space-y-4 bg-slate-50/30">
          {(meta.isSubmitted || meta.feedbackNote) && (
            <PlanStatusBanner
              plan_status={meta.bannerStatus || "DRAFT"}
              submitted_at={meta.submittedAt}
              approved_at={meta.approvedAt}
              published_at={meta.publishedAt}
              reviewer_name={meta.reviewerName}
              feedback_note={meta.feedbackNote}
              feedbackItems={meta.feedbackItems}
              hideStatusBanner={meta.bannerStatus === "PUBLISHED"}
            />
          )}

          {plans.length === 0 ? (
            <div className="rounded-2xl bg-white border border-dashed border-slate-200 px-5 py-10 text-center">
              <MdAdd
                className="mx-auto text-slate-300 mb-2"
                style={{ fontSize: 36 }}
              />
              <p className="text-sm text-slate-600 mb-3">
                No plan yet for Week {weekNumber}. Click "+ Add Weekly Plan" to
                start.
              </p>
              {/* <Button variant="outline" size="sm" icon={MdAdd} onClick={onAdd}>
                Add Weekly Plan
              </Button> */}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {plans.map((plan) => (
                <WeeklyPlanCard
                  key={plan.id}
                  plan={plan}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPostPublishEdit={onPostPublishEdit}
                  onUpdateProgress={onUpdateProgress}
                />
              ))}
            </div>
          )}

          {meta.canShowSubmit && isCurrent && (
            <div className="flex items-center justify-end pt-2">
              <Button
                variant="secondary"
                size="sm"
                icon={MdSend}
                onClick={onSubmit}
              >
                Submit Week {weekNumber} Plan for Review
              </Button>
            </div>
          )}

          {meta.canShowPublish && (
            <div className="flex items-center justify-end pt-2">
              <Button
                variant="primary"
                size="sm"
                icon={MdPublish}
                onClick={onPublish}
              >
                Publish Week {weekNumber} Plan
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
