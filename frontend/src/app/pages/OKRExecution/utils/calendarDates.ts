const DAY_OFFSETS: Record<string, number> = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6,
};

const pad = (value: number) => String(value).padStart(2, "0");

export const parseLocalDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parts = value.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  const [year, month, day] = parts;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

export const formatDateInput = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const formatReadableDate = (value?: string | null): string => {
  const date = parseLocalDate(value);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const getAutoCycleEndDate = (startDate: string): string => {
  const start = parseLocalDate(startDate);
  if (!start) return "";
  const end = new Date(start);
  end.setDate(end.getDate() + 90);
  return formatDateInput(end);
};

export const getCycleWeekRange = (
  cycleStartDate: string,
  weekNumber: number,
) => {
  const start = parseLocalDate(cycleStartDate);
  if (!start) return null;

  // Align to the Monday of the week containing cycleStartDate
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const mondayOfFirstWeek = new Date(start);
  mondayOfFirstWeek.setDate(start.getDate() + diffToMonday);

  const rangeStart = new Date(mondayOfFirstWeek);
  rangeStart.setDate(rangeStart.getDate() + (Math.max(1, weekNumber) - 1) * 7);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + 6);
  return { start: rangeStart, end: rangeEnd };
};

export const getPlannedDailyDate = (
  cycleStartDate: string,
  weekNumber: number,
  completionDay: string,
) => {
  const start = parseLocalDate(cycleStartDate);
  if (!start) return null;

  // Align to the Monday of the week containing cycleStartDate
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const mondayOfFirstWeek = new Date(start);
  mondayOfFirstWeek.setDate(start.getDate() + diffToMonday);

  const rangeStart = new Date(mondayOfFirstWeek);
  rangeStart.setDate(rangeStart.getDate() + (Math.max(1, weekNumber) - 1) * 7);
  const offset = DAY_OFFSETS[completionDay] ?? 0;
  const planned = new Date(rangeStart);
  planned.setDate(planned.getDate() + offset);
  return planned;
};

/**
 * Returns which month-slot (1, 2, or 3) within a 3-month cycle the given
 * date falls into, based on the cycle's start date.
 * Returns null if the date is before the cycle start or after cycle end.
 */
export const getCurrentCycleMonth = (
  cycleStartDate: string,
  cycleEndDate: string,
  today: Date = new Date(),
): 1 | 2 | 3 | null => {
  const start = parseLocalDate(cycleStartDate);
  const end = parseLocalDate(cycleEndDate);
  if (!start || !end) return null;

  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12,
    0,
    0,
    0,
  );
  if (todayMidnight < start || todayMidnight > end) return null;

  // Compute the total duration and split into 3 equal months
  const totalMs = end.getTime() - start.getTime();
  const monthMs = totalMs / 3;
  const elapsed = todayMidnight.getTime() - start.getTime();

  if (elapsed < monthMs) return 1;
  if (elapsed < monthMs * 2) return 2;
  return 3;
};

/**
 * Returns which week-slot (1–5) within the cycle the given date falls into,
 * using the Monday-aligned week grid from getCycleWeekRange.
 * Returns null if the date is outside the cycle.
 */
export const getCurrentCycleWeek = (
  cycleStartDate: string,
  cycleEndDate: string,
  today: Date = new Date(),
): number | null => {
  const start = parseLocalDate(cycleStartDate);
  const end = parseLocalDate(cycleEndDate);
  if (!start || !end) return null;

  // Align to Monday of the week containing the cycle start
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const mondayOfFirstWeek = new Date(start);
  mondayOfFirstWeek.setDate(start.getDate() + diffToMonday);

  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12,
    0,
    0,
    0,
  );

  if (todayMidnight > end) return null;
  if (todayMidnight < start) return null;

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const elapsed = todayMidnight.getTime() - mondayOfFirstWeek.getTime();
  const weekSlot = Math.floor(elapsed / msPerWeek) + 1;
  return Math.max(1, Math.min(5, weekSlot));
};

/**
 * Determines availability state of a period (month or week slot).
 *   "current"  → fully interactive
 *   "past"     → read-only
 *   "future"   → greyed-out / hidden
 *   "no-cycle" → cycle dates unavailable; treat everything as accessible
 */
export type PeriodAvailability = "current" | "past" | "future" | "no-cycle";

export const getMonthAvailability = (
  monthNumber: 1 | 2 | 3,
  cycleStartDate?: string | null,
  cycleEndDate?: string | null,
): PeriodAvailability => {
  if (!cycleStartDate || !cycleEndDate) return "no-cycle";
  const currentMonth = getCurrentCycleMonth(cycleStartDate, cycleEndDate);
  if (currentMonth === null) return "no-cycle";
  if (monthNumber === currentMonth) return "current";
  if (monthNumber < currentMonth) return "past";
  return "future";
};

export const getWeekAvailability = (
  weekNumber: number,
  cycleStartDate?: string | null,
  cycleEndDate?: string | null,
): PeriodAvailability => {
  if (!cycleStartDate || !cycleEndDate) return "no-cycle";
  const currentWeek = getCurrentCycleWeek(cycleStartDate, cycleEndDate);
  if (currentWeek === null) return "no-cycle";
  if (weekNumber === currentWeek) return "current";
  if (weekNumber < currentWeek) return "past";
  return "future";
};

/**
 * Returns the start/end Date for a given month slot (1, 2 or 3) within a cycle.
 * The cycle is divided into 3 equal thirds.
 */
export const getCycleMonthRange = (
  cycleStartDate: string,
  cycleEndDate: string,
  monthNumber: 1 | 2 | 3,
): { start: Date; end: Date } | null => {
  const start = parseLocalDate(cycleStartDate);
  const end = parseLocalDate(cycleEndDate);
  if (!start || !end) return null;
  const totalMs = end.getTime() - start.getTime();
  const slotMs = totalMs / 3;
  const slotStart = new Date(start.getTime() + slotMs * (monthNumber - 1));
  const slotEnd =
    monthNumber === 3
      ? end
      : new Date(start.getTime() + slotMs * monthNumber - 1);
  return { start: slotStart, end: slotEnd };
};

export const formatConciseDateRange = (
  startStr?: string | null,
  endStr?: string | null,
): string => {
  const start = parseLocalDate(startStr);
  const end = parseLocalDate(endStr);
  if (!start || !end) return "—";

  const optionsShort: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const optionsLong: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString(undefined, optionsShort)} — ${end.toLocaleDateString(undefined, optionsLong)}`;
  }

  return `${start.toLocaleDateString(undefined, optionsLong)} — ${end.toLocaleDateString(undefined, optionsLong)}`;
};
