import React, { useState, useEffect } from "react";
import { MdAdd, MdVisibility } from "react-icons/md";
import {
  MdCalendarToday,
  MdSchool,
  MdChildFriendly,
  MdWork,
  MdSick,
  MdPregnantWoman,
  MdFavorite,
  MdMoneyOff,
  MdSentimentVeryDissatisfied,
} from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import CardMenu from "./CardMenu";
import StatusModal from "../common/StatusModal";
import { useLeaveSlice, leaveActions } from "../../slice/leaveSlice";
import {
  selectLeaveBalance,
  selectLeaveBalanceLoading,
} from "../../slice/leaveSlice/selectors";
import { LeaveBalance } from "../../slice/leaveSlice/types";

interface LeaveBarProps {
  label: string;
  used: number;
  total: number;
  colorClass: string;
  icon?: React.ComponentType<{ className?: string }>;
}

// Icon mapping for different leave types
const getLeaveTypeIcon = (leaveTypeName: string): React.ComponentType<{ className?: string }> => {
  const name = leaveTypeName.toLowerCase();

  if (name.includes("annual") || name.includes("vacation")) {
    return MdCalendarToday;
  }
  if (name.includes("sick") || name.includes("medical")) {
    return MdSick;
  }
  if (name.includes("maternity")) {
    return MdPregnantWoman;
  }
  if (name.includes("paternity")) {
    return MdChildFriendly;
  }
  if (name.includes("marriage") || name.includes("wedding")) {
    return MdFavorite;
  }
  if (name.includes("bereavement") || name.includes("mourning") || name.includes("funeral")) {
    return MdSentimentVeryDissatisfied;
  }
  if (name.includes("study") || name.includes("education") || name.includes("training")) {
    return MdSchool;
  }
  if (name.includes("civic") || name.includes("jury") || name.includes("court")) {
    return MdWork;
  }
  if (name.includes("unpaid")) {
    return MdMoneyOff;
  }

  // Default icon
  return MdCalendarToday;
};

const LeaveBar = ({ label, used, total, colorClass, icon: Icon }: LeaveBarProps) => {
  const remaining = Math.max(total - used, 0);
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const IconComponent = Icon || MdCalendarToday;

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between text-sm mb-1">
        <div className="flex items-center gap-2">
          <IconComponent className="text-gray-600 text-lg" />
          <span className="font-medium text-gray-700">{label}</span>
        </div>
        <span className="text-gray-500">
          {remaining} of {total} days
        </span>
      </div>
      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const LeaveBalanceSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="mb-4">
        <div className="flex justify-between mb-1">
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
          <div className="h-4 w-20 bg-gray-200 rounded"></div>
        </div>
        <div className="h-2 w-full bg-gray-200 rounded-full"></div>
      </div>
    ))}
  </div>
);

// Default leave types removed

export default function LeaveBalanceCard() {
  useLeaveSlice();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const leaveBalance = useSelector(selectLeaveBalance);
  const loading = useSelector(selectLeaveBalanceLoading);

  useEffect(() => {
    dispatch(leaveActions.getMyLeaveBalanceRequest());
  }, [dispatch]);

  const actions = [
    {
      label: "View Details",
      icon: MdVisibility,
      onClick: () => setShowDetailsModal(true),
    },
    {
      label: "Request Leave",
      icon: MdAdd,
      onClick: () => navigate("/employee/leave"),
    },
  ];

  // Map leave balance to display data
  const getDisplayData = () => {
    if (leaveBalance && leaveBalance.length > 0) {
      return leaveBalance.map((balance: LeaveBalance) => ({
        name: balance.leaveType?.name || "Leave",
        total: balance.total_entitlement || 0,
        used: balance.used_days || 0,
        pending: balance.pending_days || 0,
        remaining:
          balance.remaining_days ||
          (balance.total_entitlement || 0) - (balance.used_days || 0),
      }));
    }

    return [];
  };

  const displayData = getDisplayData();
  const totalAllocated = displayData.reduce((sum, d) => sum + d.total, 0);
  const calculatedTotalUsed = displayData.reduce((sum, d) => sum + d.used, 0);

  const modalMessage =
    displayData.length > 0
      ? `You have used ${calculatedTotalUsed} days out of your total ${totalAllocated} allocated leave days for this year.`
      : "No leave balance data available.";

  return (
    <>
      <div className="bg-white p-6 rounded-2xl shadow-card h-full">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-k-dark-grey">
            Available Leave Days
          </h3>
          <CardMenu actions={actions} />
        </div>

        {loading ? (
          <LeaveBalanceSkeleton />
        ) : displayData.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No leave balances found.
          </div>
        ) : (
          <div className="space-y-6">
            {displayData.map((item, index) => (
              <LeaveBar
                key={item.name + index}
                label={item.name}
                used={item.used}
                total={item.total}
                colorClass="bg-primary"
                icon={getLeaveTypeIcon(item.name)}
              />
            ))}
          </div>
        )}
      </div>

      <StatusModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        type="info"
        title="Leave Balance Details"
        message={modalMessage}
        primaryButtonText="Close"
        onPrimaryAction={() => setShowDetailsModal(false)}
        secondaryButtonText="Dismiss"
        onSecondaryAction={() => setShowDetailsModal(false)}
      />
    </>
  );
}
