import { useEffect, useState } from "react";
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
  MdInfoOutline,
  MdWarning,
  MdTrendingUp,
} from "react-icons/md";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import { okrUnwrap } from "../../../../utils/okrApi";
import ToastService from "../../../../../utils/ToastService";
import DepartmentInsightsDashboard from "./components/DepartmentInsightsDashboard";
import EmployeeContributionTable from "./components/EmployeeContributionTable";

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
  const [currentCycle, setCurrentCycle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
          `${apiRoutes.okr.dashboardCeo || apiRoutes.okr.cycles}/../manager/planning-insights`,
          undefined,
          {
            cycle_id: cycle.id,
            department_id: Number(departmentId),
            scope: "department",
          }
        );

        if (insightsResponse?.data) {
          setPlanningInsights(insightsResponse.data);
        }
      } catch (insightsError) {
        // If the specific endpoint doesn't exist, use alternative approach
        console.warn(
          "Could not fetch planning insights with POST, trying alternative",
        );
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

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="space-y-4">
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
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!department) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="text-center py-12">
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
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Calculate aggregate metrics from planning insights
  const metrics = planningInsights
    ? {
        totalObjectives: planningInsights.totals?.objectives || 0,
        totalKRs: planningInsights.totals?.krs || 0,
        totalEmployees: planningInsights.totals?.members || 0,
        averageProgress:
          (planningInsights.totals?.krs || 0) > 0
            ? Math.round(
                (((planningInsights.highlights?.set_monthly_plan?.length || 0) /
                  Math.max(planningInsights.totals?.members || 1, 1)) *
                  100) as unknown as number,
              )
            : 0,
        atRiskCount:
          planningInsights.highlights?.missing_progress_update?.length || 0,
        onTrackCount: planningInsights.highlights?.updated_progress?.length || 0,
        missingPlansCount:
          planningInsights.highlights?.missing_monthly_plan?.length || 0,
        missingSetsCount:
          planningInsights.highlights?.missing_monthly_plan?.length || 0,
        completedPlansCount:
          (planningInsights.totals?.monthly_plans || 0) +
          (planningInsights.totals?.weekly_plans || 0) +
          (planningInsights.totals?.daily_plans || 0),
      }
    : {
        totalObjectives: 0,
        totalKRs: 0,
        totalEmployees: 0,
        averageProgress: 0,
        atRiskCount: 0,
        onTrackCount: 0,
        missingPlansCount: 0,
        missingSetsCount: 0,
        completedPlansCount: 0,
      };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8 pt-2">
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
            loading={loading}
          />

          {/* Employee Contribution Roster */}
          <div className="mt-12 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <MdInfoOutline className="text-primary" />
                Team Member Progress & Contribution
              </h2>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {planningInsights?.members.length || 0} members
              </span>
            </div>

            <EmployeeContributionTable
              employees={
                planningInsights?.members.map((member) => ({
                  employeeId: member.employee_id,
                  employeeName: member.employee_name,
                  profilePictureUrl: undefined, // Can be added from employee data if available
                  objectiveCount: member.objective_count,
                  krCount: member.kr_count,
                  monthlyPlansCount: member.monthly_plan_count,
                  weeklyPlansCount: member.weekly_plan_count,
                  dailyPlansCount: member.daily_plan_count,
                  progressUpdateCount: member.progress_update_count,
                  hasSetMonthlyPlan: member.has_set_monthly_plan,
                  hasSetWeeklyPlan: member.has_set_weekly_plan,
                  hasSetDailyPlan: member.has_set_daily_plan,
                  hasUpdatedProgress: member.has_updated_progress,
                  lastProgressAt: member.last_progress_at,
                  objectiveStatus: member.objective_status,
                })) || []
              }
              loading={loading}
            />
          </div>

          {/* Call to Action */}
          <div className="mt-12 rounded-xl bg-gradient-to-r from-primary/10 to-blue-50 border border-primary/20 p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-lg shrink-0">
                <MdTrendingUp className="text-2xl text-primary" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 mb-2">
                  Next Steps
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Use this insights dashboard to monitor your department's
                  planning progress. Click on individual team members to view
                  their detailed OKR execution or navigate back to the executive
                  dashboard for company-wide visibility.
                </p>
                <div className="flex gap-3 flex-wrap">
                  <Button
                    onClick={() => navigate(routeConstants.okr)}
                    variant="outline"
                    size="sm"
                  >
                    Go to OKR Dashboard
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
