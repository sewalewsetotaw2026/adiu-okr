import React, { useState, useEffect } from "react";
import { MdSettings, MdSave, MdRefresh, MdInfo } from "react-icons/md";
import toast from "react-hot-toast";
import Button from "../../../../components/Core/ui/Button";
import FormField from "../../../../components/common/FormField";
import InfoBanner from "../../../../components/common/InfoBanner";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";

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
  <div className="bg-white rounded-2xl shadow-card p-6 border border-gray-100">
    <div className="flex items-start gap-4 mb-6">
      <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 border border-orange-100">
        <Icon className="text-2xl text-orange-600" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
    </div>
    {children}
  </div>
);

export default function EmployeeSettingsTab() {
  const [settings, setSettings] = useState({
    probation_period_days: 90,
    probation_notification_days: 5,
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchSettings = async () => {
    try {
      setFetching(true);
      const response = await makeCall({
        route: apiRoutes.employeeSettings,
        method: "GET",
      });
      if (response.data?.status === "success") {
        setSettings(response.data.data.settings);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setFetching(false);
      setHasChanges(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleUpdate = async () => {
    try {
      setLoading(true);
      const response = await makeCall({
        route: apiRoutes.employeeSettings,
        method: "PATCH",
        body: settings,
      });
      if (response.data?.status === "success") {
        toast.success("Settings updated successfully");
        setHasChanges(false);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to update settings");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: parseInt(value) || 0,
    }));
    setHasChanges(true);
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <MdSettings className="text-orange-600" />
            Employee Management Settings
          </h2>
          <p className="text-gray-500 mt-1">
            Configure system-wide settings for employee lifecycle management.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="subtle"
            onClick={fetchSettings}
            disabled={loading}
            icon={MdRefresh}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={handleUpdate}
            disabled={!hasChanges || loading}
            icon={MdSave}
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <InfoBanner variant="info" className="mb-8">
        <div className="flex items-center gap-2 font-bold mb-1">
          <MdInfo className="text-lg" />
          Probation Management
        </div>
        <p>
          These settings define the default probation period for new employees
          and when the system should notify HR/Admins about upcoming probation
          milestones.
        </p>
      </InfoBanner>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SettingsCard
          icon={MdSettings}
          title="Probation Duration"
          description="Default length of the probation period for new employments."
        >
          <div className="space-y-4">
            <FormField
              label="Probation Period (Days)"
              name="probation_period_days"
              type="number"
              value={settings.probation_period_days}
              onChange={handleChange}
              placeholder="e.g. 90"
              min={1}
              helpText="Number of days from the start date when probation ends by default."
            />
          </div>
        </SettingsCard>

        <SettingsCard
          icon={MdSettings}
          title="Notification Alarms"
          description="How many days before a milestone to send notifications."
        >
          <div className="space-y-4">
            <FormField
              label="Notification Days"
              name="probation_notification_days"
              type="number"
              value={settings.probation_notification_days}
              onChange={handleChange}
              placeholder="e.g. 5"
              min={1}
              helpText="The system will send alerts this many days before the halfway point and before the end of probation."
            />
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}
