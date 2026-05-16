import { useState, useEffect } from "react";
import {
  FiTrendingUp,
  FiTrendingDown,
  FiRepeat,
  FiCalendar,
  FiChevronRight,
  FiFileText,
} from "react-icons/fi";
// HrisSpinner replaced by generic spinner
import careerService, { CareerEvent } from "../../services/careerService";
import { formatDate } from "../../utils/dayjs-format";

interface CareerHistoryTimelineProps {
  employeeId: string;
  className?: string;
}

const EVENT_CONFIG: Record<string, any> = {
  Promotion: {
    icon: FiTrendingUp,
    color: "bg-green-500",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
  },
  PROMOTION: {
    icon: FiTrendingUp,
    color: "bg-green-500",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
  },
  Demotion: {
    icon: FiTrendingDown,
    color: "bg-amber-500",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
  },
  DEMOTION: {
    icon: FiTrendingDown,
    color: "bg-amber-500",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
  },
  Transfer: {
    icon: FiRepeat,
    color: "bg-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
  },
  TRANSFER: {
    icon: FiRepeat,
    color: "bg-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
  },
  SALARY_INCREASE: {
    icon: FiTrendingUp,
    color: "bg-green-500",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
  },
};

export default function CareerHistoryTimeline({
  employeeId,
  className = "",
}: CareerHistoryTimelineProps) {
  const [events, setEvents] = useState<CareerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) return;

    setLoading(true);
    careerService
      .getCareerHistory(employeeId)
      .then((data) => {
        setEvents(data.careerEvents || []);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to fetch career history:", err);
        setError("Failed to load career history");
        setEvents([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [employeeId]);

  const formatSalary = (salary?: string | number) => {
    if (!salary) return "N/A";
    const num = typeof salary === "string" ? parseFloat(salary) : salary;
    return `ETB ${num.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl shadow-sm p-6 ${className}`}>
        <div className="h-6 w-48 shimmer-bg rounded mb-8" />
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="w-12 h-12 shimmer-bg rounded-full shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 w-32 shimmer-bg rounded" />
                <div className="h-3 w-48 shimmer-bg rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-2xl shadow-sm p-6 ${className}`}>
        <h2 className="text-xl font-bold text-k-dark-grey mb-4">
          Career History
        </h2>
        <div className="text-center py-8 text-gray-500">{error}</div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={`bg-white rounded-2xl shadow-sm p-6 ${className}`}>
        <h2 className="text-xl font-bold text-k-dark-grey mb-4">
          Career History
        </h2>
        <div className="text-center py-8">
          <FiCalendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No career events recorded yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm p-6 ${className}`}>
      <h2 className="text-xl font-bold text-k-dark-grey mb-6">
        Career History
      </h2>

      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-gray-200" />

        {/* Events */}
        <div className="space-y-6">
          {events.map((event, _index) => {
            const config =
              EVENT_CONFIG[event.event_type] || EVENT_CONFIG.Transfer;
            const Icon = config.icon;

            return (
              <div key={event.id} className="relative flex gap-4">
                {/* Icon */}
                <div
                  className={`relative z-10 w-12 h-12 rounded-full ${config.color} flex items-center justify-center shrink-0`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>

                {/* Content */}
                <div
                  className={`flex-1 ${config.bgColor} rounded-xl p-4 border ${config.borderColor}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}
                      >
                        {event.event_type}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        <FiCalendar className="inline w-3.5 h-3.5 mr-1" />
                        {formatDate(event.event_date)}
                        {event.effective_date &&
                          event.effective_date !== event.event_date && (
                            <span className="ml-2">
                              (Effective: {formatDate(event.effective_date)})
                            </span>
                          )}
                      </p>
                    </div>
                  </div>

                  {/* Position Change */}
                  {(event.previousJobTitle || event.newJobTitle) && (
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <span className="text-gray-600">
                        {event.previousJobTitle?.title || "N/A"}
                      </span>
                      <FiChevronRight className="text-gray-400" />
                      <span className="font-medium text-gray-800">
                        {event.newJobTitle?.title || "N/A"}
                      </span>
                    </div>
                  )}

                  {/* Department Change */}
                  {(event.previousDepartment || event.newDepartment) && (
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <span className="text-gray-500">Department:</span>
                      <span className="text-gray-600">
                        {event.previousDepartment?.name || "N/A"}
                      </span>
                      <FiChevronRight className="text-gray-400" />
                      <span className="font-medium text-gray-800">
                        {event.newDepartment?.name || "N/A"}
                      </span>
                    </div>
                  )}

                  {/* Salary Change */}
                  {(event.previous_salary || event.new_salary) && (
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <span className="text-gray-500">Salary:</span>
                      <span className="text-gray-600">
                        {formatSalary(event.previous_salary)}
                      </span>
                      <FiChevronRight className="text-gray-400" />
                      <span
                        className={`font-medium ${
                          Number(event.new_salary) >
                          Number(event.previous_salary)
                            ? "text-green-600"
                            : "text-gray-800"
                        }`}
                      >
                        {formatSalary(event.new_salary)}
                      </span>
                    </div>
                  )}

                  {/* Manager Change */}
                  {(event.previousEmployment?.manager ||
                    event.newEmployment?.manager) && (
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <span className="text-gray-500">Manager:</span>
                      <span className="text-gray-600">
                        {event.previousEmployment?.manager?.full_name || "N/A"}
                      </span>
                      <FiChevronRight className="text-gray-400" />
                      <span className="font-medium text-gray-800">
                        {event.newEmployment?.manager?.full_name || "N/A"}
                      </span>
                    </div>
                  )}

                  {/* Justification */}
                  {event.justification && (
                    <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-200/50">
                      <span className="font-medium">Reason:</span>{" "}
                      {event.justification}
                    </p>
                  )}

                  {/* Document Link */}
                  {event.document_url && (
                    <div className="mt-3 pt-2 border-t border-gray-100">
                      <a
                        href={event.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-primary hover:text-primary-dark hover:underline transition-colors"
                      >
                        <FiFileText className="w-4 h-4 mr-1.5" />
                        View Document
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
