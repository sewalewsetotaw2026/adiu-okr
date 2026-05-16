import { useEffect, useState, useMemo } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import RefreshButton from "../../../../components/common/RefreshButton";
import Button from "../../../../components/Core/ui/Button";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectAuthUser } from "../../../../slice/authSlice/selectors";
import { routeConstants } from "../../../../../utils/constants";
import {
  MdChevronLeft,
  MdBusiness,
  MdWarning,
  MdTrendingUp,
} from "react-icons/md";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import { okrUnwrap, resolveConfidenceLevel } from "../../../../utils/okrApi";
import ToastService from "../../../../../utils/ToastService";
import DepartmentInsightsDashboard from "./components/DepartmentInsightsDashboard";
import ObjectiveCard from "../../../../components/common/ObjectiveCard";

type DepartmentData = {
  id: number;
  name: string;
};

type PlanningInsightData = {
  cycle_id: number;
  scope: string;
  totals: {
    members: number;
    objectives: number;
    krs: number;
    monthly_plans: number;
    weekly_plans: number;
    daily_plans: number;
    progress_updates: number;
  };
  highlights: {
    set_monthly_plan: Array<{ name: string }>;
    missing_monthly_plan: Array<{ name: string }>;
    set_weekly_plan: Array<{ name: string }>;
    missing_weekly_plan: Array<{ name: string }>;
    set_daily_plan: Array<{ name: string }>;
    missing_daily_plan: Array<{ name: string }>;
    updated_progress: Array<{ name: string }>;
    missing_progress_update: Array<{ name: string }>;
  };
  members: Array<{
    employee_user_id: string;
    employee_id: string;
    employee_name: string;
    department_id: number | null;
    department_name: string;
    objective_count: number;
    objective_status: {
      draft: number;
      submitted: number;
      approved: number;
      published: number;
    };
    kr_count: number;
    monthly_plan_count: number;
    weekly_plan_count: number;
    daily_plan_count: number;
    progress_update_count: number;
    has_set_monthly_plan: boolean;
    has_set_weekly_plan: boolean;
    has_set_daily_plan: boolean;
    has_updated_progress: boolean;
    last_progress_at: string | null;
  }>;
};

/**
 * Department OKR Planning Detail Page - Insights Dashboard
 * Shows comprehensive planning insights and employee contribution overview
 * instead of form-based KR creation
 */
export default function DepartmentDetail() {
  const { departmentId } = useParams<{ departmentId: string }>();
  const navigate = useNavigate();
  const authUser = useSelector(selectAuthUser);

  const [department, setDepartment] = useState<DepartmentData | null>(null);
  const [planningInsights, setPlanningInsights] =
    useState<PlanningInsightData | null>(null);
  const [departmentObjectives, setDepartmentObjectives] = useState<any[]>([]);
  const [currentCycle, setCurrentCycle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Calculate aggregate metrics from planning insights and objectives
  const metrics = useMemo(() => {
    const totalObjectives = departmentObjectives.length;
    const avgProgress =
      totalObjectives > 0
        ? Math.round(
          departmentObjectives.reduce(
            (acc, obj) => acc + Number(obj.final_score || 0),
            0,
          ) / totalObjectives,
        )
        : 0;

    const atRiskCount = departmentObjectives.filter(
      (obj) => resolveConfidenceLevel(Number(obj.final_score || 0)) === "AT_RISK",
    ).length;

    const onTrackCount = totalObjectives - atRiskCount;

    return {
      totalObjectives,
      totalKRs: departmentObjectives.reduce(
        (acc, obj) => acc + (obj._count?.keyResults || 0),
        0,
      ),
      totalEmployees: planningInsights?.totals?.members || 0,
      averageProgress: avgProgress,
      atRiskCount,
      onTrackCount,
      missingPlansCount:
        planningInsights?.highlights?.missing_monthly_plan?.length || 0,
      missingSetsCount:
        planningInsights?.highlights?.missing_monthly_plan?.length || 0,
      completedPlansCount:
        (planningInsights?.totals?.monthly_plans || 0) +
        (planningInsights?.totals?.weekly_plans || 0) +
        (planningInsights?.totals?.daily_plans || 0),
    };
  }, [planningInsights, departmentObjectives]);

  // Fetch department data and planning insights
  const fetchData = async () => {
    if (!departmentId || !authUser) return;

    try {
      setLoading(true);

      // Fetch current cycle if not already available
      let cycle = currentCycle;
      if (!cycle) {
        const cycleRes = await makeCall("GET", apiRoutes.okr.currentCycle);
        cycle = okrUnwrap(cycleRes);
        if (cycle) {
          setCurrentCycle(cycle);
        }
      }

      if (!cycle) {
        setLoading(false);
        return;
      }

      // Fetch department info
      const deptResponse = await makeCall(
        "GET",
        `${apiRoutes.departments}/${departmentId}`,
        undefined,
        undefined,
      );

      if (deptResponse?.data) {
        setDepartment(deptResponse.data);
      }

      // Fetch planning insights for this department
      try {
        const insightsResponse = await makeCall(
          "GET",
          apiRoutes.okr.planningInsights,
          undefined,
          {
            cycle_id: cycle.id,
            department_id: Number(departmentId),
            scope: "department",
          },
        );

        const insightsData = insightsResponse?.data?.data || insightsResponse?.data;
        if (insightsData) {
          setPlanningInsights(insightsData);
        }

        // Fetch department objectives (execution data)
        const objectivesResponse = await makeCall(
          "GET",
          apiRoutes.okr.departmentObjectives,
          undefined,
          {
            cycle_id: cycle.id,
            department_id: Number(departmentId),
          },
        );

        if (objectivesResponse?.data) {
          const rawObjectives = okrUnwrap(objectivesResponse);
          setDepartmentObjectives(Array.isArray(rawObjectives) ? rawObjectives : []);
        }
      } catch (insightsError) {
        console.error("Could not fetch planning insights:", insightsError);
      }
    } catch (error) {
      console.error("Failed to fetch department data:", error);
      ToastService.error("Failed to load department data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [departmentId, authUser]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8 pt-2">
          {loading ? (
            <div className="space-y-4 pt-8">
              <div className="h-20 bg-slate-200 rounded-2xl animate-pulse" />
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-32 bg-slate-100 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : !department ? (
            <div className="text-center py-24">
              <MdWarning className="mx-auto text-4xl text-amber-600 mb-4" />
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                Department Not Found
              </h2>
              <p className="text-slate-600 mb-6">
                The department you're looking for doesn't exist
              </p>
              <Button
                onClick={() => navigate(routeConstants.okrDepartmentPlanning)}
              >
                Back to Departments
              </Button>
            </div>
          ) : (
            <>
              {/* Breadcrumb & Header */}
              <div className="space-y-4">
                <nav className="flex flex-wrap items-center gap-2 text-sm pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(routeConstants.okrDepartmentPlanning)}
                    className="text-gray-500 hover:text-gray-800 transition-colors p-0 h-auto font-normal flex items-center gap-1"
                  >
                    <MdChevronLeft className="text-lg" />
                    Departments
                  </Button>
                  <span className="text-gray-300">/</span>
                  <span className="text-gray-800 font-medium text-xs uppercase tracking-widest font-space">
                    {department.name} Planning
                  </span>
                </nav>

                <PageHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/10 rounded-2xl ring-1 ring-white/20 shadow-inner">
                        <MdBusiness className="text-3xl text-white" />
                      </div>
                      <div className="text-white">
                        <h1 className="text-2xl font-black tracking-tighter capitalize">
                          {department.name}
                        </h1>
                        <p className="text-white/60 text-[10px] font-black uppercase tracking-widest font-space mt-1">
                          Planning Insights & Team Overview
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <RefreshButton onClick={handleRefresh} loading={refreshing} />
                    </div>
                  </div>
                </PageHeader>
              </div>

              {/* Insights Dashboard */}
              <div className="space-y-2 mb-4">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <MdTrendingUp className="text-primary" />
                  Department Overview
                </h2>
              </div>

              <DepartmentInsightsDashboard
                departmentName={department.name}
                metrics={metrics}
              />

              {/* Departmental Execution Section — Quarterly Plan OKRs */}
              {departmentObjectives.length > 0 && (
                <div className="mt-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <MdTrendingUp className="text-primary" />
                      Departmental Execution
                    </h2>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-space">
                      {departmentObjectives.length} Objective
                      {departmentObjectives.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {departmentObjectives.map((obj) => (
                      <ObjectiveCard
                        key={obj.id}
                        objective={{
                          id: obj.id,
                          title: obj.title,
                          description: obj.description,
                          status: obj.status_code || "draft",
                          progress: Number(obj.final_score || 0),
                          indirectProgress: Number(obj.indirect_score || 0),
                          krCount: obj._count?.keyResults || 0,
                        }}
                        keyResults={obj.keyResults}
                        expandable={true}
                        parentKrTitle={obj.parentCompanyKr?.title}
                        variant="admin"
                        confidenceLevel={resolveConfidenceLevel(
                          Number(obj.final_score || 0),
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}