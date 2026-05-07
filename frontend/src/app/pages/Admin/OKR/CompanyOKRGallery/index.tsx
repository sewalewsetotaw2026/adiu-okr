import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import RefreshButton from "../../../../components/common/RefreshButton";
import { okrFeatureFlags } from "../okrFeatureFlags";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import { okrAsArray, okrErrorMessage, okrUnwrap } from "../../../../utils/okrApi";
import ToastService from "../../../../../utils/ToastService";
import { useNavigate } from "react-router-dom";
import { routeConstants } from "../../../../../utils/constants";
import { MdChevronRight, MdSearch, MdFilterList, MdWarningAmber } from "react-icons/md";
import Button from "../../../../components/Core/ui/Button";
import ObjectiveCard from "../../../../components/common/ObjectiveCard";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";

type GalleryObjective = {
  id: number;
  title: string;
  description: string;
  status: string;
  keyResults: Array<{
    id: number;
    title: string;
    target: string | null;
    unit: string | null;
    metricName?: string | null;
    metricCategory?: string | null;
    isFinancial?: boolean | null;
    departmentObjectives: Array<{
      id: number;
      title: string;
      status: string;
      departmentId: number;
    }>;
  }>;
};

export default function CompanyOKRGalleryPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "published" | "closed">(
    "all",
  );
  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<GalleryObjective[]>([]);

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
        return;
      }
      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.dashboardCompanyGallery,
        query: { cycle_id: cid },
        isSecureRoute: true,
      });
      const body = okrUnwrap<any>(res) ?? {};
      const objs = okrAsArray<any>(body.objectives ?? []);
      setObjectives(
        objs.map((o) => ({
          id: Number(o.id),
          title: String(o.title ?? "Objective"),
          description: String(o.description ?? ""),
          status: String(o.status ?? o.status_code ?? "draft").toLowerCase(),
          keyResults: okrAsArray<any>(o.keyResults ?? []).map((k) => ({
            id: Number(k.id),
            title: String(k.title ?? "KR"),
            target: k.target != null ? String(k.target) : null,
            unit: k.unit != null ? String(k.unit) : null,
            metricName: k.metricName ?? null,
            metricCategory: k.metricCategory ?? null,
            isFinancial: Boolean(k.isFinancial),
            departmentObjectives: okrAsArray<any>(k.departmentObjectives ?? []).map(
              (d) => ({
                id: Number(d.id),
                title: String(d.title ?? "Department objective"),
                status: String(d.status ?? d.status_code ?? "draft"),
                departmentId: Number(d.departmentId),
              }),
            ),
          })),
        })),
      );
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setObjectives([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (okrFeatureFlags.gallery) void load();
  }, [load]);

  const filtered = useMemo(() => {
    return objectives.filter((o) => {
      const m =
        !q ||
        o.title.toLowerCase().includes(q.toLowerCase()) ||
        o.keyResults.some((k) => k.title.toLowerCase().includes(q.toLowerCase()));
      const s = status === "all" || o.status === status;
      return m && s;
    });
  }, [objectives, q, status]);

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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-2 space-y-6">
          <nav className="flex flex-wrap items-center gap-2 text-sm pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(routeConstants.okr)}
              className="text-gray-500 hover:text-gray-800 transition-colors p-0 h-auto font-normal"
            >
              OKR
            </Button>
            <MdChevronRight className="text-gray-300 shrink-0 text-lg" />
            <span className="text-gray-800 font-medium">Gallery</span>
          </nav>

          <PageHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight capitalize">
                  OKR gallery
                </h1>
                <p className="text-white/80 text-sm mt-1">Current cycle.</p>
              </div>
              <div className="flex items-center gap-2">
                <RefreshButton onClick={load} loading={loading} />
              </div>
            </div>
          </PageHeader>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search objectives, key results..."
                className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <MdFilterList className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as any)
                  }
                  className="appearance-none rounded-xl border border-slate-200 pl-9 pr-8 py-2.5 text-sm bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="closed">Closed</option>
                </select>
                <MdChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-4">
              <LoadingSkeleton variant="card" count={3} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/30 px-8 py-20 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                <MdWarningAmber className="text-3xl text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1 capitalize">No matches found</h3>
              <p className="text-sm text-slate-400">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {filtered.map((o) => (
                <ObjectiveCard
                  key={o.id}
                  id={`CO-${o.id}`}
                  title={o.title}
                  status={o.status}
                  progress={0} // Gallery might need explicit progress if API adds it
                  krsCount={o.keyResults.length}
                  expandable={o.keyResults.length > 0}
                  headerContext={o.description ? <p className="line-clamp-2">{o.description}</p> : undefined}
                >
                  <div className="space-y-3 pt-2">
                    {o.keyResults.map((k) => (
                      <div
                        key={k.id}
                        className="group p-4 rounded-xl bg-white border border-slate-100 hover:border-primary/20 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800 group-hover:text-primary transition-colors">
                              {k.title}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-space">
                              <span>Target: {k.target ?? "—"} {k.unit ?? ""}</span>
                              <span className="text-slate-200">|</span>
                              <span>{k.departmentObjectives.length} Linked Departments</span>
                            </div>
                          </div>
                          {k.isFinancial && (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-tighter">Financial</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ObjectiveCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
