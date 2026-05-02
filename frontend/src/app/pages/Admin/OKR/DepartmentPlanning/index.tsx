import { useEffect } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import RefreshButton from "../../../../components/common/RefreshButton";
import { useNavigate } from "react-router-dom";
import { routeConstants } from "../../../../../utils/constants";
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

/**
 * Hub at /admin/okr/departments — pick a department for execution planning
 * (monthly → weekly → daily), built on department objectives from company KRs.
 */
export default function DepartmentPlanningList() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { actions } = useDepartments();

  const departments = useSelector(selectDepartments);
  const loading = useSelector(selectDepartmentsLoading);

  useEffect(() => {
    dispatch(actions.fetchDepartmentsStart({ page: 1, limit: 100 }));
  }, [dispatch, actions]);

  const goToDepartment = (id: number) => {
    navigate(
      routeConstants.okrDepartmentDetail.replace(":departmentId", String(id)),
    );
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8 pt-2">
          <nav className="flex flex-wrap items-center gap-2 text-sm pt-4">
            <button
              type="button"
              onClick={() => navigate(routeConstants.okr)}
              className="text-gray-500 hover:text-gray-800"
            >
              OKR
            </button>
            <MdChevronRight className="text-gray-300 shrink-0" />
            <span className="text-gray-800 font-medium">
              Department Execution
            </span>
          </nav>

          <PageHeader>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl ring-1 ring-white/20 shadow-inner">
                    <MdAccountTree className="text-3xl text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black tracking-tighter text-white">
                      Departmental Execution
                    </h1>
                    <p className="text-white/60 text-xs font-medium mt-1">
                      Link strategy to execution. Map company key results to
                      monthly deliverables and daily plans.
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
            </div>
          </PageHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              [1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-40 rounded-2xl bg-white animate-pulse ring-1 ring-slate-100 shadow-sm"
                />
              ))
            ) : !departments?.length ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white/50 p-12 text-center">
                <MdAccountTree className="mx-auto text-4xl text-slate-300 mb-3" />
                <p className="text-slate-600 font-black uppercase tracking-widest text-xs font-space">
                  No Departments Found
                </p>
              </div>
            ) : (
              departments.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => goToDepartment(d.id)}
                  className="group relative flex flex-col text-left rounded-2xl bg-white p-6 shadow-xl shadow-slate-200/40 ring-1 ring-slate-100 transition-all hover:shadow-2xl hover:shadow-slate-300/50 hover:ring-primary/20"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2.5 bg-slate-50 rounded-xl ring-1 ring-slate-100 group-hover:bg-primary/5 group-hover:ring-primary/10 transition-colors">
                      <MdOutlineCorporateFare className="text-xl text-slate-400 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex flex-col items-end">
                      {/*<span className="text-[10px] font-black uppercase tracking-widest text-slate-300 font-space group-hover:text-primary/40">
                        DEPT ID
                      </span>*/}
                      {/*<span className="text-xs font-black text-slate-900 font-space">
                        #{d.department_code || d.id}
                      </span>*/}
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 tracking-tight mb-1 group-hover:text-primary transition-colors line-clamp-1">
                    {d.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium line-clamp-2 min-h-[2rem]">
                    Active department participating in organizational strategy
                    and execution planning.
                  </p>

                  <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary font-space opacity-0 group-hover:opacity-100 transition-opacity">
                      Configure Execution
                    </span>
                    <MdChevronRight className="text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
