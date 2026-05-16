import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import RefreshButton from "../../../../components/common/RefreshButton";
import { okrFeatureFlags } from "../okrFeatureFlags";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import {
  okrAsArray,
  okrErrorMessage,
  okrUnwrap,
  resolveConfidenceLevel,
} from "../../../../utils/okrApi";
import ToastService from "../../../../../utils/ToastService";

import {
  MdOutlineFlag,
  MdBusiness,
  MdExpandMore,
  MdExpandLess,
  MdWarningAmber,
} from "react-icons/md";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";
import ConfidenceBadge from "../../../../components/common/ConfidenceBadge";
import PageHeader from "../../../../components/common/PageHeader";

type GalleryObjective = {
  id: number;
  title: string;
  description: string;
  status: string;
  progress: number;
  keyResults: Array<{
    id: number;
    title: string;
    target: string | null;
    unit: string | null;
    status: string;
    progress: number;
    metricName?: string | null;
    metricCategory?: string | null;
    isFinancial?: boolean | null;
    departmentObjectives: Array<{
      id: number;
      title: string;
      status: string;
      departmentId: number;
      progress: number;
    }>;
  }>;
};

type DepartmentStat = {
  id: number;
  departmentId: number;
  departmentName: string;
  objectiveCount: number;
  krCount: number;
  avgScore: number;
  employeeCount: number;
  atRiskCount: number;
};

// Top-level Summary Card for Company Objectives
function CompanyObjectiveSummaryCard({
  title,
  progress,
}: {
  title: string;
  progress: number;
}) {
  const conf = resolveConfidenceLevel(progress);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-bold text-slate-800 line-clamp-2 pr-4">{title}</h3>
        <ConfidenceBadge level={conf} />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="text-slate-500">Progress</span>
          <span className="text-slate-800">{progress}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              conf === "ON_TRACK"
                ? "bg-emerald-500"
                : conf === "AT_RISK"
                  ? "bg-amber-500"
                  : "bg-rose-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function DepartmentAccordion({
  dept,
  deptObjectives,
}: {
  dept: DepartmentStat;
  deptObjectives: Array<{ id: number; title: string; progress: number }>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all shadow-sm mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 bg-slate-50/50 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
            {dept.avgScore}%
          </div>
          <div className="text-left">
            <h4 className="text-xl font-bold text-slate-800">{dept.departmentName}</h4>
            <p className="text-sm text-slate-500 font-medium">
              {dept.employeeCount} Employees • {deptObjectives.length} Objectives
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          {dept.atRiskCount > 0 && (
            <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <MdWarningAmber className="text-sm" />
              {dept.atRiskCount} At Risk
            </span>
          )}
          {open ? <MdExpandLess className="text-2xl" /> : <MdExpandMore className="text-2xl" />}
        </div>
      </button>

      {open && (
        <div className="p-6 border-t border-slate-100 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deptObjectives.length === 0 ? (
            <div className="col-span-full py-8 text-center text-slate-400 text-sm">
              No objectives mapped to this department yet.
            </div>
          ) : (
            deptObjectives.map((obj) => (
              <div
                key={obj.id}
                className="p-5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-sm transition-all flex flex-col justify-between gap-4"
              >
                <div className="flex justify-between items-start gap-2">
                  <h5 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">
                    {obj.title}
                  </h5>
                  <ConfidenceBadge level={resolveConfidenceLevel(obj.progress)} className="shrink-0" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        resolveConfidenceLevel(obj.progress) === "ON_TRACK"
                          ? "bg-emerald-500"
                          : resolveConfidenceLevel(obj.progress) === "AT_RISK"
                            ? "bg-amber-500"
                            : "bg-rose-500"
                      }`}
                      style={{ width: `${obj.progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-600 w-8 text-right">
                    {obj.progress}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function CompanyOKRGalleryPage() {
  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<GalleryObjective[]>([]);
  const [departments, setDepartments] = useState<DepartmentStat[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });
      const cycle = okrUnwrap<any>(cycleRes);
      const cid = cycle?.id != null ? Number(cycle.id) : null;
      if (!cid) {
        setObjectives([]);
        setDepartments([]);
        return;
      }
      
      // Fetch both endpoints concurrently
      const [galleryRes, deptRes] = await Promise.all([
        makeCall({
          method: "GET",
          route: apiRoutes.okr.dashboardCompanyGallery,
          query: { cycle_id: cid },
          isSecureRoute: true,
        }),
        makeCall({
          method: "GET",
          route: apiRoutes.okr.dashboardDepartmentsCompare,
          query: { cycle_id: cid },
          isSecureRoute: true,
        })
      ]);

      const body = okrUnwrap<any>(galleryRes) ?? {};
      const objs = okrAsArray<any>(body.objectives ?? []);
      setObjectives(
        objs.map((o) => ({
          id: Number(o.id),
          title: String(o.title ?? "Objective"),
          description: String(o.description ?? ""),
          status: String(o.status ?? o.status_code ?? "draft").toLowerCase(),
          progress: Number(
            o.score ?? o.progress ?? o.final_score ?? o.progress_percent ?? 0,
          ),
          keyResults: okrAsArray<any>(o.keyResults ?? []).map((k) => ({
            id: Number(k.id),
            title: String(k.title ?? "KR"),
            target: k.target != null ? String(k.target) : null,
            unit: k.unit != null ? String(k.unit) : null,
            metricName: k.metricName ?? null,
            metricCategory: k.metricCategory ?? null,
            isFinancial: Boolean(k.isFinancial),
            progress: Number(
              k.score ?? k.progress ?? k.final_score ?? k.progress_percent ?? 0,
            ),
            status: String(k.status ?? k.status_code ?? "draft").toLowerCase(),
            departmentObjectives: okrAsArray<any>(
              k.departmentObjectives ?? k.employeeObjectives ?? [],
            ).map((d) => ({
              id: Number(d.id),
              title: String(d.title ?? "Department objective"),
              status: String(d.status ?? d.status_code ?? "draft"),
              departmentId: Number(d.departmentId ?? d.department_id),
              progress: Number(d.score ?? d.final_score ?? d.progress ?? 0),
            })),
          })),
        })),
      );

      const deptBody = okrUnwrap<any>(deptRes) ?? {};
      const depts = okrAsArray<any>(deptBody.departments ?? []);
      setDepartments(
        depts.map((d) => ({
          id: Number(d.id),
          departmentId: Number(d.departmentId),
          departmentName: String(d.departmentName ?? "Unknown"),
          objectiveCount: Number(d.objectiveCount ?? 0),
          krCount: Number(d.krCount ?? 0),
          avgScore: Number(d.avgScore ?? 0),
          employeeCount: Number(d.employeeCount ?? 0),
          atRiskCount: Number(d.atRiskCount ?? 0),
        }))
      );

    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setObjectives([]);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (okrFeatureFlags.gallery) void load();
  }, [load]);

  // Map all department objectives from the gallery payload to their respective departments
  const departmentObjectivesMap = useMemo(() => {
    const map = new Map<number, Array<{ id: number; title: string; progress: number }>>();
    
    // Initialize map for all known departments
    for (const d of departments) {
      map.set(d.departmentId, []);
    }

    // Collect all department objectives
    objectives.forEach(obj => {
      obj.keyResults.forEach(kr => {
        kr.departmentObjectives.forEach(dObj => {
          if (!map.has(dObj.departmentId)) {
            map.set(dObj.departmentId, []);
          }
          // Avoid duplicates (since multiple KRs might reference the same dept objective if mapping is complex, though usually 1:1)
          const list = map.get(dObj.departmentId)!;
          if (!list.find(x => x.id === dObj.id)) {
            list.push({
              id: dObj.id,
              title: dObj.title,
              progress: dObj.progress,
            });
          }
        });
      });
    });

    return map;
  }, [objectives, departments]);

  // Aggregate stats for the bottom panel
  const stats = useMemo(() => {
    const totalKRs = objectives.reduce((a, o) => a + o.keyResults.length, 0);
    const avgProgress =
      objectives.length > 0
        ? Math.round(
            objectives.reduce((a, o) => a + o.progress, 0) / objectives.length,
          )
        : 0;
    const onTrack = objectives.filter(
      (o) => resolveConfidenceLevel(o.progress) === "ON_TRACK",
    ).length;
    return { totalKRs, avgProgress, onTrack };
  }, [objectives]);

  if (!okrFeatureFlags.gallery) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-slate-50 p-8 text-center text-gray-500 text-sm">
          Gallery disabled (feature flag).
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8 pt-2">
          
          {/* ── Page Header ─────────────────────────────────────────── */}
          <PageHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
              <div className="max-w-2xl text-white">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-white/80 mb-4 ring-1 ring-white/20">
                  <MdOutlineFlag className="text-sm" />
                  Company Overview
                </div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
                  Company OKR Gallery
                </h1>
                <p className="text-white/80 text-base md:text-lg font-medium">
                  See how we're tracking our goals across every department.
                </p>
              </div>
              <div className="shrink-0">
                <RefreshButton onClick={load} loading={loading} />
              </div>
            </div>
          </PageHeader>

          {/* ── Bottom Metric Panel ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-wrap gap-4 md:gap-8 justify-around items-center mb-8">
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black text-slate-800">{objectives.length}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Objectives</span>
            </div>
            <div className="w-px h-10 bg-slate-100 hidden md:block" />
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black text-slate-800">{stats.totalKRs}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Key Results</span>
            </div>
            <div className="w-px h-10 bg-slate-100 hidden md:block" />
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black text-primary">{stats.avgProgress}%</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Avg Progress</span>
            </div>
            <div className="w-px h-10 bg-slate-100 hidden md:block" />
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black text-emerald-500">{stats.onTrack}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">On Track</span>
            </div>
          </div>
          
          {/* ── Company Objectives Section ──────────────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <MdOutlineFlag className="text-primary" />
              Company Objectives
            </h2>
            
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <LoadingSkeleton variant="card" count={3} />
              </div>
            ) : objectives.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
                No company objectives available for this cycle.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {objectives.map((o) => (
                  <CompanyObjectiveSummaryCard key={o.id} title={o.title} progress={o.progress} />
                ))}
              </div>
            )}
          </section>

          {/* ── Departmental Breakdown Section ──────────────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <MdBusiness className="text-primary" />
              Departmental Breakdown
            </h2>
            
            {loading ? (
              <div className="flex flex-col gap-4">
                <LoadingSkeleton variant="card" count={2} />
              </div>
            ) : departments.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
                No department data available.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {departments.map((dept) => (
                  <DepartmentAccordion 
                    key={dept.id} 
                    dept={dept} 
                    deptObjectives={departmentObjectivesMap.get(dept.departmentId) || []} 
                  />
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </AdminLayout>
  );
}
