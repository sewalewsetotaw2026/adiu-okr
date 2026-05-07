import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MdAdd,
  MdChevronRight,
  MdSend,
  MdPublish,
  MdLock,
  MdLockOpen,
  MdCheckCircle,
  MdPlayCircle,
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
} from "../../../services/okr-execution.api";
import type {
  AvailableWeight,
  MonthlyPlan,
} from "../../../../types/okr.types";
import AddMonthlyPlanModal, {
  type AddMonthlyKR,
} from "./AddMonthlyPlanModal";
import EditMonthlyPlanModal from "./EditMonthlyPlanModal";
import MonthlyPlanCard from "./MonthlyPlanCard";
import PlanStatusBanner from "./PlanStatusBanner";
import EditOkrChangeRequestModal from "../../Admin/OKR/components/modals/EditOkrChangeRequestModal";
import RealignmentBanner from "../../Admin/OKR/components/RealignmentBanner";

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
  /** ID of a plan to auto-expand and focus (deep link support). */
  focusItemId?: string | number;
  /** Whether adding monthly plans is allowed by cadence configuration. */
  allowAdd?: boolean;
  /** The user's role level. */
  userRoleLevel?: "CEO" | "DIRECTOR" | "MANAGER_TEAM_LEADER" | "EMPLOYEE";
  /** Callback to trigger a post-publish edit request. */
  onPostPublishEdit?: (plan: MonthlyPlan) => void;
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
  focusItemId,
  allowAdd = true,
  userRoleLevel,
  onPostPublishEdit,
}: MonthlyPlanTabProps) {
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
  const [publishConfirm, setPublishConfirm] = useState<{ monthNumber: 1 | 2 | 3 } | null>(null);
  const [publishingPeriod, setPublishingPeriod] = useState(false);
  const [postPublishEditing, setPostPublishEditing] = useState<MonthlyPlan | null>(null);

  const krIds = useMemo(() => krs.map((k) => k.id), [krs]);

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
      const banner = order.find((s) =>
        list.some((p) => p.plan_status === s),
      );
      const bannerPlan = banner
        ? list.find((p) => p.plan_status === banner)
        : undefined;
      // Find rejected plan for feedback note
      const rejectedPlan = list.find((p) => p.plan_status === "REJECTED");
      const canShowPublish =
        list.length > 0 &&
        list.some((p) => p.plan_status === "APPROVED");
      out[m] = {
        isSubmitted,
        canShowSubmit,
        canShowPublish,
        // Weight is tracked per-KR (each KR's months must sum to 100% across
        // its own months). Cross-KR sum in a single month is meaningless.
        totalWeight: 100,
        bannerStatus: bannerPlan?.plan_status,
        submittedAt: bannerPlan?.submitted_at,
        approvedAt: bannerPlan?.approved_at,
        publishedAt: bannerPlan?.published_at,
        reviewerName: rejectedPlan?.reviewer_name || bannerPlan?.reviewer_name,
        feedbackNote: rejectedPlan?.feedback_note || rejectedPlan?.rejection_reason || rejectedPlan?.reviewer_note,
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
      ToastService.success(`Monthly plan created for Month ${created[0].month_number}.`);
    } else {
      ToastService.success(`${created.length} monthly plans created.`);
    }
  };

  const handleEdited = (updated: MonthlyPlan) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
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
    if (list.length === 0) {
      errors.push("This month has no plans yet.");
    }
    list.forEach((p) => {
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
      await submitMonthlyPeriod(submitConfirm.monthNumber, String(cycleId));
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
        err?.data?.message ||
          err?.message ||
          "Could not publish plans.",
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

  // A month is locked when the previous month has no plans that are APPROVED or PUBLISHED.
  // Month 1 is always unlocked (it's the starting point).
  const monthLocked = useMemo<Record<1 | 2 | 3, boolean>>(() => {
    const isMonthApprovedOrPublished = (m: 1 | 2 | 3) =>
      plansByMonth[m].some(
        (p) => p.plan_status === "APPROVED" || p.plan_status === "PUBLISHED",
      );
    return {
      1: false,
      2: !isMonthApprovedOrPublished(1),
      3: !isMonthApprovedOrPublished(2),
    };
  }, [plansByMonth]);

  // Active month = the last month that has at least one plan (approved/published
  // or even just in-progress). This represents where the user is currently working.
  // Falls back to month 1.
  const activeMonth = useMemo<1 | 2 | 3>(() => {
    if (initialExpandMonth) return initialExpandMonth;
    // Prefer: last month that has plans (regardless of status)
    for (const m of [3, 2, 1] as (1 | 2 | 3)[]) {
      if (plansByMonth[m].length > 0) return m;
    }
    return 1;
  }, [initialExpandMonth, plansByMonth]);

  // The next unlocked month = first unlocked month with zero plans (ready to start).
  // This is distinct from active — it just has a primary border hint.
  const nextUnlockedMonth = useMemo<1 | 2 | 3 | null>(() => {
    for (const m of MONTHS) {
      if (!monthLocked[m] && plansByMonth[m].length === 0 && m !== activeMonth) {
        return m;
      }
    }
    return null;
  }, [monthLocked, plansByMonth, activeMonth]);

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
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasAnyApproved && (
            <Button
              variant="outline"
              size="sm"
              icon={MdPublish}
              onClick={() => {
                const approvedMonths = MONTHS.filter((m) => periodMeta[m]?.canShowPublish);
                if (approvedMonths.length === 0) return;
                Promise.all(approvedMonths.map(async (m) => {
                  try {
                    await publishMonthlyPeriod(m, String(cycleId));
                  } catch (e) {
                    console.error("Failed to publish month " + m, e);
                  }
                })).then(() => {
                  ToastService.success("Approved plans published successfully.");
                  loadPlans();
                  onAllocationsChanged?.();
                });
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
              onClick={() => {
                const draftMonths = MONTHS.filter((m) => periodMeta[m]?.canShowSubmit);
                if (draftMonths.length === 0) return;
                Promise.all(draftMonths.map(async (m) => {
                  try {
                    await submitMonthlyPeriod(m, String(cycleId));
                  } catch (e) {
                    console.error("Failed to submit month " + m, e);
                  }
                })).then(() => {
                  ToastService.success("Draft plans submitted for review.");
                  loadPlans();
                  onAllocationsChanged?.();
                });
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
            isLocked={!!monthLocked[m]}
            onToggle={() => {
              if (monthLocked[m]) return;
              setExpanded((prev) => ({ ...prev, [m]: !prev[m] }));
            }}
            onAdd={() => setAddForMonth(m as 1 | 2 | 3)}
            onEdit={(p) => setEditing(p)}
            onDelete={(p) => setDeleting(p)}
            onPostPublishEdit={onPostPublishEdit}
            onSubmit={() => startSubmitPeriod(m)}
            onPublish={() => setPublishConfirm({ monthNumber: m as 1 | 2 | 3 })}
            allowAdd={allowAdd}
          />
        ))
      )}

      <AddMonthlyPlanModal
        isOpen={addForMonth !== null}
        onClose={() => setAddForMonth(null)}
        krs={krs}
        onCreated={handleCreated}
        preselectedMonth={addForMonth ? (addForMonth as 1 | 2 | 3) : undefined}
        cycleId={cycleId}
        userRoleLevel={userRoleLevel}
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
  isActive,
  isNextUnlocked,
  isLocked,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
  onPostPublishEdit,
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
  isLocked: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onEdit: (plan: MonthlyPlan) => void;
  onDelete: (plan: MonthlyPlan) => void;
  onPostPublishEdit: (plan: MonthlyPlan) => void;
  onSubmit: () => void;
  onPublish: () => void;
  allowAdd?: boolean;
}) {
  const isCompleted = meta.bannerStatus === "PUBLISHED" || meta.bannerStatus === "APPROVED";

  // Border theming: locked=slate, active=primary ring, completed=emerald, next-unlocked=primary(no ring), default=slate
  const cardBorder = isLocked
    ? "border-slate-200"
    : isActive
      ? "border-primary/50 ring-2 ring-primary/15"
      : isCompleted
        ? "border-emerald-300"
        : isNextUnlocked
          ? "border-primary/30"
          : "border-slate-200";

  const headerBg = isLocked
    ? "bg-slate-50"
    : isActive
      ? "bg-gradient-to-r from-primary/5 to-primary/10"
      : isCompleted
        ? "bg-gradient-to-r from-emerald-50 to-emerald-50/60"
        : "bg-white";

  const badgeBg = isLocked
    ? "bg-slate-200 text-slate-400"
    : isActive
      ? "bg-primary text-white shadow-md shadow-primary/30"
      : isCompleted
        ? "bg-emerald-500 text-white"
        : isNextUnlocked
          ? "bg-primary/10 text-primary"
          : "bg-slate-100 text-slate-500";

  return (
    <section
      className={`rounded-3xl border-2 bg-white overflow-hidden transition-all duration-200 ${
        isLocked ? "opacity-70" : "shadow-md hover:shadow-lg"
      } ${cardBorder}`}
    >
      {/* Card Header */}
      <div
        role="button"
        tabIndex={isLocked ? -1 : 0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (!isLocked && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onToggle();
          }
        }}
        className={`w-full flex items-center justify-between gap-4 px-6 py-5 text-left transition-colors ${
          isLocked ? "cursor-not-allowed" : "hover:bg-black/[0.02] cursor-pointer"
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
              {isActive && !isLocked && (
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
              {isNextUnlocked && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide">
                  <MdLockOpen className="text-xs" />
                  Ready
                </span>
              )}
              {isLocked && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wide">
                  Locked
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {isLocked
                ? `Unlocks after Month ${monthNumber - 1} plan is approved`
                : isNextUnlocked
                  ? "Unlocked — add your first plan to start"
                  : plans.length === 0
                    ? "No plans yet — click Add to start"
                    : `${plans.length} plan${plans.length === 1 ? "" : "s"} · ${meta.isSubmitted ? "Submitted" : "In progress"}`}
            </div>
          </div>
        </div>

        {/* Right: lock icon + actions */}
        <div className="flex items-center gap-3 shrink-0">
          {isLocked ? (
            <div className="flex flex-col items-center gap-1">
              <MdLock className="text-slate-400" style={{ fontSize: 32 }} />
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                Locked
              </span>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-1">
                <MdLockOpen
                  className={isActive || isNextUnlocked ? "text-primary" : "text-emerald-500"}
                  style={{ fontSize: 28 }}
                />
                <span
                  className={`text-[9px] font-semibold uppercase tracking-wider ${
                    isActive || isNextUnlocked ? "text-primary" : "text-emerald-500"
                  }`}
                >
                  Unlocked
                </span>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={MdAdd}
                disabled={!allowAdd}
                title={!allowAdd ? "Monthly plans are not enabled for your role" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd();
                }}
              >
                Add
              </Button>
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

      {/* Locked overlay message */}
      {isLocked && (
        <div className="px-6 py-6 border-t border-slate-100 bg-slate-50/80">
          <div className="flex flex-col items-center justify-center gap-3 py-4">
            <MdLock className="text-slate-300" style={{ fontSize: 48 }} />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-500">
                Month {monthNumber} is locked
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Complete and get Month {(monthNumber - 1) as 1 | 2} approved
                before planning Month {monthNumber}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expanded content */}
      {!isLocked && expanded && (
        <div className="border-t border-slate-100 p-6 space-y-4 bg-slate-50/30">
          {/* Banner if submitted; otherwise nothing here. */}
          {meta.isSubmitted && meta.bannerStatus && (
            <PlanStatusBanner
              plan_status={meta.bannerStatus}
              submitted_at={meta.submittedAt}
              approved_at={meta.approvedAt}
              published_at={meta.publishedAt}
              reviewer_name={meta.reviewerName}
              feedback_note={meta.feedbackNote}
            />
          )}

          {/* Plans grid */}
          {plans.length === 0 ? (
            <div className="rounded-2xl bg-white border border-dashed border-slate-200 px-5 py-10 text-center">
              <MdAdd className="mx-auto text-slate-300 mb-2" style={{ fontSize: 36 }} />
              <p className="text-sm text-slate-600 mb-3">
                No plan yet for Month {monthNumber}. Click "+ Add Monthly Plan"
                to start.
              </p>
              <Button variant="outline" size="sm" icon={MdAdd} onClick={onAdd}>
                Add Monthly Plan
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.map((plan) => (
                <MonthlyPlanCard
                  key={plan.id}
                  plan={plan}
                  unit={plan.parent_key_result?.unit}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPostPublishEdit={onPostPublishEdit}
                />
              ))}
            </div>
          )}

          {/* Period submit button (replaces banner when canShowSubmit) */}
          {meta.canShowSubmit && (
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
