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
