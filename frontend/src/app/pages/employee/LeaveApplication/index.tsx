import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import LeaveHistory from "./LeaveHistory";
import LeaveForm from "./LeaveForm";
// HrisSpinner replaced by generic spinner
import {
  MdCalendarToday,
  MdSick,
  MdChildFriendly,
  MdSchool,
  MdSentimentVeryDissatisfied,
  MdWork,
  MdPregnantWoman,
  MdInfo,
} from "react-icons/md";
import { useLeaveSlice, leaveActions } from "../../../slice/leaveSlice";
import {
  selectApplicableLeaveTypes,
  selectLeaveTypes,
  selectLeaveTypesLoading,
  selectEnhancedBalance,
  selectLeaveBalanceLoading,
  selectAccrualSettings,
  selectCurrentFiscalYear,
} from "../../../slice/leaveSlice/selectors";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import {
  LeaveType,
  EnhancedLeaveBalance,
} from "../../../slice/leaveSlice/types";
import {
  EnhancedLeaveBalanceCard,
  LeaveBalanceCardSkeleton,
} from "../../../components/Leave/EnhancedLeaveBalanceCard";
import Button from "../../../components/Core/ui/Button";
import { formatDate } from "../../../utils/dayjs-format";

// Icon mapping for leave types
const getLeaveIcon = (code: string) => {
  const iconMap: Record<string, React.ComponentType<any>> = {
    ANNUAL: MdCalendarToday,
    SICK: MdSick,
    MATERNITY: MdPregnantWoman,
    MATERNITY_PRE: MdPregnantWoman,
    MATERNITY_POST: MdPregnantWoman,
    PATERNITY: MdChildFriendly,
    BEREAVEMENT: MdSentimentVeryDissatisfied,
    STUDY: MdSchool,
    UNPAID: MdWork,
    CIVIC: MdWork,
  };
  return iconMap[code?.toUpperCase()] || MdCalendarToday;
};

// Simple leave type card for non-accrual types (fallback)
interface LeaveTypeCardProps {
  type: string;
  code: string;
  days: number;
  balance: number;
  icon: React.ComponentType<any>;
  onApply: () => void;
  disabled?: boolean;
}

const LeaveTypeCard = ({
  type,
  days,
  balance,
  icon: Icon,
  onApply,
  disabled = false,
}: LeaveTypeCardProps) => (
  <div
    className={`bg-white text-k-dark-grey p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between h-48 shadow-card group hover:scale-[1.02] transition-transform duration-300 border border-gray-100 ${
      disabled ? "opacity-60" : ""
    }`}
  >
    <div className="absolute right-0 top-0 w-32 h-32 bg-k-yellow rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />

    <div className="relative z-10 flex justify-between items-start">
      <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center">
        <Icon className="text-2xl text-primary" />
      </div>
      <div className="text-right">
        <div className="text-4xl font-bold font-display text-k-dark-grey">
          {days}
        </div>
      </div>
    </div>

    <div className="relative z-10">
      <div className="flex justify-between items-end mb-3">
        <h3 className="text-lg font-semibold">{type}</h3>
        <div className="text-right">
          <span className="text-sm font-bold text-primary">{balance}</span>
          <span className="text-xs text-gray-400"> left</span>
        </div>
      </div>
      <Button
        onClick={onApply}
        disabled={disabled || balance <= 0}
        variant="primary"
        className="w-full h-10 rounded-lg text-sm font-semibold"
      >
        {balance <= 0 ? "No Balance" : "Apply"}
      </Button>
    </div>
  </div>
);

export default function LeaveApplication() {
  useLeaveSlice();
  const dispatch = useDispatch();
  const [showForm, setShowForm] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"enhanced" | "simple">("enhanced");

  const applicableLeaveTypes = useSelector(selectApplicableLeaveTypes);
  const allLeaveTypes = useSelector(selectLeaveTypes);
  const leaveTypesLoading = useSelector(selectLeaveTypesLoading);
  const enhancedBalance = useSelector(selectEnhancedBalance);
  const leaveBalanceLoading = useSelector(selectLeaveBalanceLoading);
  const accrualSettings = useSelector(selectAccrualSettings);
  const fiscalYear = useSelector(selectCurrentFiscalYear);
  const authUser = useSelector(selectAuthUser) as any;
  const [probationEndDate, setProbationEndDate] = useState<string | null>(null);

  useEffect(() => {
    // Fetch applicable leave types for the employee
    dispatch(leaveActions.getApplicableLeaveTypesRequest());
    // Fetch enhanced balance with accrual details
    dispatch(leaveActions.getEnhancedBalanceRequest());
  }, [dispatch]);

  useEffect(() => {
    const fetchProbationEndDate = async () => {
      try {
        const response: any = await makeCall({
          method: "GET",
          route: `${apiRoutes.employees}/me`,
        });

        const payload = response?.data?.data || response?.data || response;
        const probationDate =
          payload?.employment?.probation_end_date ||
          payload?.employment?.probationEndDate ||
          payload?.probation_end_date ||
          payload?.probationEndDate ||
          null;

        setProbationEndDate(probationDate);
      } catch (_error) {
        setProbationEndDate(null);
      }
    };

    fetchProbationEndDate();
  }, [authUser?.id]);

  const probationEnd = probationEndDate ? new Date(probationEndDate) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isOnProbation = !!probationEnd && probationEnd >= today;
  const probationRemainingDays = probationEnd
    ? Math.max(
        0,
        Math.ceil((probationEnd.getTime() - today.getTime()) / 86400000),
      )
    : 0;

  const isSickLeaveType = (leaveType?: LeaveType | null) =>
    (leaveType?.code || "").toUpperCase() === "SICK";

  const handleApply = (leaveType: LeaveType) => {
    if (isOnProbation && !isSickLeaveType(leaveType)) {
      toast.error("During probation, only Sick leave can be applied.");
      return;
    }

    setSelectedLeaveType(leaveType);
    setShowForm(true);
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    setShowForm(false);
    setSelectedLeaveType(null);
    // Refresh balance after form submission
    dispatch(leaveActions.getEnhancedBalanceRequest());
    dispatch(leaveActions.getMyLeavesRequest());
  };

  const handleRefresh = () => {
    dispatch(leaveActions.getApplicableLeaveTypesRequest());
    dispatch(leaveActions.getEnhancedBalanceRequest());
  };

  // Get balance for a specific leave type from enhanced balance
  const getBalanceForType = (
    leaveTypeId: number,
  ): EnhancedLeaveBalance | null => {
    if (enhancedBalance && enhancedBalance.length > 0) {
      return (
        enhancedBalance.find((b) => b.leave_type_id === leaveTypeId) || null
      );
    }
    return null;
  };

  // Get leave type by ID
  const getLeaveTypeById = (leaveTypeId: number): LeaveType | undefined => {
    return (
      applicableLeaveTypes.find((lt) => lt.id === leaveTypeId) ||
      allLeaveTypes.find((lt) => lt.id === leaveTypeId)
    );
  };

  const isLoading = leaveTypesLoading || leaveBalanceLoading;

  // Combine leave types with their balances
  const leaveTypesWithBalance = applicableLeaveTypes.map((lt) => ({
    leaveType: lt,
    balance: getBalanceForType(lt.id),
  }));

  return (
    <EmployeeLayout>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-k-dark-grey">
              {showForm
                ? `Apply for Leave > ${selectedLeaveType?.name}`
                : "Leave Application"}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {showForm
                ? "Fill the required fields below to apply for leave."
                : ""}
            </p>
          </div>
          {!showForm && (
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-primary transition-colors"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent animate-spin rounded-full" />
              ) : (
                <span className="text-lg">↻</span>
              )}
              Refresh
            </button>
          )}
        </div>
      </div>

      {!showForm ? (
        <>
          {/* Fiscal Year & Accrual Info Banner */}
          {fiscalYear && accrualSettings && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
              <MdInfo className="text-blue-500 text-xl shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-blue-700">
                  <strong>Fiscal Year {fiscalYear}:</strong>{" "}
                  {accrualSettings.frequency === "DAILY"
                    ? `Daily accrual at ${accrualSettings.daily_rate?.toFixed(
                        4,
                      )} days/day`
                    : `Monthly accrual`}
                  {accrualSettings.base_days &&
                    ` • Base: ${accrualSettings.base_days} days`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode("enhanced")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    viewMode === "enhanced"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-blue-600 hover:bg-blue-100"
                  }`}
                >
                  Detailed
                </button>
                <button
                  onClick={() => setViewMode("simple")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    viewMode === "simple"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-blue-600 hover:bg-blue-100"
                  }`}
                >
                  Simple
                </button>
              </div>
            </div>
          )}

          {isOnProbation && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <MdInfo className="text-amber-600 text-xl mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  You are currently in probation.
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  During probation, only <strong>Sick Leave</strong> can be
                  applied.
                </p>
                {probationEndDate && (
                  <p className="text-xs text-amber-700 mt-2">
                    Probation ends on{" "}
                    <strong>{formatDate(probationEndDate)}</strong>
                    {" • "}
                    <strong>{probationRemainingDays}</strong> day
                    {probationRemainingDays === 1 ? "" : "s"} remaining.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Leave Balance Cards */}
          {isLoading ? (
            <div className="grid gap-6 mb-10 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <LeaveBalanceCardSkeleton />
              <LeaveBalanceCardSkeleton />
              <LeaveBalanceCardSkeleton />
              <LeaveBalanceCardSkeleton />
            </div>
          ) : viewMode === "enhanced" && enhancedBalance.length > 0 ? (
            <div className="grid gap-6 mb-10 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {[...enhancedBalance]
                .sort((a, b) => {
                  const aType = getLeaveTypeById(a.leave_type_id);
                  const bType = getLeaveTypeById(b.leave_type_id);
                  if (aType?.code === "ANNUAL") return -1;
                  if (bType?.code === "ANNUAL") return 1;
                  return 0;
                })
                .map((balance) => {
                  const leaveType = getLeaveTypeById(balance.leave_type_id);
                  return (
                    <EnhancedLeaveBalanceCard
                      key={balance.id || balance.leave_type_id}
                      balance={balance}
                      leaveType={leaveType}
                      onApply={() => leaveType && handleApply(leaveType)}
                      disabled={isOnProbation && !isSickLeaveType(leaveType)}
                      showDetails={true}
                      defaultExpanded={false}
                    />
                  );
                })}
            </div>
          ) : (
            // Simple view or fallback
            <div className="grid gap-6 mb-10 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              {leaveTypesWithBalance.map(({ leaveType, balance }) => (
                <LeaveTypeCard
                  key={leaveType.id}
                  type={leaveType.name}
                  code={leaveType.code}
                  days={
                    balance?.total_entitlement ||
                    leaveType.default_allowance_days ||
                    0
                  }
                  balance={balance?.remaining_days || 0}
                  icon={getLeaveIcon(leaveType.code)}
                  onApply={() => handleApply(leaveType)}
                  disabled={isOnProbation && !isSickLeaveType(leaveType)}
                />
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-card p-6">
            <LeaveHistory />
          </div>
        </>
      ) : (
        <LeaveForm leaveType={selectedLeaveType!} onBack={handleBack} />
      )}
    </EmployeeLayout>
  );
}
