import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import {
  FiUsers,
  FiSearch,
  FiChevronRight,
  FiChevronLeft,
  FiFilter,
  FiBriefcase,
  FiMapPin,
  FiRefreshCw,
} from "react-icons/fi";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import Button from "../../../components/Core/ui/Button";
import BackButton from "../../../components/common/BackButton";
import FormAutocomplete from "../../../components/Core/ui/FormAutocomplete";
import adminService from "../../../services/adminService";
import { useManagerListSlice } from "./slice";
import {
  selectManagers,
  selectLoading,
  selectFilter,
  selectPagination,
  selectLastFetched,
} from "./slice/selectors";
import { managerListActions } from "./slice";
import LoadingSkeleton from "../../../components/common/LoadingSkeleton";
import { getFileUrl } from "../../../utils/fileUtils";
import { Employee } from "../Employees/slice/types";
import ChangeManagerModal from "../../../components/common/ChangeManagerModal"; // Import Modal

export default function ManagersPage() {
  useManagerListSlice();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const managers = useSelector(selectManagers);
  const loading = useSelector(selectLoading);
  const filters = useSelector(selectFilter);
  const pagination = useSelector(selectPagination);

  const isFilterActive =
    filters.search ||
    filters.department ||
    filters.job_title ||
    filters.job_level;

  // Track previous search term to identify search-only changes
  const [prevSearch, setPrevSearch] = useState(filters.search);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedManagerForUpdate, setSelectedManagerForUpdate] =
    useState<Employee | null>(null);

  useEffect(() => {
    const isSearchChange = filters.search !== prevSearch;

    if (isSearchChange && filters.search !== "") {
      // It's a search update: debounce
      const timer = setTimeout(() => {
        dispatch(managerListActions.fetchManagersRequest());
        setPrevSearch(filters.search);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      // It's a mount, tab change, or filter change: Fetch INSTANTLY
      // The Saga will handle caching
      dispatch(managerListActions.fetchManagersRequest());
      setPrevSearch(filters.search);
    }
  }, [
    dispatch,
    pagination.page,
    filters.search,
    filters.department,
    filters.job_title,
    filters.job_level,
    prevSearch,
  ]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(managerListActions.setFilters({ search: e.target.value }));
  };

  const handleFilterChange = (key: string, value: string) => {
    dispatch(managerListActions.setFilters({ [key]: value }));
  };

  const resetFilters = () => {
    dispatch(managerListActions.resetFilters());
  };

  const handleRowClick = (manager: any) => {
    const id =
      manager?.employee?.id ??
      manager?.employee_id ??
      manager?.employeeId ??
      manager?.id;
    if (!id) return;
    navigate(`/admin/managers/${String(id)}`);
  };

  // const handleChangeManagerClick = (e: React.MouseEvent, manager: Employee) => {
  //   e.stopPropagation();
  //   setSelectedManagerForUpdate(manager);
  //   setIsModalOpen(true);
  // };

  const handleModalSuccess = () => {
    dispatch(managerListActions.fetchManagersRequest());
    setSelectedManagerForUpdate(null);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      dispatch(managerListActions.setPage(newPage));
    }
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>Managers</title>
      </Helmet>

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        <BackButton label="Back to Employees" to="/admin/employees" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
              Managers
            </h1>
            <p className="text-gray-500 font-medium">
              Overview of leadership and reporting lines.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                dispatch(managerListActions.refresh());
                dispatch(managerListActions.fetchManagersRequest());
              }}
              className={`p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-primary hover:border-primary-light hover:bg-primary-light transition-all overflow-hidden relative ${loading ? "pointer-events-none" : ""}`}
              title="Refresh List"
              disabled={loading}
            >
              {loading && (
                <div className="absolute inset-0 shimmer-bg opacity-30" />
              )}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 ${loading ? "opacity-0" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <Button
              variant="primary"
              icon={FiUsers}
              onClick={() => navigate("/admin/managers/assign")}
            >
              Assign Manager
            </Button>
            <Button
              variant="outline"
              icon={FiBriefcase}
              onClick={() => navigate("/manager/department-tree")}
            >
              View Tree
            </Button>
          </div>
        </div>

        {/* FILTERS TOOLBAR */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex flex-col lg:flex-row items-center gap-4">
            {/* Search - Left */}
            <div className="relative flex-1 w-full group">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Search managers..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary-light transition-all font-medium text-sm outline-none"
                value={filters.search}
                onChange={handleSearch}
              />
            </div>

            {/* Filters & Reset - Right */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <div className="w-full sm:w-56">
                <FormAutocomplete
                  type="jobTitles"
                  placeholder="All Job Titles"
                  value={filters.job_title}
                  onChange={(val) => handleFilterChange("job_title", val)}
                  icon={<FiBriefcase />}
                  containerClassName="!mb-0 [&>div:first-of-type]:!bg-gray-50 [&>div:first-of-type]:!border-transparent [&>div:first-of-type]:focus-within:!bg-white [&>div:first-of-type]:focus-within:!border-primary"
                />
              </div>
              <div className="w-full sm:w-56">
                <FormAutocomplete
                  type="departments"
                  placeholder="All Departments"
                  value={filters.department}
                  onChange={(val) => handleFilterChange("department", val)}
                  icon={<FiMapPin />}
                  containerClassName="!mb-0 [&>div:first-of-type]:!bg-gray-50 [&>div:first-of-type]:!border-transparent [&>div:first-of-type]:focus-within:!bg-white [&>div:first-of-type]:focus-within:!border-primary"
                />
              </div>
              <div className="w-full sm:w-56">
                <FormAutocomplete
                  type="jobLevels"
                  placeholder="All Job Levels"
                  value={filters.job_level}
                  onChange={(val) => handleFilterChange("job_level", val)}
                  icon={<FiBriefcase />}
                  containerClassName="!mb-0 [&>div:first-of-type]:!bg-gray-50 [&>div:first-of-type]:!border-transparent [&>div:first-of-type]:focus-within:!bg-white [&>div:first-of-type]:focus-within:!border-primary"
                />
              </div>

              {isFilterActive && (
                <button
                  onClick={resetFilters}
                  className="p-2.5 rounded-xl bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-primary transition-all group shrink-0"
                  title="Reset Filters"
                >
                  <div className="relative">
                    <FiFilter className="w-5 h-5" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                  <th className="px-6 py-5">Full Name</th>
                  <th className="px-6 py-5">Job Title</th>
                  <th className="px-6 py-5">Department</th>
                  <th className="px-6 py-5">Team Size</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr>
                  <td colSpan={5} className="relative p-0">
                    <div className="absolute top-2 right-4 z-20">
                      <div className="w-16 h-3 shimmer-bg rounded" />
                    </div>
                  </td>
                </tr>
                {loading && managers.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-6 py-4">
                        <LoadingSkeleton variant="table-row" />
                      </td>
                    </tr>
                  ))
                ) : managers.length === 0 && !loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      No managers found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  managers.map((manager: Employee) => (
                    <tr
                      key={manager.id}
                      onClick={() => handleRowClick(manager)}
                      className="cursor-pointer hover:bg-primary-light transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm overflow-hidden">
                            {manager.profile_picture_url ? (
                              <img
                                src={getFileUrl(manager.profile_picture_url)}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              manager.full_name?.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 group-hover:text-primary transition-colors">
                              {manager.full_name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {manager.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-600">
                        {manager.job_title || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold border border-blue-100">
                          {manager.department || "Unassigned"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-700">
                        {manager.team_size || 0}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/*<button
                            onClick={(e) =>
                              handleChangeManagerClick(e, manager)
                            }
                            className="text-gray-400 hover:text-k-orange transition-colors p-2 hover:bg-orange-50 rounded-lg text-xs font-medium flex items-center gap-1 group/btn"
                            title="Change Manager"
                          >
                            <FiRefreshCw className="group-hover/btn:rotate-180 transition-transform duration-300" />
                            <span className="hidden xl:inline">Change Mgr</span>
                          </button>*/}
                          <button className="text-gray-400 group-hover:text-primary transition-colors p-2 hover:bg-primary-light rounded-full">
                            <FiChevronRight />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* PAGINATION */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500 font-medium">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={pagination.page === 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                  className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiChevronLeft />
                </button>
                <button
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                  className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiChevronRight />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Helper Comments:
            selectedManagerForUpdate is an object of type Employee.
            However, ChangeManagerModal expects { id: string, name: string ... } in separate props
            or we can just reuse the state.
         */}
        <ChangeManagerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          employeeId={selectedManagerForUpdate?.id || null}
          employeeName={selectedManagerForUpdate?.full_name || ""}
          currentManagerId={null} // We don't have this in the table list easily, can pass null or fetch
          onSuccess={handleModalSuccess}
        />
      </div>
    </AdminLayout>
  );
}
