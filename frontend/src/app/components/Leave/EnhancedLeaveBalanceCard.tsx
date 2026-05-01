import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { routeConstants } from "../../../utils/constants";
import Button from "../Core/ui/Button";
import {
  MdCalendarToday,
  MdSick,
  MdChildFriendly,
  MdSchool,
  MdSentimentVeryDissatisfied,
  MdWork,
  MdPregnantWoman,
  MdTrendingUp,
  MdAttachMoney,
  MdFavorite,
  MdMoneyOff,
  MdExpandLess,
  MdExpandMore,
} from "react-icons/md";
import { EnhancedLeaveBalance, LeaveType } from "../../slice/leaveSlice/types";

// Icon mapping for leave types
const getLeaveIcon = (code: string): React.ComponentType<any> => {
  const iconMap: Record<string, React.ComponentType<any>> = {
    ANNUAL: MdCalendarToday,
    SICK: MdSick,
    MATERNITY: MdPregnantWoman,
    MATERNITY_PRE: MdPregnantWoman,
    MATERNITY_POST: MdPregnantWoman,
    PATERNITY: MdChildFriendly,
    BEREAVEMENT: MdSentimentVeryDissatisfied,
    MOURNING: MdSentimentVeryDissatisfied,
    STUDY: MdSchool,
    UNPAID: MdMoneyOff,
    CIVIC: MdWork,
    MARRIAGE: MdFavorite,
  };
  return iconMap[code?.toUpperCase()] || MdCalendarToday;
};

interface EnhancedLeaveBalanceCardProps {
  balance: EnhancedLeaveBalance;
  leaveType?: LeaveType;
  onApply: () => void;
  disabled?: boolean;
  showDetails?: boolean;
  defaultExpanded?: boolean;
}

export const EnhancedLeaveBalanceCard = ({
  balance,
  leaveType,
  onApply,
  disabled = false,
  showDetails = true,
  defaultExpanded = false,
}: EnhancedLeaveBalanceCardProps) => {
  const navigate = useNavigate();
  const [detailsExpanded, setDetailsExpanded] = useState(defaultExpanded);
  const Icon = getLeaveIcon(leaveType?.code || "ANNUAL");
  const typeName = leaveType?.name || balance.leaveType?.name || "Leave";

  // Calculate percentage for progress bar
  // Some APIs provide both an annual entitlement (e.g., 16 days/yr for Annual Leave)
  // and an accrued/available entitlement to-date. For display, "Total" should reflect
  // the accrued/available entitlement, not the annual default.
  const annualEntitlement = Number(
    balance.annual_entitlement ?? balance.total_entitlement ?? 0,
  );
  const accruedEntitlement = Number(
    balance.accrued_entitlement ?? balance.total_entitlement ?? 0,
  );
  const totalEntitlementForDisplay = Number(
    balance.total_entitlement ?? accruedEntitlement ?? 0,
  );
  const usedDays = Number(balance.used_days || 0);
  const remainingDays = Number(balance.remaining_days || 0);

  const percentageDenominator =
    annualEntitlement > 0 ? annualEntitlement : accruedEntitlement;
  const usedPercentage =
    percentageDenominator > 0 ? (usedDays / percentageDenominator) * 100 : 0;
  const accrualPercentage =
    percentageDenominator > 0
      ? (accruedEntitlement / percentageDenominator) * 100
      : 0;

  // Cash-out info
  const cashOutInfo = balance.cash_out;
  const hasCashOut = cashOutInfo && cashOutInfo.eligible_days > 0;
  const showCashOutAction = !!(hasCashOut && detailsExpanded);
  const canShowDetails = !!(
    showDetails &&
    (balance.accrual_details || hasCashOut)
  );

  return (
    <div
      className={`bg-white text-k-dark-grey rounded-2xl relative overflow-hidden flex flex-col shadow-card border border-gray-100 transition-all duration-300 hover:shadow-lg ${
        canShowDetails && detailsExpanded ? "md:col-span-2 lg:col-span-3" : ""
      } ${disabled ? "opacity-60" : ""}`}
    >
      {/* Header with Icon and Title */}
      <div className="p-6 pb-4">
        <div className="flex justify-between items-start mb-4">
          <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center">
            <Icon className="text-2xl text-primary" />
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold font-display text-k-dark-grey">
              {remainingDays}
            </div>
            <span className="text-xs text-gray-400">days left</span>
          </div>
        </div>
        <h3 className="text-lg font-semibold mb-2">{typeName}</h3>

        {/* Progress Bar */}
        <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
          {/* Accrued (total available) */}
          <div
            className="absolute left-0 top-0 h-full bg-blue-200 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(accrualPercentage, 100)}%` }}
          />
          {/* Used */}
          <div
            className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${Math.min(usedPercentage, 100)}%` }}
          />
        </div>

        {/* Stats Row */}
        <div className="flex justify-between text-xs text-gray-500 mb-4">
          <span>Used: {usedDays}</span>
          <span>Accrued: {accruedEntitlement.toFixed(1)}</span>
          <span>Total: {totalEntitlementForDisplay.toFixed(1)}</span>
        </div>
      </div>

      {/* Details Sections (Accrual & Cash-Out) */}
      {canShowDetails && detailsExpanded && (
        <div className="px-6 pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Accrual Breakdown (First Column) */}
            {balance.accrual_details && (
              <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-base font-bold text-k-dark-grey">
                  <MdTrendingUp className="text-blue-500 text-lg" />
                  <span>Accrual Breakdown</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <span className="text-gray-500 font-medium block mb-1">
                      Carried Over
                    </span>
                    <p className="font-bold text-blue-600 text-base">
                      {balance.accrual_details.carried_over_days} days
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <span className="text-gray-500 font-medium block mb-1">
                      Accrued This Year
                    </span>
                    <p className="font-bold text-green-600 text-base">
                      +
                      {balance.accrual_details.accrued_days_current_year?.toFixed(
                        2,
                      )}{" "}
                      days
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <span className="text-gray-500 font-medium block mb-1">
                      Total Available
                    </span>
                    <p className="font-bold text-k-dark-grey text-base">
                      {accruedEntitlement.toFixed(2)} days
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mt-2">
                  <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <span className="text-gray-500 font-medium block mb-1">
                      Base + Tenure Bonus
                    </span>
                    <p className="font-bold text-k-dark-grey">
                      {balance.accrual_details.base_entitlement} +{" "}
                      {balance.accrual_details.tenure_bonus_days} ={" "}
                      {(balance.accrual_details.base_entitlement || 0) +
                        (balance.accrual_details.tenure_bonus_days || 0)}{" "}
                      days/yr
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <span className="text-gray-500 font-medium block mb-1">
                      Years of Service
                    </span>
                    <p className="font-bold text-k-dark-grey">
                      {(balance.accrual_details.years_of_service || 0).toFixed(
                        1,
                      )}{" "}
                      years
                      <span className="text-xs text-gray-500 font-normal ml-1">
                        ({balance.accrual_details.total_service_days || 0} days)
                      </span>
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <span className="text-gray-500 font-medium block mb-1">
                      {balance.accrual_details.accrual_frequency === "MONTHLY"
                        ? "Monthly Accrual"
                        : "Daily Rate"}
                    </span>
                    <p className="font-bold text-k-dark-grey">
                      {balance.accrual_details.accrual_frequency ===
                      "MONTHLY" ? (
                        <>
                          {balance.accrual_details.months_worked ?? 0} months
                          credited ({balance.accrual_details.days_worked} days
                          worked)
                        </>
                      ) : (
                        <>
                          {balance.accrual_details.daily_rate.toFixed(4)}/day (
                          {balance.accrual_details.days_worked} days worked this
                          year)
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cash-Out Available (Second Column) */}
            {hasCashOut ? (
              <div className="bg-green-50 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-base font-bold text-green-700">
                  <MdAttachMoney className="text-green-600 text-lg" />
                  <span>Cash-Out Available</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white p-3 rounded-lg border border-green-100 shadow-sm">
                    <span className="text-green-600 font-medium block mb-1">
                      Eligible Days
                    </span>
                    <p className="font-bold text-green-700 text-base">
                      {cashOutInfo!.eligible_days} days
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-green-100 shadow-sm">
                    <span className="text-green-600 font-medium block mb-1">
                      Est. Value
                    </span>
                    <p className="font-bold text-green-700 text-base">
                      {(cashOutInfo?.cash_value || 0).toLocaleString()}{" "}
                      {cashOutInfo?.currency || "ETB"}
                    </p>
                  </div>
                </div>
                <div className="bg-white/50 p-3 rounded-lg border border-green-100 mt-auto text-xs text-green-700">
                  <p className="italic">
                    You can convert these accrued days into a cash payment based
                    on your current salary.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50/50 rounded-xl p-5 flex flex-col items-center justify-center border border-dashed border-gray-200 space-y-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                  <MdAttachMoney className="text-2xl" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-gray-400">
                    Cash-Out Unavailable
                  </p>
                  <p className="text-xs text-gray-400 max-w-50 mt-1 italic">
                    Leave encashment is currently not available for this leave
                    type or your current eligibility status.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div
        className={`p-6 pt-2 mt-auto ${
          showCashOutAction ? "flex flex-col sm:flex-row gap-3" : "space-y-3"
        }`}
      >
        {canShowDetails && (
          <Button
            onClick={() => setDetailsExpanded((prev) => !prev)}
            variant="secondary"
            className={`${showCashOutAction ? "flex-1" : "w-full"} h-11 text-sm font-semibold`}
            icon={detailsExpanded ? MdExpandLess : MdExpandMore}
            iconPosition="right"
          >
            {detailsExpanded ? "Hide Details" : "View Details"}
          </Button>
        )}

        <Button
          onClick={onApply}
          disabled={disabled || remainingDays <= 0}
          variant="warning"
          className={`${showCashOutAction ? "flex-1" : "w-full"} h-11 text-sm font-semibold`}
        >
          {remainingDays <= 0 ? "No Balance" : "Apply for Leave"}
        </Button>

        {showCashOutAction && (
          <Button
            onClick={() => navigate(routeConstants.employeeLeaveCashOut)}
            variant="success"
            className="flex-1 h-11 text-sm font-semibold"
          >
            Request Cash-Out
          </Button>
        )}
      </div>
    </div>
  );
};

// Compact version for dashboard/summary views
interface CompactBalanceCardProps {
  balance: EnhancedLeaveBalance;
  leaveType?: LeaveType;
  onClick?: () => void;
}

export const CompactLeaveBalanceCard = ({
  balance,
  leaveType,
  onClick,
}: CompactBalanceCardProps) => {
  const Icon = getLeaveIcon(leaveType?.code || "ANNUAL");
  const typeName = leaveType?.name || balance.leaveType?.name || "Leave";
  const remainingDays = balance.remaining_days || 0;
  const totalEntitlement = balance.total_entitlement || 0;
  const usedDays = balance.used_days || 0;

  return (
    <div
      onClick={onClick}
      className={`bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0">
          <Icon className="text-xl text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-k-dark-grey truncate">
            {typeName}
          </h4>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{remainingDays} left</span>
            <span className="text-gray-300">•</span>
            <span>{usedDays} used</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-k-dark-grey">
            {remainingDays}
          </span>
        </div>
      </div>
      {/* Mini progress bar */}
      <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{
            width: `${
              totalEntitlement > 0 ? (usedDays / totalEntitlement) * 100 : 0
            }%`,
          }}
        />
      </div>
    </div>
  );
};

// Loading skeleton
export const LeaveBalanceCardSkeleton = () => (
  <div className="bg-white p-6 rounded-2xl shadow-card animate-pulse">
    <div className="flex justify-between items-start mb-4">
      <div className="w-12 h-12 rounded-full bg-gray-200"></div>
      <div className="text-right">
        <div className="h-8 w-12 bg-gray-200 rounded mb-1"></div>
        <div className="h-3 w-8 bg-gray-200 rounded"></div>
      </div>
    </div>
    <div className="h-5 w-24 bg-gray-200 rounded mb-3"></div>
    <div className="h-3 w-full bg-gray-200 rounded-full mb-2"></div>
    <div className="flex justify-between mb-4">
      <div className="h-3 w-12 bg-gray-200 rounded"></div>
      <div className="h-3 w-12 bg-gray-200 rounded"></div>
      <div className="h-3 w-12 bg-gray-200 rounded"></div>
    </div>
    <div className="h-12 w-full bg-gray-200 rounded-xl"></div>
  </div>
);

export default EnhancedLeaveBalanceCard;
