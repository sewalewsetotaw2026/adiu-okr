import { MdCheckCircle, MdCancel, MdNotificationsActive, MdPersonAdd } from "react-icons/md";
import Button from "../Core/ui/Button";

interface CancellableLeave {
  id: number;
  type: string;
  startDate: string;
  endDate: string;
  duration: number;
  approvedDate: string;
}

interface ActiveLeave {
  id: number;
  employeeName?: string; // Added for manager view
  type: string;
  startDate: string;
  endDate: string;
  duration: number;
  daysRemaining: number;
}

interface RecallNotification {
  id: number;
  leaveType: string;
  reason: string;
  requestedDate: string;
  requestedBy: string;
}

interface CancellableLeaveItemProps {
  leave: CancellableLeave;
  onCancel: (leave: CancellableLeave) => void;
}

interface ActiveLeaveItemProps {
  leave: ActiveLeave;
  onRecall: (leave: ActiveLeave) => void;
}

interface RecallNotificationItemProps {
  notification: RecallNotification;
  onRespond: (notification: RecallNotification, response: "accept" | "decline") => void;
  isLoading?: boolean;
}

// Leave item for active leaves (manager can recall)
export const ActiveLeaveItem = ({ leave, onRecall }: ActiveLeaveItemProps) => {
  const daysRemaining = leave.daysRemaining;
  const progressPercent = Math.min(100, Math.max(0, ((leave.duration - daysRemaining) / leave.duration) * 100));

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center text-primary shrink-0 font-bold">
            {leave.employeeName ? leave.employeeName.charAt(0) : <MdNotificationsActive size={24} />}
          </div>
          <div>
            {leave.employeeName && (
              <h3 className="font-bold text-gray-900 text-lg">{leave.employeeName}</h3>
            )}
            <h4 className={`font-medium ${leave.employeeName ? 'text-gray-600 text-sm' : 'text-gray-800 font-bold'}`}>
              {leave.type}
            </h4>
            <p className="text-sm text-gray-500 mt-1">
              <span className="font-medium text-gray-700">{leave.startDate}</span> to <span className="font-medium text-gray-700">{leave.endDate}</span>
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded-full font-medium">
                {daysRemaining} days remaining
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full md:w-auto">
          <div className="hidden md:block w-32">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">{Math.round(progressPercent)}% completed</p>
          </div>

          <Button
            onClick={() => onRecall(leave)}
            variant="primary"
            icon={MdPersonAdd}
          >
            Recall Employee
          </Button>
        </div>
      </div>
    </div>
  );
};



// Recall notification item (for employee view)
export const RecallNotificationItem = ({ notification, onRespond, isLoading }: RecallNotificationItemProps) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-primary hover:shadow-md transition-shadow">
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center text-primary shrink-0">
        <MdNotificationsActive size={24} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-gray-800">Recall Request</h3>
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
            Pending Response
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          Your manager has requested you return from <strong>{notification.leaveType}</strong> early.
        </p>
        <p className="text-sm text-gray-500">
          <strong>Reason:</strong> {notification.reason}
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Requested on {notification.requestedDate} by {notification.requestedBy}
        </p>
      </div>
    </div>
    <div className="flex flex-col sm:flex-row gap-3 mt-4 pt-4 border-t border-gray-100">
      <Button
        onClick={() => onRespond(notification, 'accept')}
        variant="primary"
        icon={MdCheckCircle}
        loading={isLoading}
      >
        Accept & Return
      </Button>
      <Button
        onClick={() => onRespond(notification, 'decline')}
        variant="secondary"
        icon={MdCancel}
        disabled={isLoading}
      >
        Decline
      </Button>
    </div>
  </div>
);
