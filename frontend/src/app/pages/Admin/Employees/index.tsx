import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";

import { useEmployeesSlice } from "./slice";
import {
  selectAllEmployees,
  selectEmployeesLoading,
  selectEmployeesPagination,
  selectApproveSuccess,
  selectDeleteSuccess,
  selectActivateSuccess,
  selectEmployeeFilters,
  selectActiveTab,
  selectLastInvalidated,
  selectEmployeeStatusCounts,
} from "./slice/selectors";

import { useDepartments } from "../Departments/slice";
import { selectDepartments } from "../Departments/slice/selectors";
import { useJobTitlesSlice } from "../Settings/JobTitles/slice";
import { selectAllJobTitles } from "../Settings/JobTitles/slice/selectors";

import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import DataTable from "../../../components/common/DataTable";
import Button from "../../../components/Core/ui/Button";
import FormField from "../../../components/common/FormField";
import Checkbox from "../../../components/common/Checkbox";
import { ActionMenu } from "../../../components/common/ActionMenu";
import PageHeader from "../../../components/common/PageHeader";

import {
  FiUser,
  FiPlus,
  FiSearch,
  FiFilter,
  FiTrash2,
  FiEye,
  FiUserPlus,
  FiDownload,
  FiUsers,
} from "react-icons/fi";
import { MdRefresh, MdSettings, MdApartment } from "react-icons/md";

import { Employee } from "./slice/types";
import ToastService from "../../../../utils/ToastService";

import ExportModal from "./components/ExportModal";
import { getFileUrl } from "../../../utils/fileUtils";
import { formatDate } from "../../../utils/dayjs-format";

export default function Employees() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { actions } = useEmployeesSlice();

  const employees: Employee[] = useSelector(selectAllEmployees);
  const loading = useSelector(selectEmployeesLoading);

  const deleteSuccess = useSelector(selectDeleteSuccess);
  const activeTab = useSelector(selectActiveTab);
  const filters = useSelector(selectEmployeeFilters);

  // Dynamic Filters Data
  const { actions: departmentActions } = useDepartments();
  const { actions: jobTitleActions } = useJobTitlesSlice();
  const departments = useSelector(selectDepartments);
  const jobTitles = useSelector(selectAllJobTitles);

  useEffect(() => {
    dispatch(departmentActions.fetchDepartmentsStart({ limit: 1000 }));
    dispatch(jobTitleActions.fetchAllJobTitlesRequest());
    dispatch(actions.fetchEmployeeTabCountsRequest());
  }, [dispatch, departmentActions, jobTitleActions, actions]);

  // Extract unique job levels
  const jobLevels = Array.from(
    new Set(jobTitles.map((jt) => jt.level).filter(Boolean)),
  ).map((level) => ({ label: level as string, value: level as string }));

  // Map departments to options
  const departmentOptions = departments.map((d) => ({
    label: d.name,
    value: d.name,
  }));

  const {
    gender: genderFilter,
    department: departmentFilter,
    job_level: levelFilter,
    sort_by: sortFilter,
    search: searchTerm,
    cost_sharing_status: costSharingFilter,
  } = filters;

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<"SINGLE" | "BULK">("BULK");
  const [exportEmployeeId, setExportEmployeeId] = useState<string | undefined>(
    undefined,
  );

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoadingAllIds, setIsLoadingAllIds] = useState(false);
  const [endingProbationId, setEndingProbationId] = useState<string | null>(
    null,
  );

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSelectAll = async () => {
    // Check if current page is already fully selected
    const isCurrentPageSelected =
      employees.length > 0 &&
      employees.every((e) => selectedIds.includes(e.id));

    if (isCurrentPageSelected) {
      // If current page is selected, we assume intent is to deselect all
      setSelectedIds([]);
    } else {
      // Select ALL employees (Global Fetch)
      setIsLoadingAllIds(true);
      try {
        // Replicate filter params logic
        let status = "COMPLETED";
        let isActive: boolean | undefined = true;
        let probationStatus: string | undefined;

        if (activeTab === "active") {
          status = "COMPLETED";
          isActive = true;
        } else if (activeTab === "pending") {
          status = "PENDING_APPROVAL";
          isActive = undefined;
        } else if (activeTab === ("inprogress" as any)) {
          status = "IN_PROGRESS";
          isActive = undefined;
        } else if (activeTab === "inactive") {
          status = "COMPLETED";
          isActive = false;
        } else if (activeTab === "probation") {
          status = "COMPLETED";
          isActive = true;
          probationStatus = "active";
        }

        let params: any = {
          limit: 100000,
          onboarding_status: status,
        };

        if (isActive !== undefined) params.is_active = isActive;
        if (genderFilter) params.gender = genderFilter;
        if (departmentFilter) params.department = departmentFilter;
        if (levelFilter) params.job_level = levelFilter;
        if (costSharingFilter) params.cost_sharing_status = costSharingFilter;
        if (probationStatus) params.probation_status = probationStatus;
        if (searchTerm) params.search = searchTerm;

        // Import needed at top of file, but used here
        const response: any = await makeCall({
          method: "GET",
          route: apiRoutes.employees,
          query: params,
          isSecureRoute: true,
        });

        const rawEmployees = response?.data?.data?.employees || [];
        const allIds = rawEmployees.map((e: any) => e.id);
        setSelectedIds(allIds);
        ToastService.success(`Selected all ${allIds.length} employees`);
      } catch (error) {
        console.error("Failed to fetch all IDs", error);
        ToastService.error("Failed to select all employees");
      } finally {
        setIsLoadingAllIds(false);
      }
    }
  };

  const openExportModal = (scope: "SINGLE" | "BULK", id?: string) => {
    setExportScope(scope);
    setExportEmployeeId(id);
    setIsExportModalOpen(true);
  };

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isHardDelete, setIsHardDelete] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(
    null,
  );

  // Approve Modal State
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [employeeToApprove, setEmployeeToApprove] = useState<Employee | null>(
    null,
  );

  // Activate Modal State
  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
  const [employeeToActivate, setEmployeeToActivate] = useState<Employee | null>(
    null,
  );

  const pagination = useSelector(selectEmployeesPagination);
  const page = pagination?.page || 1;
  const totalPages = pagination?.totalPages || 0;

  const approveSuccess = useSelector(selectApproveSuccess);
  const activateSuccess = useSelector(selectActivateSuccess);
  const lastInvalidated = useSelector(selectLastInvalidated);
  const statusCounts = useSelector(selectEmployeeStatusCounts);

  const isFilterActive = !!(
    genderFilter ||
    departmentFilter ||
    levelFilter ||
    sortFilter ||
    searchTerm ||
    costSharingFilter
  );

  const fetchEmployees = (
    currentPage: number = page,
    refresh: boolean = false,
  ) => {
    // Determine filters based on tab
    let status = "COMPLETED";
    let isActive: boolean | undefined = true;
    let probationStatus: string | undefined;

    if (activeTab === "active") {
      // All Employees: Completed onboarding and active
      status = "COMPLETED";
      isActive = true;
    } else if (activeTab === "pending") {
      // Pending Approval: Waiting for HR approval
      status = "PENDING_APPROVAL";
      isActive = undefined; // Fetch all regardless of is_active
    } else if (activeTab === ("inprogress" as any)) {
      // In Progress: Still completing onboarding
      status = "IN_PROGRESS";
      isActive = undefined; // Fetch all regardless of is_active
    } else if (activeTab === "inactive") {
      // Inactive Employees: Completed onboarding but deactivated
      status = "COMPLETED";
      isActive = false;
    } else if (activeTab === "probation") {
      // Employees currently on probation
      status = "COMPLETED";
      isActive = true;
      probationStatus = "active";
    }

    dispatch(
      actions.fetchAllEmployeesRequest({
        page: currentPage,
        limit: 10,
        status: status,
        is_active: isActive,
        // filters
        gender: genderFilter,
        department: departmentFilter,
        job_level: levelFilter,
        sort_by: sortFilter,
        search: searchTerm,
        cost_sharing_status: costSharingFilter,
        probation_status: probationStatus,
        refresh: refresh, // Pass refresh flag
      }),
    );
  };

  const handleEndProbation = async (employeeId: string) => {
    try {
      setEndingProbationId(employeeId);
      await makeCall({
        route: apiRoutes.updateEmployment(employeeId),
        method: "PATCH",
        body: { probation_end_date: null },
        isSecureRoute: true,
      });
      ToastService.success("Probation ended successfully.");
      fetchEmployees(page, true);
    } catch (error: any) {
      ToastService.error(error?.message || "Failed to end probation.");
    } finally {
      setEndingProbationId(null);
    }
  };

  const getProbationInfo = (emp: Employee) => {
    const startDate = emp.start_date ? new Date(emp.start_date) : null;
    const endDate = emp.probation_end_date
      ? new Date(emp.probation_end_date)
      : null;

    const isValidStart = !!startDate && !Number.isNaN(startDate.getTime());
    const isValidEnd = !!endDate && !Number.isNaN(endDate.getTime());

    let remainingDaysLabel = "-";
    if (isValidEnd && endDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      const diffDays = Math.max(
        0,
        Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      );
      remainingDaysLabel = `${diffDays} day${diffDays === 1 ? "" : "s"}`;
    }

    return {
      startDate: isValidStart && startDate ? formatDate(startDate) : "-",
      endDate: isValidEnd && endDate ? formatDate(endDate) : "-",
      remainingDaysLabel,
    };
  };

  // Track previous search term to identify search-only changes
  const [prevSearch, setPrevSearch] = useState(searchTerm);

  useEffect(() => {
    if (searchTerm !== prevSearch) {
      // It's a search update: debounce
      const timer = setTimeout(() => {
        fetchEmployees(page);
        setPrevSearch(searchTerm);
      }, 500); // 500ms for search typing
      return () => clearTimeout(timer);
    } else {
      // It's a mount, tab change, or filter change: Fetch INSTANTLY
      // The Saga will handle caching (if page exists in store, it returns instantly)
      fetchEmployees(page);
    }
  }, [
    dispatch,
    actions,
    activeTab,
    page,
    genderFilter,
    departmentFilter,
    levelFilter,
    sortFilter,
    searchTerm,
    costSharingFilter,
    prevSearch,
    lastInvalidated,
  ]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      dispatch(actions.setPage(newPage));
    }
  };

  // Handle Success States - Consolidated listener
  useEffect(() => {
    if (approveSuccess || deleteSuccess || activateSuccess) {
      if (approveSuccess)
        ToastService.success("Employee approved successfully!");
      if (deleteSuccess) ToastService.success("Employee updated successfully!");
      if (activateSuccess)
        ToastService.success("Employee activated successfully!");

      setIsApproveModalOpen(false);
      setIsDeleteModalOpen(false);
      setIsActivateModalOpen(false);

      setEmployeeToApprove(null);
      setEmployeeToDelete(null);
      setEmployeeToActivate(null);

      dispatch(actions.resetSuccessStates());

      // Force refresh with the new flag to bypass cache
      fetchEmployees(page, true);
    }
  }, [approveSuccess, deleteSuccess, activateSuccess]);

  const openApproveModal = (employee: Employee) => {
    setEmployeeToApprove(employee);
    setIsApproveModalOpen(true);
  };

  const openActivateModal = (employee: Employee) => {
    setEmployeeToActivate(employee);
    setIsActivateModalOpen(true);
  };

  const openDeleteModal = (employee: Employee, hard: boolean) => {
    setEmployeeToDelete(employee);
    setIsHardDelete(hard);
    setIsDeleteModalOpen(true);
  };

  const updateFilter = (newFilters: Partial<typeof filters>) => {
    dispatch(actions.setEmployeeFilters(newFilters));
    dispatch(actions.setPage(1)); // Reset to page 1 on filter change
  };

  const handleTabChange = (
    tab:
      | "active"
      | "pending"
      | "inprogress"
      | "inactive"
      | "probation"
      | "settings",
  ) => {
    dispatch(actions.setEmployeeTab(tab as any));
    dispatch(actions.setPage(1));
  };

  const openDetailsPage = (employee: Employee) => {
    navigate(`/admin/employees/${employee.id}`);
  };

  const confirmDelete = () => {
    if (employeeToDelete) {
      dispatch(
        actions.deleteEmployeeRequest({
          id: employeeToDelete.id,
          hard_delete: isHardDelete,
        }),
      );
    }
  };

  const confirmApprove = () => {
    if (employeeToApprove) {
      dispatch(actions.approveEmployeeRequest(employeeToApprove.id));
    }
  };

  const confirmActivate = () => {
    if (employeeToActivate) {
      dispatch(actions.activateEmployeeRequest(employeeToActivate.id));
    }
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>Employees | ADIU Communication Service PLC</title>
      </Helmet>
      <div className="max-w-7xl mx-auto space-y-8">
        <PageHeader>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold text-white">
                  Employees Management
                </h1>
                <p className="text-white-200 mt-1">
                  Manage your employees and user accounts
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => navigate("/admin/departments")}
                variant="white"
                icon={MdApartment}
              >
                Departments
              </Button>
              <Button
                onClick={() => navigate("/admin/managers")}
                variant="white"
                icon={FiUsers}
              >
                Managers
              </Button>
              <Button
                onClick={() => navigate("/admin/users/create")}
                variant="white"
                icon={FiPlus}
              >
                Create User
              </Button>

              <div className="flex-1" />

              {/* BUTTONS WITH TEXT */}
              <Button
                onClick={() => navigate("/admin/employees/settings")}
                variant="white"
                icon={MdSettings}
              >
                Settings
              </Button>
              <Button
                onClick={() => fetchEmployees(page, true)}
                variant="white"
                icon={MdRefresh}
                loading={loading}
              >
                Refresh
              </Button>
            </div>
          </div>
        </PageHeader>

        {/* DATA TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible z-0">
          {/* TABS */}
          <div className="flex items-center justify-between px-6 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-8">
              <button
                onClick={() => handleTabChange("active")}
                className={`py-4 text-sm font-medium flex items-center border-b-2 transition-colors ${
                  activeTab === "active"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                All Employees
                <span
                  className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    activeTab === "active"
                      ? "bg-primary-light text-primary"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {statusCounts.active}
                </span>
              </button>
              <button
                onClick={() => handleTabChange("pending")}
                className={`py-4 text-sm font-medium flex items-center border-b-2 transition-colors ${
                  activeTab === "pending"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Pending Approval
                <span
                  className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    activeTab === "pending"
                      ? "bg-primary-light text-primary"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {statusCounts.pending}
                </span>
              </button>
              <button
                onClick={() => handleTabChange("inprogress" as any)}
                className={`py-4 text-sm font-medium flex items-center border-b-2 transition-colors ${
                  activeTab === ("inprogress" as any)
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                In Progress
                <span
                  className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    activeTab === "inprogress"
                      ? "bg-primary-light text-primary"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {statusCounts.inprogress}
                </span>
              </button>
              <button
                onClick={() => handleTabChange("inactive")}
                className={`py-4 text-sm font-medium flex items-center border-b-2 transition-colors ${
                  activeTab === "inactive"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Inactive Employees
                <span
                  className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    activeTab === "inactive"
                      ? "bg-primary-light text-primary"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {statusCounts.inactive}
                </span>
              </button>
              <button
                onClick={() => handleTabChange("probation")}
                className={`py-4 text-sm font-medium flex items-center border-b-2 transition-colors ${
                  activeTab === "probation"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                On Probation
                <span
                  className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    activeTab === "probation"
                      ? "bg-primary-light text-primary"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {statusCounts.probation || 0}
                </span>
              </button>
            </div>
            <div className="py-2">
              <Button
                onClick={() => openExportModal("BULK")}
                variant="white"
                icon={FiDownload}
              >
                {selectedIds.length > 0
                  ? `Export Employees (${selectedIds.length})`
                  : "Export Employees"}
              </Button>
            </div>
          </div>

          {/* FILTERS & SEARCH */}
          <div className="bg-white border-b border-gray-100 p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              {/* Left: Search */}
              <div className="relative w-full md:w-96 group">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => updateFilter({ search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light focus:bg-white transition-all shadow-sm placeholder:text-gray-400"
                />
              </div>

              {/* Right: Filters & Actions */}
              <div className="flex flex-nowrap items-center gap-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
                  <FormField
                    type="select"
                    name="gender"
                    options={[
                      { label: "Male", value: "Male" },
                      { label: "Female", value: "Female" },
                    ]}
                    value={genderFilter}
                    onChange={(e) => updateFilter({ gender: e.target.value })}
                    placeholder="Gender"
                    className="mb-0 min-w-25"
                    inputClassName="bg-white border-gray-200 py-2 text-xs h-9 rounded-lg"
                  />
                  <FormField
                    type="select"
                    name="department"
                    options={departmentOptions}
                    value={departmentFilter}
                    onChange={(e) =>
                      updateFilter({ department: e.target.value })
                    }
                    placeholder="Department"
                    className="mb-0 min-w-30"
                    inputClassName="bg-white border-gray-200 py-2 text-xs h-9 rounded-lg"
                  />
                  <FormField
                    type="select"
                    name="job_level"
                    options={jobLevels}
                    value={levelFilter}
                    onChange={(e) =>
                      updateFilter({ job_level: e.target.value })
                    }
                    placeholder="Job Level"
                    className="mb-0 min-w-25"
                    inputClassName="bg-white border-gray-200 py-2 text-xs h-9 rounded-lg"
                  />
                  <FormField
                    type="select"
                    name="cost_sharing"
                    options={[
                      { label: "Fully Paid", value: "FULLY_PAID" },
                      { label: "Partially Paid", value: "PARTIALLY_PAID" },
                      { label: "Unpaid", value: "UNPAID" },
                    ]}
                    value={costSharingFilter}
                    onChange={(e) =>
                      updateFilter({ cost_sharing_status: e.target.value })
                    }
                    placeholder="Cost Sharing"
                    className="mb-0 min-w-35"
                    inputClassName="bg-white border-gray-200 py-2 text-xs h-9 rounded-lg"
                  />
                  <div className="w-px h-6 bg-gray-200 mx-1"></div>
                  <FormField
                    type="select"
                    name="sort_by"
                    options={[
                      { label: "Name: A-Z", value: "name_asc" },
                      { label: "Name: Z-A", value: "name_desc" },
                      { label: "Date: Newest", value: "newest" },
                      { label: "Date: Oldest", value: "oldest" },
                    ]}
                    value={sortFilter}
                    onChange={(e) => updateFilter({ sort_by: e.target.value })}
                    placeholder="Sort By"
                    className="mb-0 min-w-32.5"
                    inputClassName="bg-white border-gray-200 py-2 text-xs h-9 rounded-lg"
                  />
                </div>

                <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>

                <button
                  onClick={() => {
                    dispatch(actions.resetEmployeeFilters());
                    dispatch(actions.setPage(1));
                  }}
                  disabled={!isFilterActive}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full transition-all border ${
                    isFilterActive
                      ? "bg-primary-light text-primary border-primary-light hover:bg-secondary-light"
                      : "bg-gray-50 text-gray-400 border-transparent cursor-not-allowed"
                  }`}
                >
                  <FiFilter className={isFilterActive ? "" : "text-gray-300"} />
                  Reset
                </button>
              </div>
            </div>
          </div>

          {activeTab === ("inprogress" as any) && (
            <div className="p-4 bg-blue-50 text-blue-800 text-sm border-b border-blue-100 flex items-center gap-2">
              <FiUserPlus className="text-blue-500" />
              These employees are still completing their profile and haven't
              been submitted for approval.
            </div>
          )}

          <DataTable
            data={employees}
            loading={loading}
            keyExtractor={(emp: Employee) => emp.id}
            onRowClick={(emp) => openDetailsPage(emp)}
            rowClassName={(emp) =>
              selectedIds.includes(emp.id)
                ? "bg-primary-light hover:bg-primary-light/80"
                : ""
            }
            pagination={{
              currentPage: page,
              totalPages: totalPages,
              totalItems: pagination?.total || 0,
              itemsPerPage: 10,
              onPageChange: handlePageChange,
            }}
            itemLabel="employee"
            className="min-h-112.5"
            columns={[
              {
                key: "select",
                stopPropagation: true,
                header: (
                  <div className="flex justify-center">
                    <Checkbox
                      checked={
                        employees.length > 0 &&
                        selectedIds.length > 0 &&
                        employees.every((e) => selectedIds.includes(e.id))
                      }
                      onChange={handleSelectAll}
                      disabled={isLoadingAllIds}
                      className={`border-gray-300 text-primary w-4! h-4! ${
                        isLoadingAllIds ? "opacity-50 cursor-wait" : ""
                      }`}
                    />
                  </div>
                ),
                render: (emp: Employee) => (
                  <div className="flex justify-center">
                    <Checkbox
                      checked={selectedIds.includes(emp.id)}
                      onChange={() => {
                        handleSelectRow(emp.id);
                      }}
                      className="w-4! h-4! accent-primary"
                    />
                  </div>
                ),
                className: "px-2 w-[50px]",
              },
              {
                key: "employee",
                header: "Employee",
                render: (emp: Employee) => (
                  <div className="flex items-center gap-4 py-1">
                    <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold overflow-hidden border border-primary-light shadow-sm">
                      {emp.profile_picture_url ? (
                        <img
                          src={getFileUrl(emp.profile_picture_url)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        emp.full_name?.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 leading-tight">
                        {emp.full_name}
                      </div>
                      <div className="text-[10px] font-mono text-gray-400 mt-0.5 uppercase tracking-tight">
                        ID: {emp.employee_id || emp.id.slice(0, 8)}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: "job",
                header: "Job & Dept",
                render: (emp: Employee) => (
                  <div className="py-1">
                    <div className="font-semibold text-gray-800 text-sm">
                      {emp.job_title || "—"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {emp.department || "Unassigned"}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Manager: {emp.manager?.full_name || "Unassigned"}
                    </div>
                  </div>
                ),
              },
              {
                key: "contact",
                header: "Contact",
                render: (emp: Employee) => (
                  <div className="py-1">
                    <div className="text-sm font-medium text-gray-700">
                      {emp.email || "—"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {emp.phone || "—"}
                    </div>
                  </div>
                ),
              },
              ...(activeTab === "probation"
                ? [
                    {
                      key: "probation",
                      header: "Probation Details",
                      className: "w-[200px]",
                      headerClassName: "w-[200px]",
                      render: (emp: Employee) => {
                        const info = getProbationInfo(emp);
                        return (
                          <div className="py-1 text-xs text-gray-600 space-y-1">
                            <div>
                              <span className="font-semibold text-gray-700">
                                Start:
                              </span>{" "}
                              {info.startDate}
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700">
                                End:
                              </span>{" "}
                              {info.endDate}
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700">
                                Remaining:
                              </span>{" "}
                              {info.remainingDaysLabel}
                            </div>
                          </div>
                        );
                      },
                    },
                    {
                      key: "probation_action",
                      stopPropagation: true,
                      header: "Probation Action",
                      className: "w-[150px]",
                      headerClassName: "w-[150px]",
                      render: (emp: Employee) => (
                        <div className="py-1">
                          <Button
                            variant="outline"
                            className="text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
                            loading={endingProbationId === emp.id}
                            onClick={(e: any) => {
                              e.stopPropagation();
                              handleEndProbation(emp.id);
                            }}
                          >
                            End Probation
                          </Button>
                        </div>
                      ),
                    },
                  ]
                : []),
              {
                key: "statutory",
                header: "Statutory Info",
                render: (emp: Employee) => (
                  <div className="py-1">
                    <div className="text-xs font-medium text-gray-600">
                      <span className="text-[10px] text-gray-400 uppercase mr-1">
                        TIN:
                      </span>
                      {emp.tin_number || "—"}
                    </div>
                    <div className="text-xs font-medium text-gray-600">
                      <span className="text-[10px] text-gray-400 uppercase mr-1">
                        PEN:
                      </span>
                      {emp.pension_number || "—"}
                    </div>
                  </div>
                ),
              },
              {
                key: "actions",
                stopPropagation: true,
                header: <div className="text-center">Actions</div>,
                render: (emp: Employee) => (
                  <div className="flex justify-center">
                    <ActionMenu
                      actions={[
                        {
                          label: "View Profile",
                          value: "view",
                          icon: <FiEye size={14} />,
                          onClick: () => navigate(`/admin/employees/${emp.id}`),
                        },
                        {
                          label: "Export Data",
                          value: "export",
                          icon: <FiDownload size={14} />,
                          onClick: () => openExportModal("SINGLE", emp.id),
                        },
                        ...(activeTab === "pending"
                          ? [
                              {
                                label: "Approve",
                                value: "approve",
                                icon: <FiUserPlus size={14} />,
                                onClick: () => openApproveModal(emp),
                              },
                            ]
                          : []),
                        ...(activeTab === "inactive"
                          ? [
                              {
                                label: "Activate",
                                value: "activate",
                                icon: <FiUserPlus size={14} />,
                                onClick: () => openActivateModal(emp),
                              },
                            ]
                          : []),
                        {
                          label: "Deactivate",
                          value: "deactivate",
                          icon: <FiTrash2 size={14} />,
                          onClick: () => openDeleteModal(emp, false),
                          variant: "danger",
                        },
                        {
                          label: "Hard Delete Forever",
                          value: "hardDelete",
                          icon: <FiTrash2 size={14} />,
                          onClick: () => openDeleteModal(emp, true),
                          variant: "danger",
                        },
                      ]}
                    />
                  </div>
                ),
                className:
                  "w-[80px] sticky right-0 bg-white z-10 border-l border-gray-100 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]",
              },
            ]}
          />
        </div>
      </div>

      {/* APPROVE CONFIRMATION MODAL */}
      {isApproveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <FiUser className="text-green-600 text-xl" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Approve Employee
              </h3>
              <p className="text-gray-500">
                Are you sure you want to approve{" "}
                <span className="font-semibold text-gray-900">
                  {employeeToApprove?.full_name}
                </span>
                ? They will be moved to the Active Employees list.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50"
                onClick={() => setIsApproveModalOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200 border-transparent"
                onClick={confirmApprove}
                loading={loading}
              >
                Approve
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <FiTrash2 className="text-red-600 text-xl" />
              </div>
              <h3
                className={`text-xl font-black mb-2 ${
                  isHardDelete ? "text-red-800" : "text-gray-900"
                }`}
              >
                {isHardDelete ? "DELETE FOREVER?" : "Delete Employee"}
              </h3>
              <p className="text-gray-500 mb-6">
                {isHardDelete ? (
                  <>
                    You are about to{" "}
                    <span className="text-red-700 font-bold uppercase">
                      permanently erase
                    </span>{" "}
                    <span className="font-bold text-gray-900">
                      {employeeToDelete?.full_name}
                    </span>{" "}
                    and all their related data. This cannot be undone.
                  </>
                ) : (
                  <>
                    Are you sure you want to deactivate{" "}
                    <span className="font-semibold text-gray-900">
                      {employeeToDelete?.full_name}
                    </span>
                    ?
                  </>
                )}
              </p>

              {isHardDelete ? (
                <div className="bg-red-600 p-4 rounded-xl text-white text-left mb-6 shadow-lg shadow-red-200">
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={isHardDelete}
                        onChange={() => setIsHardDelete(!isHardDelete)}
                        className="w-5 h-5 accent-white cursor-pointer border-white/30"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-wider">
                        I understand this is permanent
                      </p>
                      <p className="text-[11px] text-red-100 leading-tight mt-1">
                        This will purge all salaries, leave history, documents,
                        and identity records from the database forever.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-start gap-3 text-left mb-6">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={isHardDelete}
                      onChange={() => setIsHardDelete(!isHardDelete)}
                      className="w-4! h-4! accent-primary"
                    />
                  </div>
                  <div>
                    <label
                      className="text-sm font-bold text-orange-800 cursor-pointer block"
                      onClick={() => setIsHardDelete(!isHardDelete)}
                    >
                      Switch to Hard Delete
                    </label>
                    <p className="text-[11px] text-orange-700/70 leading-tight mt-1">
                      Use this only for cleaning up test data or fixing
                      registration mistakes.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 text-white shadow-md border-transparent font-bold ${
                  isHardDelete
                    ? "bg-red-600 hover:bg-red-700 shadow-red-300"
                    : "bg-red-500 hover:bg-red-600"
                }`}
                onClick={confirmDelete}
                disabled={loading}
              >
                {loading
                  ? isHardDelete
                    ? "PURGING..."
                    : "Deleting..."
                  : isHardDelete
                    ? "PURGE FOREVER"
                    : "Deactivate"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVATE CONFIRMATION MODAL */}
      {isActivateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <FiUserPlus className="text-green-600 text-xl" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Activate Employee
              </h3>
              <p className="text-gray-500">
                Are you sure you want to activate{" "}
                <span className="font-semibold text-gray-900">
                  {employeeToActivate?.full_name}
                </span>
                ? They will be moved to the Active Employees list.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50"
                onClick={() => setIsActivateModalOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200 border-transparent"
                onClick={confirmActivate}
                disabled={loading}
              >
                {loading ? "Activating..." : "Activate"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT MODAL */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        scope={exportScope}
        employeeId={exportEmployeeId}
        selectedIds={selectedIds}
        totalCount={pagination?.total || 0}
      />
    </AdminLayout>
  );
}
