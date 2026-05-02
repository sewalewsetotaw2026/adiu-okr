import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { routeConstants } from "../../../../utils/constants";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import LoadingScreen from "../../../components/Core/ui/LoadingScreen";
import {
  MdAttachMoney,
  MdCalculate,
  MdSend,
  MdHistory,
  MdInfo,
  MdCheck,
  MdClose,
  MdAccessTime,
  MdArrowBack,
  MdGavel,
} from "react-icons/md";
import toast from "react-hot-toast";
import Button from "../../../components/Core/ui/Button";
import InfoBanner from "../../../components/common/InfoBanner";
import { useLeaveSlice, leaveActions } from "../../../slice/leaveSlice";
import {
  selectCashOutCalculation,
  selectMyCashOutRequests,
  selectCashOutLoading,
  selectCashOutError,
  selectLeaveSuccess,
  selectLeaveMessage,
} from "../../../slice/leaveSlice/selectors";
import { CashOutRequest } from "../../../slice/leaveSlice/types";
import { formatDate } from "../../../utils/dayjs-format";

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig: Record<
    string,
    { bg: string; text: string; icon: React.ComponentType<any> }
  > = {
    PENDING: {
      bg: "bg-yellow-100",
      text: "text-yellow-700",
      icon: MdAccessTime,
    },
    APPROVED: { bg: "bg-green-100", text: "text-green-700", icon: MdCheck },
    REJECTED: { bg: "bg-red-100", text: "text-red-700", icon: MdClose },
    PAID: { bg: "bg-blue-100", text: "text-blue-700", icon: MdCheck },
  };

  const config = statusConfig[status] || statusConfig.PENDING;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      <Icon className="text-sm" />
      {status}
    </span>
  );
};

// Request history card
const CashOutRequestCard = ({ request }: { request: CashOutRequest }) => (
  <div className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-3">
      <div>
        <p className="text-sm text-gray-500">
          {request.created_at ? formatDate(request.created_at) : "N/A"}
        </p>
        <p className="font-semibold text-k-dark-grey mt-1">
          {request.days_cashed_out} days
        </p>
      </div>
      <StatusBadge status={request.status} />
    </div>
    <div className="flex justify-between items-center pt-3 border-t border-gray-100">
      <div>
        <span className="text-xs text-gray-500">Daily Rate</span>
        <p className="font-medium text-sm">
          {(
            request.monthly_salary / request.salary_divisor
          )?.toLocaleString() || "N/A"}{" "}
          ETB
        </p>
      </div>
      <div className="text-right">
        <span className="text-xs text-gray-500">Total Amount</span>
        <p className="font-bold text-k-orange">
          {request.cash_value?.toLocaleString() || "N/A"} ETB
        </p>
      </div>
    </div>
    {request.rejection_reason && (
      <div className="mt-3 p-3 bg-red-50 rounded-lg">
        <p className="text-xs text-red-700">
          <strong>Reason:</strong> {request.rejection_reason}
        </p>
      </div>
    )}
  </div>
);

export default function LeaveCashOut() {
  useLeaveSlice();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux state
  const calculation = useSelector(selectCashOutCalculation);
  const myRequests = useSelector(selectMyCashOutRequests);
  const loading = useSelector(selectCashOutLoading);
  const error = useSelector(selectCashOutError);
  const success = useSelector(selectLeaveSuccess);
  const message = useSelector(selectLeaveMessage);

  // Local state
  const [daysToRequest, setDaysToRequest] = useState<number>(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"request" | "history">("request");

  // Fetch calculation and history on mount
  useEffect(() => {
    dispatch(leaveActions.calculateCashOutRequest());
    dispatch(leaveActions.getMyCashOutRequestsRequest());
  }, [dispatch]);

  // Handle success/error
  useEffect(() => {
    if (success && message && message.includes("Cash-out")) {
      toast.success(message);
      dispatch(leaveActions.resetState());
      setShowConfirm(false);
      setDaysToRequest(0);
      // Refresh data
      dispatch(leaveActions.calculateCashOutRequest());
      dispatch(leaveActions.getMyCashOutRequestsRequest());
    }
    if (error) {
      toast.error(error);
      dispatch(leaveActions.resetState());
    }
  }, [success, error, message, dispatch]);

  const handleCalculate = () => {
    dispatch(leaveActions.calculateCashOutRequest());
  };

  const handleSubmitRequest = () => {
    if (
      daysToRequest > 0 &&
      daysToRequest <= (calculation?.eligible_days || 0)
    ) {
      dispatch(
        leaveActions.requestCashOutRequest({ days_to_cash_out: daysToRequest }),
      );
    } else {
      toast.error("Please enter a valid number of days");
    }
  };

  const handleMaxDays = () => {
    setDaysToRequest(calculation?.eligible_days || 0);
  };

  // Calculate estimated amount
  const estimatedAmount =
    calculation && daysToRequest > 0
      ? daysToRequest * calculation.daily_rate
      : 0;

  // Check if user has pending request
  const hasPendingRequest = myRequests.some((r) => r.status === "PENDING");

  return (
    <EmployeeLayout>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <button
            onClick={() => navigate(routeConstants.employeeLeave)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-k-orange transition-colors mb-2"
          >
            <MdArrowBack />
            Back to Leave Application
          </button>
          <h1 className="text-2xl font-bold text-k-dark-grey flex items-center gap-3">
            <MdAttachMoney className="text-k-orange" />
            Leave Cash-Out
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Convert your unused annual leave days to cash
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("request")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === "request"
              ? "bg-k-orange text-white shadow-md"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          <MdCalculate className="text-lg" />
          Request Cash-Out
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === "history"
              ? "bg-k-orange text-white shadow-md"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          <MdHistory className="text-lg" />
          Request History
          {myRequests.length > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {myRequests.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "request" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Eligibility Card */}
          <div className="bg-white rounded-2xl shadow-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-k-dark-grey flex items-center gap-2">
                <MdCalculate className="text-k-orange" />
                Cash-Out Eligibility
              </h2>
              <button
                onClick={handleCalculate}
                className="text-gray-500 hover:text-k-orange"
                disabled={loading}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                ) : (
                  <span className="text-xl">↻</span>
                )}
              </button>
            </div>

            {loading && !calculation ? (
              <div className="animate-pulse space-y-4">
                <div className="h-24 bg-gray-100 rounded-xl"></div>
                <div className="h-12 bg-gray-100 rounded-xl"></div>
              </div>
            ) : calculation ? (
              <>
                {!calculation.eligible ? (
                  <InfoBanner variant="warning" className="mb-4">
                    {calculation.reason ||
                      "You are not currently eligible for leave cash-out."}
                  </InfoBanner>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-green-50 p-4 rounded-xl">
                        <p className="text-xs text-green-600 mb-1">
                          Eligible Days
                        </p>
                        <p className="text-3xl font-bold text-green-700">
                          {calculation.eligible_days}
                        </p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-xl">
                        <p className="text-xs text-blue-600 mb-1">Daily Rate</p>
                        <p className="text-xl font-bold text-blue-700">
                          {calculation.daily_rate?.toLocaleString()} ETB
                        </p>
                      </div>
                    </div>

                    <div className="bg-primary-light/50 p-4 rounded-xl mb-6">
                      <p className="text-xs text-primary mb-1">
                        Maximum Cash-Out Value
                      </p>
                      <p className="text-2xl font-bold text-k-orange">
                        {calculation.max_amount?.toLocaleString()} ETB
                      </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl text-xs text-gray-600 space-y-1">
                      <p>
                        <strong>Calculation:</strong>
                      </p>
                      <p>
                        Monthly Salary:{" "}
                        {calculation.monthly_salary?.toLocaleString()} ETB
                      </p>
                      <p>
                        Salary Divisor: {calculation.settings?.salary_divisor}
                      </p>
                      <p>
                        Daily Rate ={" "}
                        {calculation.monthly_salary?.toLocaleString()} ÷{" "}
                        {calculation.settings?.salary_divisor} ={" "}
                        {calculation.daily_rate?.toLocaleString()} ETB
                      </p>
                    </div>
                  </>
                )}
              </>
            ) : (
              <InfoBanner variant="info">
                Unable to calculate eligibility. Please try refreshing.
              </InfoBanner>
            )}
          </div>

          {/* Request Form Card */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-card p-6">
              <h2 className="text-lg font-semibold text-k-dark-grey flex items-center gap-2 mb-6">
                <MdSend className="text-k-orange" />
                Submit Request
              </h2>

              {hasPendingRequest ? (
                <InfoBanner variant="warning">
                  You have a pending cash-out request. Please wait for it to be
                  processed before submitting a new one.
                </InfoBanner>
              ) : !calculation?.eligible ? (
                <InfoBanner variant="info">
                  <div className="flex items-center gap-2">
                    <MdInfo />
                    <span>You are not eligible for cash-out at this time.</span>
                  </div>
                </InfoBanner>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-k-dark-grey mb-2">
                        Days to Cash Out
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          max={calculation.eligible_days}
                          value={daysToRequest || ""}
                          onChange={(e) =>
                            setDaysToRequest(parseInt(e.target.value) || 0)
                          }
                          placeholder={`Max: ${calculation.eligible_days} days`}
                          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-k-orange/20 focus:border-k-orange"
                        />
                        <button
                          onClick={handleMaxDays}
                          className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors"
                        >
                          Max
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        You can cash out up to {calculation.eligible_days} days
                      </p>
                    </div>

                    {daysToRequest > 0 && (
                      <div className="bg-green-50 p-4 rounded-xl">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-xs text-green-600">
                              Estimated Amount
                            </p>
                            <p className="text-2xl font-bold text-green-700">
                              {estimatedAmount.toLocaleString()} ETB
                            </p>
                          </div>
                          <div className="text-right text-xs text-green-600">
                            <p>
                              {daysToRequest} days ×{" "}
                              {calculation.daily_rate?.toLocaleString()} ETB
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {!showConfirm ? (
                    <Button
                      onClick={() => setShowConfirm(true)}
                      variant="primary"
                      icon={MdSend}
                      className="w-full mt-6"
                      disabled={
                        daysToRequest <= 0 ||
                        daysToRequest > calculation.eligible_days
                      }
                    >
                      Review Request
                    </Button>
                  ) : (
                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                      <p className="text-sm text-yellow-800 mb-4">
                        <strong>Confirm your request:</strong>
                        <br />
                        You are about to request cash-out for{" "}
                        <strong>{daysToRequest} days</strong> for an estimated
                        amount of{" "}
                        <strong>{estimatedAmount.toLocaleString()} ETB</strong>.
                      </p>
                      <div className="flex gap-3">
                        <Button
                          onClick={handleSubmitRequest}
                          variant="primary"
                          loading={loading}
                          className="flex-1"
                        >
                          Confirm
                        </Button>
                        <Button
                          onClick={() => setShowConfirm(false)}
                          variant="secondary"
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Policy Info Card */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2 mb-4">
                <MdGavel className="text-lg" />
                Cash-Out Policy Criteria
              </h3>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                  <p className="text-xs text-blue-700">
                    <strong>Enablement:</strong> Leave cash-out must be enabled
                    by the organization for your specific employment category.
                  </p>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                  <p className="text-xs text-blue-700">
                    <strong>Maximum Days:</strong> There is an annual limit on
                    how many days can be converted (currently{" "}
                    <strong>10 days</strong>).
                  </p>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                  <p className="text-xs text-blue-700">
                    <strong>Accrued Balance:</strong> You can only cash out from
                    your <strong>accrued</strong> annual leave balance, not your
                    total annual entitlement.
                  </p>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                  <p className="text-xs text-blue-700">
                    <strong>Pending Requests:</strong> You cannot have another
                    active or pending cash-out request in the system.
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <h2 className="text-lg font-semibold text-k-dark-grey mb-6">
            Request History
          </h2>

          {myRequests.length === 0 ? (
            <div className="text-center py-12">
              <MdHistory className="text-6xl text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No cash-out requests yet</p>
              <button
                onClick={() => setActiveTab("request")}
                className="mt-4 text-k-orange font-medium hover:underline"
              >
                Submit your first request
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myRequests.map((request) => (
                <CashOutRequestCard key={request.id} request={request} />
              ))}
            </div>
          )}
        </div>
      )}
    </EmployeeLayout>
  );
}
