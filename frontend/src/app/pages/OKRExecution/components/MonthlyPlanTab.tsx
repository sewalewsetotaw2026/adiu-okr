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
  MdArrowForward,
  MdWarning,
} from "react-icons/md";
import Button from "../../../components/Core/ui/Button";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import LoadingSkeleton from "../../../components/common/LoadingSkeleton";
import ToastService from "../../../../utils/ToastService";
import {
  deleteMonthlyPlan,
  fetchMonthlyPlans,
  publishMonthlyPeriod,
  submitMonthlyPeriod,
  updateMonthlyPlan,
} from "../../../services/okr-execution.api";
import type { AvailableWeight, MonthlyPlan } from "../../../../types/okr.types";
import AddMonthlyPlanModal, { type AddMonthlyKR } from "./AddMonthlyPlanModal";
import EditMonthlyPlanModal from "./EditMonthlyPlanModal";
import MonthlyPlanCard from "./MonthlyPlanCard";
import PlanStatusBanner from "./PlanStatusBanner";
import EditOkrChangeRequestModal from "../../Admin/OKR/components/modals/EditOkrChangeRequestModal";
import RealignmentBanner from "../../Admin/OKR/components/RealignmentBanner";
import MonthlyPlanProgressModal from "./modals/MonthlyPlanProgressModal";
import {
  formatReadableDate,
  getMonthAvailability,
  getCycleMonthRange,
  type PeriodAvailability,
} from "../utils/calendarDates";

const MONTHS: (1 | 2 | 3)[] = [1, 2, 3];

const NON_DRAFT_LIFECYCLE = new Set([
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PUBLISHED",
]);

const EDITABLE_LIFECYCLE = new Set(["DRAFT", "REJECTED"]);

export interface MonthlyPlanTabProps {
  /** All quarterly KRs the user can plan against. */
  krs: AddMonthlyKR[];
  /** Current cycle id. Required for period submission. */
  cycleId: number | null;
  /** Map of KR-id → AvailableWeight (used to disable CTA when fully allocated). */
  krAllocations: Record<string, AvailableWeight | null>;
  /** Auto-expand a specific month section on mount (deep link support). */
  initialExpandMonth?: 1 | 2 | 3;
  /**
   * Called whenever a plan is created/edited/deleted/submitted so the parent
   * can refresh KR allocation lines on the Quarterly tab.
   */
  onAllocationsChanged?: () => void;
  /** Optional nonce to trigger a refresh from the parent. */
  refreshNonce?: number;
  /** Cycle boundaries used to render calendar-aware labels. */
  cycleStartDate?: string | null;
  cycleEndDate?: string | null;
  /** ID of a plan to auto-expand and focus (deep link support). */
  focusItemId?: string | number;
  /** Whether adding monthly plans is allowed by cadence configuration. */
  allowAdd?: boolean;
  /** The user's role level. */
  userRoleLevel?: "CEO" | "DIRECTOR" | "MANAGER_TEAM_LEADER" | "EMPLOYEE";
  /** Level-based cadence configuration for all roles. */
  levelConfig?: Record<
    string,
    { allow_monthly: boolean; allow_weekly: boolean; allow_daily: boolean }
  > | null;
  /** Callback to trigger a post-publish edit request. */
  onPostPublishEdit?: (plan: MonthlyPlan) => void;
  /** Whether the user can update progress at the monthly level based on cadence. */
  allowUpdateProgress?: boolean;
}

interface PeriodSubmissionState {
  // Per-month meta inferred from plans in that month section.
  isSubmitted: boolean; // any plan in non-DRAFT lifecycle
  canShowSubmit: boolean; // ≥1 plan AND all are DRAFT/REJECTED
  canShowPublish: boolean; // ≥1 plan is APPROVED (none PUBLISHED yet)
  totalWeight: number;
  bannerStatus?: MonthlyPlan["plan_status"];
  reviewerName?: string;
  feedbackNote?: string;
  feedbackItems: any[]; // List of specific feedback items
  submittedAt?: string;
  approvedAt?: string;
  publishedAt?: string;
}

export default function MonthlyPlanTab({
  krs,
  cycleId,
  krAllocations,
  initialExpandMonth,
  onAllocationsChanged,
  refreshNonce,
  cycleStartDate,
  cycleEndDate,
  focusItemId,
  allowAdd = true,
  userRoleLevel,
  levelConfig,
  onPostPublishEdit,
  allowUpdateProgress = false,
}: MonthlyPlanTabProps) {
  const authUser = useSelector(selectAuthUser);
  const currentUserId = authUser?.employee_id
    ? String(authUser.employee_id)
    : authUser?.id
      ? String(authUser.id)
      : null;
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [loading, setLoading] = useState(false);

  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => ({
    1: (initialExpandMonth ?? 1) === 1,
    2: (initialExpandMonth ?? 1) === 2,
    3: (initialExpandMonth ?? 1) === 3,
  }));
  const [addForMonth, setAddForMonth] = useState<0 | 1 | 2 | 3 | null>(null);
  const [editing, setEditing] = useState<MonthlyPlan | null>(null);
  const [deleting, setDeleting] = useState<MonthlyPlan | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [submitConfirm, setSubmitConfirm] = useState<{
    monthNumber: 1 | 2 | 3;
    warning?: string;
  } | null>(null);
  const [submittingPeriod, setSubmittingPeriod] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState<{
    monthNumber: 1 | 2 | 3;
  } | null>(null);
  const [publishingPeriod, setPublishingPeriod] = useState(false);
  // Top-level batch CTA loaders
  const [publishAllLoading, setPublishAllLoading] = useState(false);
  const [submitAllLoading, setSubmitAllLoading] = useState(false);
  const [postPublishEditing, setPostPublishEditing] =
    useState<MonthlyPlan | null>(null);
  const [progressPlan, setProgressPlan] = useState<MonthlyPlan | null>(null);

  const krIdsString = JSON.stringify(krs.map((k) => k.id));
  const krIds = useMemo(() => krs.map((k) => k.id), [krIdsString]);

  const loadPlans = useCallback(async () => {
    if (krIds.length === 0) {
      setPlans([]);
      return;
    }
    setLoading(true);
    try {
      const lists = await Promise.all(
        krIds.map((id) =>
          fetchMonthlyPlans(id).catch(() => [] as MonthlyPlan[]),
        ),
      );
      setPlans(lists.flat());
    } finally {
      setLoading(false);
    }
  }, [krIds, refreshNonce]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  // Auto-expand on focusItemId change.
  useEffect(() => {
    if (!focusItemId || plans.length === 0) return;
    const plan = plans.find((p) => String(p.id) === String(focusItemId));
    if (plan && plan.month_number) {
      setExpanded((prev) => ({ ...prev, [plan.month_number]: true }));
    }
  }, [focusItemId, plans]);

  // Auto-expand on initialExpandMonth change.
  useEffect(() => {
    if (!initialExpandMonth) return;
    setExpanded((prev) => ({ ...prev, [initialExpandMonth]: true }));
  }, [initialExpandMonth]);

  const plansByMonth = useMemo(() => {
    const map: Record<number, MonthlyPlan[]> = { 1: [], 2: [], 3: [] };
    for (const p of plans) {
      const m = Number(p.month_number);
      if (m >= 1 && m <= 3) map[m].push(p);
    }
    return map;
  }, [plans]);

  const periodMeta = useMemo<Record<number, PeriodSubmissionState>>(() => {
    const out: Record<number, PeriodSubmissionState> = {} as any;
    for (const m of MONTHS) {
      const list = plansByMonth[m];
      const isSubmitted = list.some((p) =>
        NON_DRAFT_LIFECYCLE.has(p.plan_status),
      );
      const canShowSubmit =
        list.length > 0 &&
        list.some((p) => EDITABLE_LIFECYCLE.has(p.plan_status));
      // Choose the "lowest" lifecycle status (worst case) to display banner.
      const order: MonthlyPlan["plan_status"][] = [
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

      // Find ALL plans with feedback (Legacy + History)
      const feedbackItems: any[] = [];
      list.forEach((p) => {
        const planFeedback: any[] = [];

        // 1. Add historical comments
        if (p.comments && p.comments.length > 0) {
          p.comments.forEach((c: any) => {
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
      out[m] = {
        isSubmitted,
        canShowSubmit,
        canShowPublish,
        totalWeight: 100,
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
      };
    }
    return out;
  }, [plansByMonth]);

  const allFullyAllocated = useMemo(() => {
    if (krs.length === 0) return true;
    return krs.every((kr) => {
      const aw = krAllocations[kr.id];
      if (!aw) return true;
      const remaining = aw.remaining_pct;
      const progress = Number(kr.progress_pct ?? 0);
      return remaining <= 0 || progress >= 100;
    });
  }, [krs, krAllocations]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleCreated = (created: MonthlyPlan[]) => {
    setPlans((prev) => [...prev, ...created]);
    onAllocationsChanged?.();
    if (created.length === 1) {
      ToastService.success(
        `Monthly plan created for Month ${created[0].month_number}.`,
      );
    } else {
      ToastService.success(`${created.length} monthly plans created.`);
    }
  };

  const handleEdited = (updated: MonthlyPlan) => {
    setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    ToastService.success("Monthly plan updated.");
  };

  const onConfirmDelete = async () => {
    if (!deleting) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteMonthlyPlan(deleting.id);
      setPlans((prev) => prev.filter((p) => p.id !== deleting.id));
      onAllocationsChanged?.();
      setDeleting(null);
      ToastService.success("Monthly plan deleted.");
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

  const startSubmitPeriod = (m: 1 | 2 | 3) => {
    const list = plansByMonth[m];
    const errors: string[] = [];

    // Filter to only editable plans (draft/rejected) for validation
    const editablePlans = list.filter((p) =>
      EDITABLE_LIFECYCLE.has(p.plan_status),
    );

    if (editablePlans.length === 0) {
      errors.push("No editable plans found for submission.");
    }
    editablePlans.forEach((p) => {
      if (!Number(p.target_value)) {
        errors.push(`"${p.title}" has no target value.`);
      }
      if (!Number(p.weight_pct)) {
        errors.push(`"${p.title}" has no weight.`);
      }
    });
    if (errors.length > 0) {
      ToastService.error(errors.join(" "));
      return;
    }

    setSubmitConfirm({ monthNumber: m });
  };

  const onConfirmSubmitPeriod = async () => {
    if (!submitConfirm || !cycleId) return;
    setSubmittingPeriod(true);
    try {
      const draftPlanIds = (plansByMonth[submitConfirm.monthNumber] ?? [])
        .filter((p) => EDITABLE_LIFECYCLE.has(p.plan_status))
        .map((p) => p.id);

      if (draftPlanIds.length === 0) {
        ToastService.error("No draft plans found for submission.");
        return;
      }

      await submitMonthlyPeriod(
        submitConfirm.monthNumber,
        String(cycleId),
        draftPlanIds,
      );
      ToastService.success(
        `Month ${submitConfirm.monthNumber} plan submitted for review.`,
      );
      setSubmitConfirm(null);
      await loadPlans();
      onAllocationsChanged?.();
    } catch (err: any) {
      ToastService.error(
        err?.data?.message ||
          err?.message ||
          "Could not submit plans for review.",
      );
    } finally {
      setSubmittingPeriod(false);
    }
  };

  const onConfirmPublishPeriod = async () => {
    if (!publishConfirm || !cycleId) return;
    setPublishingPeriod(true);
    try {
      await publishMonthlyPeriod(publishConfirm.monthNumber, String(cycleId));
      ToastService.success(
        `Month ${publishConfirm.monthNumber} plan published successfully.`,
      );
      setPublishConfirm(null);
      await loadPlans();
      onAllocationsChanged?.();
    } catch (err: any) {
      ToastService.error(
        err?.data?.message || err?.message || "Could not publish plans.",
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

  // Calendar-driven availability: current month is editable, past is read-only, future is hidden/disabled.
  const monthAvailability = useMemo<Record<1 | 2 | 3, PeriodAvailability>>(() => ({
    1: getMonthAvailability(1, cycleStartDate, cycleEndDate),
    2: getMonthAvailability(2, cycleStartDate, cycleEndDate),
    3: getMonthAvailability(3, cycleStartDate, cycleEndDate),
  }), [cycleStartDate, cycleEndDate]);

  // Active month = the current calendar month within the cycle.
  // Falls back to the last month with plans, then month 1.
  const activeMonth = useMemo<1 | 2 | 3>(() => {
    if (initialExpandMonth) return initialExpandMonth;
    const current = MONTHS.find((m) => monthAvailability[m] === "current");
    if (current) return current;
    for (const m of [3, 2, 1] as (1 | 2 | 3)[]) {
      if (plansByMonth[m].length > 0) return m;
    }
    return 1;
  }, [initialExpandMonth, monthAvailability, plansByMonth]);

  // No longer needed — future months are shown as greyed-out, not with a "next ready" hint.
  const nextUnlockedMonth = null;

  // Carry-over: for each month M (2, 3), collect PUBLISHED plans from month M-1
  // that have not fully met their target (current_value < target_value).
  const carryOverByMonth = useMemo<Record<2 | 3, MonthlyPlan[]>>(() => {
    const unaccomplished = (monthNum: 1 | 2): MonthlyPlan[] =>
      plansByMonth[monthNum].filter(
        (p) =>
          p.plan_status === "PUBLISHED" &&
          Number(p.current_value ?? 0) < Number(p.target_value ?? 0),
      );
    return { 2: unaccomplished(1), 3: unaccomplished(2) };
  }, [plansByMonth]);

  // Auto-expand the active month whenever it changes (driven by plan data).
  useEffect(() => {
    if (initialExpandMonth) {
      setExpanded((prev) => ({ ...prev, [initialExpandMonth]: true }));
      return;
    }
    setExpanded((prev) => ({ ...prev, [activeMonth]: true }));
  }, [activeMonth, initialExpandMonth]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <RealignmentBanner />
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            Monthly Plans
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Break the quarter into Month 1, 2 and 3 plans for each Key Result.
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
                const approvedMonths = MONTHS.filter(
                  (m) => periodMeta[m]?.canShowPublish,
                );
                if (approvedMonths.length === 0) return;

                setPublishAllLoading(true);
                try {
                  await Promise.all(
                    approvedMonths.map(async (m) => {
                      try {
                        await publishMonthlyPeriod(m, String(cycleId));
                      } catch (e) {
                        console.error("Failed to publish month " + m, e);
                      }
                    }),
                  );
                  ToastService.success(
                    "Approved plans published successfully.",
                  );
                  await loadPlans();
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
                const draftMonths = MONTHS.filter(
                  (m) => periodMeta[m]?.canShowSubmit,
                );
                if (draftMonths.length === 0) return;

                setSubmitAllLoading(true);
                try {
                  await Promise.all(
                    draftMonths.map(async (m) => {
                      try {
                        const draftPlanIds = (plansByMonth[m] ?? [])
                          .filter((p) => EDITABLE_LIFECYCLE.has(p.plan_status))
                          .map((p) => p.id);
                        if (draftPlanIds.length === 0) return;
                        await submitMonthlyPeriod(
                          m,
                          String(cycleId),
                          draftPlanIds,
                        );
                      } catch (e) {
                        console.error("Failed to submit month " + m, e);
                      }
                    }),
                  );
                  ToastService.success("Draft plans submitted for review.");
                  await loadPlans();
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
            disabled={allFullyAllocated || krs.length === 0 || !allowAdd}
            title={
              !allowAdd
                ? "Monthly plans are not enabled for your role"
                : allFullyAllocated
                  ? "All Key Results are fully allocated"
                  : undefined
            }
            onClick={() => setAddForMonth(0)}
          >
            Add Monthly Plan
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : (
        MONTHS.map((m) => (
          <MonthSection
            key={m}
            monthNumber={m}
            plans={plansByMonth[m]}
            meta={periodMeta[m]}
            expanded={!!expanded[m]}
            isActive={m === activeMonth}
            isNextUnlocked={m === nextUnlockedMonth}
            availability={monthAvailability[m]}
            carryOverPlans={m >= 2 ? (carryOverByMonth[m as 2 | 3] ?? []) : []}
            dateRange={(() => {
              if (!cycleStartDate || !cycleEndDate) return undefined;
              const range = getCycleMonthRange(cycleStartDate, cycleEndDate, m);
              if (!range) return undefined;
              const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              return `${fmt(range.start)} – ${fmt(range.end)}`;
            })()}
            onToggle={() => {
              if (monthAvailability[m] === "future") return;
              setExpanded((prev) => ({ ...prev, [m]: !prev[m] }));
            }}
            onAdd={() => setAddForMonth(m as 1 | 2 | 3)}
            onEdit={(p) => setEditing(p)}
            onDelete={(p) => setDeleting(p)}
            onPostPublishEdit={onPostPublishEdit}
            onSubmit={() => startSubmitPeriod(m)}
            onPublish={() => setPublishConfirm({ monthNumber: m as 1 | 2 | 3 })}
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

      <AddMonthlyPlanModal
        isOpen={addForMonth !== null}
        onClose={() => setAddForMonth(null)}
        krs={krs}
        onCreated={handleCreated}
        preselectedMonth={addForMonth ? (addForMonth as 1 | 2 | 3) : undefined}
        cycleId={cycleId ?? undefined}
        userRoleLevel={userRoleLevel}
        levelConfig={levelConfig}
      />

      <EditMonthlyPlanModal
        isOpen={!!editing}
        plan={editing}
        onClose={() => setEditing(null)}
        onSaved={handleEdited}
      />

      <EditOkrChangeRequestModal
        isOpen={!!postPublishEditing}
        entity={postPublishEditing}
        entityType="EMPLOYEE_MONTH_PLAN"
        companyId={Number(localStorage.getItem("companyId") || 1)} // Fallback for now
        cycleId={cycleId || 0}
        onClose={() => setPostPublishEditing(null)}
        onSuccess={() => {
          setPostPublishEditing(null);
          loadPlans();
        }}
      />

      {progressPlan && (
        <MonthlyPlanProgressModal
          isOpen={!!progressPlan}
          plan={progressPlan}
          onClose={() => setProgressPlan(null)}
          onSave={async (data) => {
            try {
              await updateMonthlyPlan(progressPlan.id, data);
              setProgressPlan(null);
              void loadPlans();
              onAllocationsChanged?.();
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
        title="Delete this monthly plan?"
        message={
          deleteError
            ? deleteError
            : "Deleting removes all weekly and daily plans under it and recalculates parent KR progress. This cannot be undone."
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
        title={`Submit Month ${submitConfirm?.monthNumber ?? ""} plan for review?`}
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
        title={`Publish Month ${publishConfirm?.monthNumber ?? ""} plan?`}
        message="Publishing makes this plan live and active. This action cannot be undone."
        confirmText="Publish"
        cancelText="Cancel"
        type="info"
        isLoading={publishingPeriod}
      />
    </div>
  );
}

// ── Month Section ────────────────────────────────────────────────────────

function MonthSection({
  monthNumber,
  plans,
  meta,
  expanded,
  isActive: _isActive,
  isNextUnlocked: _isNextUnlocked,
  availability,
  carryOverPlans = [],
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
  monthNumber: 1 | 2 | 3;
  plans: MonthlyPlan[];
  meta: PeriodSubmissionState;
  expanded: boolean;
  isActive: boolean;
  isNextUnlocked: boolean;
  availability: PeriodAvailability;
  carryOverPlans?: MonthlyPlan[];
  dateRange?: string;
  onToggle: () => void;
  onAdd: () => void;
  onEdit: (plan: MonthlyPlan) => void;
  onDelete: (plan: MonthlyPlan) => void;
  onPostPublishEdit?: (plan: MonthlyPlan) => void;
  onUpdateProgress?: (plan: MonthlyPlan) => void;
  onSubmit: () => void;
  onPublish: () => void;
  allowAdd?: boolean;
}) {
  const isCompleted =
    meta.bannerStatus === "PUBLISHED" || meta.bannerStatus === "APPROVED";
  const isFuture = availability === "future";
  const isPast = availability === "past";
  const isCurrent = availability === "current" || availability === "no-cycle";

  // Border theming: future=slate/dim, current=primary ring, past=emerald, default=slate
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
          {/* Month badge */}
          <span
            className={`h-12 w-12 rounded-2xl font-black text-base flex items-center justify-center shrink-0 transition-all ${badgeBg}`}
          >
            M{monthNumber}
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-slate-800">
                Month {monthNumber}
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
                ? "Not yet available — becomes active when this month begins"
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
                      ? "Monthly plans are not enabled for your role"
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
                Month {monthNumber} hasn't started yet
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                This period will become available when the current calendar month begins.
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
          {/* Carry-over banner: show unaccomplished targets from previous month */}
          {carryOverPlans.length > 0 && isCurrent && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <MdWarning className="text-amber-500 shrink-0 mt-0.5" style={{ fontSize: 20 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-800 mb-1">
                    {carryOverPlans.length} unaccomplished target{carryOverPlans.length > 1 ? "s" : ""} from Month {monthNumber - 1}
                  </p>
                  <p className="text-xs text-amber-700 mb-3">
                    The following plans did not reach their target last month. Consider carrying them over into Month {monthNumber}.
                  </p>
                  <div className="space-y-2">
                    {carryOverPlans.map((cp) => {
                      const remaining = Math.max(0, Number(cp.target_value ?? 0) - Number(cp.current_value ?? 0));
                      const unit = cp.parent_key_result?.unit ?? "";
                      return (
                        <div
                          key={cp.id}
                          className="flex items-center justify-between gap-2 rounded-xl bg-white border border-amber-100 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 truncate">{cp.title}</p>
                            <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                              Remaining: <span className="font-bold tabular-nums">{remaining}{unit ? ` ${unit}` : ""}</span>
                              {" "}({Math.round(100 - Number(cp.progress_pct ?? 0))}% unmet)
                            </p>
                          </div>
                          <MdArrowForward className="text-amber-400 shrink-0" style={{ fontSize: 16 }} />
                        </div>
                      );
                    })}
                  </div>
                  {allowAdd && (
                    <button
                      type="button"
                      onClick={onAdd}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 hover:underline transition-colors cursor-pointer"
                    >
                      <MdAdd style={{ fontSize: 14 }} />
                      Add carry-over plan for Month {monthNumber}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Banner if submitted; otherwise nothing here. */}
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

          {/* Plans grid */}
          {plans.length === 0 ? (
            <div className="rounded-2xl bg-white border border-dashed border-slate-200 px-5 py-10 text-center">
              <MdAdd
                className="mx-auto text-slate-300 mb-2"
                style={{ fontSize: 36 }}
              />
              <p className="text-sm text-slate-600 mb-3">
                No plan yet for Month {monthNumber}. Click "+ Add Monthly Plan"
                to start.
              </p>
              {/* <Button variant="outline" size="sm" icon={MdAdd} onClick={onAdd}>
                Add Monthly Plan
              </Button> */}
            </div>
          ) : (
            // <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            // <div className="grid grid-cols-[repeat(auto-fit,minmax(100%,1fr))] gap-4">
            <div className="grid grid-cols-1 gap-4">  
              {plans.map((plan) => (
                <MonthlyPlanCard
                  key={plan.id}
                  plan={plan}
                  unit={plan.parent_key_result?.unit}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPostPublishEdit={onPostPublishEdit}
                  onUpdateProgress={
                    onUpdateProgress ? () => onUpdateProgress(plan) : undefined
                  }
                />
              ))}
            </div>
          )}

          {/* Period submit button — only for current or no-cycle periods */}
          {meta.canShowSubmit && isCurrent && (
            <div className="flex items-center justify-end pt-2">
              <Button
                variant="secondary"
                size="sm"
                icon={MdSend}
                onClick={onSubmit}
              >
                Submit Month {monthNumber} Plan for Review
              </Button>
            </div>
          )}

          {/* Publish button when plans are approved but not yet published */}
          {meta.canShowPublish && (
            <div className="flex items-center justify-end pt-2">
              <Button
                variant="primary"
                size="sm"
                icon={MdPublish}
                onClick={onPublish}
              >
                Publish Month {monthNumber} Plan
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
