import { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import {
  MdCalendarToday,
  MdRefresh,
  MdVisibility,
  MdCheck,
  MdClose,
  MdInsertDriveFile,
  MdNotifications,
  MdEdit,
  MdSettings,
  MdEvent,
  MdCategory,
  MdReplay,
} from "react-icons/md";
import { FiDownload } from "react-icons/fi";
import LeaveExportModal from "../../../components/exports/LeaveExportModal";
import {
  ActionMenu,
  ActionOption,
} from "../../../components/common/ActionMenu";

// ... (existing imports)

// ... inside component

import toast from "react-hot-toast";
import Modal from "../../../components/common/Modal";
import StatusBadge from "../../../components/common/StatusBadge";
import Button from "../../../components/Core/ui/Button";
import DataTable, { TableColumn } from "../../../components/common/DataTable";
import PageHeader from "../../../components/common/PageHeader";

import TabBar, { Tab } from "../../../components/common/TabBar";
import InfoBanner from "../../../components/common/InfoBanner";
import FilterBar from "../../../components/common/FilterBar";
import FormField from "../../../components/common/FormField";
import { getFileUrl } from "../../../utils/fileUtils";
import { useLeaveSlice, leaveActions } from "../../../slice/leaveSlice";
import { formatDate, formatIsoDate } from "../../../utils/dayjs-format";
import {
  selectLeaveApplications,
  selectPendingApplications,
  selectPendingCancellations,
  selectApplicationsLoading,
  selectLeaveLoading,
  selectLeaveSuccess,
  selectLeaveError,
  selectLeaveMessage,
  selectOnLeaveCount,
  selectOnLeaveEmployees,
  selectExpiringBalances,
  selectExpiringBalancesLoading,
  selectAllCashOutRequests,
  selectCashOutLoading,
  selectPendingCashOutCount,
  selectAllLeaveBalances,
  selectLeaveBalanceLoading,
  selectLeavePagination,
  selectLeaveRecalls,
  selectRecallsLoading,
  selectLeaveTypes,
  selectTabCounts,
  selectTabCountsLoading,
} from "../../../slice/leaveSlice/selectors";
import {
  LeaveApplication,
  LeaveStatus,
  OnLeaveDetailedEmployee,
  ExpiringBalance,
  CashOutRequest,
  LeaveBalance,
  LeaveRecall,
} from "../../../slice/leaveSlice/types";

const formatStatusLabel = (status: string | undefined): string => {
  if (!status) return "Unknown";
  // Handle specific cases
  if (status === "PENDING_SUPERVISOR") return "Pending Supervisor";
  if (status === "PENDING_HR") return "Pending HR";
  if (status === "PENDING_CEO") return "Pending CEO";
  if (status === "APPROVED_BY_MANAGER") return "Approved by Manager";
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  if (status === "CANCELLED") return "Cancelled";

  // Fallback for standard formatting (Capitalize first letter, lower rest)
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
};

const getBadgeStatus = (status: string): string => {
  if (status?.startsWith?.("PENDING")) return "Pending";
  return status?.charAt?.(0) + status?.slice?.(1)?.toLowerCase() || "Unknown";
};

// Sub-navigation cards for Leave Management settings
const subNavCards = [
  {
    id: "leave-types",
    title: "Leave Types",
    description: "Configure leave type settings, allowances, and rules",
    icon: MdCategory,
    path: "/admin/leave-types",
    color: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    id: "public-holidays",
    title: "Public Holidays",
    description: "Manage public holidays for leave calculations",
    icon: MdEvent,
    path: "/admin/public-holidays",
    color: "bg-green-50",
    iconColor: "text-green-600",
  },
  {
    id: "leave-settings",
    title: "Leave Settings",
    description: "Configure accrual, encashment, and notification settings",
    icon: MdSettings,
    path: "/admin/leave-settings",
    color: "bg-purple-50",
    iconColor: "text-purple-600",
  },
];

export default function LeaveManagement() {
  useLeaveSlice();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Redux state
  const rawLeaveApplications = useSelector(selectLeaveApplications);
  const rawPendingApplications = useSelector(selectPendingApplications);
  const rawPendingCancellations = useSelector(selectPendingCancellations);
  const applicationsLoading = useSelector(selectApplicationsLoading);
  const loading = useSelector(selectLeaveLoading);
  const success = useSelector(selectLeaveSuccess);
  const error = useSelector(selectLeaveError);
  const message = useSelector(selectLeaveMessage);

  const onLeaveCount = useSelector(selectOnLeaveCount);
  const onLeaveEmployees = useSelector(selectOnLeaveEmployees);
  const expiringBalances = useSelector(selectExpiringBalances);
  const expiringLoading = useSelector(selectExpiringBalancesLoading);
  const cashOutRequests = useSelector(selectAllCashOutRequests);
  const cashOutLoading = useSelector(selectCashOutLoading);
  const pendingCashOutCount = useSelector(selectPendingCashOutCount);
  const allLeaveBalances = useSelector(selectAllLeaveBalances);
  const balancesLoading = useSelector(selectLeaveBalanceLoading);
  const leaveRecalls = useSelector(selectLeaveRecalls);
  const recallsLoading = useSelector(selectRecallsLoading);
  const leaveTypes = useSelector(selectLeaveTypes);
  const tabCounts = useSelector(selectTabCounts);
  const tabCountsLoading = useSelector(selectTabCountsLoading);

  // Ensure arrays are always arrays
  const leaveApplications = Array.isArray(rawLeaveApplications)
    ? rawLeaveApplications
    : [];
  const pendingApplications = Array.isArray(rawPendingApplications)
    ? rawPendingApplications
    : [];
  const pendingCancellations = Array.isArray(rawPendingCancellations)
    ? rawPendingCancellations
    : [];

  // Local state
  const [selectedLeave, setSelectedLeave] = useState<LeaveApplication | null>(
    null,
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approvalComments, setApprovalComments] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState<string>("on_leave");
  const [pendingFocusApplicationId, setPendingFocusApplicationId] = useState<
    number | null
  >(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const pagination = useSelector(selectLeavePagination);

  // Advanced filter state
  const [filters, setFilters] = useState<Record<string, any>>({
    search: "",
    department_id: "",
    job_title_id: "",
    leave_type_id: "",
    gender: "",
    manager_id: "",
    status: "ALL",
    start_date: "",
    end_date: "",
    sortBy: "",
    order: "asc",
  });

  // Cash-out & Expiring state
  const [selectedCashOut, setSelectedCashOut] = useState<CashOutRequest | null>(
    null,
  );
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [cashOutAction, setCashOutAction] = useState<
    "APPROVE" | "REJECT" | null
  >(null);
  const [showNotifyModal, setShowNotifyModal] = useState(false);

  // Balance Adjustment state
  const [selectedBalance, setSelectedBalance] = useState<LeaveBalance | null>(
    null,
  );
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<
    "add" | "subtract" | "set"
  >("add");
  const [adjustmentDays, setAdjustmentDays] = useState<number>(0);
  const [usedDaysAdjustment, setUsedDaysAdjustment] = useState<number>(0);
  const [usedDaysAdjustmentType, setUsedDaysAdjustmentType] = useState<
    "add" | "subtract" | "set"
  >("add");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  // Recall State
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [recallReason, setRecallReason] = useState("");
  const [recallDate, setRecallDate] = useState("");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Reset pagination and selection when tab or filter changes
  useEffect(() => {
    setPage(1);
    setSelectedIds([]); // Clear row selection on tab switch
  }, [activeTab, filters]);

  // Support deep links from notifications: /admin/leaves?tab=pending&applicationId=123
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    const applicationId = params.get("applicationId");

    if (
      tab &&
      [
        "on_leave",
        "pending",
        "cancellations",
        "all",
        "balances",
        "cash_out",
        "expiring",
        "calendar",
      ].includes(tab)
    ) {
      setActiveTab(tab);
    }

    if (applicationId) {
      const parsed = Number(applicationId);
      if (!Number.isNaN(parsed)) {
        setPendingFocusApplicationId(parsed);
      }
    }
  }, [location.search]);

  useEffect(() => {
    if (!pendingFocusApplicationId) return;

    const combined = [...pendingApplications, ...leaveApplications];
    const target = combined.find(
      (item) => Number(item.id) === Number(pendingFocusApplicationId),
    );

    if (target) {
      setSelectedLeave(target);
      setShowDetailModal(true);
      setPendingFocusApplicationId(null);
    }
  }, [pendingFocusApplicationId, pendingApplications, leaveApplications]);

  // Fetch data on mount and state change
  useEffect(() => {
    const fetchData = () => {
      // Build query params from filter state
      const buildParams = () => {
        const params: any = {
          page,
          limit,
        };

        if (filters.status && filters.status !== "ALL") {
          params.status = filters.status;
        }
        if (filters.department_id) {
          params.department_id = Number(filters.department_id);
        }
        if (filters.job_title_id) {
          params.job_title_id = Number(filters.job_title_id);
        }
        if (filters.leave_type_id) {
          params.leave_type_id = Number(filters.leave_type_id);
        }
        if (filters.gender) {
          params.gender = filters.gender;
        }
        if (filters.manager_id) {
          params.manager_id = filters.manager_id;
        }
        if (filters.search) {
          params.search = filters.search;
        }
        if (filters.start_date) {
          params.start_date = filters.start_date;
        }
        if (filters.end_date) {
          params.end_date = filters.end_date;
        }
        if (filters.sortBy) {
          params.sortBy = filters.sortBy;
          params.order = filters.order || "asc";
        }

        return params;
      };

      const params = buildParams();

      if (activeTab === "balances") {
        dispatch(
          leaveActions.getAllLeaveBalancesRequest({
            ...params,
            year: new Date().getFullYear(),
          } as any),
        );
      } else if (activeTab === "all") {
        dispatch(leaveActions.getAllLeavesRequest(params));
      } else if (activeTab === "pending") {
        dispatch(leaveActions.getPendingLeavesRequest(params));
        dispatch(leaveActions.getPublicHolidaysRequest(undefined));
        dispatch(leaveActions.getUpcomingHolidaysRequest({} as any));
        dispatch(leaveActions.getReliefOfficersRequest());
      } else if (activeTab === "cancellations") {
        dispatch(leaveActions.getPendingCancellationsRequest(params));
      } else if (activeTab === "on_leave") {
        dispatch(leaveActions.getOnLeaveEmployeesRequest(params));
      } else if (activeTab === "calendar") {
        dispatch(
          leaveActions.getAllLeavesRequest({
            ...params,
            year: new Date().getFullYear(),
          } as any),
        );
      } else if (activeTab === "expiring") {
        dispatch(leaveActions.getExpiringBalancesRequest(params));
      } else if (activeTab === "cash_out") {
        dispatch(leaveActions.getAllCashOutRequestsRequest(params));
        dispatch(leaveActions.getAllCashOutRequestsRequest(params));
      } else if (activeTab === "recalls") {
        // Redundant tab, kept for safety but unused
        dispatch(leaveActions.getAllRecallsRequest(params));
      }
    };
    fetchData();

    // Fetch leave types for filter dropdown
    dispatch(leaveActions.getLeaveTypesRequest());

    // Fetch tab counts for dashboard
    dispatch(leaveActions.getTabCountsRequest(filters));
  }, [dispatch, activeTab, refreshTrigger, page, limit, filters]);

  // Handle success/error
  useEffect(() => {
    if (success && message) {
      toast.success(message);
      dispatch(leaveActions.resetState());
      // Refresh data
      setRefreshTrigger((prev) => prev + 1);

      // Close modals
      setShowApproveModal(false);
      setShowRejectModal(false);
      setShowCashOutModal(false);
      setShowNotifyModal(false);
      setShowAdjustModal(false);
      setApprovalComments("");
      setRejectionReason("");
      setAdjustmentDays(0);
      setAdjustmentReason("");
      setRecallReason("");
      setRecallDate("");
      setShowRecallModal(false);
    }
    if (error) {
      toast.error(error);
      dispatch(leaveActions.resetState());
    }
  }, [success, error, message, dispatch]);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleViewDetails = (leave: LeaveApplication) => {
    setSelectedLeave(leave);
    setShowDetailModal(true);
  };

  const handleApprove = (leave: LeaveApplication) => {
    setSelectedLeave(leave);
    setApprovalComments("");
    setShowApproveModal(true);
  };

  const handleReject = (leave: LeaveApplication) => {
    setSelectedLeave(leave);
    setRejectionReason("");
    setShowRejectModal(true);
  };

  const confirmApprove = () => {
    if (selectedLeave) {
      if (activeTab === "cancellations") {
        dispatch(
          leaveActions.approveLeaveCancellationRequest({
            id: selectedLeave.id,
            comments: approvalComments || undefined,
          }),
        );
      } else {
        dispatch(
          leaveActions.approveLeaveRequest({
            id: selectedLeave.id,
            comments: approvalComments || undefined,
          }),
        );
      }
    }
  };

  const confirmReject = () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    if (selectedLeave) {
      if (activeTab === "cancellations") {
        dispatch(
          leaveActions.rejectLeaveCancellationRequest({
            id: selectedLeave.id,
            reason: rejectionReason, // Note: payload uses 'reason' for cancellation
          }),
        );
      } else {
        dispatch(
          leaveActions.rejectLeaveRequest({
            id: selectedLeave.id,
            rejection_reason: rejectionReason,
          }),
        );
      }
    }
  };

  // Cash-out handlers
  const handleCashOutAction = (
    request: CashOutRequest,
    action: "APPROVE" | "REJECT",
  ) => {
    setSelectedCashOut(request);
    setCashOutAction(action);
    setRejectionReason("");
    setShowCashOutModal(true);
  };

  const confirmCashOutAction = () => {
    if (!selectedCashOut || !cashOutAction) return;

    if (cashOutAction === "APPROVE") {
      dispatch(leaveActions.approveCashOutRequest(selectedCashOut.id));
    } else {
      if (!rejectionReason.trim()) {
        toast.error("Please provide a reason for rejection");
        return;
      }
      dispatch(
        leaveActions.rejectCashOutRequest({
          id: selectedCashOut.id,
          rejection_reason: rejectionReason,
        }),
      );
    }
  };

  // Expiring balance handlers
  const handleTriggerNotify = () => {
    setShowNotifyModal(true);
  };

  const confirmNotify = () => {
    dispatch(
      leaveActions.notifyExpiringBalancesRequest({
        days_threshold: 30, // Default to 30 days
      } as any),
    );
  };

  // Balance Adjustment handlers
  const handleAdjustBalance = (balance: LeaveBalance) => {
    setSelectedBalance(balance);
    setAdjustmentDays(0);
    setAdjustmentType("add");
    setUsedDaysAdjustment(0);
    setUsedDaysAdjustmentType("add");
    setAdjustmentReason("");
    setShowAdjustModal(true);
  };

  const confirmAdjustment = () => {
    if (
      !selectedBalance ||
      (!adjustmentDays && !usedDaysAdjustment) ||
      !adjustmentReason
    ) {
      toast.error("Please provide days and a reason for adjustment");
      return;
    }

    dispatch(
      leaveActions.adjustLeaveBalanceRequest({
        id: selectedBalance.id,
        adjustment_days: adjustmentDays,
        adjustment_type: adjustmentType,
        used_days_adjustment: usedDaysAdjustment,
        used_days_adjustment_type: usedDaysAdjustmentType,
        reason: adjustmentReason,
      }),
    );
    setShowAdjustModal(false);
  };

  const handleRecall = (leave: LeaveApplication) => {
    setSelectedLeave(leave);
    // Use ISO string YYYY-MM-DD for date input
    setRecallDate(formatIsoDate(new Date()));
    setShowRecallModal(true);
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

  const canRecall = (leave: LeaveApplication): boolean => {
    // Can only recall if APPROVED (meaning actively on leave or about to go)
    // And not already cancelled/recalled/rejected
    if (!leave.current_status && activeTab === "on_leave") return true; // Assume recallable if on leave
    return (
      leave.current_status === "APPROVED" ||
      leave.current_status === "APPROVED_BY_MANAGER"
    );
  };

  // Can approve/reject based on current status
  const canTakeAction = (leave: LeaveApplication): boolean => {
    return leave.current_status?.startsWith?.("PENDING") || false;
  };

  const getNextStatusMessage = (currentStatus: LeaveStatus): string => {
    switch (currentStatus) {
      case "PENDING_SUPERVISOR":
        return "This will forward the application to HR for review.";
      case "PENDING_HR":
        return "This will forward the application to CEO for final approval (if manager) or approve directly.";
      case "PENDING_CEO":
        return "This will complete the approval process.";
      default:
        return "";
    }
  };

  // Get display data based on tab and filter
  const allApplicationsWithPending = useMemo(() => {
    const allAppsMap = new Map<number, LeaveApplication>();
    leaveApplications.forEach((app) => allAppsMap.set(app.id, app));
    pendingApplications.forEach((app) => {
      if (!allAppsMap.has(app.id)) allAppsMap.set(app.id, app);
    });
    return Array.from(allAppsMap.values());
  }, [leaveApplications, pendingApplications]);

  const actualPendingApplications = useMemo(() => {
    if (pendingApplications.length > 0) return pendingApplications;
    return allApplicationsWithPending.filter(
      (app) => app.current_status?.startsWith?.("PENDING") || false,
    );
  }, [pendingApplications, allApplicationsWithPending]);

  const displayDataSource = useMemo(() => {
    if (activeTab === "on_leave") {
      return onLeaveEmployees.map((emp) => {
        if (!emp.full_name) {
          const fullApp = leaveApplications.find(
            (app) =>
              app.id === (emp as any).id || String(app.id) === emp.employee_id,
          );
          if (fullApp) {
            // Map flat structure back to LeaveApplication for the modal
            const employment0: any = fullApp.employee?.employments?.[0];
            const departmentName: string | undefined =
              employment0?.department?.name || employment0?.department;
            const jobTitleText: string | undefined =
              employment0?.jobTitle?.title ||
              employment0?.jobTitle?.name ||
              (typeof employment0?.job_title === "string"
                ? employment0.job_title
                : undefined);

            // Construct a LeaveApplication-like object that the modal expects
            // Use 'as any' to satisfy TS while providing the nested structure
            const mappedApp: any = {
              ...fullApp,
              id: fullApp.id,
              employee: {
                ...fullApp.employee,
                full_name: fullApp.employee?.full_name,
                employments: [
                  {
                    department: { name: departmentName },
                    jobTitle: { title: jobTitleText },
                  },
                ],
              },
              leaveType: {
                name: fullApp.leaveType?.name,
              },
              // Keep flat props for the table
              department: departmentName,
              job_title: jobTitleText,
              leave_type: fullApp.leaveType?.name,
              is_paid: (fullApp as any).is_paid ?? true,
              phone: (fullApp as any).phone_number,
            };
            return mappedApp;
          }
        }
        // If it's already a full object (from initial load) or raw data
        // Try to map it if it's the specific OnLeave structure
        const empAny = emp as any;
        if (empAny.full_name && !empAny.employee) {
          // It's the flat structure from backend which lacks nested objects for Modal
          // We need to reconstruct them
          return {
            ...empAny,
            employee: {
              id: empAny.employee_id,
              full_name: empAny.full_name,
              employments: [
                {
                  department: { name: empAny.department },
                  jobTitle: { title: empAny.job_title },
                },
              ],
            },
            leaveType: {
              name: empAny.leave_type || empAny.leaveTip, // handle typos if any
            },
          };
        }
        return emp;
      });
    }

    if (activeTab === "cancellations") {
      if (!filters.status || filters.status === "ALL")
        return pendingCancellations;
      return pendingCancellations.filter(
        (req) => req.cancellation_status === filters.status,
      );
    }

    if (activeTab === "expiring") return expiringBalances;

    if (activeTab === "cash_out") {
      if (!filters.status || filters.status === "ALL") return cashOutRequests;
      return cashOutRequests.filter((req) => req.status === filters.status);
    }

    if (activeTab === "balances") return allLeaveBalances;
    if (activeTab === "recalls") return leaveRecalls;

    const sourceData =
      activeTab === "pending"
        ? actualPendingApplications
        : allApplicationsWithPending;

    if (!filters.status || filters.status === "ALL") return sourceData;
    return sourceData.filter((app) => app.current_status === filters.status);
  }, [
    activeTab,
    filters.status,
    actualPendingApplications,
    allApplicationsWithPending,
    onLeaveEmployees,
    expiringBalances,
    cashOutRequests,
    allLeaveBalances,
    leaveApplications,
    pendingCancellations,
  ]);

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

  const displayData = Array.isArray(displayDataSource) ? displayDataSource : [];

  const tabs: Tab[] = [
    {
      id: "on_leave",
      label: "Currently on Leave",
      count: tabCounts?.on_leave ?? onLeaveCount,
    },
    {
      id: "pending",
      label: "Pending Approval",
      count: tabCounts?.pending ?? actualPendingApplications.length,
    },
    {
      id: "cancellations",
      label: "Cancellation Requests",
      count: tabCounts?.cancellations ?? pendingCancellations.length,
    },
    { id: "all", label: "All Applications" },
    { id: "balances", label: "Employee Leave Balances" },
    {
      id: "cash_out",
      label: "Cash-Out Requests",
      count: tabCounts?.cash_out ?? pendingCashOutCount,
    },
    {
      id: "expiring",
      label: "Expiring Balances",
      count: tabCounts?.expiring ?? expiringBalances.length,
    },
    // Recalls tab removed as requested
  ];

  const cancellationColumns: TableColumn<LeaveApplication>[] = [
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
      key: "reqReturnDate",
      header: "Requested Return Date",
      render: (leave) => (
        <span className="text-orange-600 font-medium">
          {leave.requested_return_date
            ? formatDate(leave.requested_return_date)
            : "Full Cancellation"}
        </span>
      ),
    },
    {
      key: "reason",
      header: "Cancellation Reason",
      render: (leave) => (
        <span
          className="truncate max-w-[150px] inline-block"
          title={leave.cancellation_reason}
        >
          {leave.cancellation_reason || "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (leave) => (
        <StatusBadge
          status={getBadgeStatus(leave.cancellation_status || "Unknown")}
        />
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
        // We know it's a pending cancellation if it's in this list
        actions.push({
          label: "Approve Cancel",
          value: "approve",
          icon: <MdCheck className="text-green-500" />,
          onClick: () => handleApprove(leave),
        });
        actions.push({
          label: "Reject Cancel",
          value: "reject",
          icon: <MdClose className="text-red-500" />,
          onClick: () => handleReject(leave),
          variant: "danger",
        });

        return <ActionMenu actions={actions} />;
      },
    },
  ];

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
        <StatusBadge status={getBadgeStatus(leave.current_status)} />
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
              className="p-2 text-primary hover:text-primary-dark hover:bg-primary-light rounded-lg transition-colors"
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
        return <ActionMenu actions={actions} />;
      },
    },
  ];

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
            {(() => {
              const jobTitle =
                (emp as any)?.job_title?.title ||
                (emp as any)?.job_title?.name ||
                (typeof (emp as any)?.job_title === "string"
                  ? (emp as any).job_title
                  : undefined) ||
                (emp as any)?.employments?.[0]?.jobTitle?.title ||
                (emp as any)?.employments?.[0]?.jobTitle?.name ||
                (emp as any)?.employments?.[0]?.job_title?.title ||
                (emp as any)?.employments?.[0]?.job_title?.name;

              const department =
                (emp as any)?.department ||
                (emp as any)?.employments?.[0]?.department?.name ||
                (emp as any)?.employments?.[0]?.department;

              const norm = (v?: string) => (v || "").trim().toLowerCase();
              const showDepartment =
                department && norm(department) !== norm(jobTitle);

              return (
                <>
                  <p className="font-medium text-k-dark-grey">
                    {emp.full_name}
                  </p>
                  {jobTitle ? (
                    <p className="text-xs text-gray-500">{jobTitle}</p>
                  ) : null}
                  {showDepartment ? (
                    <p className="text-xs text-gray-500">{department}</p>
                  ) : null}
                </>
              );
            })()}
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
      key: "contact",
      header: "Contact",
      render: (emp) => (
        <div className="text-sm text-gray-600">{emp.phone || "-"}</div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-center",
      render: (emp) => {
        const leave = mapToLeaveApplication(emp);

        // Ensure we have an ID for actions
        if (!leave.id) return null;

        const actions: ActionOption[] = [
          {
            label: "View Details",
            value: "view",
            icon: <MdVisibility className="text-gray-500" />,
            onClick: () => handleViewDetails(leave),
          },
        ];

        // Recall check - assume approved if on leave tab
        if (canRecall(leave) || activeTab === "on_leave") {
          actions.push({
            label: "Recall",
            value: "recall",
            icon: <MdReplay className="text-primary" />,
            onClick: () => handleRecall(leave),
          });
        }

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

  const recallColumns: TableColumn<LeaveRecall>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (recall) => (
        <div>
          <p className="font-medium">
            {recall.leaveApplication?.employee?.full_name || "-"}
          </p>
          <p className="text-xs text-gray-400">
            {recall.leaveApplication?.employee?.employments?.[0]?.department
              ?.name || "-"}
          </p>
        </div>
      ),
    },
    {
      key: "leaveInfo",
      header: "Original Leave",
      render: (recall) => (
        <div>
          <p className="text-sm">{recall.leaveApplication?.leaveType?.name}</p>
          <p className="text-xs text-gray-400">
            {formatDate(recall.leaveApplication?.start_date || "")} -{" "}
            {formatDate(recall.leaveApplication?.end_date || "")}
          </p>
        </div>
      ),
    },
    {
      key: "recallDate",
      header: "Recall Date",
      render: (recall) => formatDate(recall.recall_date),
    },
    {
      key: "recalledBy",
      header: "Recalled By",
      render: (recall) => (
        <span className="text-sm">
          {recall.recalledBy?.full_name || "System"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (recall) => (
        <StatusBadge status={getBadgeStatus(recall.status)} />
      ),
    },
    {
      key: "response",
      header: "Response",
      render: (recall) => (
        <div>
          {recall.employee_response ? (
            <p className="text-sm italic text-gray-600">
              "{recall.employee_response}"
            </p>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      ),
    },
  ];

  const expiringColumns: TableColumn<ExpiringBalance>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (bal) => (
        <div>
          <p className="font-medium">{bal.employee?.full_name}</p>
          <p className="text-xs text-gray-400">
            {bal.employee?.employments?.[0]?.department?.name}
          </p>
        </div>
      ),
    },
    {
      key: "leaveType",
      header: "Leave Type",
      render: (bal) => bal.leaveType?.name,
    },
    {
      key: "remaining",
      header: "Balance",
      render: (bal) => (
        <span className="font-bold text-k-dark-grey">
          {bal.remaining_days} days
        </span>
      ),
    },
    {
      key: "expiry",
      header: "Expiry Date",
      render: (bal) => (
        <span className="text-red-600 font-medium">
          {formatDate(bal.expiry_date)}
        </span>
      ),
    },
  ];

  const cashOutColumns: TableColumn<CashOutRequest>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (req) => (
        <div>
          <p className="font-medium">{req.employee?.full_name}</p>
          <p className="text-xs text-gray-400">
            {formatDate(req.created_at || "")}
          </p>
        </div>
      ),
    },
    {
      key: "days",
      header: "Days",
      render: (req) => <span className="font-bold">{req.days_cashed_out}</span>,
    },
    {
      key: "rate",
      header: "Daily Rate",
      render: (req) => {
        const rate =
          req.monthly_salary && req.salary_divisor
            ? req.monthly_salary / req.salary_divisor
            : 0;
        return `${rate.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} ETB`;
      },
    },
    {
      key: "amount",
      header: "Total Amount",
      render: (req) => (
        <span className="font-bold text-green-600">
          {req.cash_value?.toLocaleString()} ETB
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (req) => <StatusBadge status={getBadgeStatus(req.status)} />,
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-center",
      render: (req) => {
        if (req.status !== "PENDING") return null;
        return (
          <div className="flex justify-center gap-2">
            <button
              onClick={() => handleCashOutAction(req, "APPROVE")}
              className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
              title="Approve"
            >
              <MdCheck />
            </button>
            <button
              onClick={() => handleCashOutAction(req, "REJECT")}
              className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              title="Reject"
            >
              <MdClose />
            </button>
          </div>
        );
      },
    },
  ];

  const balancesColumns: TableColumn<LeaveBalance>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (bal) => (
        <div>
          <p className="font-medium">{bal.employee?.full_name || "-"}</p>
          <p className="text-xs text-gray-400">
            {bal.employee?.employments?.[0]?.department?.name || ""}
          </p>
        </div>
      ),
    },
    {
      key: "leaveType",
      header: "Leave Type",
      render: (bal) => bal.leaveType?.name || bal.leave_type_id,
    },
    {
      key: "total",
      header: "Total Entitlement",
      render: (bal) => `${bal.total_entitlement ?? 0} days`,
    },
    {
      key: "used",
      header: "Used",
      render: (bal) => `${bal.used_days ?? 0} days`,
    },
    {
      key: "remaining",
      header: "Remaining",
      render: (bal) => (
        <span className="font-bold text-k-dark-grey">
          {bal.remaining_days ?? 0} days
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-center",
      render: (bal) => (
        <Button
          onClick={() => handleAdjustBalance(bal)}
          variant="secondary"
          icon={MdEdit}
        >
          Adjust
        </Button>
      ),
    },
  ];

  // Helper to determine columns based on tab
  const getColumns = () => {
    switch (activeTab) {
      case "on_leave":
        return onLeaveColumns;
      case "recalls":
        return recallColumns;
      case "expiring":
        return expiringColumns;
      case "cash_out":
        return cashOutColumns;
      case "balances":
        return balancesColumns;
      case "cancellations":
        return cancellationColumns as any; // Cast slightly for generic match
      default:
        return applicationColumns as any;
    }
  };

  // Helper for key extraction
  const getKey = (item: any) => {
    if (activeTab === "on_leave") return item.id;
    return item.id;
  };

  return (
    <AdminLayout>
      <PageHeader>
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <MdCalendarToday className="text-white" />
              Leave Management
            </h1>
            <p className="text-white text-sm mt-1">
              Review and manage employee leave applications
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              onClick={() => navigate("/admin/leave-types")}
              variant="white"
              icon={MdCategory}
            >
              Leave Types
            </Button>

            <Button
              onClick={() => navigate("/admin/public-holidays")}
              variant="white"
              icon={MdEvent}
            >
              Public Holidays
            </Button>

            <Button
              onClick={() => navigate("/admin/leave-settings")}
              variant="white"
              icon={MdSettings}
            >
              Settings
            </Button>

            <Button
              onClick={() => setIsExportModalOpen(true)}
              variant="white"
              icon={FiDownload}
            >
              {selectedIds.length > 0
                ? `Export (${selectedIds.length})`
                : "Export"}
            </Button>

            <Button
              onClick={handleRefresh}
              variant="white"
              icon={MdRefresh}
              loading={
                applicationsLoading ||
                expiringLoading ||
                cashOutLoading ||
                balancesLoading ||
                recallsLoading
              }
            >
              Refresh
            </Button>
          </div>
        </div>
      </PageHeader>

      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

          <div className="flex items-center gap-2">
            {activeTab === "expiring" && (
              <Button
                onClick={handleTriggerNotify}
                variant="primary"
                icon={MdNotifications}
              >
                Send Expiry Notifications
              </Button>
            )}
          </div>
        </div>

        {/* Standardized Filter Panel */}
        <div className="mb-6">
          <FilterBar
            filters={filters}
            onFilterChange={setFilters}
            onClear={() => {
              // Reset logical filters but keep structural ones if needed, or just let generic clear handle it
              setFilters({
                status: "ALL",
                search: "",
                department_id: "",
                job_title_id: "",
                leave_type_id: "",
                manager_id: "",
                gender: "",
                start_date: "",
                end_date: "",
                sort_by: "created_at",
                order: "desc",
              });
            }}
            showSearch={true}
            showSort={true}
            storageKey="admin_leave_management_filters_pinned"
            config={[
              {
                key: "status",
                label: "Status",
                type: "select",
                options: [
                  { value: "ALL", label: "All Status" },
                  { value: "PENDING_SUPERVISOR", label: "Pending Supervisor" },
                  { value: "PENDING_HR", label: "Pending HR" },
                  { value: "PENDING_CEO", label: "Pending CEO" },
                  { value: "APPROVED", label: "Approved" },
                  { value: "REJECTED", label: "Rejected" },
                  { value: "CANCELLED", label: "Cancelled" },
                ].filter((opt) =>
                  activeTab === "pending" || activeTab === "cash_out"
                    ? opt.value === "ALL" || opt.value.startsWith("PENDING")
                    : true,
                ),
                visible: ["all", "pending", "cash_out"].includes(activeTab),
              },
              {
                key: "department_id",
                label: "Department",
                type: "autocomplete",
                autocompleteType: "departments",
                visible: true,
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
                  { label: "All Leave Types", value: "" },
                  ...(leaveTypes || []).map((t: any) => ({
                    // Ensure leaveTypes is type-safe
                    label: t.name,
                    value: String(t.id),
                  })),
                ],
                visible: [
                  "on_leave",
                  "all",
                  "pending",
                  "balances",
                  "expiring",
                ].includes(activeTab),
              },
              {
                key: "gender",
                label: "Gender",
                type: "select",
                options: [
                  { label: "Male", value: "Male" },
                  { label: "Female", value: "Female" },
                ],
                visible: true,
              },
              {
                key: "manager_id",
                label: "Manager",
                type: "autocomplete",
                autocompleteType: "managers",
                visible: ["all", "pending", "balances", "expiring"].includes(
                  activeTab,
                ),
              },
              {
                key: "start_date",
                label: "Start Date",
                type: "date",
                visible: ["all", "pending"].includes(activeTab),
              },
              {
                key: "end_date",
                label: "End Date",
                type: "date",
                visible: ["all", "pending"].includes(activeTab),
              },
            ]}
            sortOptions={
              activeTab === "balances"
                ? [
                    { value: "full_name", label: "Employee Name" },
                    { value: "created_at", label: "Date Added" },
                    ...(filters.leave_type_id
                      ? [{ value: "remaining_days", label: "Remaining Days" }]
                      : []),
                  ]
                : activeTab === "on_leave" || activeTab === "expiring"
                  ? [{ value: "full_name", label: "Employee Name" }]
                  : [
                      { value: "full_name", label: "Employee Name" },
                      { value: "created_at", label: "Date Created" },
                      { value: "start_date", label: "Start Date" },
                    ]
            }
          />
        </div>

        {activeTab === "pending" && actualPendingApplications.length > 0 && (
          <InfoBanner variant="info" className="mb-6">
            <strong>3-Level Approval Workflow:</strong> Supervisor → HR → CEO
            (for managers). Your pending list shows applications awaiting your
            approval.
          </InfoBanner>
        )}

        <DataTable
          data={displayData as any[]}
          columns={getColumns() as any}
          loading={
            applicationsLoading ||
            expiringLoading ||
            cashOutLoading ||
            balancesLoading ||
            recallsLoading
          }
          keyExtractor={getKey}
          emptyState={{
            icon: MdCalendarToday,
            title: "No data found",
            description: "No records found matching your current view.",
          }}
          className="shadow-none"
          onRowClick={
            ["pending", "all", "on_leave", "cancellations"].includes(activeTab)
              ? handleViewDetails
              : undefined
          }
          pagination={{
            currentPage: page,
            totalPages: pagination?.totalPages || 1,
            totalItems: pagination?.total || displayData.length,
            itemsPerPage: limit,
            onPageChange: (newPage) => setPage(newPage),
          }}
          itemLabel={
            activeTab === "cash_out"
              ? "request"
              : activeTab === "balances"
                ? "balance"
                : "application"
          }
          enableSelection={true}
          selectedIds={selectedIds}
          onSelectionChange={(ids) => setSelectedIds(ids)}
        />
      </div>

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
                  Relief Officer
                </p>
                <p className="text-sm font-medium text-k-dark-grey">
                  {selectedLeave.reliefOfficer?.full_name || "Not assigned"}
                </p>
              </div>
              <div>
                <div className="grid grid-cols-2 gap-4 text-sm mt-3 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <label className="text-gray-500 block mb-1">Status</label>
                    <span className="font-medium">
                      {formatStatusLabel(selectedLeave.current_status)}
                    </span>
                  </div>
                  {selectedLeave.current_status === "CANCELLED" && (
                    <div>
                      <label className="text-gray-500 block mb-1">
                        Cancelled Date
                      </label>
                      <span className="font-medium">
                        {selectedLeave.updated_at
                          ? formatDate(selectedLeave.updated_at)
                          : "-"}
                      </span>
                    </div>
                  )}
                  {selectedLeave.current_status === "REJECTED" && (
                    <div>
                      <label className="text-gray-500 block mb-1">
                        Rejection Reason
                      </label>
                      <span className="text-red-500">
                        {selectedLeave.rejection_reason || "-"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Applied On
                </p>
                <p className="text-sm font-medium text-k-dark-grey">
                  {formatDate(selectedLeave.created_at || "")}
                </p>
              </div>
            </div>

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

            {/* Show Recall Info if Cancelled/Recalled - assuming recall info is in rejection_reason or similar for now until backend supports recall object in leave detail */}
            {(selectedLeave.current_status === "CANCELLED" ||
              selectedLeave.current_status === "REJECTED") &&
              selectedLeave.rejection_reason && (
                <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                  <p className="text-xs font-semibold text-red-800 mb-1">
                    Cancellation Reason / Recall Info
                  </p>
                  <p className="text-sm text-red-700">
                    {selectedLeave.rejection_reason}
                  </p>
                </div>
              )}

            {selectedLeave.attachment_url && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  Supporting Document
                </p>
                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <MdInsertDriveFile className="text-k-orange text-xl" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-k-dark-grey truncate">
                      Attachment
                    </p>
                    <p className="text-xs text-gray-500">
                      Click to view the document
                    </p>
                  </div>
                  <a
                    href={selectedLeave.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <MdVisibility size={16} />
                    View
                  </a>
                </div>
              </div>
            )}

            {selectedLeave.current_status === "REJECTED" &&
              selectedLeave.rejection_reason && (
                <div>
                  <p className="text-xs font-semibold text-red-500 mb-1">
                    Rejection Reason
                  </p>
                  <p className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-lg">
                    {selectedLeave.rejection_reason}
                  </p>
                </div>
              )}

            {selectedLeave.approvalLogs &&
              selectedLeave.approvalLogs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">
                    Approval History
                  </p>
                  <div className="space-y-2">
                    {selectedLeave.approvalLogs.map(
                      (log: any, index: number) => {
                        // Backend sends 'approver', legacy/mapped might have 'actionBy'
                        const actor = log.approver || log.actionBy;

                        // Determine Role: Try to get job title, if null then assume System Admin or specialized role
                        let approverRole = "System Admin";

                        // Use actor object for job title lookup
                        if (actor?.job_title) {
                          approverRole = actor.job_title;
                        } else if (actor?.employments?.[0]?.jobTitle?.title) {
                          approverRole = actor.employments[0].jobTitle.title;
                        } else if (
                          log.action_by === "admin" ||
                          log.action_by === "system" ||
                          !actor
                        ) {
                          approverRole = "System Admin";
                        } else {
                          // Fallback if we have an opaque ID but no detailed info
                          approverRole = "Approver";
                        }

                        let approverName = actor?.full_name;
                        if (!approverName) {
                          if (approverRole === "System Admin") {
                            approverName = "System Admin"; // Fallback for System Admin
                          } else {
                            approverName = "Unknown Name";
                          }
                        }

                        const approverId = actor?.id || log.action_by;

                        return (
                          <div
                            key={log.id || index}
                            className={`text-sm p-3 rounded-lg border ${
                              log.action === "APPROVED"
                                ? "bg-green-50 text-green-700 border-green-100"
                                : "bg-red-50 text-red-700 border-red-100"
                            }`}
                          >
                            <p className="font-medium">
                              {log.action === "APPROVED"
                                ? "Approved"
                                : "Rejected"}{" "}
                              by {approverRole}
                            </p>
                            <p className="text-sm font-semibold mt-0.5">
                              "{approverName}"{" "}
                              <span className="text-xs font-normal opacity-75">
                                ({approverId})
                              </span>
                            </p>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDate(log.action_date || log.action_at)}
                            </div>
                            {log.comments && (
                              <p className="text-xs mt-2 italic bg-white/50 p-2 rounded">
                                "{log.comments}"
                              </p>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

            {canTakeAction(selectedLeave) && activeTab !== "cancellations" && (
              <div className="flex gap-4 pt-4 border-t border-gray-100">
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
              </div>
            )}

            {activeTab === "cancellations" && (
              <div className="flex gap-4 pt-4 border-t border-gray-100">
                <Button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleApprove(selectedLeave);
                  }}
                  variant="primary"
                  icon={MdCheck}
                >
                  Approve Cancellation
                </Button>
                <Button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleReject(selectedLeave);
                  }}
                  variant="secondary"
                  icon={MdClose}
                  className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                >
                  Reject Cancellation
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Leave Application"
        size="md"
      >
        <div className="space-y-4">
          <InfoBanner variant="success">
            Approve application for{" "}
            <strong>{selectedLeave?.employee?.full_name}</strong>.
            {selectedLeave && (
              <p className="text-xs mt-2">
                {getNextStatusMessage(selectedLeave.current_status)}
              </p>
            )}
          </InfoBanner>
          <FormField
            label="Comments (Optional)"
            name="comments"
            type="textarea"
            value={approvalComments}
            onChange={(e) => setApprovalComments(e.target.value)}
          />
          <div className="flex gap-4">
            <Button
              onClick={() => setShowApproveModal(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmApprove}
              variant="primary"
              loading={loading}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Leave Application"
        size="md"
      >
        <div className="space-y-4">
          <InfoBanner variant="error">
            Reject application for{" "}
            <strong>{selectedLeave?.employee?.full_name}</strong>. This will
            notify the employee.
          </InfoBanner>
          <FormField
            label="Reason (Required)"
            name="reason"
            type="textarea"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            required
          />
          <div className="flex gap-4">
            <Button
              onClick={() => setShowRejectModal(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button onClick={confirmReject} variant="primary" loading={loading}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cash Out Modal */}
      <Modal
        isOpen={showCashOutModal}
        onClose={() => setShowCashOutModal(false)}
        title={
          cashOutAction === "APPROVE" ? "Approve Cash-Out" : "Reject Cash-Out"
        }
        size="md"
      >
        <div className="space-y-4">
          <InfoBanner
            variant={cashOutAction === "APPROVE" ? "success" : "error"}
          >
            You are about to{" "}
            {cashOutAction === "APPROVE" ? "approve" : "reject"} cash-out
            request for <strong>{selectedCashOut?.employee?.full_name}</strong>.
            {selectedCashOut && (
              <div className="mt-2 text-xs">
                <p>Days: {selectedCashOut.days_cashed_out}</p>
                <p>
                  Amount: {selectedCashOut.cash_value?.toLocaleString()} ETB
                </p>
              </div>
            )}
          </InfoBanner>
          {cashOutAction === "REJECT" && (
            <FormField
              label="Rejection Reason"
              name="reason"
              type="textarea"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
            />
          )}
          <div className="flex gap-4">
            <Button
              onClick={() => setShowCashOutModal(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmCashOutAction}
              variant={cashOutAction === "APPROVE" ? "primary" : "secondary"}
              loading={loading}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* Notify Expiring Modal */}
      <Modal
        isOpen={showNotifyModal}
        onClose={() => setShowNotifyModal(false)}
        title="Send Expiry Notifications"
        size="md"
      >
        <div className="space-y-4">
          <InfoBanner variant="info">
            This will send email and in-app notifications to all employees whose
            leave balance expires within the configured threshold days.
          </InfoBanner>
          <p className="text-sm text-gray-600">
            Are you sure you want to proceed?
          </p>
          <div className="flex gap-4">
            <Button
              onClick={() => setShowNotifyModal(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmNotify}
              variant="primary"
              icon={MdNotifications}
              loading={loading}
            >
              Send Notifications
            </Button>
          </div>
        </div>
      </Modal>

      {/* Adjust Balance Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title="Adjust Leave Balance"
        size="4xl"
      >
        <div className="space-y-6">
          <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl">
            <p className="text-sm text-gray-700">
              Adjusting balance for{" "}
              <span className="font-bold text-gray-900">
                {selectedBalance?.employee?.full_name}
              </span>{" "}
              ({selectedBalance?.leaveType?.name}).
            </p>
            <div className="flex gap-6 mt-2">
              <p className="text-xs text-gray-500">
                Total Entitlement:{" "}
                <span className="font-semibold text-gray-800">
                  {selectedBalance?.total_entitlement} days
                </span>
              </p>
              <p className="text-xs text-gray-500">
                Current used:{" "}
                <span className="font-semibold text-gray-800">
                  {selectedBalance?.used_days} days
                </span>
              </p>
              <p className="text-xs text-gray-500">
                Current remaining:{" "}
                <span className="font-semibold text-gray-800">
                  {selectedBalance?.remaining_days} days
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leave Allowance Adjustment */}
            <div className="bg-gray-50 border border-gray-100 p-5 rounded-xl space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-200/50">
                <MdSettings className="text-k-orange text-lg" />
                <h4 className="text-sm font-bold text-gray-800">
                  Allowance Adjustment
                </h4>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Modify the base entitlement or add manual bonus days to the
                  opening balance.
                </p>
                <div className="flex flex-wrap gap-4 py-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      checked={adjustmentType === "add"}
                      onChange={() => setAdjustmentType("add")}
                      className="w-4 h-4 text-k-orange focus:ring-k-orange cursor-pointer"
                    />
                    <span className="text-sm group-hover:text-k-orange transition-colors">
                      Add Days
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      checked={adjustmentType === "subtract"}
                      onChange={() => setAdjustmentType("subtract")}
                      className="w-4 h-4 text-k-orange focus:ring-k-orange cursor-pointer"
                    />
                    <span className="text-sm group-hover:text-k-orange transition-colors">
                      Subtract Days
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      checked={adjustmentType === "set"}
                      onChange={() => setAdjustmentType("set")}
                      className="w-4 h-4 text-k-orange focus:ring-k-orange cursor-pointer"
                    />
                    <span className="text-sm group-hover:text-k-orange transition-colors">
                      Set Total
                    </span>
                  </label>
                </div>

                <FormField
                  label="Days"
                  name="days"
                  type="number"
                  value={adjustmentDays}
                  onChange={(e) => setAdjustmentDays(Number(e.target.value))}
                  min="0"
                  step="any"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Used Days Adjustment */}
            <div className="bg-gray-50 border border-gray-100 p-5 rounded-xl space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-200/50">
                <MdCalendarToday className="text-k-orange text-lg" />
                <h4 className="text-sm font-bold text-gray-800">
                  Used Days Adjustment
                </h4>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Directly override the total days already taken by the
                  employee.
                </p>
                <div className="flex flex-wrap gap-4 py-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      checked={usedDaysAdjustmentType === "add"}
                      onChange={() => setUsedDaysAdjustmentType("add")}
                      className="w-4 h-4 text-k-orange focus:ring-k-orange cursor-pointer"
                    />
                    <span className="text-sm group-hover:text-k-orange transition-colors">
                      Add Used
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      checked={usedDaysAdjustmentType === "subtract"}
                      onChange={() => setUsedDaysAdjustmentType("subtract")}
                      className="w-4 h-4 text-k-orange focus:ring-k-orange cursor-pointer"
                    />
                    <span className="text-sm group-hover:text-k-orange transition-colors">
                      Subtract Used
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      checked={usedDaysAdjustmentType === "set"}
                      onChange={() => setUsedDaysAdjustmentType("set")}
                      className="w-4 h-4 text-k-orange focus:ring-k-orange cursor-pointer"
                    />
                    <span className="text-sm group-hover:text-k-orange transition-colors">
                      Set Used
                    </span>
                  </label>
                </div>

                <FormField
                  label="Days"
                  name="usedDays"
                  type="number"
                  value={usedDaysAdjustment}
                  onChange={(e) =>
                    setUsedDaysAdjustment(Number(e.target.value))
                  }
                  min="0"
                  step="any"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <FormField
              label="Reason for Adjustment"
              name="reason"
              type="textarea"
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              required
              placeholder="Please explain the reason for this manual adjustment..."
              rows={3}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <Button
                onClick={() => setShowAdjustModal(false)}
                variant="white"
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmAdjustment}
                variant="primary"
                loading={loading}
                icon={MdCheck}
                className="px-8 shadow-md"
              >
                Confirm Adjustment
              </Button>
            </div>
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
              You are about to recall{" "}
              <strong>{selectedLeave?.employee?.full_name}</strong> from their{" "}
              <strong>{selectedLeave?.leaveType?.name}</strong> leave.
            </p>
            <p className="text-xs text-primary mt-2">
              The employee will receive a notification and must accept or
              decline.
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
            max={
              selectedLeave?.end_date
                ? formatIsoDate(selectedLeave.end_date)
                : undefined
            }
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
            <Button onClick={confirmRecall} variant="primary" loading={loading}>
              Send Recall Request
            </Button>
          </div>
        </div>
      </Modal>

      <LeaveExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        scope={selectedIds.length > 0 ? "SELECTION" : "BULK"}
        ids={selectedIds}
        title={
          selectedIds.length > 0
            ? `Export Selected (${selectedIds.length})`
            : "Export Leave Data"
        }
        activeTab={activeTab}
        filters={{
          status: filters.status,
          start_date: filters.start_date,
          end_date: filters.end_date,
          search: filters.search,
          leave_type_id: filters.leave_type_id,
        }}
      />
    </AdminLayout>
  );
}
