import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import {
  MdEvent,
  MdAdd,
  MdEdit,
  MdDelete,
  MdRefresh,
  MdAutorenew,
  MdCalendarToday,
} from "react-icons/md";
import toast from "react-hot-toast";
import Modal from "../../../components/common/Modal";
import Button from "../../../components/Core/ui/Button";
import BackButton from "../../../components/common/BackButton";
import FormField from "../../../components/common/FormField";
import StatusModal from "../../../components/common/StatusModal";
import DataTable, { TableColumn } from "../../../components/common/DataTable";
import InfoBanner from "../../../components/common/InfoBanner";
import StatCard from "../../../components/common/StatCard";
import {
  ActionMenu,
  ActionOption,
} from "../../../components/common/ActionMenu";
import { useLeaveSlice, leaveActions } from "../../../slice/leaveSlice";
import {
  formatDate,
  formatIsoDate,
  formatWithPattern,
  isValidDateValue,
} from "../../../utils/dayjs-format";
import {
  selectPublicHolidays,
  selectUpcomingHolidays,
  selectHolidaysLoading,
  selectLeaveLoading,
  selectLeaveSuccess,
  selectLeaveError,
  selectLeaveMessage,
} from "../../../slice/leaveSlice/selectors";
import { PublicHoliday } from "../../../slice/leaveSlice/types";

// Helper to get the date field (prioritize holiday_date from API)
const getHolidayDate = (holiday: PublicHoliday): string => {
  const dateStr = holiday.holiday_date || (holiday as any).date || "";
  if (!dateStr) return "";
  if (!isValidDateValue(dateStr)) return dateStr;
  return formatIsoDate(dateStr);
};

// Get day of week
const getDayOfWeek = (dateString: string): string => {
  if (!dateString) return "-";
  return formatWithPattern(dateString, "dddd");
};

// Check if date is in the past
const isPastDate = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

// Initial form state
const initialFormState = {
  name: "",
  date: "",
  is_recurring: true,
};

export default function PublicHolidaysPage() {
  useLeaveSlice();
  const dispatch = useDispatch();

  // Redux state
  const rawHolidays = useSelector(selectPublicHolidays);
  const rawUpcoming = useSelector(selectUpcomingHolidays);
  const holidaysLoading = useSelector(selectHolidaysLoading);
  const loading = useSelector(selectLeaveLoading);
  const success = useSelector(selectLeaveSuccess);
  const error = useSelector(selectLeaveError);
  const message = useSelector(selectLeaveMessage);

  // Ensure array safety
  const holidays = Array.isArray(rawHolidays) ? rawHolidays : [];
  const upcomingHolidays = Array.isArray(rawUpcoming) ? rawUpcoming : [];

  // Local state
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<PublicHoliday | null>(
    null,
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch holidays on mount
  useEffect(() => {
    dispatch(leaveActions.getPublicHolidaysRequest(undefined));
    dispatch(leaveActions.getUpcomingHolidaysRequest({} as any));
  }, [dispatch]);

  // Handle success/error
  useEffect(() => {
    if (success && message) {
      toast.success(message);
      dispatch(leaveActions.resetState());
      setShowFormModal(false);
      setShowDeleteModal(false);
      setShowSeedModal(false);
      resetForm();
      // Ensure we re-fetch with empty objects to match typing and force fresh data
      dispatch(leaveActions.getPublicHolidaysRequest(undefined));
      dispatch(leaveActions.getUpcomingHolidaysRequest({} as any));
    }
    if (error) {
      toast.error(error);
      dispatch(leaveActions.resetState());
    }
  }, [success, error, message, dispatch]);

  const handleRefresh = () => {
    dispatch(leaveActions.getPublicHolidaysRequest(undefined));
    dispatch(leaveActions.getUpcomingHolidaysRequest({} as any));
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setFormErrors({});
    setSelectedHoliday(null);
    setIsEditMode(false);
  };

  const handleAdd = () => {
    resetForm();
    setShowFormModal(true);
  };

  const handleEdit = (holiday: PublicHoliday) => {
    setSelectedHoliday(holiday);
    setIsEditMode(true);
    setFormData({
      name: holiday.name,
      date: getHolidayDate(holiday),
      is_recurring: holiday.is_recurring,
    });
    setShowFormModal(true);
  };

  const handleDelete = (holiday: PublicHoliday) => {
    setSelectedHoliday(holiday);
    setShowDeleteModal(true);
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Name is required";
    }

    if (!formData.date) {
      errors.date = "Date is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const payload = {
      name: formData.name.trim(),
      holiday_date: formData.date,
      is_recurring: formData.is_recurring,
    };

    if (isEditMode && selectedHoliday) {
      dispatch(
        leaveActions.updatePublicHolidayRequest({
          id: selectedHoliday.id,
          ...payload,
        }),
      );
    } else {
      dispatch(leaveActions.createPublicHolidayRequest(payload));
    }
  };

  const confirmDelete = () => {
    if (selectedHoliday) {
      dispatch(leaveActions.deletePublicHolidayRequest(selectedHoliday.id));
    }
  };

  const handleSeedDefaults = () => {
    setShowSeedModal(true);
  };

  const confirmSeedDefaults = () => {
    dispatch(leaveActions.seedDefaultHolidaysRequest());
  };

  // Sort holidays: upcoming first (nearest to today on top), then past holidays
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sortedHolidays = [...holidays].sort((a, b) => {
    const dateA = new Date(getHolidayDate(a));
    const dateB = new Date(getHolidayDate(b));
    const isPastA = dateA < today;
    const isPastB = dateB < today;

    // If one is past and one is upcoming, upcoming comes first
    if (isPastA && !isPastB) return 1;
    if (!isPastA && isPastB) return -1;

    // If both are upcoming, nearest date first
    if (!isPastA && !isPastB) {
      return dateA.getTime() - dateB.getTime();
    }

    // If both are past, most recent past first
    return dateB.getTime() - dateA.getTime();
  });

  // Table columns
  const columns: TableColumn<PublicHoliday>[] = [
    {
      key: "name",
      header: "Holiday Name",
      render: (holiday) => {
        const dateStr = getHolidayDate(holiday);
        return (
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isPastDate(dateStr) ? "bg-gray-100" : "bg-k-orange/10"
              }`}
            >
              <MdEvent
                className={`text-xl ${
                  isPastDate(dateStr) ? "text-gray-400" : "text-k-orange"
                }`}
              />
            </div>
            <div>
              <p
                className={`font-medium ${
                  isPastDate(dateStr) ? "text-gray-400" : "text-k-dark-grey"
                }`}
              >
                {holiday.name}
              </p>
              {isPastDate(dateStr) && (
                <p className="text-xs text-gray-400">Past</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "date",
      header: "Date",
      render: (holiday) => {
        const dateStr = getHolidayDate(holiday);
        return (
          <div>
            <p className="font-medium">{formatDate(dateStr)}</p>
            <p className="text-xs text-gray-400">{getDayOfWeek(dateStr)}</p>
          </div>
        );
      },
    },
    {
      key: "recurring",
      header: "Recurring",
      render: (holiday) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            holiday.is_recurring
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {holiday.is_recurring ? "Annual" : "One-time"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      headerClassName: "text-center",
      className: "text-center",
      render: (holiday) => {
        const actions: ActionOption[] = [
          {
            label: "Edit",
            value: "edit",
            icon: <MdEdit className="text-gray-500" />,
            onClick: () => handleEdit(holiday),
          },
          {
            label: "Delete",
            value: "delete",
            icon: <MdDelete className="text-red-500" />,
            onClick: () => handleDelete(holiday),
            variant: "danger",
          },
        ];
        return <ActionMenu actions={actions} />;
      },
    },
  ];

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-4">
        <BackButton to="/admin/leaves" label="Back to Leave Management" />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-k-dark-grey flex items-center gap-3">
              <MdCalendarToday className="text-k-orange" />
              Public Holidays
            </h1>
          </div>
          <p className="text-gray-500 text-sm mt-1 ml-12">
            Manage public holidays for leave calculations
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleRefresh}
            variant="secondary"
            icon={MdRefresh}
            loading={holidaysLoading}
          >
            Refresh
          </Button>
          <Button onClick={handleAdd} variant="primary" icon={MdAdd}>
            Add Holiday
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <StatCard
          icon={MdEvent}
          label="Total Holidays"
          value={holidays.length}
          color="bg-k-orange"
        />
        <StatCard
          icon={MdCalendarToday}
          label="Upcoming"
          value={upcomingHolidays.length}
          color="bg-k-orange"
        />
        <StatCard
          icon={MdAutorenew}
          label="Recurring"
          value={holidays.filter((h) => h.is_recurring).length}
          color="bg-k-orange"
        />
      </div>

      {/* Upcoming Holidays Card */}
      {upcomingHolidays.length > 0 && (
        <div className="bg-gradient-to-r from-primary/10 to-primary-light rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-k-dark-grey mb-4">
            Upcoming Holidays
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingHolidays.slice(0, 3).map((holiday) => {
              const dateStr = getHolidayDate(holiday);
              return (
                <div
                  key={holiday.id}
                  className="bg-white rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-k-orange/10 flex items-center justify-center">
                      <MdEvent className="text-2xl text-k-orange" />
                    </div>
                    <div>
                      <p className="font-medium text-k-dark-grey">
                        {holiday.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(dateStr)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {getDayOfWeek(dateStr)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Data Table */}
      <DataTable
        data={sortedHolidays}
        columns={columns}
        loading={holidaysLoading}
        keyExtractor={(holiday) => holiday.id}
        emptyState={{
          icon: MdCalendarToday,
          title: "No public holidays configured",
          description:
            "Add holidays manually or use 'Seed Ethiopian Holidays' to create common Ethiopian holidays.",
          action: (
            <div className="flex gap-3 justify-center">
              <Button onClick={handleAdd} variant="primary" icon={MdAdd}>
                Add Holiday
              </Button>
            </div>
          ),
        }}
        className="p-6"
        itemLabel="holiday"
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          resetForm();
        }}
        title={isEditMode ? "Edit Holiday" : "Add Public Holiday"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <FormField
            label="Holiday Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Ethiopian New Year"
            error={formErrors.name}
            required
          />

          <FormField
            label="Date"
            name="date"
            type="date"
            value={formData.date}
            onChange={handleChange}
            error={formErrors.date}
            required
          />

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="is_recurring"
              checked={formData.is_recurring}
              onChange={handleChange}
              className="w-5 h-5 text-k-orange rounded border-gray-300 focus:ring-k-orange cursor-pointer"
            />
            <div>
              <span className="text-sm font-medium text-k-dark-grey">
                Recurring Annual Holiday
              </span>
              <p className="text-xs text-gray-500">
                This holiday occurs every year on the same date
              </p>
            </div>
          </label>

          <div className="flex gap-4 pt-4 border-t border-gray-100">
            <Button
              onClick={() => {
                setShowFormModal(false);
                resetForm();
              }}
              variant="secondary"
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              {isEditMode ? "Update Holiday" : "Create Holiday"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <StatusModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        type="warning"
        title="Delete Holiday"
        message={`Are you sure you want to delete "${selectedHoliday?.name}"? This action cannot be undone.`}
        primaryButtonText={loading ? "Deleting..." : "Delete"}
        onPrimaryAction={confirmDelete}
        secondaryButtonText="Cancel"
        onSecondaryAction={() => setShowDeleteModal(false)}
      />

      {/* Seed Defaults Modal */}
      <Modal
        isOpen={showSeedModal}
        onClose={() => setShowSeedModal(false)}
        title="Seed Ethiopian Holidays"
        size="md"
      >
        <div className="space-y-4">
          <InfoBanner variant="info">
            This will create common Ethiopian public holidays:
          </InfoBanner>

          <ul className="text-sm text-gray-600 space-y-2 pl-4">
            <li>• Ethiopian New Year (Enkutatash)</li>
            <li>• Finding of the True Cross (Meskel)</li>
            <li>• Ethiopian Christmas (Genna)</li>
            <li>• Ethiopian Epiphany (Timket)</li>
            <li>• Adwa Victory Day</li>
            <li>• Ethiopian Good Friday</li>
            <li>• Ethiopian Easter</li>
            <li>• Labor Day</li>
            <li>• Ethiopian Patriots' Victory Day</li>
            <li>• Eid al-Fitr (Approximate)</li>
            <li>• Eid al-Adha (Approximate)</li>
            <li>• Mawlid (Prophet's Birthday)</li>
          </ul>

          <InfoBanner variant="warning">
            Existing holidays will not be affected. Duplicates (by name and
            date) will be skipped.
          </InfoBanner>

          <div className="flex gap-4 pt-4 border-t border-gray-100">
            <Button onClick={() => setShowSeedModal(false)} variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={confirmSeedDefaults}
              variant="primary"
              icon={MdAutorenew}
              loading={loading}
            >
              Create Ethiopian Holidays
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
