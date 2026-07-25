import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EmployeePaidLeave {
  employeeId: string;
  paidLeaveDays: number;
}

/**
 * Returns the total approved paid leave days each employee has used
 * within the given payroll period.
 *
 * Only counts:
 *  - LeaveApplications with current_status = 'APPROVED'
 *  - Whose LeaveType has is_paid = true
 *  - Whose leave period overlaps with [startDate, endDate]
 *
 * Overlap condition:
 *   leave starts before period ends AND leave ends after period starts
 *
 * @param companyId  Your company ID
 * @param startDate  Payroll period start — e.g. "2026-03-26"
 * @param endDate    Payroll period end   — e.g. "2026-04-25"
 */
export async function getPaidLeaveDaysPerEmployee(
  companyId: number,
  startDate: string,
  endDate: string,
): Promise<Map<string, number>> {
  

  const start = new Date(startDate);
  const end   = new Date(endDate);

  const applications = await prisma.leaveApplication.findMany({
    where: {
      company_id:     companyId,
      current_status: 'APPROVED',
      leaveType: {
        is_paid: true,
      },
      // Overlap: leave starts before period ends AND leave ends after period starts
      start_date: { lte: end },
      end_date:   { gte: start },
    },
    select: {
      employee_id:    true,
      requested_days: true,
      start_date:     true,
      end_date:       true,
    },
  });

  // Aggregate total paid leave days per employee
  const result = new Map<string, number>();

  for (const app of applications) {
    const existing = result.get(app.employee_id) ?? 0;

    // requested_days is a Decimal — convert to number
    result.set(app.employee_id, existing + Number(app.requested_days));
  }

  return result;
}