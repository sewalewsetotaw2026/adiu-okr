import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { useLeaveSlice, leaveActions } from "../../slice/leaveSlice";
import {
  selectOnLeaveEmployees,
  selectLeaveLoading,
  selectLeaveSuccess,
  selectLeaveError,
  selectLeaveMessage,
} from "../../slice/leaveSlice/selectors";
import { selectAuthUser } from "../../slice/authSlice/selectors";
// HrisSpinner replaced by generic spinner
import {
  MdPerson,
  MdCalendarToday,
  MdArrowForward,
  MdReplay,
} from "react-icons/md";
import Modal from "../common/Modal";
import Button from "../Core/ui/Button";
import FormField from "../common/FormField";
import toast from "react-hot-toast";
import { formatDate, formatIsoDate } from "../../utils/dayjs-format";

export default function TeamOnLeaveWidget() {
  useLeaveSlice();
  const dispatch = useDispatch();
  const onLeaveEmployees = useSelector(selectOnLeaveEmployees);
  const loading = useSelector(selectLeaveLoading);
  const success = useSelector(selectLeaveSuccess);
  const error = useSelector(selectLeaveError);
  const message = useSelector(selectLeaveMessage);
  const user = useSelector(selectAuthUser) as any;

  const [showRecallModal, setShowRecallModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [recallReason, setRecallReason] = useState("");
  const [recallDate, setRecallDate] = useState("");

  useEffect(() => {
    if (user?.employee_id) {
      dispatch(
        leaveActions.getOnLeaveEmployeesRequest({
          manager_id: user.employee_id,
        }),
      );
    }
  }, [dispatch, user?.employee_id]);

  useEffect(() => {
    if (success && message) {
      // Only show success if it's related to recall (simple check if modal was open or generic success)
      if (showRecallModal) {
        toast.success(message);
        setShowRecallModal(false);
        setRecallReason("");
        setRecallDate("");
        setSelectedLeave(null);
        dispatch(leaveActions.resetState());
        // Refresh list
        if (user?.employee_id) {
          dispatch(
            leaveActions.getOnLeaveEmployeesRequest({
              manager_id: user.employee_id,
            }),
          );
        }
      }
    }
    if (error) {
      toast.error(error);
      dispatch(leaveActions.resetState());
    }
  }, [success, error, message, dispatch, showRecallModal, user]);

  const handleRecall = (app: any) => {
    setSelectedLeave(app);
    setRecallDate(formatIsoDate(new Date())); // Default to today
    setShowRecallModal(true);
  };

  const confirmRecall = () => {
    if (selectedLeave && recallReason && recallDate) {
      const applicationId = selectedLeave.application_id || selectedLeave.id;

      dispatch(
        leaveActions.createRecallRequest({
          leave_application_id: applicationId,
          reason: recallReason,
          recall_date: recallDate,
        }),
      );
    } else {
      toast.error("Please provide recall reason and date");
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-card hover:shadow-lg transition-all duration-300 p-6 flex flex-col h-full border border-gray-100 relative group overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50/50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 duration-500"></div>

      <div className="flex justify-between items-center mb-6 relative">
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <MdCalendarToday className="text-k-orange" />
          On Leave Today
        </h3>
        <Link
          to="/manager/team-leaves"
          className="text-sm font-medium text-k-orange hover:text-orange-600 flex items-center gap-1 transition-colors"
        >
          View All <MdArrowForward />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2 max-h-[300px]">
        {loading ? (
          <div className="space-y-3 p-4">
            <div className="h-12 w-full shimmer-bg rounded-xl" />
            <div className="h-12 w-full shimmer-bg rounded-xl" />
            <div className="h-12 w-full shimmer-bg rounded-xl" />
          </div>
        ) : onLeaveEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 text-gray-400">
              <MdPerson size={24} />
            </div>
            <p className="text-gray-500 font-medium">
              No one is on leave today
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Your team is fully available
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {onLeaveEmployees.map((app: any) => (
              <div
                key={app.id || app.application_id}
                className="flex items-center gap-4 p-3 rounded-2xl border border-gray-100 bg-white hover:border-orange-100 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-orange-50 text-k-orange font-bold flex items-center justify-center shrink-0 text-sm">
                  {app.full_name?.charAt(0) || "E"}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 truncate text-sm">
                    {app.full_name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-medium truncate max-w-[100px]">
                      {app.leave_type}
                    </span>
                    <span className="truncate">
                      Ends: {formatDate(app.end_date)}
                    </span>
                  </div>
                </div>

                {/* Direct Recall Button */}
                <button
                  onClick={() => handleRecall(app)}
                  className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors"
                  title="Recall Employee"
                >
                  Recall
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {onLeaveEmployees.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
            <span>Total on leave: {onLeaveEmployees.length}</span>
          </div>
        </div>
      )}

      {/* Recall Modal */}
      <Modal
        isOpen={showRecallModal}
        onClose={() => setShowRecallModal(false)}
        title="Recall Employee from Leave"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              You are about to recall{" "}
              <strong>{selectedLeave?.full_name}</strong> from their{" "}
              <strong>{selectedLeave?.leave_type}</strong> leave (
              {selectedLeave?.requested_days ||
                (selectedLeave?.end_date && selectedLeave?.start_date
                  ? Math.ceil(
                      (new Date(selectedLeave.end_date).getTime() -
                        new Date(selectedLeave.start_date).getTime()) /
                        (1000 * 60 * 60 * 24),
                    )
                  : 0)}{" "}
              days).
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
              loading={loading}
              icon={MdReplay}
              disabled={!recallReason || !recallDate}
            >
              Send Recall Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
