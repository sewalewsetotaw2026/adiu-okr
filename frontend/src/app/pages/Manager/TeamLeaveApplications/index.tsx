import { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import { useManagerSlice } from "../../../slice/managerSlice";
import { useLeaveSlice, leaveActions } from "../../../slice/leaveSlice";
import {
  selectTeamLeaveApplications,
  selectManagerLoading,
  selectManagerPagination,
} from "../../../slice/managerSlice/selectors";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import {
  MdCalendarToday,
  MdRefresh,
  MdCheck,
  MdClose,
  MdVisibility,
  MdInsertDriveFile,
  MdReplay,
} from "react-icons/md";
import { FiDownload } from "react-icons/fi";
import LeaveExportModal from "../../../components/exports/LeaveExportModal";
import toast from "react-hot-toast";
import Modal from "../../../components/common/Modal";
import StatusBadge from "../../../components/common/StatusBadge";
import Button from "../../../components/Core/ui/Button";
import DataTable, { TableColumn } from "../../../components/common/DataTable";
import TabBar, { Tab } from "../../../components/common/TabBar";
import FilterBar, { FilterConfig } from "../../../components/common/FilterBar";
import {
  ActionMenu,
  ActionOption,
} from "../../../components/common/ActionMenu";
import {
  LeaveApplication,
  LeaveType,
  OnLeaveDetailedEmployee,
} from "../../../slice/leaveSlice/types";
import {
  selectLeaveLoading,
  selectLeaveSuccess,
  selectLeaveError,
  selectLeaveMessage,
  selectLeaveTypes,
  selectOnLeaveEmployees,
  selectOnLeavePagination,
  selectOnLeaveLoading,
} from "../../../slice/leaveSlice/selectors";
import FormField from "../../../components/common/FormField";
import { getFileUrl } from "../../../utils/fileUtils";
import { formatDate, formatIsoDate } from "../../../utils/dayjs-format";

// Helper to get display status
const getBadgeStatus = (status: string, cancellationStatus?: string): string => {
  if (cancellationStatus && ["PENDING_SUPERVISOR", "PENDING_HR", "PENDING_CEO"].includes(cancellationStatus)) {
    return `Cancellation: ${cancellationStatus.replace("PENDING_", "").charAt(0) + cancellationStatus.replace("PENDING_", "").slice(1).toLowerCase()}`;
  }
  if (!status) return "Unknown";
  if (status === "PENDING_SUPERVISOR") return "Pending Manager";
  if (status === "PENDING_MANAGER_APPROVAL") return "Pending HR";
  if (status.startsWith("PENDING")) return "Pending";
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
};

type TabId = "on_leave" | "pending" | "all";

interface TeamLeaveApplicationsProps {
  isEmbedded?: boolean;
  defaultTab?: TabId;
}

export default function TeamLeaveApplications({
  isEmbedded = false,
  defaultTab = "pending",
}: TeamLeaveApplicationsProps) {
  const { actions: managerActions } = useManagerSlice();
  useLeaveSlice();
  const dispatch = useDispatch();
  const location = useLocation();

  // Selectors
  const applications = useSelector(
    selectTeamLeaveApplications,
  ) as LeaveApplication[];
  const onLeaveEmployees = useSelector(selectOnLeaveEmployees);
  const user = useSelector(selectAuthUser);
  const loading = useSelector(selectManagerLoading);
  const managerPagination = useSelector(selectManagerPagination);
  const onLeavePagination = useSelector(selectOnLeavePagination);
  const onLeaveLoading = useSelector(selectOnLeaveLoading);

  const actionLoading = useSelector(selectLeaveLoading);
  const actionSuccess = useSelector(selectLeaveSuccess);
  const actionError = useSelector(selectLeaveError);
  const actionMessage = useSelector(selectLeaveMessage);
  const leaveTypes = useSelector(selectLeaveTypes) as LeaveType[];

  const roleName = (
    (user as any)?.role?.name ||
    (user as any)?.role ||
    ""
  ).toString();
  const canUseDepartmentFilter =
    roleName.toLowerCase().includes("admin") ||
    roleName.toLowerCase().includes("hr");

  // Local state
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [selectedLeave, setSelectedLeave] = useState<LeaveApplication | null>(
    null,
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [recallReason, setRecallReason] = useState("");
  const [recallDate, setRecallDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [pendingFocusApplicationId, setPendingFocusApplicationId] = useState<
    number | null
  >(null);
  const [showApproveCancellationModal, setShowApproveCancellationModal] = useState(false);
  const [showRejectCancellationModal, setShowRejectCancellationModal] = useState(false);
  const [cancellationComments, setCancellationComments] = useState("");
  const [cancellationRejectionReason, setCancellationRejectionReason] = useState("");

  // Support deep links from notifications: /manager/team-leaves?tab=pending
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = (params.get("tab") || "").toLowerCase();
    const applicationId = params.get("applicationId");

    if (
      tab === "pending" ||
      tab === "pending-approvals" ||
      tab === "pending_approvals"
    ) {
      setActiveTab("pending");
    } else if (tab === "all") {
      setActiveTab("all");
    } else if (tab === "on_leave" || tab === "on-leave") {
      setActiveTab("on_leave");
    }

    if (applicationId) {
      const parsed = Number(applicationId);
      if (!Number.isNaN(parsed)) {
        setPendingFocusApplicationId(parsed);
      }
    }
  }, [location.search]);

  // Support deep links from notifications: /manager/team-leaves?tab=pending
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = (params.get("tab") || "").toLowerCase();

    if (
      tab === "pending" ||
      tab === "pending-approvals" ||
      tab === "pending_approvals"
    ) {
      setActiveTab("pending");
    } else if (tab === "all") {
      setActiveTab("all");
    } else if (tab === "on_leave" || tab === "on-leave") {
      setActiveTab("on_leave");
    }
  }, [location.search]);

  // Build API params properly from filters
  const buildApiParams = useMemo(() => {
    const params: Record<string, any> = { page, limit };

    // Only include non-empty filter values
    if (filters.search && filters.search.trim()) {
      params.search = filters.search.trim();
    }
    if (filters.leave_type_id && filters.leave_type_id !== "__all__") {
      params.leave_type_id = filters.leave_type_id;
    }
    if (
      filters.status &&
      filters.status !== "ALL" &&
      filters.status !== "__all__"
    ) {
      params.status = filters.status;
    }
    if (filters.sortBy && filters.sortBy !== "__none__") {
      params.sortBy = filters.sortBy;
    }
    if (filters.order) {
      params.order = filters.order;
    }
    if (canUseDepartmentFilter && filters.department_id) {
      params.department_id = filters.department_id;
    }
    if (filters.job_title_id) {
      params.job_title_id = filters.job_title_id;
    }
    if (filters.start_date) {
      params.start_date = filters.start_date;
    }
    if (filters.end_date) {
      params.end_date = filters.end_date;
    }

    return params;
  }, [page, limit, filters, canUseDepartmentFilter]);

  const exportFilters = useMemo(
    () => ({
      ...filters,
      status: activeTab === "on_leave" ? "APPROVED" : filters.status,
      start_date: filters.start_date,
      end_date: filters.end_date,
      search: filters.search,
      leave_type_id: filters.leave_type_id,
      department_id: canUseDepartmentFilter ? filters.department_id : undefined,
    }),
    [filters, activeTab, canUseDepartmentFilter],
  );

  // Fetch data on mount and when filters/page change
  useEffect(() => {
    if (activeTab === "on_leave") {
      if (user?.employee_id) {
        dispatch(
          leaveActions.getOnLeaveEmployeesRequest({
            manager_id: user.employee_id,
            ...buildApiParams,
          }),
        );
      }
    } else {
      dispatch(managerActions.getTeamLeaveApplications(buildApiParams));
    }
  }, [dispatch, managerActions, buildApiParams, user?.employee_id, activeTab]);

  // Handle action results
  useEffect(() => {
    if (actionSuccess && actionMessage) {
      toast.success(actionMessage);
      // Refresh current tab data
      if (activeTab === "on_leave") {
        if (user?.employee_id) {
          dispatch(
            leaveActions.getOnLeaveEmployeesRequest({
              manager_id: user.employee_id,
              ...buildApiParams,
            }),
          );
        }
      } else {
        dispatch(managerActions.getTeamLeaveApplications(buildApiParams));
      }

      setShowRecallModal(false);
      setShowApproveCancellationModal(false);
      setShowRejectCancellationModal(false);
      setApprovalComment("");
      setRejectionReason("");
      setRecallReason("");
      setRecallDate("");
      setCancellationComments("");
      setCancellationRejectionReason("");
      dispatch(leaveActions.resetState());
    }
    if (actionError) {
      toast.error(actionError);
      dispatch(leaveActions.resetState());
    }
  }, [
    actionSuccess,
    actionError,
    actionMessage,
    dispatch,
    managerActions,
    buildApiParams,
    activeTab,
    user?.employee_id,
  ]);

  const handleRefresh = () => {
    if (activeTab === "on_leave") {
      if (user?.employee_id) {
        dispatch(
          leaveActions.getOnLeaveEmployeesRequest({
            manager_id: user.employee_id,
            ...buildApiParams,
          }),
        );
      }
    } else {
      dispatch(managerActions.getTeamLeaveApplications(buildApiParams));
    }
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  const handleViewDetails = (leave: LeaveApplication) => {
    setSelectedLeave(leave);
    setShowDetailModal(true);
  };

  const handleApprove = (leave: LeaveApplication) => {
    setSelectedLeave(leave);
    setShowApproveModal(true);
  };

  const handleReject = (leave: LeaveApplication) => {
    setSelectedLeave(leave);
    setShowRejectModal(true);
  };

  const handleRecall = (leave: LeaveApplication) => {
    setSelectedLeave(leave);
    setRecallDate(formatIsoDate(new Date())); // Default to today
    setShowRecallModal(true);
  };

  const handleApproveCancellation = (leave: LeaveApplication) => {
    setSelectedLeave(leave);
    setShowApproveCancellationModal(true);
  };

  const handleRejectCancellation = (leave: LeaveApplication) => {
    setSelectedLeave(leave);
    setShowRejectCancellationModal(true);
  };

  const confirmApprove = () => {
    if (selectedLeave) {
      dispatch(
        leaveActions.approveLeaveRequest({
          id: selectedLeave.id,
          status: "APPROVED_BY_MANAGER",
          comments: approvalComment || "Approved by manager",
        }),
      );
    }
  };

  const confirmReject = () => {
    if (selectedLeave && rejectionReason) {
      dispatch(
        leaveActions.rejectLeaveRequest({
          id: selectedLeave.id,
          rejection_reason: rejectionReason,
        }),
      );
    } else {
      toast.error("Please provide a rejection reason");
    }
  };

  const confirmRecall = () => {
    if (selectedLeave && recallReason && recallDate) {
      dispatch(
        leaveActions.createRecallRequest({
          leave_application_id: selectedLeave.id,
          reason: recallReason,
          recall_date: recallDate,
        }),
      );
    } else {
      toast.error("Please provide recall reason and date");
    }
  };

  const confirmApproveCancellation = () => {
    if (selectedLeave) {
      dispatch(
        leaveActions.approveLeaveCancellationRequest({
          id: selectedLeave.id,
          comments: cancellationComments || "Approved by manager",
        }),
      );
    }
  };

  const confirmRejectCancellation = () => {
    if (selectedLeave && cancellationRejectionReason) {
      dispatch(
        leaveActions.rejectLeaveCancellationRequest({
          id: selectedLeave.id,
          reason: cancellationRejectionReason,
        }),
      );
    } else {
      toast.error("Please provide a rejection reason");
    }
  };

  const canTakeAction = (leave: LeaveApplication): boolean => {
    return (
      leave.current_status === "PENDING_MANAGER_APPROVAL" ||
      leave.current_status === "PENDING_SUPERVISOR"
    );
  };

  const canApproveCancellation = (leave: LeaveApplication): boolean => {
    if (!leave.cancellation_status) return false;
    
    // Simplistic check - matching how the backend routes/filters work
    if (roleName === "HR" || roleName === "ADMIN") return true;
    
    // Supervisor case
    return leave.cancellation_status === "PENDING_SUPERVISOR";
  };

  const canRecall = (leave: LeaveApplication): boolean => {
    return leave.current_status === "APPROVED";
  };

  // Helper to map flat OnLeaveDetailedEmployee to LeaveApplication for modal compatibility
  const mapToLeaveApplication = (
    emp: OnLeaveDetailedEmployee,
  ): LeaveApplication => {
    return {
      ...emp,
      id: (emp as any).id || emp.application_id, // Ensure ID is present
      employee: {
        id: emp.employee_id,
        full_name: emp.full_name,
        profile_picture_url: emp.profile_picture_url,
        employments: [
          {
            department: { name: emp.department },
            job_title: { name: emp.job_title }, // Map to nested expectation
            // Also support jobTitle.name just in case
            jobTitle: { name: emp.job_title },
          },
        ],
      },
      leaveType: {
        name: emp.leave_type,
      },
      leave_type_id: (emp as any).leave_type_id,
      current_status: (emp as any).current_status || "APPROVED",
      start_date: emp.start_date,
      end_date: emp.end_date,
      return_date: emp.return_date,
      requested_days: emp.requested_days,
      reason: (emp as any).reason,
    } as unknown as LeaveApplication;
  };

  // Calculate data for each tab
  const pendingApplications = useMemo(() => {
    return applications.filter(
      (app) =>
        app.current_status === "PENDING_MANAGER_APPROVAL" ||
        app.current_status === "PENDING_SUPERVISOR" ||
        (app.cancellation_status && ["PENDING_SUPERVISOR", "PENDING_HR", "PENDING_CEO"].includes(app.cancellation_status)),
    );
  }, [applications]);

  useEffect(() => {
    if (!pendingFocusApplicationId) return;

    const combined: LeaveApplication[] = [
      ...applications,
      ...onLeaveEmployees.map(mapToLeaveApplication),
    ];

    const target = combined.find(
      (item) => Number(item.id) === Number(pendingFocusApplicationId),
    );

    if (target) {
      setSelectedLeave(target);
      setShowDetailModal(true);
      setPendingFocusApplicationId(null);
    }
  }, [
    pendingFocusApplicationId,
    applications,
    onLeaveEmployees,
    mapToLeaveApplication,
  ]);

  // Apply local filtering for search
  const filteredDisplayData = useMemo(() => {
    let data: LeaveApplication[] = [];

    if (activeTab === "on_leave") {
      // Backend handles pagination and filtering for on_leave now
      data = onLeaveEmployees.map(mapToLeaveApplication);
    } else if (activeTab === "pending") {
      data = [...pendingApplications];
    } else {
      data = [...applications];
    }

    // Only apply client-side search if NOT activeTab === "on_leave" (unless key filters are missing from backend)
    // Actually, backend now handles search for on_leave too.
    // Ideally we skip client filtering for on_leave if backend does it.
    if (activeTab !== "on_leave") {
      if (filters.search && filters.search.trim()) {
        const searchTerm = filters.search.toLowerCase();
        data = data.filter(
          (app) =>
            app.employee?.full_name?.toLowerCase().includes(searchTerm) ||
            app.leaveType?.name?.toLowerCase().includes(searchTerm),
        );
      }

      // Apply local leave type filter if backend doesn't (assuming backend does for on_leave)
      if (filters.leave_type_id && filters.leave_type_id !== "__all__") {
        data = data.filter(
          (app) => String(app.leave_type_id) === String(filters.leave_type_id),
        );
      }
    }

    // Apply local status filter for "all" tab
    if (
      activeTab === "all" &&
      filters.status &&
      filters.status !== "ALL" &&
      filters.status !== "__all__"
    ) {
      data = data.filter((app) => app.current_status === filters.status);
    }

    return data;
  }, [activeTab, onLeaveEmployees, pendingApplications, applications, filters]);

  const tabs: Tab[] = [
    {
      id: "on_leave",
      label: "Currently on Leave",
      count: onLeaveEmployees.length,
    },
    {
      id: "pending",
      label: "Pending Approval",
      count: pendingApplications.length,
    },
    { id: "all", label: "All Applications" },
  ];

  // Table columns for applications
  const applicationColumns: TableColumn<LeaveApplication>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (leave) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
            {(leave.employee as any)?.profile_picture_url ? (
              <img
                src={getFileUrl((leave.employee as any).profile_picture_url)}
                alt={leave.employee?.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-gray-500">
                {leave.employee?.full_name?.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium text-k-dark-grey">
              {leave.employee?.full_name || "-"}
            </p>
            <p className="text-xs text-gray-400">
              {leave.employee?.employments?.[0]?.department?.name || ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "leaveType",
      header: "Leave Type",
      render: (leave) => leave.leaveType?.name || "-",
    },
    {
      key: "days",
      header: "Days",
      render: (leave) => `${leave.requested_days || 0} days`,
    },
    {
      key: "startDate",
      header: "Start Date",
      render: (leave) => formatDate(leave.start_date),
    },
    {
      key: "endDate",
      header: "End Date",
      render: (leave) => formatDate(leave.end_date),
    },
    {
      key: "status",
      header: "Status",
      render: (leave) => (
        <StatusBadge status={getBadgeStatus(leave.current_status, leave.cancellation_status)} />
      ),
    },
    {
      key: "attachment",
      header: "Attachment",
      className: "text-center",
      render: (leave) => (
        <div className="flex items-center justify-center">
          {leave.attachment_url ? (
            <a
              href={leave.attachment_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 text-primary hover:text-primary-dark hover:bg-primary-light rounded-lg transition-colors cursor-pointer"
              title="View Attachment"
            >
              <MdInsertDriveFile size={18} />
            </a>
          ) : (
            <span className="text-gray-400 text-sm">-</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-center",
      render: (leave) => {
        const actions: ActionOption[] = [
          {
            label: "View Details",
            value: "view",
            icon: <MdVisibility className="text-gray-500" />,
            onClick: () => handleViewDetails(leave),
          },
        ];
        if (canTakeAction(leave)) {
          actions.push({
            label: "Approve",
            value: "approve",
            icon: <MdCheck className="text-green-500" />,
            onClick: () => handleApprove(leave),
          });
          actions.push({
            label: "Reject",
            value: "reject",
            icon: <MdClose className="text-red-500" />,
            onClick: () => handleReject(leave),
            variant: "danger",
          });
        }
        if (canApproveCancellation(leave)) {
          actions.push({
            label: "Approve Cancellation",
            value: "approve-cancellation",
            icon: <MdCheck className="text-orange-500" />,
            onClick: () => handleApproveCancellation(leave),
          });
          actions.push({
            label: "Reject Cancellation",
            value: "reject-cancellation",
            icon: <MdClose className="text-red-500" />,
            onClick: () => handleRejectCancellation(leave),
            variant: "danger",
          });
        }
        return <ActionMenu actions={actions} />;
      },
    },
  ];

  // On leave columns matching Admin view for consistency
  const onLeaveColumns: TableColumn<OnLeaveDetailedEmployee>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (emp) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
            {emp.profile_picture_url ? (
              <img
                src={getFileUrl(emp.profile_picture_url)}
                alt={emp.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-gray-500">
                {emp.full_name?.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium text-k-dark-grey">{emp.full_name}</p>
            {emp.job_title && (
              <p className="text-xs text-gray-500">{emp.job_title}</p>
            )}
            {emp.department && (
              <p className="text-xs text-gray-500">{emp.department}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "leaveInfo",
      header: "Leave Details",
      render: (emp) => (
        <div>
          <p className="font-medium text-k-dark-grey">{emp.leave_type}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                emp.is_paid
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {emp.is_paid ? "Paid" : "Unpaid"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "duration",
      header: "Duration",
      render: (emp) => (
        <div>
          <p className="text-sm text-k-dark-grey">{emp.requested_days} days</p>
          <p className="text-xs text-gray-400">
            {formatDate(emp.start_date)} - {formatDate(emp.end_date)}
          </p>
        </div>
      ),
    },
    {
      key: "returnDate",
      header: "Return Date",
      render: (emp) => (
        <div className="flex items-center gap-2">
          <MdCalendarToday className="text-gray-400" size={16} />
          <span className="text-sm font-medium">
            {formatDate(emp.return_date)}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-center",
      render: (emp) => {
        const mappedLeave = mapToLeaveApplication(emp);
        const actions: ActionOption[] = [
          {
            label: "View Details",
            value: "view",
            icon: <MdVisibility className="text-gray-500" />,
            onClick: () => handleViewDetails(mappedLeave),
          },
        ];

        // Only show recall if actively on leave (which they should be if in this list)
        actions.push({
          label: "Recall",
          value: "recall",
          icon: <MdReplay className="text-primary" />,
          onClick: () => handleRecall(mappedLeave),
        });

        return (
          <div
            className="flex justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <ActionMenu actions={actions} />
          </div>
        );
      },
    },
  ];

  const getColumns = () => {
    if (activeTab === "on_leave") {
      return onLeaveColumns;
    }
    return applicationColumns;
  };

  const content = (
    <>
      {!isEmbedded && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-k-dark-grey flex items-center gap-3">
              <MdCalendarToday className="text-k-orange" />
              Team Leave Applications
            </h1>
          <p className="text-gray-500 text-sm mt-1">
            Review and manage leave requests from your team members
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setIsExportModalOpen(true)}
            variant="outline"
            icon={FiDownload}
          >
            {selectedIds.length > 0
              ? `Export (${selectedIds.length})`
              : "Export"}
          </Button>
          <Button
            onClick={handleRefresh}
            variant="secondary"
            icon={MdRefresh}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>
      )}

      <div className="bg-white rounded-2xl shadow-card p-6">
        {/* TABS */}
        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => {
            setActiveTab(id as TabId);
            setPage(1);
          }}
          className="mb-6"
        />

        {/* Filter Panel */}
        <div className="mb-6">
          <FilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            showSearch={true}
            showSort={true}
            storageKey="manager_team_leave_filters_pinned"
            sortOptions={[
              { value: "created_at", label: "Date Applied" },
              { value: "start_date", label: "Start Date" },
              { value: "days", label: "Duration" },
            ]}
            config={[
              {
                key: "department_id",
                label: "Department",
                type: "autocomplete",
                autocompleteType: "departments",
                visible: canUseDepartmentFilter,
              },
              {
                key: "job_title_id",
                label: "Job Title",
                type: "autocomplete",
                autocompleteType: "jobTitles",
                visible: true,
              },
              {
                key: "leave_type_id",
                label: "Leave Type",
                type: "select",
                options: [
                  { label: "All Leave Types", value: "__all__" },
                  ...leaveTypes.map((t) => ({
                    label: t.name,
                    value: String(t.id),
                  })),
                ],
                visible: true,
              },
              {
                key: "gender",
                label: "Gender",
                type: "select",
                options: [
                  { label: "All Genders", value: "__all__" },
                  { label: "Male", value: "Male" },
                  { label: "Female", value: "Female" },
                ],
                visible: true,
              },
              {
                key: "status",
                label: "Status",
                type: "select",
                options: [
                  { label: "All Statuses", value: "ALL" },
                  { label: "Pending", value: "PENDING" },
                  { label: "Approved", value: "APPROVED" },
                  { label: "Rejected", value: "REJECTED" },
                ],
                visible: activeTab === "all",
              },
              {
                key: "start_date",
                label: "Start Date From",
                type: "date",
                visible: true,
              },
              {
                key: "end_date",
                label: "End Date To",
                type: "date",
                visible: true,
              },
            ]}
          />
        </div>
        <DataTable
          data={
            // Backend handles pagination for 'on_leave' now, no need to slice client-side
            activeTab === "on_leave"
              ? (filteredDisplayData as any[])
              : (filteredDisplayData as any[])
          }
          columns={getColumns() as any}
          loading={
            activeTab === "on_leave"
              ? onLeaveLoading
              : loading && activeTab !== "on_leave"
          }
          keyExtractor={(item) => String(item.id || Math.random())}
          enableSelection={true}
          selectedIds={selectedIds}
          onSelectionChange={(ids) => setSelectedIds(ids)}
          emptyState={{
            icon: MdCalendarToday,
            title:
              activeTab === "pending" ? "No Pending Requests" : "No Data Found",
            description:
              activeTab === "pending"
                ? "There are no leave requests pending your approval."
                : "No leave records found matching your filters.",
          }}
          className="shadow-none"
          onRowClick={activeTab !== "on_leave" ? handleViewDetails : undefined}
          pagination={{
            currentPage: page,
            totalPages:
              (activeTab === "on_leave"
                ? onLeavePagination?.totalPages
                : managerPagination?.totalPages) || 1,
            totalItems:
              (activeTab === "on_leave"
                ? onLeavePagination?.total
                : managerPagination?.total) || 0,
            itemsPerPage: limit,
            onPageChange: setPage,
          }}
          itemLabel="application"
        />
      </div>

      <LeaveExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        scope={selectedIds.length > 0 ? "SELECTION" : "BULK"}
        ids={selectedIds}
        title={
          selectedIds.length > 0
            ? `Export Selected (${selectedIds.length})`
            : activeTab === "on_leave"
              ? "Export Employees On Leave"
              : "Export Team Leaves"
        }
        filters={{
          ...exportFilters,
        }}
      />

      {/* Leave Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Leave Application Details"
        size="lg"
      >
        {selectedLeave && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Employee
                </p>
                <p className="text-sm font-medium text-k-dark-grey">
                  {selectedLeave.employee?.full_name || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Department
                </p>
                <p className="text-sm font-medium text-k-dark-grey">
                  {selectedLeave.employee?.employments?.[0]?.department?.name ||
                    "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Leave Type
                </p>
                <p className="text-sm font-medium text-k-dark-grey">
                  {selectedLeave.leaveType?.name || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Requested Days
                </p>
                <p className="text-sm font-medium text-k-dark-grey">
                  {selectedLeave.requested_days} days
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Start Date
                </p>
                <p className="text-sm font-medium text-k-dark-grey">
                  {formatDate(selectedLeave.start_date)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  End Date
                </p>
                <p className="text-sm font-medium text-k-dark-grey">
                  {formatDate(selectedLeave.end_date)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Return Date
                </p>
                <p className="text-sm font-medium text-k-dark-grey">
                  {formatDate(selectedLeave.return_date)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Status
                </p>
                <StatusBadge
                  status={getBadgeStatus(selectedLeave.current_status, selectedLeave.cancellation_status)}
                />
              </div>
            </div>

            {selectedLeave.cancellation_status && (
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                <p className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-2">
                  <MdRefresh className="rotate-180" />
                  Early Return Request
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-orange-600 mb-1">
                      Requested Return Date
                    </p>
                    <p className="text-sm font-medium text-orange-900">
                      {formatDate(selectedLeave.requested_return_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-orange-600 mb-1">
                      Request Status
                    </p>
                    <p className="text-sm font-medium text-orange-900">
                      {selectedLeave.cancellation_status.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
                {selectedLeave.cancellation_reason && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-orange-600 mb-1">
                      Reason for Early Return
                    </p>
                    <p className="text-sm text-orange-900 bg-white/50 p-2 rounded-lg italic">
                      "{selectedLeave.cancellation_reason}"
                    </p>
                  </div>
                )}
              </div>
            )}

            {selectedLeave.reason && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Reason
                </p>
                <p className="text-sm font-medium text-k-dark-grey bg-gray-50 p-3 rounded-lg">
                  {selectedLeave.reason}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              {canApproveCancellation(selectedLeave) && (
                <>
                  <Button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleRejectCancellation(selectedLeave);
                    }}
                    variant="secondary"
                    icon={MdClose}
                  >
                    Reject Cancellation
                  </Button>
                  <Button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleApproveCancellation(selectedLeave);
                    }}
                    variant="primary"
                    icon={MdCheck}
                    className="bg-orange-600 hover:bg-orange-700 border-orange-600"
                  >
                    Approve Cancellation
                  </Button>
                </>
              )}
              {canRecall(selectedLeave) && (
                <Button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleRecall(selectedLeave);
                  }}
                  variant="secondary"
                  icon={MdReplay}
                >
                  Recall
                </Button>
              )}
              {canTakeAction(selectedLeave) && (
                <>
                  <Button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleReject(selectedLeave);
                    }}
                    variant="secondary"
                    icon={MdClose}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleApprove(selectedLeave);
                    }}
                    variant="primary"
                    icon={MdCheck}
                  >
                    Approve
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Leave Request"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to approve{" "}
            {selectedLeave?.employee?.full_name}'s{" "}
            {selectedLeave?.leaveType?.name} request for{" "}
            {selectedLeave?.requested_days} days?
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Comment (Optional)
            </label>
            <textarea
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-k-orange"
              rows={3}
              placeholder="Add a comment..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => setShowApproveModal(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmApprove}
              variant="primary"
              loading={actionLoading}
            >
              Approve
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Leave Request"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting{" "}
            {selectedLeave?.employee?.full_name}'s leave request.
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
              placeholder="Enter rejection reason..."
              required
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => setShowRejectModal(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmReject}
              variant="primary"
              loading={actionLoading}
              className="bg-red-600! hover:bg-red-700!"
            >
              Reject
            </Button>
          </div>
        </div>
      </Modal>

      {/* Recall Modal */}
      <Modal
        isOpen={showRecallModal}
        onClose={() => setShowRecallModal(false)}
        title="Recall Employee from Leave"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-primary-light/50 border border-primary-light p-4 rounded-lg">
            <p className="text-sm text-primary-dark">
              Are you sure you want to recall this employee from leave?
            </p>
            <p className="text-xs text-primary mt-2">
              You are about to recall{" "}
              <strong>{selectedLeave?.employee?.full_name}</strong> from their{" "}
              <strong>{selectedLeave?.leaveType?.name}</strong> leave (
              {selectedLeave?.requested_days} days).
            </p>
            <p className="text-xs text-orange-600 mt-2">
              The employee will receive an email and in-app notification and
              must accept or decline the recall request.
            </p>
          </div>

          <FormField
            label="Recall Date"
            name="recallDate"
            type="date"
            value={recallDate}
            onChange={(e) => setRecallDate(e.target.value)}
            required
            min={formatIsoDate(new Date())}
            max={selectedLeave?.end_date?.split("T")[0]}
          />

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Reason for Recall <span className="text-red-500">*</span>
            </label>
            <textarea
              value={recallReason}
              onChange={(e) => setRecallReason(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-k-orange"
              rows={3}
              placeholder="Explain why this employee needs to return early..."
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => setShowRecallModal(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRecall}
              variant="primary"
              loading={actionLoading}
              icon={MdReplay}
            >
              Send Recall Request
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approve Cancellation Modal */}
      <Modal
        isOpen={showApproveCancellationModal}
        onClose={() => setShowApproveCancellationModal(false)}
        title="Approve Leave Cancellation"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
            <p className="text-sm text-orange-800">
              You are approving the early return for <strong>{selectedLeave?.employee?.full_name}</strong>.
            </p>
            <p className="text-xs text-orange-700 mt-2">
              New Return Date: <strong>{formatDate(selectedLeave?.requested_return_date)}</strong>
            </p>
            <p className="text-xs text-gray-500 mt-1 italic">
              Reason: "{selectedLeave?.cancellation_reason}"
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Comments (Optional)
            </label>
            <textarea
              value={cancellationComments}
              onChange={(e) => setCancellationComments(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-k-orange"
              rows={3}
              placeholder="Add details about the approval..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => setShowApproveCancellationModal(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmApproveCancellation}
              variant="primary"
              loading={actionLoading}
              className="bg-orange-600 hover:bg-orange-700 border-orange-600"
            >
              Approve Cancellation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Cancellation Modal */}
      <Modal
        isOpen={showRejectCancellationModal}
        onClose={() => setShowRejectCancellationModal(false)}
        title="Reject Leave Cancellation"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting the early return request from <strong>{selectedLeave?.employee?.full_name}</strong>.
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={cancellationRejectionReason}
              onChange={(e) => setCancellationRejectionReason(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
              placeholder="Explain why this request is being rejected..."
              required
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => setShowRejectCancellationModal(false)}
              variant="secondary"
            >
              Back
            </Button>
            <Button
              onClick={confirmRejectCancellation}
              variant="primary"
              loading={actionLoading}
              className="bg-red-600! hover:bg-red-700!"
              disabled={!cancellationRejectionReason}
            >
              Reject Request
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );

  return isEmbedded ? content : <EmployeeLayout>{content}</EmployeeLayout>;
}
