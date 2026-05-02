import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import LoadingScreen from "../../../components/Core/ui/LoadingScreen";
import useMinimumDelay from "../../../hooks/useMinimumDelay";
import {
  MdSettings,
  MdSave,
  MdRefresh,
  MdCalendarToday,
  MdBusinessCenter,
  MdPeople,
  MdAutorenew,
  MdAttachMoney,
  MdNotifications,
  MdHistory,
  MdTrendingUp,
} from "react-icons/md";
import toast from "react-hot-toast";
import Button from "../../../components/Core/ui/Button";
import BackButton from "../../../components/common/BackButton";
import InfoBanner from "../../../components/common/InfoBanner";
import FormField from "../../../components/common/FormField";
import { useLeaveSlice, leaveActions } from "../../../slice/leaveSlice";
import {
  selectLeaveSettings,
  selectSettingsLoading,
  selectLeaveLoading,
  selectLeaveSuccess,
  selectLeaveError,
  selectLeaveMessage,
} from "../../../slice/leaveSlice/selectors";
import {
  AccrualBasis,
  AccrualFrequency,
  EncashmentRounding,
} from "../../../slice/leaveSlice/types";
import { formatDate } from "../../../utils/dayjs-format";

// Settings Card Component
const SettingsCard = ({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <div className="bg-white rounded-2xl shadow-card p-6">
    <div className="flex items-start gap-4 mb-6">
      <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
        <Icon className="text-2xl text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-k-dark-grey">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
    </div>
    {children}
  </div>
);

// Toggle Switch Component
const ToggleSwitch = ({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) => (
  <div
    className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0 cursor-pointer"
    onClick={() => onChange(!checked)}
  >
    <div>
      <p className="text-sm font-medium text-k-dark-grey">{label}</p>
      {description && (
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      )}
    </div>
    <button
      type="button"
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
        checked ? "bg-primary" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  </div>
);

// Month options
const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

// Form data interface
interface LeaveSettingsFormData {
  // Work Week Configuration
  saturday_half_day: boolean;
  sunday_off: boolean;
  fiscal_year_start_month: number;
  accrual_basis: AccrualBasis;
  require_ceo_approval_for_managers: boolean;
  auto_approve_after_days: number | null;
  // Accrual Configuration
  annual_leave_base_days: number;
  accrual_frequency: AccrualFrequency;
  accrual_divisor: number;
  increment_period_years: number;
  increment_amount: number;
  max_annual_leave_cap: number | null;
  // Encashment Configuration
  enable_encashment: boolean;
  encashment_salary_divisor: number;
  max_encashment_days: number;
  encashment_rounding: EncashmentRounding;
  // Notification Configuration
  enable_leave_expiry: boolean;
  expiry_notification_days: number;
  balance_notification_enabled: boolean;
  notification_channels: string;
}

export default function LeaveSettingsPage() {
  useLeaveSlice();
  const dispatch = useDispatch();

  // Redux state
  const leaveSettings = useSelector(selectLeaveSettings);
  const settingsLoading = useSelector(selectSettingsLoading);
  const loading = useSelector(selectLeaveLoading);
  const success = useSelector(selectLeaveSuccess);
  const error = useSelector(selectLeaveError);
  const message = useSelector(selectLeaveMessage);

  // Local state for form
  const [formData, setFormData] = useState<LeaveSettingsFormData>({
    // Work Week Configuration
    saturday_half_day: true,
    sunday_off: true,
    fiscal_year_start_month: 1,
    accrual_basis: "ANNIVERSARY",
    require_ceo_approval_for_managers: true,
    auto_approve_after_days: null,
    // Accrual Configuration
    annual_leave_base_days: 16,
    accrual_frequency: "DAILY",
    accrual_divisor: 365,
    increment_period_years: 2,
    increment_amount: 1,
    max_annual_leave_cap: null,
    // Encashment Configuration
    enable_encashment: true,
    encashment_salary_divisor: 30,
    max_encashment_days: 10,
    encashment_rounding: "FLOOR",
    // Notification Configuration
    enable_leave_expiry: true,
    expiry_notification_days: 30,
    balance_notification_enabled: true,
    notification_channels: "EMAIL,IN_APP",
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "general" | "encashment" | "notifications"
  >("general");

  // Fetch settings on mount
  useEffect(() => {
    dispatch(leaveActions.getLeaveSettingsRequest());
  }, [dispatch]);

  // Sync settings to form
  useEffect(() => {
    if (leaveSettings) {
      setFormData({
        saturday_half_day: leaveSettings.saturday_half_day ?? true,
        sunday_off: leaveSettings.sunday_off ?? true,
        fiscal_year_start_month: leaveSettings.fiscal_year_start_month ?? 1,
        accrual_basis: leaveSettings.accrual_basis ?? "ANNIVERSARY",
        require_ceo_approval_for_managers:
          leaveSettings.require_ceo_approval_for_managers ?? true,
        auto_approve_after_days: leaveSettings.auto_approve_after_days ?? null,
        annual_leave_base_days: leaveSettings.annual_leave_base_days ?? 16,
        accrual_frequency: leaveSettings.accrual_frequency ?? "DAILY",
        accrual_divisor: leaveSettings.accrual_divisor ?? 365,
        increment_period_years: leaveSettings.increment_period_years ?? 2,
        increment_amount: leaveSettings.increment_amount ?? 1,
        max_annual_leave_cap: leaveSettings.max_annual_leave_cap ?? null,
        enable_encashment: leaveSettings.enable_encashment ?? true,
        encashment_salary_divisor:
          leaveSettings.encashment_salary_divisor ?? 30,
        max_encashment_days: leaveSettings.max_encashment_days ?? 10,
        encashment_rounding: leaveSettings.encashment_rounding ?? "FLOOR",
        enable_leave_expiry: leaveSettings.enable_leave_expiry ?? true,
        expiry_notification_days: leaveSettings.expiry_notification_days ?? 30,
        balance_notification_enabled:
          leaveSettings.balance_notification_enabled ?? true,
        notification_channels:
          leaveSettings.notification_channels ?? "EMAIL,IN_APP",
      });
      setHasChanges(false);
    }
  }, [leaveSettings]);

  // Handle success/error
  useEffect(() => {
    if (success && message) {
      toast.success(message);
      dispatch(leaveActions.resetState());
      setHasChanges(false);
    }
    if (error) {
      toast.error(error);
      dispatch(leaveActions.resetState());
    }
  }, [success, error, message, dispatch]);

  const handleRefresh = () => {
    dispatch(leaveActions.getLeaveSettingsRequest());
  };

  const handleToggleChange = (
    field: keyof LeaveSettingsFormData,
    value: boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "number" ? (value === "" ? null : parseFloat(value)) : value,
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    dispatch(leaveActions.updateLeaveSettingsRequest(formData));
  };

  const handleReset = () => {
    if (leaveSettings) {
      setFormData({
        saturday_half_day: leaveSettings.saturday_half_day ?? true,
        sunday_off: leaveSettings.sunday_off ?? true,
        fiscal_year_start_month: leaveSettings.fiscal_year_start_month ?? 1,
        accrual_basis: leaveSettings.accrual_basis ?? "ANNIVERSARY",
        require_ceo_approval_for_managers:
          leaveSettings.require_ceo_approval_for_managers ?? true,
        auto_approve_after_days: leaveSettings.auto_approve_after_days ?? null,
        annual_leave_base_days: leaveSettings.annual_leave_base_days ?? 16,
        accrual_frequency: leaveSettings.accrual_frequency ?? "DAILY",
        accrual_divisor: leaveSettings.accrual_divisor ?? 365,
        increment_period_years: leaveSettings.increment_period_years ?? 2,
        increment_amount: leaveSettings.increment_amount ?? 1,
        max_annual_leave_cap: leaveSettings.max_annual_leave_cap ?? null,
        enable_encashment: leaveSettings.enable_encashment ?? true,
        encashment_salary_divisor:
          leaveSettings.encashment_salary_divisor ?? 30,
        max_encashment_days: leaveSettings.max_encashment_days ?? 10,
        encashment_rounding: leaveSettings.encashment_rounding ?? "FLOOR",
        enable_leave_expiry: leaveSettings.enable_leave_expiry ?? true,
        expiry_notification_days: leaveSettings.expiry_notification_days ?? 30,
        balance_notification_enabled:
          leaveSettings.balance_notification_enabled ?? true,
        notification_channels:
          leaveSettings.notification_channels ?? "EMAIL,IN_APP",
      });
      setHasChanges(false);
    }
  };

  // Tab button component
  const TabButton = ({
    tab,
    label,
    icon: Icon,
  }: {
    tab: typeof activeTab;
    label: string;
    icon: React.ComponentType<any>;
  }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer ${
        activeTab === tab
          ? "bg-primary text-white shadow-md"
          : "bg-white text-gray-600 hover:bg-gray-100"
      }`}
    >
      <Icon className="text-lg" />
      {label}
    </button>
  );

  const showSettingsLoading = useMinimumDelay(settingsLoading, 800);

  if (showSettingsLoading) {
    return (
      <AdminLayout>
        <LoadingScreen />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-4">
        <BackButton to="/admin/leaves" label="Back to Leave Management" />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-k-dark-grey flex items-center gap-3">
              <MdSettings className="text-k-orange" />
              Leave Settings
            </h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Configure leave management policies and work schedule
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleRefresh}
            variant="secondary"
            icon={MdRefresh}
            loading={settingsLoading}
          >
            Refresh
          </Button>
          {hasChanges && (
            <>
              <Button onClick={handleReset} variant="secondary">
                Reset
              </Button>
              <Button
                onClick={handleSave}
                variant="primary"
                icon={MdSave}
                loading={loading}
              >
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Policy Version Badge */}
      {leaveSettings && (
        <div className="mb-6 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm">
            <MdHistory className="text-lg" />
            <span className="font-medium">Policy Version:</span> v
            {leaveSettings.policy_version || 1}
          </div>
          {leaveSettings.policy_effective_date && (
            <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-xl text-sm">
              <MdCalendarToday className="text-lg" />
              <span className="font-medium">Effective:</span>{" "}
              {formatDate(leaveSettings.policy_effective_date)}
            </div>
          )}
        </div>
      )}

      {/* Info Banner */}
      {!leaveSettings && (
        <InfoBanner variant="warning" className="mb-6">
          Leave settings have not been configured yet. Configure your
          organization's leave policies below.
        </InfoBanner>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-6 bg-gray-50 p-2 rounded-xl">
        <TabButton tab="general" label="General" icon={MdBusinessCenter} />
        <TabButton tab="encashment" label="Cash-Out" icon={MdAttachMoney} />
        <TabButton
          tab="notifications"
          label="Notifications"
          icon={MdNotifications}
        />
      </div>

      {/* Tab Content */}
      {activeTab === "general" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Work Schedule Settings */}
          <SettingsCard
            icon={MdCalendarToday}
            title="Work Schedule"
            description="Configure working days for leave calculations"
          >
            <ToggleSwitch
              checked={formData.saturday_half_day}
              onChange={(checked) =>
                handleToggleChange("saturday_half_day", checked)
              }
              label="Saturday is Half-Day"
              description="Saturday counts as 0.5 working days in leave calculations"
            />
            <ToggleSwitch
              checked={formData.sunday_off}
              onChange={(checked) => handleToggleChange("sunday_off", checked)}
              label="Sunday is Off"
              description="Sunday is a non-working day"
            />
            <div className="mt-4 bg-gray-50 p-4 rounded-xl">
              <p className="text-xs text-gray-600">
                <strong>Current Work Week:</strong>{" "}
                {formData.sunday_off ? "Mon-Sat" : "Mon-Sun"} (
                {formData.saturday_half_day ? "5.5 days" : "6 days"})
              </p>
            </div>
          </SettingsCard>

          {/* Fiscal Year Settings */}
          <SettingsCard
            icon={MdBusinessCenter}
            title="Fiscal Year & Basis"
            description="Configure fiscal year and leave calculation basis"
          >
            <div className="space-y-4">
              <FormField
                label="Fiscal Year Start Month"
                name="fiscal_year_start_month"
                type="select"
                value={formData.fiscal_year_start_month}
                onChange={handleInputChange}
                options={months.map((month) => ({
                  value: month.value,
                  label: month.label,
                }))}
                hint="Leave balances are calculated from this month"
              />

              <div>
                <label className="block text-sm font-medium text-k-dark-grey mb-3">
                  Leave Accrual Basis
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="radio"
                      name="accrual_basis"
                      value="ANNIVERSARY"
                      checked={formData.accrual_basis === "ANNIVERSARY"}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-primary cursor-pointer"
                    />
                    <div>
                      <p className="text-sm font-medium text-k-dark-grey">
                        Anniversary Date
                      </p>
                      <p className="text-xs text-gray-500">
                        Leave is calculated from the employee's hire date
                        anniversary
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="radio"
                      name="accrual_basis"
                      value="CALENDAR_YEAR"
                      checked={formData.accrual_basis === "CALENDAR_YEAR"}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-k-orange cursor-pointer"
                    />
                    <div>
                      <p className="text-sm font-medium text-k-dark-grey">
                        Calendar Year
                      </p>
                      <p className="text-xs text-gray-500">
                        Leave is calculated from the start of the fiscal year
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </SettingsCard>

          {/* Approval Settings */}
          <SettingsCard
            icon={MdPeople}
            title="Approval Workflow"
            description="Configure leave approval workflow settings"
          >
            <ToggleSwitch
              checked={formData.require_ceo_approval_for_managers}
              onChange={(checked) =>
                handleToggleChange("require_ceo_approval_for_managers", checked)
              }
              label="Require CEO Approval for Managers"
              description="Manager leave applications require CEO approval after HR review"
            />
            <div className="mt-4">
              <FormField
                label="Auto-Approve After Days"
                name="auto_approve_after_days"
                type="number"
                value={formData.auto_approve_after_days ?? ""}
                onChange={handleInputChange}
                placeholder="Leave blank to disable"
                hint="Automatically approve leave if no action is taken within specified days."
              />
            </div>
          </SettingsCard>

          {/* Workflow Info */}
          <SettingsCard
            icon={MdAutorenew}
            title="Approval Workflow Info"
            description="Understanding the approval process"
          >
            <div className="space-y-3">
              <div className="bg-gray-50 p-4 rounded-xl">
                <h4 className="font-semibold text-k-dark-grey text-sm mb-2">
                  Standard Approval Flow
                </h4>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                    Supervisor
                  </span>
                  <span>→</span>
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    HR
                  </span>
                  <span>→</span>
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                    Approved
                  </span>
                </div>
              </div>
              {formData.require_ceo_approval_for_managers && (
                <div className="bg-primary-light p-4 rounded-xl">
                  <h4 className="font-semibold text-k-dark-grey text-sm mb-2">
                    Manager Approval Flow
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                      Supervisor
                    </span>
                    <span>→</span>
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      HR
                    </span>
                    <span>→</span>
                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      CEO
                    </span>
                    <span>→</span>
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                      Approved
                    </span>
                  </div>
                </div>
              )}
            </div>
          </SettingsCard>
        </div>
      )}

      {activeTab === "encashment" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Encashment Settings */}
          <SettingsCard
            icon={MdAttachMoney}
            title="Cash-Out Configuration"
            description="Configure leave cash-out (encashment) settings"
          >
            <ToggleSwitch
              checked={formData.enable_encashment}
              onChange={(checked) =>
                handleToggleChange("enable_encashment", checked)
              }
              label="Enable Leave Cash-Out"
              description="Allow employees to convert unused leave to cash"
            />
            {formData.enable_encashment && (
              <div className="space-y-4 mt-4">
                <FormField
                  label="Salary Divisor"
                  name="encashment_salary_divisor"
                  type="number"
                  value={formData.encashment_salary_divisor}
                  onChange={handleInputChange}
                  hint="Daily rate = Monthly Salary / Divisor"
                />
                <FormField
                  label="Maximum Cash-Out Days"
                  name="max_encashment_days"
                  type="number"
                  value={formData.max_encashment_days}
                  onChange={handleInputChange}
                  hint="Maximum days that can be cashed out per year"
                />
                <div>
                  <label className="block text-sm font-medium text-k-dark-grey mb-3">
                    Rounding Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["FLOOR", "ROUND", "CEIL"] as EncashmentRounding[]).map(
                      (method) => (
                        <label
                          key={method}
                          className={`flex items-center justify-center p-3 rounded-xl cursor-pointer transition-colors ${
                            formData.encashment_rounding === method
                              ? "bg-primary text-white"
                              : "bg-gray-50 hover:bg-gray-100"
                          }`}
                        >
                          <input
                            type="radio"
                            name="encashment_rounding"
                            value={method}
                            checked={formData.encashment_rounding === method}
                            onChange={handleInputChange}
                            className="sr-only"
                          />
                          <span className="text-sm font-medium">{method}</span>
                        </label>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
          </SettingsCard>

          {/* Cash-Out Formula */}
          <SettingsCard
            icon={MdAttachMoney}
            title="Cash-Out Formula"
            description="How cash-out value is calculated"
          >
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                <p className="text-sm font-medium text-k-dark-grey">
                  Calculation Formula:
                </p>
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <code className="text-sm text-gray-700">
                    Daily Rate = Monthly Salary ÷{" "}
                    {formData.encashment_salary_divisor}
                  </code>
                </div>
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <code className="text-sm text-gray-700">
                    Cash Value = Eligible Days × Daily Rate
                  </code>
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-xl">
                <p className="text-xs text-green-700">
                  <strong>Example:</strong> Employee with 25,000 ETB monthly
                  salary and 5 eligible days:
                  <br />
                  Daily Rate = 25,000 ÷ {
                    formData.encashment_salary_divisor
                  } = {(25000 / formData.encashment_salary_divisor).toFixed(2)}{" "}
                  ETB
                  <br />
                  Cash Value = 5 ×{" "}
                  {(25000 / formData.encashment_salary_divisor).toFixed(
                    2,
                  )} ={" "}
                  {((5 * 25000) / formData.encashment_salary_divisor).toFixed(
                    2,
                  )}{" "}
                  ETB
                </p>
              </div>
            </div>
          </SettingsCard>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expiry Notifications */}
          <SettingsCard
            icon={MdNotifications}
            title="Leave Expiry Notifications"
            description="Configure alerts for expiring leave balances"
          >
            <ToggleSwitch
              checked={formData.enable_leave_expiry}
              onChange={(checked) =>
                handleToggleChange("enable_leave_expiry", checked)
              }
              label="Enable Leave Expiry Tracking"
              description="Track and notify about expiring leave balances"
            />
            {formData.enable_leave_expiry && (
              <div className="space-y-4 mt-4">
                <FormField
                  label="Expiry Notification Days"
                  name="expiry_notification_days"
                  type="number"
                  value={formData.expiry_notification_days}
                  onChange={handleInputChange}
                  hint="Notify employees this many days before leave expires"
                />
              </div>
            )}
          </SettingsCard>

          {/* Notification Channels */}
          <SettingsCard
            icon={MdNotifications}
            title="Notification Settings"
            description="Configure notification preferences"
          >
            <ToggleSwitch
              checked={formData.balance_notification_enabled}
              onChange={(checked) =>
                handleToggleChange("balance_notification_enabled", checked)
              }
              label="Balance Update Notifications"
              description="Notify employees when their balance changes"
            />
            <div className="mt-4">
              <label className="block text-sm font-medium text-k-dark-grey mb-3">
                Notification Channels
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={formData.notification_channels.includes("EMAIL")}
                    onChange={(e) => {
                      const channels = formData.notification_channels
                        .split(",")
                        .filter(Boolean);
                      if (e.target.checked) {
                        channels.push("EMAIL");
                      } else {
                        const idx = channels.indexOf("EMAIL");
                        if (idx > -1) channels.splice(idx, 1);
                      }
                      setFormData((prev) => ({
                        ...prev,
                        notification_channels: channels.join(","),
                      }));
                      setHasChanges(true);
                    }}
                    className="w-4 h-4 text-primary rounded cursor-pointer"
                  />
                  <span className="text-sm text-k-dark-grey">
                    Email Notifications
                  </span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={formData.notification_channels.includes("IN_APP")}
                    onChange={(e) => {
                      const channels = formData.notification_channels
                        .split(",")
                        .filter(Boolean);
                      if (e.target.checked) {
                        channels.push("IN_APP");
                      } else {
                        const idx = channels.indexOf("IN_APP");
                        if (idx > -1) channels.splice(idx, 1);
                      }
                      setFormData((prev) => ({
                        ...prev,
                        notification_channels: channels.join(","),
                      }));
                      setHasChanges(true);
                    }}
                    className="w-4 h-4 text-k-orange rounded cursor-pointer"
                  />
                  <span className="text-sm text-k-dark-grey">
                    In-App Notifications
                  </span>
                </label>
              </div>
            </div>
          </SettingsCard>
        </div>
      )}
    </AdminLayout>
  );
}
