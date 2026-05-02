import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
// HrisSpinner replaced by generic spinner
import { MdHistory, MdPersonAdd, MdNotificationsActive } from "react-icons/md";
import toast from "react-hot-toast";
import Button from "../../../components/Core/ui/Button";
import StatusModal from "../../../components/common/StatusModal";
import Modal from "../../../components/common/Modal";
import {
  ActiveLeaveItem,
  RecallNotificationItem,
} from "../../../components/Leave/LeaveRecallItems";
import { useLeaveSlice, leaveActions } from "../../../slice/leaveSlice";
import {
  selectMyRecallNotifications,
  selectRecallsLoading,
  selectLeaveLoading,
  selectLeaveSuccess,
  selectLeaveError,
  selectLeaveMessage,
  selectOnLeaveEmployees,
} from "../../../slice/leaveSlice/selectors";
import { LeaveRecall } from "../../../slice/leaveSlice/types";
import { selectIsManager } from "../../../slice/managerSlice/selectors";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import { formatDate, formatIsoDate } from "../../../utils/dayjs-format";

// Helper to calculate days remaining
const calculateDaysRemaining = (endDate: string): number => {
  const end = new Date(endDate);
  const today = new Date();
  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

const transformRecallNotification = (recall: LeaveRecall) => ({
  id: recall.id,
  leaveType: recall.leaveApplication?.leaveType?.name || "Leave",
  reason: recall.reason,
  requestedDate: formatDate(recall.created_at || "", ""),
  requestedBy: recall.recalledBy?.full_name || "Manager",
});

export default function LeaveRecallPage({ isEmbedded = false }: { isEmbedded?: boolean }) {
  useLeaveSlice();
  const dispatch = useDispatch();

  // Role selectors
  const isManager = useSelector(selectIsManager);
  const user = useSelector(selectAuthUser) as any;

  // Redux selectors
  const onLeaveEmployees = useSelector(selectOnLeaveEmployees);
  const recallNotificationsData = useSelector(selectMyRecallNotifications);
  const recallsLoading = useSelector(selectRecallsLoading);
  const loading = useSelector(selectLeaveLoading);
  const success = useSelector(selectLeaveSuccess);
  const error = useSelector(selectLeaveError);
  const message = useSelector(selectLeaveMessage);

  // Local state
  const [showRecallForm, setShowRecallForm] = useState(false);
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [recallReason, setRecallReason] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch data on mount
  useEffect(() => {
    dispatch(leaveActions.getMyRecallNotificationsRequest());

    if (isManager && user?.employee_id) {
      dispatch(
        leaveActions.getOnLeaveEmployeesRequest({
          manager_id: user.employee_id,
        }),
      );
    }
  }, [dispatch, isManager, user?.employee_id]);

  // Handle success/error
  useEffect(() => {
    if (success && message) {
      setSuccessMessage(message);
      setShowSuccessModal(true);
      // Auto-refresh data
      dispatch(leaveActions.getMyRecallNotificationsRequest());
      if (isManager && user?.employee_id) {
        dispatch(
          leaveActions.getOnLeaveEmployeesRequest({
            manager_id: user.employee_id,
          }),
        );
      }

      dispatch(leaveActions.resetState());
    }
    if (error) {
      toast.error(error);
      dispatch(leaveActions.resetState());
    }
  }, [success, error, message, dispatch, isManager, user?.employee_id]);

  const handleRefresh = () => {
    dispatch(leaveActions.getMyRecallNotificationsRequest());
    if (isManager && user?.employee_id) {
      dispatch(
        leaveActions.getOnLeaveEmployeesRequest({
          manager_id: user.employee_id,
        }),
      );
    }
  };

  // Transform data
  const recallNotifications = Array.isArray(recallNotificationsData)
    ? recallNotificationsData.map(transformRecallNotification)
    : [];

  const activeLeaves = Array.isArray(onLeaveEmployees)
    ? onLeaveEmployees.map((leave: any) => ({
        id: leave.id || leave.application_id,
        employeeName: leave.full_name,
        type: leave.leave_type || leave.leaveType?.name || "Leave",
        startDate: formatDate(leave.start_date),
        endDate: formatDate(leave.end_date),
        duration: leave.requested_days || 0,
        daysRemaining: calculateDaysRemaining(leave.end_date),
      }))
    : [];

  // Handle recall click (manager action)
  const handleRecallClick = (leave: any) => {
    setSelectedLeave(leave);
    setShowRecallForm(true);
  };

  // Submit recall request
  const submitRecallRequest = () => {
    if (!recallReason.trim()) {
      toast.error("Please provide a reason for the recall");
      return;
    }
    if (selectedLeave) {
      dispatch(
        leaveActions.createRecallRequest({
          leave_application_id: selectedLeave.id,
          reason: recallReason,
          recall_date: formatIsoDate(new Date()),
        }),
      );
    }
    setShowRecallForm(false);
    setSelectedLeave(null);
    setRecallReason("");
  };

  // Handle recall notification response
  const handleRecallResponse = (notification: any, response: string) => {
    if (response === "accept") {
      dispatch(
        leaveActions.respondToRecallRequest({
          id: notification.id,
          response: "ACCEPTED",
        }),
      );
    } else {
      setSelectedNotification(notification);
      setShowDeclineForm(true);
    }
  };

  // Submit decline reason
  const submitDeclineReason = () => {
    if (!declineReason.trim()) {
      toast.error("Please provide a reason for declining");
      return;
    }
    if (selectedNotification) {
      dispatch(
        leaveActions.respondToRecallRequest({
          id: selectedNotification.id,
          response: "DECLINED",
          employee_response: declineReason,
        }),
      );
    }
    setShowDeclineForm(false);
    setSelectedNotification(null);
    setDeclineReason("");
  };

  const isLoading = recallsLoading || (isManager && loading);

  const content = (
    <>
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-k-dark-grey flex items-center gap-3">
            <MdHistory className="text-k-orange" /> Leave Recall
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage recall requests and employee recalls.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
          title="Refresh"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent animate-spin rounded-full" />
          ) : (
            <span className="text-lg">↻</span>
          )}
        </button>
      </div>

      {/* 1. Recall Notifications (Visible to ALL Employees) */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-k-dark-grey mb-4 flex items-center gap-2">
          <MdNotificationsActive className="text-k-orange" /> Recall Requests
        </h2>
        {isLoading && !recallNotifications.length ? (
          <div className="bg-white p-6 rounded-xl shadow-sm animate-pulse">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-gray-200"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 w-1/3 rounded"></div>
                <div className="h-4 bg-gray-200 w-1/2 rounded"></div>
              </div>
            </div>
          </div>
        ) : recallNotifications.length > 0 ? (
          <div className="space-y-4">
            {recallNotifications.map((notification) => (
              <RecallNotificationItem
                key={notification.id}
                notification={notification}
                onRespond={handleRecallResponse}
                isLoading={isLoading}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-xl border border-dashed border-gray-300 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
              <MdNotificationsActive size={24} />
            </div>
            <p className="text-gray-500 font-medium">
              No recall requests currently
            </p>
            <p className="text-xs text-gray-400 mt-1">
              You have no active recall requests from your manager or HR.
            </p>
          </div>
        )}
      </div>

      {/* 2. Recall Employees (Visible ONLY to Managers) */}
      {isManager && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-k-dark-grey flex items-center gap-2">
              <MdPersonAdd className="text-k-orange" /> Recall Employee
            </h2>
            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
              Manager View
            </span>
          </div>

          {isLoading && !activeLeaves.length ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white p-6 rounded-xl shadow-sm animate-pulse h-24"
                ></div>
              ))}
            </div>
          ) : activeLeaves.length > 0 ? (
            <div className="space-y-4">
              {activeLeaves.map((leave) => (
                <ActiveLeaveItem
                  key={leave.id}
                  leave={leave}
                  onRecall={handleRecallClick}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                <MdPersonAdd size={32} />
              </div>
              <h3 className="text-lg font-medium text-gray-600">
                No employees on leave
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                None of your team members are currently on leave.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recall Form Modal */}
      <Modal
        isOpen={showRecallForm}
        onClose={() => {
          setShowRecallForm(false);
          setRecallReason("");
        }}
        title="Recall Employee"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Employee:</strong> {selectedLeave?.employeeName}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <strong>Leave Type:</strong> {selectedLeave?.type}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <strong>Period:</strong> {selectedLeave?.startDate} to{" "}
              {selectedLeave?.endDate}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <strong>Days Remaining:</strong> {selectedLeave?.daysRemaining}{" "}
              days
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-k-dark-grey mb-2">
              Reason for Recall <span className="text-red-500">*</span>
            </label>
            <textarea
              value={recallReason}
              onChange={(e) => setRecallReason(e.target.value)}
              rows={4}
              className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-k-orange focus:border-transparent transition-all resize-none outline-none"
              placeholder="Please provide a reason for recalling this employee..."
            />
          </div>

          <div className="flex gap-4 pt-2">
            <Button
              onClick={() => {
                setShowRecallForm(false);
                setRecallReason("");
              }}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={submitRecallRequest}
              variant="primary"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Recall Request"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Decline Reason Modal */}
      <Modal
        isOpen={showDeclineForm}
        onClose={() => {
          setShowDeclineForm(false);
          setDeclineReason("");
        }}
        title="Decline Recall Request"
        size="md"
      >
        <div className="space-y-4">
          {/* Warning Message */}
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
            <p className="text-sm text-yellow-800">
              Please provide a reason for declining. This will be sent to your
              manager.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-k-dark-grey mb-2">
              Reason for Declining <span className="text-red-500">*</span>
            </label>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={4}
              className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-k-orange focus:border-transparent transition-all resize-none outline-none"
              placeholder="Please explain why you cannot return to work..."
            />
          </div>

          <div className="flex gap-4 pt-2">
            <Button
              onClick={() => {
                setShowDeclineForm(false);
                setDeclineReason("");
              }}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={submitDeclineReason}
              variant="primary"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit Decline"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Success Modal */}
      <StatusModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        type="success"
        title="Success!"
        message={successMessage}
        primaryButtonText="Done"
        onPrimaryAction={() => setShowSuccessModal(false)}
        secondaryButtonText=""
        onSecondaryAction={() => {}}
      />
    </>
  );

  return isEmbedded ? content : <EmployeeLayout>{content}</EmployeeLayout>;
}
