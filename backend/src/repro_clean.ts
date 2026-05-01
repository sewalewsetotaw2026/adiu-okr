
// Mock/Copy utilities to avoid import issues

const getJoinDateAnniversaryForYear = (joinDate: Date, year: number): Date => {
  const month = joinDate.getMonth();
  const day = joinDate.getDate();

  // Handles dates like Feb 29 in non-leap years by snapping to last day of month.
  const candidate = new Date(year, month, day);
  if (candidate.getMonth() !== month) {
    return new Date(year, month + 1, 0);
  }
  return candidate;
};

const getAnniversaryYearStartDate = (
  joinDate: Date,
  referenceDate: Date = new Date()
): Date => {
  const thisYearAnniversary = getJoinDateAnniversaryForYear(
    joinDate,
    referenceDate.getFullYear()
  );

  if (referenceDate < thisYearAnniversary) {
    return getJoinDateAnniversaryForYear(
      joinDate,
      referenceDate.getFullYear() - 1
    );
  }

  return thisYearAnniversary;
};

const getFiscalYearStartDate = (
  fiscalYearStartMonth: number,
  referenceDate: Date = new Date()
): Date => {
  const currentMonth = referenceDate.getMonth() + 1;
  const currentYear = referenceDate.getFullYear();

  if (currentMonth < fiscalYearStartMonth) {
    return new Date(currentYear - 1, fiscalYearStartMonth - 1, 1);
  }
  return new Date(currentYear, fiscalYearStartMonth - 1, 1);
};

const calculatePreciseYearsOfService = (
  hireDate: Date,
  referenceDate: Date = new Date()
): number => {
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  const diffMs = referenceDate.getTime() - hireDate.getTime();
  return Math.max(0, diffMs / msPerYear);
};

const calculateTenureEntitlement = (
  baseDays: number,
  yearsOfService: number,
  incrementPeriodYears: number,
  incrementAmount: number,
  maxCap?: number | null
): { entitlement: number; bonusDays: number } => {
  if (incrementPeriodYears <= 0) return { entitlement: baseDays, bonusDays: 0 };

  const bonusPeriods = Math.floor(yearsOfService / incrementPeriodYears);
  const bonusDays = bonusPeriods * incrementAmount;
  let totalEntitlement = baseDays + bonusDays;

  if (maxCap && totalEntitlement > maxCap) {
    totalEntitlement = maxCap;
  }

  return { entitlement: totalEntitlement, bonusDays };
};

const calculateAccruedBalance = (
  joinDate: Date,
  referenceDate: Date,
  baseDays: number,
  divisor: number = 365,
  fiscalYearStartMonth: number = 1,
  incrementPeriodYears: number = 2,
  incrementAmount: number = 1,
  maxCap: number | null = null,
  accrualBasis: "ANNIVERSARY" | "CALENDAR_YEAR" = "ANNIVERSARY"
) => {
  const fiscalYearStart =
    accrualBasis === "ANNIVERSARY"
      ? getAnniversaryYearStartDate(joinDate, referenceDate)
      : getFiscalYearStartDate(fiscalYearStartMonth, referenceDate);

  // Determine when accrual *actually* starts for this period
  // If employee joined AFTER the fiscal year start, accrual starts on join date
  const accrualStartDate =
    joinDate > fiscalYearStart ? joinDate : fiscalYearStart;

  // IMPORTANT: If reference date is BEFORE accrual start (possible in edge cases), return 0
  if (referenceDate < accrualStartDate) {
    console.log('Early return: referenceDate < accrualStartDate');
    console.log('Ref:', referenceDate.toISOString());
    console.log('Start:', accrualStartDate.toISOString());
    return {
      accruedDays: 0,
      daysInFiscalYear: 0,
      dailyRate: 0,
      fiscalYearStart,
      annualEntitlement: baseDays,
      tenureBonusDays: 0,
    };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  
  // Completed days (Elapsed Time)
  const daysInFiscalYear =
    Math.floor(
      (referenceDate.getTime() - accrualStartDate.getTime()) / msPerDay
    ); 

  // Calculate annual entitlement based on tenure
  const yearsOfService = calculatePreciseYearsOfService(joinDate, referenceDate);
  
  const { entitlement: annualEntitlement, bonusDays: tenureBonusDays } =
    calculateTenureEntitlement(
      baseDays,
      yearsOfService,
      incrementPeriodYears,
      incrementAmount,
      maxCap
    );

  const dailyRate = annualEntitlement / divisor;
  
  // Core Accrual Calculation
  const rawAccruedDays = dailyRate * daysInFiscalYear;

  // Cap at annual entitlement
  const accruedDays = Math.min(rawAccruedDays, annualEntitlement);

  return {
    accruedDays: Number(accruedDays.toFixed(4)),
    daysInFiscalYear,
    dailyRate: Number(dailyRate.toFixed(4)),
    fiscalYearStart,
    annualEntitlement,
    tenureBonusDays,
  };
};

// --- Execute ---

const joinDate = new Date('2024-06-01T00:00:00.000Z');
const today = new Date('2026-01-30T10:00:00.000Z');

console.log('--- Inputs ---');
console.log('Join Date:', joinDate.toISOString());
console.log('Today:', today.toISOString());
console.log('Basis:', 'ANNIVERSARY');

console.log('\n--- Debugging getAnniversaryYearStartDate ---');
const annivStart = getAnniversaryYearStartDate(joinDate, today);
console.log('Anniversary Start Date:', annivStart.toISOString());

console.log('\n--- Calculating Accrued Balance ---');
const result = calculateAccruedBalance(
    joinDate,
    today,
    16, // baseDays
    365, // divisor
    1, // fiscalStartMonth (irrelevant for Anniversary)
    2, // incrementPeriod
    1, // incrementAmount
    null, // maxCap
    "ANNIVERSARY"
);

console.log('Result:', JSON.stringify(result, null, 2));
