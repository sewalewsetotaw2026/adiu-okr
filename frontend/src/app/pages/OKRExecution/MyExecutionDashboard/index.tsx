import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
// import BulletText from "../../../components/common/BulletText";
import ExecutionShell from "../components/ExecutionShell";
import RefreshButton from "../../../components/common/RefreshButton";
import ObjectiveCard from "../../../components/common/ObjectiveCard";
import LoadingSkeleton from "../../../components/common/LoadingSkeleton";
import { routeConstants } from "../../../../utils/constants";
import {
  MdFlag,
  MdChevronRight,
  MdPublish,
  MdAdd,
  MdClose,
  MdSend,
  MdWarningAmber,
} from "react-icons/md";
import Button from "../../../components/Core/ui/Button";
import ExecutionSetupModal, {
  type EmployeeAdoptionMode,
  type AdoptableOption,
} from "../components/modals/ExecutionSetupModal";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import {
  fromBackendExecutionMode,
  okrAsArray,
  okrErrorMessage,
  okrListRows,
  okrUnwrap,
} from "../../../utils/okrApi";
import ToastService from "../../../../utils/ToastService";
import { useSelector } from "react-redux";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import KeyResultListItem from "../../../components/common/KeyResultListItem";

type Card = {
  id: string;
  title: string;
  parentKr: string;
  progress: number;
  mode: EmployeeAdoptionMode | null;
  status: string;
  krId?: number;
  keyResults?: any[];
};

type AssignedKR = {
  contributor_id: number;
  department_kr_id: number | null;
  employee_kr_id: number | null;
  title: string;
  description: string;
};

// At the top with other types
// Type removed here as it is imported from ExecutionSetupModal

function keyResultsFromObjectiveRow(o: Record<string, unknown>): unknown[] {
  const raw =
    o.employee_key_results ??
    o.key_results ??
    o.keyResults ??
    o.employeeKeyResults;
  return Array.isArray(raw) ? raw : [];
}

export default function MyExecutionDashboardPage() {
  const navigate = useNavigate();
  const user = useSelector(selectAuthUser);
  const [cards, setCards] = useState<Card[]>([]);
  const [assignedKrs, setAssignedKrs] = useState<AssignedKR[]>([]);
  const [loading, setLoading] = useState(true);


  // Modal State
  const [setupOpen, setSetupOpen] = useState(false);
  const [modeDraft, setModeDraft] =
    useState<EmployeeAdoptionMode>("direct_adoption");
  const [setupContributorId, setSetupContributorId] = useState<number | null>(
    null,
  );
  const [setupDeptKrId, setSetupDeptKrId] = useState<number | null>(null);
  const [setupEmployeeKrId, setSetupEmployeeKrId] = useState<number | null>(null);

  const [setupParentTitle, setSetupParentTitle] = useState("");
  const [setupParentDescription, setSetupParentDescription] = useState("");
  const [setupCustomTitle, setSetupCustomTitle] = useState("");
  const [setupCustomDescription, setSetupCustomDescription] = useState("");
  const [saveSetupBusy, setSaveSetupBusy] = useState(false);
  const [maxObjectives, setMaxObjectives] = useState<number | null>(null);
  const handleNewObjectiveClick = () => {
    if (maxObjectives !== null && cards.length >= maxObjectives) {
      ToastService.error(`You have reached the maximum limit of ${maxObjectives} objectives for this cycle.`);
      return;
    }

    if (assignedKrs.length === 0) {
      ToastService.error("You don't have any pending assigned KRs to adopt.");
      return;
    }

    // Reset modal state
    setModeDraft("direct_adoption");
    setSetupCustomTitle("");
    setSetupCustomDescription("");

    if (assignedKrs.length > 0) {
      handleSelectAdoptOption(assignedKrs[0].contributor_id);
    } else {
      setSetupContributorId(null);
    }

    setSetupOpen(true);
  };

  const handleSelectAdoptOption = (contributorId: number) => {
    const kr = assignedKrs.find(a => a.contributor_id === contributorId);
    if (!kr) return;

    setSetupContributorId(kr.contributor_id);
    setSetupDeptKrId(kr.department_kr_id);
    setSetupEmployeeKrId(kr.employee_kr_id);

    // Always start with direct adoption values of the newly selected KR
    setSetupParentTitle(kr.title);
    setSetupParentDescription(kr.description);
    setSetupCustomTitle(kr.title);
    setSetupCustomDescription(kr.description);
    setModeDraft("direct_adoption");
  };

  // Bulk Selection
  const [selectedObjectiveIds, setSelectedObjectiveIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedKrIds, setSelectedKrIds] = useState<Set<number>>(new Set());

  const userId = user?.employee_id ? String(user.employee_id) : (user?.id ? String(user.id) : null);

  const loadAssignedKRs = useCallback(async () => {

    try {
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });

      const cycle = okrUnwrap(cycleRes) as { id?: number } | null;
      const cid = cycle?.id != null ? Number(cycle.id) : null;

      if (!cid || !userId) {
        setAssignedKrs([]);
        return;
      }

      // Fetch assigned KRs
      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.employeeAssignedKRs,
        query: { cycle_id: cid, user_id: userId },
        isSecureRoute: true,
      });
      const rows = okrAsArray(okrUnwrap(res)) as any[];
      const mapped = rows.map((r) => ({
        contributor_id: Number(r.contributor_id || r.id),
        department_kr_id: r.company_kr?.id || r.companyKr?.id || r.department_kr?.id || null,
        employee_kr_id: r.employee_kr?.id || r.employeeKr?.id || null,
        title: r.company_kr?.title || r.companyKr?.title || r.employee_kr?.title || r.employeeKr?.title || r.department_kr?.title || r.departmentKr?.title || "Assigned KR",
        description: r.company_kr?.description || r.companyKr?.description || r.employee_kr?.description || r.employeeKr?.description || r.department_kr?.description || r.departmentKr?.description || "",
      }));

      setAssignedKrs(mapped);
    } catch (e) {
      console.error("Failed to load assigned KRs:", e);
      setAssignedKrs([]);
    } finally {

    }
  }, [userId]);

  const loadObjectives = useCallback(async () => {
    setLoading(true);
    try {
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });
      const cycle = okrUnwrap(cycleRes) as { id?: number } | null;
      const cid = cycle?.id != null ? Number(cycle.id) : null;
      if (!cid) {
        setCards([]);
        return;
      }

      const queries: Record<string, string | number>[] = [{ cycle_id: cid }];
      if (user?.employee_id)
        queries.push({ cycle_id: cid, user_id: String(user.employee_id) });
      if (user?.id) queries.push({ cycle_id: cid, user_id: String(user.id) });

      const merged = new Map<string, Record<string, unknown>>();

      for (const q of queries) {
        try {
          const listRes = await makeCall({
            method: "GET",
            route: apiRoutes.okr.employeeObjectives,
            query: q,
            isSecureRoute: true,
          });
          const rows = okrListRows(okrUnwrap(listRes)) as Record<
            string,
            unknown
          >[];
          rows.forEach((r) => {
            if (r?.id != null) merged.set(String(r.id), r);
          });
        } catch (e) {
          console.warn("Failed to load objective list", e);
        }
      }

      const rows = Array.from(merged.values());

      // === CRITICAL PART: Force fetch full detail + progress for every objective ===
      const enriched = await Promise.all(
        rows.map(async (o: Record<string, unknown>) => {
          const objectiveId = String(o.id);
          let fullObj = o;

          try {
            const detRes = await makeCall({
              method: "GET",
              route: apiRoutes.okr.employeeObjectiveById(objectiveId),
              isSecureRoute: true,
            });
            fullObj = okrUnwrap(detRes);
          } catch (e) {
            console.warn(`Detail fetch failed for objective ${objectiveId}`, e);
          }

          return fullObj;
        }),
      );

      // Build final cards
      setCards(
        enriched.map((o: Record<string, unknown>) => {
          const krs = keyResultsFromObjectiveRow(o);
          const first = krs[0] as
            | { execution_mode?: string; progress?: number; id?: number }
            | undefined;
          const pkr =
            o.parentDepartmentKr ?? o.parent_department_kr ?? undefined;
          const pTitle =
            typeof (pkr as any)?.title === "string" ? (pkr as any).title : "—";

          return {
            id: String(o.id),
            title: (o.title as string) ?? "Employee objective",
            parentKr:
              (o.parent_kr_title as string) ??
              (o as { department_kr?: { title?: string } }).department_kr
                ?.title ??
              (o as { departmentKr?: { title?: string } }).departmentKr
                ?.title ??
              pTitle ??
              "—",
            progress: (() => {
              const tgt = Number((o as any).target_value ?? 0);
              const cur = Number((o as any).current_value ?? 0);
              return tgt > 0 ? Number(((cur / tgt) * 100).toFixed(2)) : 0;
            })(),
            mode: fromBackendExecutionMode(
              first?.execution_mode ?? (o.execution_mode as string | undefined),
            ),
            status: String(o.status_code || "draft"),
            krId: first?.id ? Number(first.id) : undefined,
            keyResults: Array.isArray(o.keyResults) ? o.keyResults : []
          };
        }),
      );
    } catch (e) {
      console.error(e);
      ToastService.error(okrErrorMessage(e));
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [user?.employee_id, user?.id]);

  useEffect(() => {
    void loadObjectives();
    void loadAssignedKRs();

    const fetchConfig = async () => {
      try {
        const res = await makeCall({
          method: "GET",
          route: apiRoutes.okr.configurationMenu,
          isSecureRoute: true,
        });
        const menu = okrUnwrap(res) as any;
        const max = menu?.additional_configuration?.allowed_objectives?.max;
        if (max) setMaxObjectives(Number(max));
      } catch (e) {
        console.warn("Failed to fetch OKR configuration", e);
      }
    };
    void fetchConfig();
  }, [loadObjectives, loadAssignedKRs]);

  // Removed openAdoptModal in favor of handleNewObjectiveClick + handleSelectAdoptOption

  const handleAdopt = async () => {
    if ((!setupDeptKrId && !setupEmployeeKrId) || !setupContributorId) return;
    if (modeDraft === "custom_adoption" && !setupCustomTitle.trim()) {
      ToastService.error(
        "Custom adoption requires a title for your key result.",
      );
      return;
    }

    if (modeDraft === "custom_adoption" && !setupCustomTitle.trim()) {
      ToastService.error("Custom adoption requires a title.");
      return;
    }

    setSaveSetupBusy(true);

    try {
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });
      const cycle = okrUnwrap(cycleRes) as { id?: number } | null;
      const cid = cycle?.id != null ? Number(cycle.id) : null;
      if (!cid) throw new Error("No active cycle found");

      // FIXED: Use exact values the backend expects
      const backendExecutionMode =
        modeDraft === "custom_adoption" ? "CUSTOMIZED" : "DIRECT_ADOPTION";

      await makeCall({
        method: "POST",
        route: apiRoutes.okr.employeeAdoptAssignedKR,
        body: {
          contributor_id: setupContributorId,
          department_kr_id: setupDeptKrId || undefined,
          employee_kr_id: setupEmployeeKrId || undefined,
          cycle_id: cid,
          execution_mode: backendExecutionMode, // ← This was the issue
          title: modeDraft === "custom_adoption" ? setupCustomTitle.trim() : "",
          description:
            modeDraft === "custom_adoption"
              ? setupCustomDescription.trim()
              : "",
        },
        isSecureRoute: true,
      });

      ToastService.success("KR successfully adopted!");
      setSetupOpen(false);

      // Refresh lists
      await Promise.all([loadAssignedKRs(), loadObjectives()]);
    } catch (e: any) {
      ToastService.error(okrErrorMessage(e) || "Failed to adopt KR");
    } finally {
      setSaveSetupBusy(false);
    }
  };

  // ... rest of your functions (toggleSelectCard, handleBulkSubmit, handleBulkPublish, goDetail) remain unchanged

  const toggleSelectCard = (id: string, krId?: number) => {
    setSelectedObjectiveIds((prev) => {
      const ns = new Set(prev);
      if (ns.has(id)) ns.delete(id);
      else ns.add(id);
      return ns;
    });
    if (krId) {
      setSelectedKrIds((prev) => {
        const ns = new Set(prev);
        if (ns.has(krId)) ns.delete(krId);
        else ns.add(krId);
        return ns;
      });
    }
  };

  const handleSubmitAllDrafts = async () => {
    const draftObjectives = cards.filter((c) => c.status === "draft");
    const objectiveIds = draftObjectives.map((c) => Number(c.id));

    // Collect all draft KRs under these objectives
    const krIds: number[] = [];
    draftObjectives.forEach((c) => {
      if (c.keyResults) {
        c.keyResults.forEach((kr: any) => {
          if (kr.status_code === "draft") {
            krIds.push(Number(kr.id));
          }
        });
      }
    });

    if (objectiveIds.length === 0 && krIds.length === 0) return;

    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.employeeBulkSubmit,
        body: {
          objective_ids: objectiveIds,
          kr_ids: krIds,
        },
        isSecureRoute: true,
      });
      ToastService.success(
        "All draft objectives and key results submitted for approval.",
      );
      void loadObjectives();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    }
  };

  const handleBulkSubmit = async () => {
    if (selectedObjectiveIds.size === 0 && selectedKrIds.size === 0) return;
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.employeeBulkSubmit,
        body: {
          objective_ids: Array.from(selectedObjectiveIds).map(Number),
          kr_ids: Array.from(selectedKrIds).map(Number),
        },
        isSecureRoute: true,
      });
      ToastService.success("Successfully submitted for approval.");
      setSelectedObjectiveIds(new Set());
      setSelectedKrIds(new Set());
      void loadObjectives();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    }
  };

  const handleBulkPublish = async () => {
    if (selectedObjectiveIds.size === 0 && selectedKrIds.size === 0) return;
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.employeeBulkPublish,
        body: {
          objective_ids: Array.from(selectedObjectiveIds).map(Number),
          kr_ids: Array.from(selectedKrIds).map(Number),
        },
        isSecureRoute: true,
      });
      ToastService.success("Successfully published selected.");
      setSelectedObjectiveIds(new Set());
      setSelectedKrIds(new Set());
      void loadObjectives();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    }
  };

  const goDetail = (id: string) => {
    navigate(
      routeConstants.okrEmployeeObjectiveDetail.replace(":objectiveId", id),
    );
  };

  const draftCards = cards.filter((c) => c.status === "draft");

  return (
    <EmployeeLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white -mx-4 md:-mx-8 px-4 md:px-8">
        <ExecutionShell
          breadcrumbs={[
            { label: "Dashboard", to: routeConstants.employeeDashboard },
            { label: "My execution" },
          ]}
          title="My Execution"
          subtitle="Track your assigned objectives and continue execution planning."
          icon={<MdFlag className="text-2xl" />}
          actions={
            <div className="flex flex-wrap gap-2 justify-end">
              {draftCards.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={MdSend}
                  onClick={handleSubmitAllDrafts}
                >
                  Submit Planning
                </Button>
              )}
              <RefreshButton
                onClick={() => {
                  void loadObjectives();
                  void loadAssignedKRs();
                }}
                loading={loading}
              />
              <Button
                variant="white"
                size="sm"
                icon={MdAdd}
                onClick={handleNewObjectiveClick}
                disabled={maxObjectives !== null && cards.length >= maxObjectives}
                title={maxObjectives !== null && cards.length >= maxObjectives ? `Maximum limit of ${maxObjectives} objectives reached` : ""}
              >
                {assignedKrs.length > 0 ? `New Objective (${assignedKrs.length})` : "New Objective"}
              </Button>
            </div>
          }
        >
          {/* MY OBJECTIVES SECTION */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h3 className="text-lg font-semibold text-k-dark-grey flex items-center gap-2">
              <MdFlag className="text-k-medium-grey" />
              My Objectives
            </h3>
            {draftCards.length > 0 && selectedObjectiveIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-k-medium-grey">
                  {selectedObjectiveIds.size} selected
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={MdSend}
                  onClick={handleBulkSubmit}
                >
                  Submit
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={MdPublish}
                  onClick={handleBulkPublish}
                >
                  Publish
                </Button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-4">
              <LoadingSkeleton variant="card" count={3} />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {cards.map((c) => (
                <ObjectiveCard
                  key={c.id}
                  id={`EO-${c.id}`}
                  title={c.title}
                  status={c.status}
                  progress={c.progress}
                  expandable={c.keyResults && c.keyResults.length > 0}
                  headerContext={
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-400 font-black tracking-[0.15em] font-space text-[9px]">Parent KR</strong>
                        <span className="font-bold font-jost text-xs text-slate-700 bg-slate-100/50 px-2 py-0.5 rounded border border-slate-200/50 line-clamp-1">{c.parentKr}</span>
                      </div>
                      {c.mode && (
                        <span className="rounded-lg bg-primary/5 px-2 py-0.5 text-[9px] font-black text-primary tracking-widest font-space border border-primary/10">
                          {c.mode === "direct_adoption"
                            ? "Direct Adoption"
                            : "Custom Adoption"}
                        </span>
                      )}
                    </div>
                  }
                  actions={
                    <div className="flex flex-wrap items-center gap-4 justify-end flex-1">
                      {c.status === "draft" && (
                        <label className="flex items-center gap-2.5 px-3 py-2 bg-white rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all group">
                          <input
                            type="checkbox"
                            checked={selectedObjectiveIds.has(c.id)}
                            onChange={() => toggleSelectCard(c.id, c.krId)}
                            className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-offset-0 focus:ring-primary/20 cursor-pointer shrink-0 accent-primary"
                          />
                          <span className="text-[10px] font-black text-slate-400 tracking-widest group-hover:text-primary transition-colors">Select For Publish</span>
                        </label>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        icon={MdChevronRight}
                        iconPosition="right"
                        className="shadow-lg shadow-primary/20"
                        onClick={(e) => { e.stopPropagation(); goDetail(c.id); }}
                      >
                        Execution Details
                      </Button>
                    </div>
                  }
                >
                  {c.keyResults && c.keyResults.length > 0 && (
                    <div className="flex flex-col gap-4 mt-2">
                      {c.keyResults.map((kr: any) => {
                        const krTgt = Number(kr.target_value ?? kr.targetValue ?? 0);
                        const krCur = Number(kr.current_value ?? kr.currentValue ?? kr.final_value ?? 0);
                        const krPct = krTgt > 0 ? Number(((krCur / krTgt) * 100).toFixed(2)) : 0;
                        return (
                          <KeyResultListItem
                            key={kr.id}
                            title={kr.title}
                            progress={krPct}
                            status={kr.status_code || "draft"}
                            targetString={`${kr.unit_of_measure === 'ETB' ? 'ETB ' : ''}${krCur} / ${krTgt}${kr.unit_of_measure === '%' ? '%' : ''}`}
                            metricTypeString={`Weight: ${Math.round(kr.weight_percent ?? 0)}%`}
                          />
                        );
                      })}
                    </div>
                  )}
                </ObjectiveCard>
              ))}
            </div>
          )}

          {!loading && cards.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/30 px-8 py-20 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-black/[0.03] border border-slate-100">
                <MdFlag className="text-4xl text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">
                No Active Objectives
              </h3>
              <p className="text-slate-400 text-sm max-w-sm mb-8 font-medium">
                Your execution dashboard is empty. Adopt an assigned Key Result to start planning your progress.
              </p>
              {assignedKrs.length > 0 ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="px-4 py-2 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs font-bold text-amber-700 tracking-widest font-space">
                      {assignedKrs.length} Assigned KRs Pending
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    icon={MdAdd}
                    className="shadow-xl shadow-primary/25 px-8"
                    onClick={handleNewObjectiveClick}
                    disabled={maxObjectives !== null && cards.length >= maxObjectives}
                  >
                    Adopt Key Result ({assignedKrs.length})
                  </Button>
                </div>
              ) : (
                <div className="text-slate-400 text-xs font-bold tracking-[0.2em] font-space flex items-center gap-2">
                  <MdWarningAmber className="text-lg" />
                  No Pending Assignments
                </div>
              )}
            </div>
          )}
        </ExecutionShell>

        <ExecutionSetupModal
          isOpen={setupOpen}
          onClose={() => setSetupOpen(false)}
          options={assignedKrs.map(akr => ({
            id: akr.contributor_id,
            title: akr.title,
            description: akr.description
          }))}
          selectedId={setupContributorId}
          onSelectId={handleSelectAdoptOption}
          mode={modeDraft}
          onChangeMode={setModeDraft}
          customTitle={setupCustomTitle}
          customDescription={setupCustomDescription}
          onChangeCustomTitle={setSetupCustomTitle}
          onChangeCustomDescription={setSetupCustomDescription}
          onConfirm={() => void handleAdopt()}
          saving={saveSetupBusy}
        />
      </div>
    </EmployeeLayout>
  );
}
