import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiSearch,
  FiCheckCircle,
  FiFilter,
  FiUsers,
  FiPlus,
  FiX,
  FiChevronLeft,
} from "react-icons/fi";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import { useBuildTeamSlice } from "./slice";
import {
  selectEmployees,
  selectFilters,
  selectLoading,
  selectPagination,
  selectSelectedManager,
  selectSelectedSubordinateIds,
  selectAssignSuccess,
  selectExistingTeam,
} from "./slice/selectors";
import FormAutocomplete from "../../../../components/Core/ui/FormAutocomplete";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";
import ToastService from "../../../../../utils/ToastService";
import { managerListActions } from "../slice";
import ChangeManagerModal from "../../../../components/common/ChangeManagerModal";

export default function BuildTeamPage() {
  const { actions } = useBuildTeamSlice();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { managerId } = useParams<{ managerId: string }>();

  const employees = useSelector(selectEmployees);
  const loading = useSelector(selectLoading);
  const pagination = useSelector(selectPagination);
  const filters = useSelector(selectFilters);
  const selectedManager = useSelector(selectSelectedManager);

  const selectedIds = useSelector(selectSelectedSubordinateIds);
  const assignSuccess = useSelector(selectAssignSuccess);

  const { department, job_title, search } = filters;
  const { page, totalPages } = pagination;

  const [showMobileSquad, setShowMobileSquad] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (managerId) {
      dispatch(actions.fetchManagerRequest(managerId));
    }
  }, [dispatch, actions, managerId]);

  useEffect(() => {
    // Only fetch if manager is loaded to allow exclusion logic
    if (selectedManager) {
      dispatch(actions.fetchSubordinatesRequest());
    }
  }, [dispatch, actions, page, department, job_title, search, selectedManager]);

  useEffect(() => {
    if (assignSuccess) {
      ToastService.success("Successfully updated team composition");
      dispatch(actions.resetAssignSuccess());
      dispatch(managerListActions.refresh());
      navigate("/admin/managers");
    }
  }, [assignSuccess, dispatch, actions, navigate]);

  const error = useSelector((state: any) => state.buildTeam?.error);

  useEffect(() => {
    if (error) {
      ToastService.error(error);
    }
  }, [error]);

  // Cleanup state on unmount
  useEffect(() => {
    return () => {
      dispatch(actions.resetState());
    };
  }, [dispatch, actions]);

  const handleAssign = () => {
    console.log("handleAssign triggered", { managerId, selectedIds });
    if (managerId) {
      dispatch(
        actions.assignTeamRequest({ managerId, employeeIds: selectedIds }),
      );
    } else {
      console.error("Manager ID is missing");
      ToastService.error("Manager ID is missing");
    }
  };

  const toggleSelection = (id: string) => {
    dispatch(actions.toggleSubordinateSelection(id));
  };

  const handleModalSuccess = () => {
    if (managerId) {
      dispatch(actions.fetchManagerRequest(managerId));
      navigate("/admin/managers");
    }
  };

  const existingTeam = useSelector(selectExistingTeam);

  // Combine loaded employees and existing team members to ensure we have details for all selected IDs
  // We prioritize 'employees' (current page) but fall back to 'existingTeam' if not found
  const allAvailableEmployees = [...employees];
  if (existingTeam) {
    existingTeam.forEach((member: any) => {
      if (!allAvailableEmployees.find((e) => e.id === member.id)) {
        allAvailableEmployees.push(member);
      }
    });
  }
  console.log("the employee info in managers", allAvailableEmployees);

  const selectedEmployees = allAvailableEmployees.filter((e) =>
    selectedIds.includes(e.id),
  );

  // If loading manager initially
  if (!selectedManager && loading) {
    return (
      <AdminLayout>
        <LoadingSkeleton variant="rectangular" height="100vh" width="100%" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Helmet>
        <title>Build Team</title>
      </Helmet>

      <div className="min-h-[calc(100vh-80px)] bg-gray-50 flex flex-col">
        {/* PROGRESS HEADER */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/admin/managers")}
                className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors font-medium text-sm group"
              >
                <FiChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Back to Managers
              </button>
              <div className="w-px h-6 bg-gray-200"></div>
              <span className="text-xl font-black text-gray-900 tracking-tight">
                Team<span className="text-primary-dark">Builder</span>
              </span>
            </div>

            {/* VISUAL STEPS CHAIN - Simplified for this view, maybe just show Step 2 active */}
            <div className="flex items-center">
              {/* Step 1 - Completed */}
              <div className="relative flex items-center text-primary">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 bg-white border-primary z-10">
                  <FiCheckCircle className="w-4 h-4" />
                </div>
                <span className="ml-3 text-sm font-bold text-gray-900 hidden sm:block">
                  Select Leader
                </span>
              </div>

              {/* Connector */}
              <div className="w-8 sm:w-16 h-0.5 mx-2 sm:mx-4 bg-primary"></div>

              {/* Step 2 - Active */}
              <div className="relative flex items-center text-primary">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 bg-white border-primary z-10">
                  2
                </div>
                <span className="ml-3 text-sm font-bold text-gray-900 hidden sm:block">
                  Draft Team
                </span>
              </div>
            </div>

            <div className="w-24 text-right">
              <button
                onClick={() => navigate("/admin/managers")}
                className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors"
              >
                Cancel Process
              </button>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT - Adapted layout */}
        <div className="flex-1 overflow-hidden relative max-w-7xl mx-auto w-full p-4 md:p-6">
          <div className="flex flex-col md:flex-row h-[calc(100vh-180px)] gap-6">
            {/* LEFT PANEL: TALENT POOL */}
            <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-full">
              {/* FILTER HEADER */}
              <div className="p-5 border-b border-gray-100 bg-white z-10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                      Talent Pool
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">
                      Select employees to join{" "}
                      {selectedManager?.full_name
                        ? `${selectedManager.full_name.split(" ")[0]}'s`
                        : "the"}{" "}
                      team
                    </p>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                    <button
                      onClick={() => dispatch(actions.setPage(page - 1))}
                      disabled={page === 1}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 text-gray-600 transition-all"
                    >
                      &lt;
                    </button>
                    <span className="text-xs font-bold text-gray-600 px-2 min-w-10 text-center">
                      {page}/{totalPages}
                    </span>
                    <button
                      onClick={() => dispatch(actions.setPage(page + 1))}
                      disabled={page >= totalPages}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 text-gray-600 transition-all"
                    >
                      &gt;
                    </button>
                  </div>
                </div>

                {/* FILTERS */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1 group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                      <FiSearch className="text-gray-400 group-focus-within:text-primary transition-colors w-4.5 h-4.5" />
                    </div>
                    <input
                      value={search}
                      onChange={(e) =>
                        dispatch(actions.setFilters({ search: e.target.value }))
                      }
                      placeholder="Search by name..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border-transparent focus:bg-white border focus:border-primary rounded-xl text-sm font-medium outline-none transition-all placeholder-gray-400 h-9.5"
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <div className="flex-1 sm:w-40">
                      <FormAutocomplete
                        type="departments"
                        value={department}
                        onChange={(val) =>
                          dispatch(actions.setFilters({ department: val }))
                        }
                        placeholder="Department"
                        containerClassName="mb-0 [&>div:first-of-type]:!py-2 [&>div:first-of-type]:!h-9.5 [&>div:first-of-type]:!min-h-9.5 [&_input]:!py-0 [&_input]:text-sm"
                        label=""
                      />
                    </div>
                    <div className="flex-1 sm:w-40">
                      <FormAutocomplete
                        type="jobTitles"
                        value={job_title}
                        onChange={(val) =>
                          dispatch(actions.setFilters({ job_title: val }))
                        }
                        placeholder="Role"
                        containerClassName="mb-0 [&>div:first-of-type]:!py-2 [&>div:first-of-type]:!h-9.5 [&>div:first-of-type]:!min-h-9.5 [&_input]:!py-0 [&_input]:text-sm"
                        label=""
                      />
                    </div>
                  </div>
                  {(search || department || job_title) && (
                    <button
                      onClick={() => dispatch(actions.resetFilters())}
                      className="h-9.5 px-3 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
                      title="Reset Filters"
                    >
                      <FiFilter className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* LIST */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/30">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-60 space-y-4">
                    <LoadingSkeleton
                      variant="rectangular"
                      width={200}
                      height={200}
                    />
                    <LoadingSkeleton variant="text" width={150} />
                  </div>
                ) : employees.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <FiUsers className="w-8 h-8 text-gray-300" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-gray-500">
                        No employees found.
                      </p>
                      <p className="text-xs mt-1">
                        Try adjusting your filters.
                      </p>
                    </div>
                  </div>
                ) : (
                  employees.map((emp) => {
                    const isSelected = selectedIds.includes(emp.id);
                    const isManager = emp.id === selectedManager?.id;

                    if (isManager) return null;

                    return (
                      <div
                        key={emp.id}
                        onClick={() => toggleSelection(emp.id)}
                        className={`
                                            group p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-center gap-4 select-none
                                            ${
                                              isSelected
                                                ? "bg-primary-light border-primary/20 shadow-sm relative overflow-hidden"
                                                : "bg-white border-gray-100 hover:border-primary/20 hover:shadow-md hover:-translate-y-0.5"
                                            }
                                        `}
                      >
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                        )}

                        <div
                          className={`
                                            w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold transition-colors shrink-0
                                            ${
                                              isSelected
                                                ? "bg-primary-light text-primary"
                                                : "bg-gray-100 text-gray-500 group-hover:bg-primary-light group-hover:text-primary"
                                            }
                                        `}
                        >
                          {emp.full_name?.charAt(0)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4
                            className={`text-sm font-bold truncate transition-colors ${
                              isSelected ? "text-gray-900" : "text-gray-800"
                            }`}
                          >
                            {emp.full_name}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mt-0.5">
                            <span className="font-medium text-gray-600 truncate">
                              {emp.jobTitle && emp.jobTitle !== "Unspecified"
                                ? emp.jobTitle
                                : "No Title"}
                            </span>
                            {emp.department &&
                              emp.department !== "Unspecified" && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                  <span className="truncate">
                                    {emp.department}
                                  </span>
                                </>
                              )}
                          </div>
                        </div>

                        <div
                          className={`
                                            w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shrink-0
                                            ${
                                              isSelected
                                                ? "bg-primary border-primary text-white shadow-md shadow-primary/20 scale-100"
                                                : "border-gray-200 bg-white text-gray-300 group-hover:border-primary/30 group-hover:text-primary/30"
                                            }
                                        `}
                        >
                          {isSelected ? (
                            <FiCheckCircle className="w-5 h-5" />
                          ) : (
                            <FiPlus className="w-5 h-5" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT PANEL: SELECTED SQUAD */}
            <div
              className={`
                    fixed inset-x-0 bottom-0 z-40 md:relative md:inset-auto md:z-auto
                    w-full md:w-80 lg:w-96 flex flex-col
                    bg-white md:rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-xl md:border border-gray-100
                    transition-transform duration-300 ease-in-out
                    ${
                      showMobileSquad
                        ? "translate-y-0"
                        : "translate-y-[calc(100%-80px)] md:translate-y-0"
                    }
                    md:h-full lg:h-full
                `}
            >
              {/* MOBILE HANDLE */}
              <div
                className="md:hidden h-6 bg-gray-50 flex items-center justify-center border-t border-gray-200 cursor-pointer"
                onClick={() => setShowMobileSquad(!showMobileSquad)}
              >
                <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
              </div>

              {/* RIGHT HEADER */}
              <div className="p-6 border-b border-gray-100 bg-linear-to-br from-white to-gray-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-light rounded-full blur-[50px] opacity-40 pointer-events-none -mr-10 -mt-10"></div>
                <div className="relative z-10">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">
                    Squad Roster
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">
                      {selectedIds.length}
                    </h2>
                    <span className="text-gray-500 font-bold">Selected</span>
                  </div>
                </div>
              </div>

              {/* SELECTED LIST */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                {selectedIds.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-8 border-2 border-dashed border-gray-200 rounded-2xl bg-white/50">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <FiUsers className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="text-sm font-bold text-gray-600">
                      The bench is empty.
                    </p>
                    <p className="text-xs mt-1">
                      Start drafting from the left.
                    </p>
                  </div>
                ) : (
                  <>
                    {selectedEmployees.map((emp) => (
                      <div
                        key={emp.id}
                        className="bg-white p-3 rounded-xl flex items-center gap-3 border border-gray-100 shadow-sm animate-in slide-in-from-left-4 duration-300 group hover:border-red-200 hover:shadow-md transition-all"
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0">
                          {emp.full_name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {emp.full_name}
                          </p>
                          <p className="text-[10px] uppercase font-bold text-gray-400 truncate">
                            {emp.jobTitle || "Employee"}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleSelection(emp.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                          title="Remove"
                        >
                          <FiX />
                        </button>
                      </div>
                    ))}
                    {selectedIds.length > selectedEmployees.length && (
                      <div className="text-center py-3 text-xs font-medium text-gray-400 bg-white/50 rounded-xl border border-dashed border-gray-200">
                        + {selectedIds.length - selectedEmployees.length} others
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* FOOTER */}
              <div className="p-5 bg-white border-t border-gray-100 shadow-[0_-5px_20px_rgba(0,0,0,0.02)] z-20">
                <div className="flex items-center justify-between mb-5 px-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary text-sm font-bold border border-primary/10">
                      {selectedManager?.full_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                        Reports To
                      </p>
                      <p className="text-xs font-bold text-gray-900 truncate">
                        {selectedManager?.full_name || (
                          <span className="text-gray-400 italic">
                            Not Selected
                          </span>
                        )}
                      </p>
                      {selectedManager && (
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5">
                          {selectedManager.job_title &&
                            selectedManager.job_title !== "Unspecified" && (
                              <span className="truncate">
                                {selectedManager.job_title}
                              </span>
                            )}
                          {selectedManager.department &&
                            selectedManager.department !== "Unspecified" &&
                            selectedManager.job_title &&
                            selectedManager.job_title !== "Unspecified" && (
                              <span className="w-0.5 h-0.5 rounded-full bg-gray-300"></span>
                            )}
                          {selectedManager.department &&
                            selectedManager.department !== "Unspecified" && (
                              <span className="truncate">
                                {selectedManager.department}
                              </span>
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="py-3.5 px-4 rounded-xl text-xs font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 transition-colors col-span-1"
                  >
                    Change Manager
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={selectedIds.length === 0}
                    className="py-3.5 px-4 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2 col-span-2"
                  >
                    <FiCheckCircle className="w-4 h-4" /> Confirm & Assign
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ChangeManagerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        employeeId={selectedManager?.id || null}
        employeeName={selectedManager?.full_name || ""}
        currentManagerId={null}
        onSuccess={handleModalSuccess}
        mode="replace_team_lead"
      />
    </AdminLayout>
  );
}
