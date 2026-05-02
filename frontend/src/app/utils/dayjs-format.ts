import dayjs from "dayjs";

export const DATE_FORMAT = "MMMM DD, YYYY";
export const TIMESTAMP_FORMAT = "MMMM DD, YYYY hh:mm A";
export const ISO_DATE_FORMAT = "YYYY-MM-DD";

type DayjsInput = string | number | Date | null | undefined;

export const isValidDateValue = (value: DayjsInput): boolean => {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  return dayjs(value).isValid();
};

export const formatWithPattern = (
  value: DayjsInput,
  pattern: string,
  fallback = "-",
): string => {
  if (!isValidDateValue(value)) {
    return fallback;
  }

  return dayjs(value).format(pattern);
};

export const formatDate = (value: DayjsInput, fallback = "-"): string =>
  formatWithPattern(value, DATE_FORMAT, fallback);

export const formatTimestamp = (value: DayjsInput, fallback = "-"): string =>
  formatWithPattern(value, TIMESTAMP_FORMAT, fallback);

export const formatIsoDate = (value: DayjsInput, fallback = ""): string =>
  formatWithPattern(value, ISO_DATE_FORMAT, fallback);
