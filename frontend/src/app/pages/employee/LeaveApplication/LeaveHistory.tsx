import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
dayjs.extend(isBetween);
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import {
  MdNotificationsActive,
  MdClose,
  MdReply,
  MdVisibility,
  MdRefresh,
} from "react-icons/md";
import { FiDownload } from "react-icons/fi";
import Modal from "../../../components/common/Modal";
// HrisSpinner replaced by generic spinner
import { toast } from "react-hot-toast";
import StatusBadge from "../../../components/common/StatusBadge";
import FilterDropdown from "../../../components/common/FilterDropdown";
import LeaveExportModal from "../../../components/exports/LeaveExportModal";
import Button from "../../../components/Core/ui/Button";
import SmartDateInput from "../../../components/Core/ui/SmartDateInput";
import { ActionMenu, ActionOption } from "../../../components/common/ActionMenu";
import RecallResponseModal from "../../../components/Leave/RecallResponseModal";
import { leaveActions } from "../../../slice/leaveSlice";
import {
  selectLeaveApplications,
  selectApplicationsLoading,
  selectLeavePagination,
  selectMyRecallNotifications,
  selectLeaveLoading,
} from "../../../slice/leaveSlice/selectors";
import {
  LeaveApplication,
  LeaveStatus,
  LeaveRecall,
} from "../../../slice/leaveSlice/types";
import { formatDate } from "../../../utils/dayjs-format";

// Helper to get status for badge
const getBadgeStatus = (status?: LeaveStatus | string): string => {
  if (typeof status !== "string" || status.length === 0) return "Unknown";
  if (status.startsWith("PENDING")) return "Pending";
  return status.charAt(0) + status.slice(1).toLowerCase();
};

const TableSkeleton = () => (
  <div className="animate-pulse">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex gap-4 p-4 border-b border-gray-50">
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
        <div className="h-4 w-16 bg-gray-200 rounded"></div>
        <div className="h-4 w-24 bg-gray-200 rounded"></div>
        <div className="h-4 w-24 bg-gray-200 rounded"></div>
        <div className="h-4 w-20 bg-gray-200 rounded"></div>
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
        <div className="h-4 w-20 bg-gray-200 rounded"></div>
      </div>
    ))}
  </div>
);

export default function LeaveHistory() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ status: "All", type: "All" });
  const [selectedRecall, setSelectedRecall] = useState<LeaveRecall | null>(
    null,
  );
  const [selectedLeave, setSelectedLeave] = useState<LeaveApplication | null>(
    null,
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [leaveToCancel, setLeaveToCancel] = useState<LeaveApplication | null>(
    null,
  );
  const [showRequestCancellationModal, setShowRequestCancellationModal] = useState(false);
  const [leaveToRequestCancellation, setLeaveToRequestCancellation] = useState<LeaveApplication | null>(null);
  const [requestReturnType, setRequestReturnType] = useState({
    date: "",
    reason: "",
  });

  const leaveApplications = useSelector(selectLeaveApplications);
  const loading = useSelector(selectApplicationsLoading);
  const pagination = useSelector(selectLeavePagination);
  const recalls = useSelector(selectMyRecallNotifications);
  const actionLoading = useSelector(selectLeaveLoading);
  const authUser = useSelector(selectAuthUser) as any;

  // Get current user's name for display in detail modal
  const currentUserName =
    authUser?.full_name ||
    authUser?.fullName ||
    authUser?.employee?.full_name ||
    authUser?.name ||
    "Employee";

  const pendingRecalls = Array.isArray(recalls)
    ? recalls.filter((r) => r.status === "PENDING")
    : [];

  // Fetch leave history and recalls on mount
  useEffect(() => {
    dispatch(leaveActions.getMyLeavesRequest(undefined));
    dispatch(leaveActions.getMyRecallNotificationsRequest());
  }, [dispatch]);

  useEffect(() => {
    const applicationId = searchParams.get("applicationId");
    if (!applicationId || !Array.isArray(leaveApplications)) return;

    const targetLeave = leaveApplications.find(
      (item) => String(item.id) === applicationId,
    );

    if (!targetLeave) return;

    setSelectedLeave(targetLeave);
    setShowDetailModal(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("applicationId");
    setSearchParams(nextParams, { replace: true });
  }, [leaveApplications, searchParams, setSearchParams]);

  // Handle successful cancellation/request to refresh balances and list
  const success = useSelector((state: any) => state.leave.success);
  const message = useSelector((state: any) => state.leave.message);

  useEffect(() => {
    if (success && (message?.includes("cancelled successfully") || message?.includes("request submitted successfully"))) {
      toast.success(message);
      // Refresh list and balances
      dispatch(leaveActions.getMyLeavesRequest(undefined));
      dispatch(leaveActions.getEnhancedBalanceRequest());
      dispatch(leaveActions.getMyRecallNotificationsRequest());
      // Clear success state
      dispatch(leaveActions.resetState());
    }
  }, [success, message, dispatch]);

  const handleRefresh = () => {
    dispatch(leaveActions.getMyLeavesRequest(undefined));
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleRowClick = (item: LeaveApplication) => {
    setSelectedLeave(item);
    setShowDetailModal(true);
  };

  const handleCancelLeave = (e: React.MouseEvent, leave: LeaveApplication) => {
    e.stopPropagation();
    setLeaveToCancel(leave);
    setShowCancelModal(true);
  };

  const confirmCancel = () => {
    if (leaveToCancel) {
      dispatch(leaveActions.cancelLeaveApplicationRequest(leaveToCancel.id));
      setShowCancelModal(false);
      setLeaveToCancel(null);
    }
  };

  const handleOpenRecall = (recall: LeaveRecall) => {
    setSelectedRecall(recall);
    setShowRecallModal(true);
  };

  const handleRecallResponse = (
    response: "ACCEPTED" | "DECLINED",
    actualReturnDate?: string,
    comments?: string,
  ) => {
    if (selectedRecall) {
      dispatch(
        leaveActions.respondToRecallRequest({
          id: selectedRecall.id,
          response,
          actual_return_date: actualReturnDate,
          employee_response: comments,
        }),
      );
      setShowRecallModal(false);
    }
  };

  const canCancel = (leave: LeaveApplication) => {
    const status = leave.current_status || "";
    if (status.startsWith("PENDING")) return true;
    // Employees CANNOT directly cancel APPROVED leaves anymore (must use Request flow)
    return false;
  };

  const canRequestEarlyReturn = (leave: LeaveApplication) => {
    const status = leave.current_status || "";
    if (!status.startsWith("APPROVED")) return false;

    // If already has an active cancellation request, don't show the button
    if (
      leave.cancellation_status &&
      ["PENDING_SUPERVISOR", "PENDING_HR"].includes(leave.cancellation_status)
    ) {
      return false;
    }

    // Allow requesting cancellation for ANY approved leave (future or ongoing)
    return true;
  };

  const handleRequestCancellation = (
    e: React.MouseEvent,
    leave: LeaveApplication,
  ) => {
    e.stopPropagation();
    setLeaveToRequestCancellation(leave);

    // If leave is in the future, default return date to start date (full cancellation)
    // Otherwise, default to tomorrow
    const tomorrow = dayjs().add(1, "day");
    const startDate = dayjs(leave.start_date);
    const endDate = dayjs(leave.end_date);

    let defaultDate = tomorrow;
    if (startDate.isAfter(dayjs(), "day")) {
      defaultDate = startDate;
    } else if (tomorrow.isAfter(endDate)) {
      defaultDate = endDate;
    }

    setRequestReturnType({
      date: defaultDate.format("YYYY-MM-DD"),
      reason: "",
    });
    setShowRequestCancellationModal(true);
  };

  const confirmRequestCancellation = () => {
    if (leaveToRequestCancellation && requestReturnType.date && requestReturnType.reason) {
      dispatch(
        leaveActions.requestLeaveCancellationRequest({
          id: leaveToRequestCancellation.id,
          requested_return_date: requestReturnType.date,
          reason: requestReturnType.reason,
        }),
      );
      setShowRequestCancellationModal(false);
      setLeaveToRequestCancellation(null);
    }
  };

  // Apply filters
  const filteredHistory = leaveApplications.filter((item) => {
    const itemStatus = getBadgeStatus(item.current_status);
    const statusMatch =
      filters.status === "All" ||
      itemStatus.toLowerCase() === filters.status.toLowerCase();
    const typeMatch =
      filters.type === "All" ||
      item.leaveType?.name?.toLowerCase() === filters.type.toLowerCase();
    return statusMatch && typeMatch;
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h3 className="text-lg font-bold text-k-dark-grey">Leave History</h3>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center justify-center bg-white border border-gray-200 text-gray-700 w-10 h-10 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
            title="Refresh"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent animate-spin rounded-full" />
            ) : (
              <MdRefresh size={20} />
            )}
          </button>
          <FilterDropdown
            isOpen={showFilter}
            onToggle={setShowFilter}
            filters={filters}
            onFilterChange={handleFilterChange}
            config={[
              {
                key: "status",
                label: "Status",
                options: [
                  "All",
                  "Pending",
                  "Approved",
                  "Rejected",
                  "Cancelled",
                ],
              },
              {
                key: "type",
                label: "Leave Type",
                options: [
                  "All",
                  ...leaveApplications
                    .map((app) => app.leaveType?.name || "")
                    .filter(Boolean),
                ],
              },
            ]}
          />
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 h-10 px-4 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shrink-0"
          >
            <FiDownload size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Recall Notifications */}
      {pendingRecalls.length > 0 && (
        <div className="mb-6 space-y-3">
          {pendingRecalls.map((recall) => (
            <div
              key={recall.id}
              className="bg-primary-light border border-primary-light rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm"
            >
              <div className="flex gap-3 items-start">
                <div className="bg-primary-light p-2 rounded-lg">
                  <MdNotificationsActive className="text-primary text-xl" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">
                    Immediate Action Required: Leave Recall
                  </p>
                  <p className="text-sm text-gray-800">
                    Your manager has requested you to return early on{" "}
                    <strong>{formatDate(recall.recall_date)}</strong>.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                onClick={() => handleOpenRecall(recall)}
                icon={MdReply}
              >
                Respond to Recall
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        {loading ? (
          <TableSkeleton />
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No leave applications found.</p>
            <p className="text-sm text-gray-400 mt-1">
              Apply for leave to see your history here.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm font-semibold">
                <th className="p-4 rounded-l-lg">Leave Type</th>
                <th className="p-4">Days</th>
                <th className="p-4">Start Date</th>
                <th className="p-4">End Date</th>
                <th className="p-4">Return Date</th>
                <th className="p-4">Reason</th>
                <th className="p-4">Status</th>
                <th className="p-4 rounded-r-lg text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-700">
              {filteredHistory.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick(item)}
                  className="border-b border-gray-50 last:border-0 hover:bg-primary-light transition-colors cursor-pointer group"
                >
                  <td className="p-4 font-medium">
                    {item.leaveType?.name || "-"}
                  </td>
                  <td className="p-4">{item.requested_days} days</td>
                  <td className="p-4">{formatDate(item.start_date)}</td>
                  <td className="p-4">{formatDate(item.end_date)}</td>
                  <td className="p-4">{formatDate(item.return_date)}</td>
                  <td className="p-4 max-w-[150px] truncate">
                    {item.reason || "-"}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={getBadgeStatus(item.current_status)} />
                  </td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center">
                      <ActionMenu
                        actions={[
                          {
                            label: "View Details",
                            value: "view",
                            icon: <MdVisibility className="text-gray-500" />,
                            onClick: () => handleRowClick(item),
                          },
                          ...(canCancel(item)
                            ? [
                                {
                                  label: "Cancel Application",
                                  value: "cancel",
                                  icon: <MdClose className="text-red-500" />,
                                  onClick: () => {
                                    setLeaveToCancel(item);
                                    setShowCancelModal(true);
                                  },
                                  variant: "danger" as const,
                                },
                              ]
                            : []),
                          ...(canRequestEarlyReturn(item)
                            ? [
                                {
                                  label: dayjs(item.start_date).isAfter(dayjs(), "day")
                                    ? "Request Cancellation"
                                    : "Request Early Return",
                                  value: "request-cancel",
                                  icon: <MdRefresh className="text-orange-500 rotate-180" />,
                                  onClick: () => {
                                    setLeaveToRequestCancellation(item);
                                    const tomorrow = dayjs().add(1, "day");
                                    const startDate = dayjs(item.start_date);
                                    const endDate = dayjs(item.end_date);
                                    let defaultDate = tomorrow;
                                    if (startDate.isAfter(dayjs(), "day")) {
                                      defaultDate = startDate;
                                    } else if (tomorrow.isAfter(endDate)) {
                                      defaultDate = endDate;
                                    }
                                    setRequestReturnType({
                                      date: defaultDate.format("YYYY-MM-DD"),
                                      reason: "",
                                    });
                                    setShowRequestCancellationModal(true);
                                  },
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination info */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
          <span>
            Showing {filteredHistory.length} of {pagination.total} entries
          </span>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
        </div>
      )}

      {/* Leave Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Leave Request Details"
        size="lg"
      >
        {selectedLeave && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Employee Name
                </p>
                <p className="text-sm font-medium text-k-dark-grey">
                  {currentUserName}
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
                  Requested Days
                </p>
                <p className="text-sm font-medium text-k-dark-grey">
                  {selectedLeave.requested_days} days
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
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Status
                </p>
                <StatusBadge
                  status={getBadgeStatus(selectedLeave.current_status)}
                />
              </div>
              {selectedLeave.cancellation_status && (
                <div className="col-span-2 bg-orange-50 p-3 rounded-lg border border-orange-100 mt-2">
                  <p className="text-xs font-semibold text-orange-700 mb-1">
                    Cancellation Request Status
                  </p>
                  <p className="text-sm font-medium text-orange-800">
                    {selectedLeave.cancellation_status.replace(/_/g, " ")}
                  </p>
                  {selectedLeave.requested_return_date && (
                    <p className="text-xs text-orange-600 mt-1">
                      Requested Return Date: {formatDate(selectedLeave.requested_return_date)}
                    </p>
                  )}
                  {selectedLeave.cancellation_reason && (
                    <p className="text-xs text-orange-600 mt-1 italic">
                      Reason: "{selectedLeave.cancellation_reason}"
                    </p>
                  )}
                </div>
              )}
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

            {/* Show Recall Information if matched */}
            {(() => {
              const linkedRecall = recalls.find(
                (r) => r.leave_application_id === selectedLeave.id,
              );
              if (linkedRecall) {
                return (
                  <div className="bg-primary-light p-3 rounded-lg border border-primary-light">
                    <p className="text-xs font-semibold text-primary mb-1">
                      Recall Request
                    </p>
                    <p className="text-sm text-primary/80">
                      Recalled by Manager on{" "}
                      <strong>{formatDate(linkedRecall.recall_date)}</strong>.
                      <br />
                      Reason: {linkedRecall.reason}
                    </p>
                    {linkedRecall.status !== "PENDING" && (
                      <p className="text-sm text-primary mt-1">
                        Response: <strong>{linkedRecall.status}</strong>
                      </p>
                    )}
                  </div>
                );
              }
              return null;
            })()}

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

            {/* Approval Logs */}
            {selectedLeave.approvalLogs &&
              selectedLeave.approvalLogs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">
                    Approval History
                  </p>
                  <div className="space-y-2">
                    {selectedLeave.approvalLogs.map(
                      (log: any, index: number) => (
                        <div
                          key={log.id || index}
                          className={`text-sm p-3 rounded-lg ${
                            log.action === "APPROVED"
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          <p className="font-medium">
                            {log.action} by{" "}
                            {log.approver?.full_name ||
                              log.actionBy?.full_name ||
                              "Unknown"}
                          </p>
                          <p className="text-xs mt-1 opacity-75">
                            {log.action_date
                              ? formatDate(log.action_date)
                              : formatDate(log.action_at)}
                            {log.from_status && log.to_status && (
                              <>
                                {" "}
                                • {log.from_status.replace(/_/g, " ")} →{" "}
                                {log.to_status.replace(/_/g, " ")}
                              </>
                            )}
                          </p>
                          {log.comments && (
                            <p className="text-xs mt-1 italic">
                              "{log.comments}"
                            </p>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

            {selectedLeave.created_at && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Applied on: {formatDate(selectedLeave.created_at)}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Request Cancellation Modal */}
      <Modal
        isOpen={showRequestCancellationModal}
        onClose={() => setShowRequestCancellationModal(false)}
        title={
          selectedLeave &&
          dayjs(selectedLeave.start_date).isAfter(dayjs(), "day")
            ? "Request Leave Cancellation"
            : "Request Early Return"
        }
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {selectedLeave &&
            dayjs(selectedLeave.start_date).isAfter(dayjs(), "day")
              ? "You are requesting to cancel your upcoming approved leave. This request will be sent to your manager and HR for approval."
              : "You are requesting to end your ongoing leave early. This request will be sent to your manager for approval."}
          </p>

          <div className="mb-4">
            <SmartDateInput
              label={
                selectedLeave &&
                dayjs(selectedLeave.start_date).isAfter(dayjs(), "day")
                  ? "Cancellation Effective Date"
                  : "New Return to Work Date"
              }
              value={requestReturnType.date}
              onChange={(value) =>
                setRequestReturnType((prev) => ({
                  ...prev,
                  date: value,
                }))
              }
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary text-sm min-h-[100px]"
              placeholder="Please explain why you want to cancel or return early..."
              value={requestReturnType.reason}
              onChange={(e) =>
                setRequestReturnType((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))
              }
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowRequestCancellationModal(false)}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={confirmRequestCancellation}
              disabled={
                !requestReturnType.date ||
                !requestReturnType.reason ||
                actionLoading
              }
            >
              {actionLoading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Leave Application"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to cancel this leave application? This action
            cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCancelModal(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              No, Keep it
            </button>
            <button
              onClick={confirmCancel}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Yes, Cancel Leave
            </button>
          </div>
        </div>
      </Modal>

      {/* Recall Response Modal */}
      <RecallResponseModal
        isOpen={showRecallModal}
        onClose={() => setShowRecallModal(false)}
        recall={selectedRecall}
        onConfirm={handleRecallResponse}
        loading={actionLoading}
      />
      <LeaveExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        scope="SINGLE"
        title="Export My History"
        filters={{
          status: filters.status,
          leave_type_id: filters.type === "All" ? undefined : filters.type,
        }}
      />
    </div>
  );
}
