
import { calculateExpiryDate } from "../../utils/leaveUtils";

describe("Leave Expiry Logic", () => {
  const fiscalYear = 2024;
  const expiryMonths = 6;
  const fiscalYearStartMonth = 1; // January
  
  // Fiscal Year 2024 (Jan 1, 2024 - Dec 31, 2024)
  // Expiry should be 6 months after end of FY 2024 -> June 30, 2025 (or around that)
  // Logic: Dec 31, 2024 + 6 months -> June 30, 2025?
  // Let's check implementation behavior: 
  // FY End = Jan 1, 2025 (start of next FY)
  // Expiry = Jan 1, 2025 + 6 months = July 1, 2025.
  
  test("CALENDAR_YEAR basis calculates expiry from fiscal year end", () => {
    const expiryDate = calculateExpiryDate(
      fiscalYear,
      expiryMonths,
      fiscalYearStartMonth,
      "CALENDAR_YEAR"
    );
    
    // FY 2024: Ends Dec 31, 2024.
    // Logic uses start of NEXT fiscal year as anchor: Jan 1, 2025.
    // + 6 months = July 1, 2025.
    
    expect(expiryDate.getFullYear()).toBe(2025);
    expect(expiryDate.getMonth()).toBe(6); // July (0-indexed 6 is July)
    expect(expiryDate.getDate()).toBe(1);
  });

  test("ANNIVERSARY basis calculates expiry from anniversary year end", () => {
    const joinDate = new Date("2022-04-15");
    // "Fiscal Year" 2024 in Anniversary terms means the period starting in 2024.
    // Period: April 15, 2024 - April 14, 2025.
    // End Date anchor: April 15, 2025.
    // Expiry: + 6 months from April 15, 2025.
    // April + 6 = October.
    // Expected: Oct 15, 2025.

    const expiryDate = calculateExpiryDate(
      fiscalYear,
      expiryMonths,
      fiscalYearStartMonth,
      "ANNIVERSARY",
      joinDate
    );

    expect(expiryDate.getFullYear()).toBe(2025);
    expect(expiryDate.getMonth()).toBe(9); // October (0-indexed 9)
    expect(expiryDate.getDate()).toBe(15);
  });
  
  test("ANNIVERSARY basis without join date falls back to CALENDAR_YEAR", () => {
     const expiryDate = calculateExpiryDate(
      fiscalYear,
      expiryMonths,
      fiscalYearStartMonth,
      "ANNIVERSARY",
      null
    );
    
    // Same as CALENDAR_YEAR test
    expect(expiryDate.getFullYear()).toBe(2025);
    expect(expiryDate.getMonth()).toBe(6); // July
    expect(expiryDate.getDate()).toBe(1);
  });
});
