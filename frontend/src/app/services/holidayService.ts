import API from "../API";
import apiRoutes from "../API/apiRoutes";

export interface PublicHoliday {
  id: number;
  name: string;
  holiday_date: string;
  is_recurring: boolean;
}

export interface HolidaysResponse {
  year: number;
  holidays: PublicHoliday[];
}

/**
 * Fetch public holidays for a given year
 */
export const getPublicHolidays = async (year: number): Promise<PublicHoliday[]> => {
  try {
    const response = await API({
      route: `${apiRoutes.publicHolidays}?year=${year}`,
      method: "GET",
      isSecureRoute: true,
    });
    return response.data?.data?.holidays || [];
  } catch {
    return [];
  }
};

/**
 * Get all holidays needed for a date range (may span two years)
 */
export const getHolidaysForRange = async (
  startDate: Date,
  endDate: Date
): Promise<PublicHoliday[]> => {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  if (startYear === endYear) {
    return getPublicHolidays(startYear);
  }

  const [startHolidays, endHolidays] = await Promise.all([
    getPublicHolidays(startYear),
    getPublicHolidays(endYear),
  ]);

  return [...startHolidays, ...endHolidays];
};

/**
 * Check if a date is a public holiday
 */
export const isHoliday = (date: Date, holidays: PublicHoliday[]): PublicHoliday | undefined => {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return holidays.find((h) => {
    const hDate = new Date(h.holiday_date);
    const hStr = `${hDate.getFullYear()}-${String(hDate.getMonth() + 1).padStart(2, "0")}-${String(hDate.getDate()).padStart(2, "0")}`;
    return hStr === dateStr;
  });
};
