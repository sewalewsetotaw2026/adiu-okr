import React, { useState, useEffect, useCallback } from "react";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import {
  getPublicHolidays,
  PublicHoliday,
} from "../../services/holidayService";
import { formatDate } from "../../utils/dayjs-format";

interface LeaveDatePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onStartHalfDayToggle?: (checked: boolean) => void;
  onEndHalfDayToggle?: (checked: boolean) => void;
  isStartHalfDay?: boolean;
  isEndHalfDay?: boolean;
  minDate?: string;
  maxDate?: string;
  startMinDate?: string;
  startMaxDate?: string;
  isCalendarDays?: boolean; // If true, all days are selectable (no skipping weekends/holidays)
  error?: { start?: string; end?: string };
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const LeaveDatePicker: React.FC<LeaveDatePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onStartHalfDayToggle,
  onEndHalfDayToggle,
  isStartHalfDay = false,
  isEndHalfDay = false,
  minDate,
  maxDate,
  startMinDate,
  startMaxDate,
  isCalendarDays = false,
  error,
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [activeBoundary, setActiveBoundary] = useState<"start" | "end">(
    "start",
  );

  useEffect(() => {
    if (!startDate) {
      setActiveBoundary("start");
      setSelectingEnd(false);
      return;
    }

    if (startDate && !endDate) {
      setActiveBoundary("end");
      setSelectingEnd(true);
      return;
    }

    setSelectingEnd(activeBoundary === "end");
  }, [startDate, endDate, activeBoundary]);

  // Fetch holidays for the current view year
  useEffect(() => {
    setLoadingHolidays(true);
    getPublicHolidays(viewYear).then((h) => {
      setHolidays(h);
      setLoadingHolidays(false);
    });
  }, [viewYear]);

  const getHolidayForDate = useCallback(
    (date: Date): PublicHoliday | undefined => {
      const dateStr = toDateStr(date);
      return holidays.find((h) => {
        const hDate = new Date(h.holiday_date);
        return toDateStr(hDate) === dateStr;
      });
    },
    [holidays],
  );

  const isNonWorkingDay = useCallback(
    (date: Date): boolean => {
      if (isCalendarDays) return false;
      return date.getDay() === 0; // Sunday
    },
    [isCalendarDays],
  );

  const isSaturdayDay = useCallback(
    (date: Date): boolean => {
      if (isCalendarDays) return false;
      return date.getDay() === 6; // Saturday
    },
    [isCalendarDays],
  );

  const isDisabled = useCallback(
    (date: Date): boolean => {
      const dateStr = toDateStr(date);
      if (minDate && dateStr < minDate) return true;
      if (maxDate && dateStr > maxDate) return true;

      if (activeBoundary === "start") {
        if (startMinDate && dateStr < startMinDate) return true;
        if (startMaxDate && dateStr > startMaxDate) return true;
      }

      if (!isCalendarDays) {
        if (date.getDay() === 0) return true; // Sunday disabled
        if (getHolidayForDate(date)) return true; // Holidays disabled
      }
      return false;
    },
    [
      minDate,
      maxDate,
      startMinDate,
      startMaxDate,
      activeBoundary,
      isCalendarDays,
      getHolidayForDate,
    ],
  );

  const isInRange = useCallback(
    (date: Date): boolean => {
      const dateStr = toDateStr(date);
      const effectiveEnd = selectingEnd && hoveredDate ? hoveredDate : endDate;
      if (!startDate || !effectiveEnd) return false;
      return dateStr > startDate && dateStr < effectiveEnd;
    },
    [startDate, endDate, hoveredDate, selectingEnd],
  );

  const isRangeStart = (date: Date) => startDate === toDateStr(date);
  const isRangeEnd = (date: Date) => {
    const effectiveEnd = selectingEnd && hoveredDate ? hoveredDate : endDate;
    return !!effectiveEnd && effectiveEnd === toDateStr(date);
  };

  const handleDayClick = (date: Date) => {
    if (isDisabled(date)) return;
    const dateStr = toDateStr(date);

    // Initial selection always starts with start date
    if (!startDate) {
      onStartDateChange(dateStr);
      setActiveBoundary("end");
      setSelectingEnd(true);
      return;
    }

    // When end date is not selected yet, continue selecting end date by default
    if (!endDate && activeBoundary === "end") {
      if (dateStr < startDate) {
        onStartDateChange(dateStr);
      } else {
        onEndDateChange(dateStr);
      }
      return;
    }

    // Explicit boundary movement behavior
    if (activeBoundary === "start") {
      onStartDateChange(dateStr);
      if (endDate && dateStr > endDate) {
        onEndDateChange(dateStr);
      }
    } else {
      onEndDateChange(dateStr);
      if (dateStr < startDate) {
        onStartDateChange(dateStr);
      }
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startPadding = firstDay.getDay(); // 0=Sun
  const totalCells = startPadding + lastDay.getDate();
  const rows = Math.ceil(totalCells / 7);

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPadding; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(new Date(viewYear, viewMonth, d));
  }
  while (cells.length < rows * 7) cells.push(null);

  return (
    <div className="space-y-4">
      {/* Calendar Card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Month Navigation */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-600"
          >
            <MdChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-sm">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            {loadingHolidays && (
              <span className="text-xs text-gray-400 animate-pulse">
                Loading holidays...
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-600"
          >
            <MdChevronRight size={20} />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className={`text-center text-xs font-bold py-2 ${
                day === "Sun"
                  ? "text-red-400"
                  : day === "Sat"
                    ? "text-orange-400"
                    : "text-gray-500"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {cells.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} className="h-10" />;
            }

            const dateStr = toDateStr(date);
            const holiday = getHolidayForDate(date);
            const disabled = isDisabled(date);
            const nonWorking = isNonWorkingDay(date);
            const halfDay = isSaturdayDay(date);
            const inRange = isInRange(date);
            const rangeStart = isRangeStart(date);
            const rangeEnd = isRangeEnd(date);
            const isToday = toDateStr(today) === dateStr;

            let cellClass =
              "relative h-10 flex items-center justify-center text-sm cursor-pointer transition-all select-none";

            // Range background
            if (inRange && !holiday) {
              cellClass += " bg-orange-50";
            }
            if (rangeStart || rangeEnd) {
              cellClass += " bg-korange";
            }

            // Day number styling
            let dayClass =
              "relative z-10 w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium transition-all";

            if (disabled) {
              dayClass += " text-gray-300 cursor-not-allowed";
              cellClass = cellClass.replace(
                "cursor-pointer",
                "cursor-not-allowed",
              );
            } else if (holiday && !isCalendarDays) {
              // Always show holidays as red circles
              dayClass += " bg-red-400 text-white font-bold shadow-sm";
            } else if (rangeStart || rangeEnd) {
              dayClass += " bg-korange text-white font-bold shadow-md";
            } else if (nonWorking && !isCalendarDays) {
              dayClass += " text-red-300";
            } else if (halfDay && !isCalendarDays) {
              dayClass += " text-orange-400";
            } else if (isToday) {
              dayClass += " text-korange font-bold ring-2 ring-korange/30";
            } else {
              dayClass +=
                " text-gray-700 hover:bg-orange-100 hover:text-korange";
            }

            return (
              <div
                key={dateStr}
                className={cellClass}
                onClick={() => handleDayClick(date)}
                onMouseEnter={() => {
                  if (selectingEnd && startDate) setHoveredDate(dateStr);
                }}
                onMouseLeave={() => setHoveredDate(null)}
                title={
                  holiday
                    ? `🎌 ${holiday.name}`
                    : nonWorking
                      ? "Non-working day (Sunday)"
                      : halfDay
                        ? "Half-day (Saturday)"
                        : undefined
                }
              >
                <span className={dayClass}>{date.getDate()}</span>
                {/* Holiday dot indicator */}
                {holiday && !disabled && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400" />
                )}
                {/* Half-day dot */}
                {halfDay && !isCalendarDays && !holiday && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-300" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Range Display */}
      <div className="grid grid-cols-2 gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveBoundary("start")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveBoundary("start");
            }
          }}
          className={`p-3 rounded-lg border text-sm ${
            error?.start
              ? "border-red-400 bg-red-50"
              : startDate
                ? "border-korange/40 bg-orange-50"
                : "border-gray-200 bg-gray-50"
          } ${activeBoundary === "start" ? "ring-2 ring-korange/30" : ""}`}
        >
          <p className="text-xs font-semibold text-gray-500 mb-0.5">
            Start Date
          </p>
          <p
            className={`font-bold ${startDate ? "text-gray-900" : "text-gray-400"}`}
          >
            {startDate ? formatDate(parseLocalDate(startDate)) : "Not selected"}
          </p>
          {error?.start && (
            <p className="text-red-500 text-xs mt-1">{error.start}</p>
          )}
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveBoundary("end")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveBoundary("end");
            }
          }}
          className={`p-3 rounded-lg border text-sm ${
            error?.end
              ? "border-red-400 bg-red-50"
              : endDate
                ? "border-korange/40 bg-orange-50"
                : "border-gray-200 bg-gray-50"
          } ${activeBoundary === "end" ? "ring-2 ring-korange/30" : ""}`}
        >
          <p className="text-xs font-semibold text-gray-500 mb-0.5">End Date</p>
          <p
            className={`font-bold ${endDate ? "text-gray-900" : "text-gray-400"}`}
          >
            {endDate
              ? formatDate(parseLocalDate(endDate))
              : selectingEnd
                ? "Click to select..."
                : "Not selected"}
          </p>
          {error?.end && (
            <p className="text-red-500 text-xs mt-1">{error.end}</p>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 -mt-1">
        Tip: Click Start Date or End Date above to choose which boundary you
        want to move, then pick a day.
      </p>

      {/* Half-Day Toggles */}
      {!isCalendarDays && startDate && (
        <div className="flex flex-col gap-2 p-3 rounded-xl border border-orange-200 bg-orange-50 mt-3 text-sm">
          {/* Start Date Half-Day Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-semibold text-gray-800">
                Start Date (Half-Day)
              </p>
              <p className="text-xs text-gray-500">
                Apply start date as 0.5 days
              </p>
            </div>
            {onStartHalfDayToggle && (
              <button
                type="button"
                onClick={() => onStartHalfDayToggle(!isStartHalfDay)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  isStartHalfDay ? "bg-korange" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    isStartHalfDay ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            )}
          </div>

          {/* End Date Half-Day Toggle (Only show if End Date is selected and not the same as Start Date) */}
          {endDate && startDate !== endDate && (
            <div className="flex items-center justify-between pt-2 border-t border-orange-200/50">
              <div className="flex-1">
                <p className="font-semibold text-gray-800">
                  End Date (Half-Day)
                </p>
                <p className="text-xs text-gray-500">
                  Apply end date as 0.5 days
                </p>
              </div>
              {onEndHalfDayToggle && (
                <button
                  type="button"
                  onClick={() => onEndHalfDayToggle(!isEndHalfDay)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    isEndHalfDay ? "bg-korange" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      isEndHalfDay ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-korange inline-block" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-orange-100 border border-orange-200 inline-block" />
          <span>Range</span>
        </div>
        {!isCalendarDays && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
              <span>Public Holiday (skipped)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-orange-300 inline-block" />
              <span>Saturday (half-day)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />
              <span>Sunday (non-working)</span>
            </div>
          </>
        )}
      </div>

      {/* Holiday List for current month */}
      {!isCalendarDays &&
        holidays.length > 0 &&
        (() => {
          const monthHolidays = holidays.filter((h) => {
            const hDate = new Date(h.holiday_date);
            return hDate.getMonth() === viewMonth;
          });
          if (monthHolidays.length === 0) return null;
          return (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-xs font-bold text-red-600 mb-1.5 uppercase tracking-wide">
                🎌 Holidays this month
              </p>
              <div className="space-y-1">
                {monthHolidays.map((h) => {
                  const hDate = new Date(h.holiday_date);
                  return (
                    <div
                      key={h.id}
                      className="flex items-center gap-2 text-xs text-red-700"
                    >
                      <span className="font-semibold w-6 text-center">
                        {hDate.getDate()}
                      </span>
                      <span>{h.name}</span>
                      {h.is_recurring && (
                        <span className="text-red-400 text-[10px]">
                          (recurring)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
    </div>
  );
};

export default LeaveDatePicker;
