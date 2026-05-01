
import { testPrisma } from "./setup";
import { EmployeeFactory } from "./utils/factories";
import { LeaveTypeFactory } from "./utils/factories";
import { LeaveBalanceFactory } from "./utils/factories";
import { recalculateLeaveBalancesForEmployee } from "../utils/leaveUtils";

describe("Fixed Leave Zero Balance Reproduction", () => {
  let companyId: number;
  let employeeId: string;
  let sickLeaveType: any;

  beforeAll(async () => {
    // 1. Setup Company and Employee
    const company = await testPrisma.company.create({
      data: { 
        name: "Test Company Fixed Leave",
        company_code: `TFL_${Date.now()}` 
      },
    });
    companyId = company.id;

    const empResult = await EmployeeFactory.create(companyId);
    employeeId = empResult.employee.id;

    // 2. Setup Fixed Leave Type (e.g., Sick Leave, 30 days)
    sickLeaveType = await testPrisma.leaveType.create({
      data: {
        company_id: companyId,
        name: "Sick Leave Repro",
        code: "SICK_REPRO",
        is_accrual_based: false,
        default_allowance_days: 30,
        applicable_gender: "All",
        is_paid: true,
      }
    });
  });

  /*
  afterAll(async () => {
     // Cleanup handled by setup.ts usually, but explicit cleanup if needed
  });
  */

  it("should NOT reset fixed leave balance to 0 on recalculation", async () => {
    // 3. Create initial balance (e.g. 30 days)
    const initialBalance = await LeaveBalanceFactory.create(
      employeeId,
      companyId,
      sickLeaveType.id,
      {
        totalEntitlement: 30,
        usedDays: 0,
      }
    );

    expect(Number(initialBalance.total_entitlement)).toBe(30);

    // 4. Trigger Recalculation
    await recalculateLeaveBalancesForEmployee(employeeId, companyId, testPrisma);

    // 5. Verify Balance
    const updatedBalance = await testPrisma.leaveBalance.findUnique({
      where: { id: initialBalance.id },
    });

    console.log(`Old Entitlement: ${initialBalance.total_entitlement}, New Entitlement: ${updatedBalance?.total_entitlement}`);

    // Expectation: Should remain 30 (or re-set to 30).
    // Failing condition: It becomes 0.
    expect(Number(updatedBalance?.total_entitlement)).toBe(30);
  });
});
