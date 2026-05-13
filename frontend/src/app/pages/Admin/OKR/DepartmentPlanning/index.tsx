import { useEffect, useState, useMemo } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import RefreshButton from "../../../../components/common/RefreshButton";
import { useNavigate } from "react-router-dom";
import { routeConstants } from "../../../../../utils/constants";
import Button from "../../../../components/Core/ui/Button";
import {
  MdAccountTree,
  MdChevronRight,
  MdOutlineCorporateFare,
} from "react-icons/md";
import { useDispatch, useSelector } from "react-redux";
import { useDepartments } from "../../Departments/slice";
import {
  selectDepartments,
  selectDepartmentsLoading,
} from "../../Departments/slice/selectors";
import DepartmentSummaryCard from "./components/DepartmentSummaryCard";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import { useSelector as useAppSelector } from "react-redux";
import { selectAuthUser } from "../../../../slice/authSlice/selectors";
import ToastService from "../../../../../utils/ToastService";

/**
 * Hub at /admin/okr/departments — pick a department for execution planning
 * Shows department cards with summary metrics (objectives, KRs, progress %)
 */
export default function DepartmentPlanningList() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { actions } = useDepartments();
  const authUser = useAppSelector(selectAuthUser);

  const departments = useSelector(selectDepartments);
  const departmentsLoading = useSelector(selectDepartmentsLoading);

  const [searchTerm, setSearchTerm] = useState("");
  const [departmentMetrics, setDepartmentMetrics] = useState<
    Map<
      number,
      {
        objectiveCount: number;
        krCount: number;
        progressPercent: number;
        employeeCount: number;
        atRiskCount: number;
      }
    >
  >(new Map());
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => {
    dispatch(actions.fetchDepartmentsStart({ page: 1, limit: 100 }));
  }, [dispatch, actions]);

  // Fetch planning insights for all departments
  useEffect(() => {
    const fetchDepartmentInsights = async () => {
      if (!authUser || departments.length === 0) return;

      setLoadingMetrics(true);
      try {
        // 1. Fetch current cycle first
        const cycleResponse = await makeCall("GET", apiRoutes.okr.currentCycle);
        const cycle = cycleResponse?.data?.data || cycleResponse?.data;
        const cycleId = cycle?.id;

        if (!cycleId) {
          setLoadingMetrics(false);
          return;
        }

        // 2. Fetch planning insights with cycle_id
        const response = await makeCall(
          "GET",
          apiRoutes.okr.dashboardDepartmentsCompare,
          undefined,
          { cycle_id: cycleId },
        );

        const data = response?.data?.data || response?.data;
        if (data?.departments) {
          const metricsMap = new Map();

          for (const dept of data.departments) {
            // Use the consistent field names from backend
            metricsMap.set(Number(dept.id), {
              objectiveCount: Number(dept.objectiveCount || 0),
              krCount: Number(dept.krCount || 0),
              progressPercent: Number(dept.progressPercent || 0),
              employeeCount: Number(dept.employeeCount || 0),
              atRiskCount: Number(dept.atRiskCount || 0),
            });
          }

          setDepartmentMetrics(metricsMap);
        }
      } catch (error) {
        console.error("Failed to fetch department metrics:", error);
        // Silently fail - departments will still load with default metrics
      } finally {
        setLoadingMetrics(false);
      }
    };

    fetchDepartmentInsights();
  }, [authUser, departments.length]);


  const goToDepartment = (id: number) => {
    navigate(
      routeConstants.okrDepartmentDetail.replace(":departmentId", String(id)),
    );
  };

  const loading = departmentsLoading;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8 pt-2">
          <nav className="flex flex-wrap items-center gap-2 text-sm pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(routeConstants.okr)}
              className="text-gray-500 hover:text-gray-800 transition-colors p-0 h-auto font-normal"
            >
              OKR
            </Button>
            <MdChevronRight className="text-gray-300 shrink-0" />
            <span className="text-gray-800 font-medium text-xs uppercase tracking-widest font-space">
              Department Execution
            </span>
          </nav>

          <PageHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl ring-1 ring-white/20 shadow-inner">
                  <MdAccountTree className="text-3xl text-white" />
                </div>
                <div className="text-white">
                  <h1 className="text-2xl font-black tracking-tighter capitalize">
                    Departmental Execution
                  </h1>
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-widest font-space mt-1">
                    Direct mapping from company strategy to tactical operations
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <RefreshButton
                  onClick={() => {
                    dispatch(
                      actions.fetchDepartmentsStart({ page: 1, limit: 100 }),
                    );
                  }}
                  loading={loading}
                />
              </div>
            </div>
          </PageHeader>

          {/* Search Bar */}
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MdOutlineCorporateFare className="text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search departments..."
              className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-2xl bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary sm:text-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-32 rounded-[2rem] bg-white animate-pulse border border-slate-100 shadow-sm"
                />
              ))}
            </div>
          ) : departments.length === 0 ? (
            <div className="col-span-full rounded-[3rem] border border-dashed border-slate-200 bg-white/50 p-20 text-center">
              <div className="mx-auto w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-6">
                <MdAccountTree className="text-4xl text-slate-300" />
              </div>
              <h3 className="text-slate-900 font-black tracking-widest text-sm font-space mb-2 capitalize">
                No Departments Found
              </h3>
              <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">
                Your organization structure is empty. Add departments to begin
                execution planning.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {departments
                .filter((d: any) =>
                  d.name.toLowerCase().includes(searchTerm.toLowerCase()),
                )
                .map((d: any) => {
                  const metrics = departmentMetrics.get(d.id) || {
                    objectiveCount: 0,
                    krCount: 0,
                    progressPercent: 0,
                    employeeCount: 0,
                    atRiskCount: 0,
                  };

                  return (
                    <DepartmentSummaryCard
                      key={d.id}
                      id={d.id}
                      name={d.name}
                      objectiveCount={metrics.objectiveCount}
                      krCount={metrics.krCount}
                      progressPercent={metrics.progressPercent}
                      employeeCount={metrics.employeeCount}
                      atRiskCount={metrics.atRiskCount}
                      onNavigate={goToDepartment}
                    />
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
