import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMPANY_ID = 2;
const FISCAL_YEAR = 2026; // Current fiscal year (as of Feb 2026)

// Parsed from "Kacha Staff Leave data for HRMS.pdf" - Page 1 (Current Employees)
// Fields: name, totalEntitlement, usedDays, remainingDays
const leaveData = [
  { name: "Abreham Tilahun Abera", totalEntitlement: 64.38, usedDays: 3.0, remainingDays: 61.38 },
  { name: "Mikiyas Fikadu Assefa", totalEntitlement: 62.09, usedDays: 5.5, remainingDays: 56.59 },
  { name: "Zemicheal Fsaha Werkneh", totalEntitlement: 61.15, usedDays: 0.0, remainingDays: 61.15 },
  { name: "Lydia Gabo Sheko", totalEntitlement: 52.41, usedDays: 14.0, remainingDays: 38.41 },
  { name: "Kassahun Tilahun Tekelle", totalEntitlement: 51.31, usedDays: 26.5, remainingDays: 24.81 },
  { name: "Sisay Lucas Teka", totalEntitlement: 51.0, usedDays: 10.0, remainingDays: 41.0 },
  { name: "Addisu Aynayehu Admas", totalEntitlement: 50.11, usedDays: 4.0, remainingDays: 46.11 },
  { name: "Tumezgi Kesete W/Giorgis", totalEntitlement: 48.48, usedDays: 24.5, remainingDays: 23.98 },
  { name: "Shalom Wondowosen", totalEntitlement: 44.0, usedDays: 19.5, remainingDays: 24.5 },
  { name: "Abdisa Birhanu Benti", totalEntitlement: 39.61, usedDays: 0.5, remainingDays: 39.11 },
  { name: "Tilahun Tolosa Begi", totalEntitlement: 38.87, usedDays: 5.5, remainingDays: 33.37 },
  { name: "Haben Eyasu Akelom", totalEntitlement: 35.71, usedDays: 16.0, remainingDays: 19.71 },
  { name: "Foziya Redi Chali", totalEntitlement: 35.47, usedDays: 14.0, remainingDays: 21.47 },
  { name: "Birhanu Bogale Muluneh", totalEntitlement: 29.32, usedDays: 14.0, remainingDays: 15.32 },
  { name: "Nahom Abera Beyene", totalEntitlement: 26.11, usedDays: 11.0, remainingDays: 15.11 },
  { name: "Henok Girma Eshetu", totalEntitlement: 26.06, usedDays: 12.0, remainingDays: 14.06 },
  { name: "Tesfaye Girma Demise", totalEntitlement: 23.68, usedDays: 21.0, remainingDays: 2.68 },
  { name: "Melat Mamo Wendimu", totalEntitlement: 19.45, usedDays: 7.0, remainingDays: 12.45 },
  { name: "Rumiya Mohammed Sheko", totalEntitlement: 21.64, usedDays: 6.5, remainingDays: 15.14 },
  { name: "Tadesse Alamir Chekol", totalEntitlement: 22.29, usedDays: 8.0, remainingDays: 14.29 },
  { name: "Amanuel Habtamu Abebe", totalEntitlement: 22.8, usedDays: 2.0, remainingDays: 20.8 },
  { name: "Tiringo zerihun Tameru", totalEntitlement: 12.36, usedDays: 13.0, remainingDays: -0.64 },
  { name: "Nathnael Abera Tessema", totalEntitlement: 12.36, usedDays: 4.5, remainingDays: 7.86 },
  { name: "Michael Girma Kassaye", totalEntitlement: 11.79, usedDays: 5.0, remainingDays: 6.79 },
  { name: "Tinsae Beyene Debele", totalEntitlement: 11.79, usedDays: 1.0, remainingDays: 10.79 },
  { name: "Gashaw Demlew Ayalew", totalEntitlement: 10.26, usedDays: 8.0, remainingDays: 2.26 },
  { name: "Saron Solomon Regassa", totalEntitlement: 12.36, usedDays: 2.0, remainingDays: 10.36 },
  { name: "Surafel Abdulmejid Hussen", totalEntitlement: 28.06, usedDays: 0.0, remainingDays: 28.06 },
  { name: "Temesgen Debebe Getahun", totalEntitlement: 9.29, usedDays: 0.0, remainingDays: 9.29 },
  { name: "Haftom Tekleweyni Hadgu", totalEntitlement: 7.8, usedDays: 0.0, remainingDays: 7.8 },
  { name: "Daniel Demelash Mengistu", totalEntitlement: 7.8, usedDays: 0.0, remainingDays: 7.8 },
  { name: "Genet Tesfaye Melese", totalEntitlement: 7.76, usedDays: 0.0, remainingDays: 7.76 },
  { name: "Tinsae Dagne Debela", totalEntitlement: 7.98, usedDays: 0.5, remainingDays: 7.48 },
  { name: "Feben Shiferaw Gelaw", totalEntitlement: 5.3, usedDays: 1.0, remainingDays: 4.3 },
  { name: "Kalkidan Dessalegn Bezabih", totalEntitlement: 4.08, usedDays: 1.0, remainingDays: 3.08 },
  { name: "Binyam Kefela Gebremichael", totalEntitlement: 3.95, usedDays: 0.0, remainingDays: 3.95 },
  { name: "Chala Aliyi Mumed", totalEntitlement: 3.68, usedDays: 0.0, remainingDays: 3.68 },
  { name: "Tinsae Hailu Gisha", totalEntitlement: 3.64, usedDays: 0.0, remainingDays: 3.64 },
  { name: "Yordanos Alemayew Teklu", totalEntitlement: 2.89, usedDays: 0.0, remainingDays: 2.89 },
  { name: "Tigist Hailu Wolde", totalEntitlement: 2.41, usedDays: 0.5, remainingDays: 1.91 },
  { name: "Milky Daru Mekonnen", totalEntitlement: 3.2, usedDays: 2.5, remainingDays: 0.7 },
  { name: "Rafael Yenew Getahun", totalEntitlement: 3.2, usedDays: 0.5, remainingDays: 2.7 },
  { name: "Sada Besher Belay", totalEntitlement: 1.97, usedDays: 0.0, remainingDays: 1.97 },
  { name: "Eyob Birihane Abraha", totalEntitlement: 1.84, usedDays: 0.0, remainingDays: 1.84 },
  { name: "Amanuel Tito Gebregeorgis", totalEntitlement: 1.67, usedDays: 0.0, remainingDays: 1.67 },
  { name: "Tsegay Berhanu Teka", totalEntitlement: 1.67, usedDays: 0.0, remainingDays: 1.67 },
  { name: "Assegid Assefa Kebede", totalEntitlement: 0.13, usedDays: 0.0, remainingDays: 0.13 },
];

const resignedLeaveData = [
  { name: "Sintayehu Nigussie Dugo", totalEntitlement: 25.87, usedDays: 0.0, remainingDays: 25.87 },
  { name: "Seid Abdullahi Ahmed", totalEntitlement: 25.83, usedDays: 0.0, remainingDays: 25.83 },
  { name: "Getachew Derib Getie", totalEntitlement: 33.39, usedDays: 0.0, remainingDays: 33.39 },
  { name: "Bekam Kumsa Faji", totalEntitlement: 30.72, usedDays: 0.0, remainingDays: 30.72 },
  { name: "Henok Ayele Iticha", totalEntitlement: 55.74, usedDays: 11.0, remainingDays: 44.74 },
  { name: "Gizework Melese Birru", totalEntitlement: 55.37, usedDays: 17.0, remainingDays: 38.37 },
  { name: "Betelehem Shebru Belete", totalEntitlement: 52.25, usedDays: 13.5, remainingDays: 38.75 },
  { name: "Yewoinshet Elias Baboro", totalEntitlement: 45.77, usedDays: 17.0, remainingDays: 28.77 },
  { name: "Abay Gebeyaw Bnalfew", totalEntitlement: 41.88, usedDays: 4.0, remainingDays: 37.88 },
  { name: "Nejat Ahmed Wolle", totalEntitlement: 41.63, usedDays: 9.5, remainingDays: 32.13 },
  { name: "Arefat Mohammed Yesuf", totalEntitlement: 41.33, usedDays: 6.5, remainingDays: 34.83 },
  { name: "Kaleb Takele Degefa", totalEntitlement: 36.11, usedDays: 3.0, remainingDays: 33.11 },
  { name: "Eden Gezahegne Tadesse", totalEntitlement: 29.79, usedDays: 0.0, remainingDays: 29.79 },
  { name: "Yafat Abera Mamo", totalEntitlement: 59.22, usedDays: 12.0, remainingDays: 47.22 },
  { name: "Tsegaye Tamiru Zergaw", totalEntitlement: 37.73, usedDays: 20.5, remainingDays: 17.23 },
  { name: "Tadiyos Siyoum", totalEntitlement: 8.07, usedDays: 0.0, remainingDays: 8.07 },
  { name: "Asrat Adane", totalEntitlement: 7.8, usedDays: 0.0, remainingDays: 7.8 },
  { name: "Samrawit Debebe", totalEntitlement: 10.08, usedDays: 2.0, remainingDays: 8.08 },
  { name: "Gemechis Kebeba", totalEntitlement: 23.5, usedDays: 12.0, remainingDays: 11.5 },
  { name: "Dawit Solomon", totalEntitlement: 13.85, usedDays: 0.0, remainingDays: 13.85 },
  { name: "Ermias Solomon", totalEntitlement: 7.41, usedDays: 2.0, remainingDays: 5.41 },
  { name: "Addis Tsega Aragie", totalEntitlement: 35.56, usedDays: 3.0, remainingDays: 32.56 },
  { name: "Sizana Tesfaye Taye", totalEntitlement: 52.46, usedDays: 47.5, remainingDays: 4.96 },
];

async function main() {
  console.log('=== Seeding Leave Balance Data ===');
  console.log(`Company ID: ${COMPANY_ID}`);
  console.log(`Fiscal Year: ${FISCAL_YEAR}`);

  // ========================================
  // PHASE 0: Ensure leave types & settings exist for Company 1
  // ========================================
  console.log('\n--- Phase 0: Bootstrapping Leave Types & Settings ---');

  const leaveTypeDefs = [
    { code: 'ANNUAL', name: 'Annual Leave', default_allowance_days: 16, is_paid: true, requires_attachment: false, applicable_gender: 'All', is_carry_over_allowed: true, carry_over_expiry_months: 100, incremental_days_per_year: 1 },
    { code: 'MARRIAGE', name: 'Marriage Leave', default_allowance_days: 5, is_paid: true, requires_attachment: true, applicable_gender: 'All', is_carry_over_allowed: false, carry_over_expiry_months: null, incremental_days_per_year: 0 },
    { code: 'MATERNITY_PRE', name: 'Maternity Leave (Pre-natal)', default_allowance_days: 30, is_paid: true, requires_attachment: true, applicable_gender: 'Female', is_carry_over_allowed: false, carry_over_expiry_months: null, incremental_days_per_year: 0 },
    { code: 'MATERNITY_POST', name: 'Maternity Leave (Post-natal)', default_allowance_days: 90, is_paid: true, requires_attachment: true, applicable_gender: 'Female', is_carry_over_allowed: false, carry_over_expiry_months: null, incremental_days_per_year: 0 },
    { code: 'PATERNITY', name: 'Paternity Leave', default_allowance_days: 5, is_paid: true, requires_attachment: true, applicable_gender: 'Male', is_carry_over_allowed: false, carry_over_expiry_months: null, incremental_days_per_year: 0 },
    { code: 'MOURNING', name: 'Mourning/Bereavement Leave', default_allowance_days: 5, is_paid: true, requires_attachment: false, applicable_gender: 'All', is_carry_over_allowed: false, carry_over_expiry_months: null, incremental_days_per_year: 0 },
    { code: 'SICK', name: 'Sick Leave', default_allowance_days: 180, is_paid: true, requires_attachment: true, applicable_gender: 'All', is_carry_over_allowed: false, carry_over_expiry_months: null, incremental_days_per_year: 0 },
    { code: 'UNPAID', name: 'Unpaid Leave', default_allowance_days: 5, is_paid: false, requires_attachment: false, applicable_gender: 'All', is_carry_over_allowed: false, carry_over_expiry_months: null, incremental_days_per_year: 0 },
    { code: 'MATERNITY', name: 'Maternity Leave', default_allowance_days: 120, is_paid: true, requires_attachment: false, applicable_gender: 'Female', is_carry_over_allowed: false, carry_over_expiry_months: null, incremental_days_per_year: 0 },
  ];

  for (const lt of leaveTypeDefs) {
    const existing = await prisma.leaveType.findFirst({
      where: { company_id: COMPANY_ID, code: lt.code }
    });
    if (!existing) {
      await prisma.leaveType.create({
        data: { company_id: COMPANY_ID, ...lt }
      });
      console.log(`  Created leave type: ${lt.name}`);
    }
  }

  // Ensure LeaveSettings exist for Company 1
  const existingSettings = await prisma.leaveSettings.findUnique({
    where: { company_id: COMPANY_ID }
  });
  if (!existingSettings) {
    await prisma.leaveSettings.create({
      data: {
        company_id: COMPANY_ID,
        annual_leave_base_days: 16,
        accrual_basis: 'CALENDAR_YEAR',
        accrual_frequency: 'DAILY',
        accrual_divisor: 365,
        increment_period_years: 2,
        increment_amount: 1,
        enable_leave_expiry: true,
        expiry_notification_days: 60,
        balance_notification_enabled: true,
        notification_channels: 'EMAIL,IN_APP',
        enable_encashment: true,
        encashment_salary_divisor: 30,
        max_encashment_days: 100,
      }
    });
    console.log('  Created LeaveSettings for Company 1');
  }

  // Now find the Annual Leave type ID dynamically
  const annualLeaveType = await prisma.leaveType.findFirst({
    where: { company_id: COMPANY_ID, code: 'ANNUAL' }
  });
  if (!annualLeaveType) {
    console.error('Annual Leave type not found after bootstrap!');
    process.exit(1);
  }
  const ANNUAL_LEAVE_TYPE_ID = annualLeaveType.id;
  console.log(`Annual Leave Type ID: ${ANNUAL_LEAVE_TYPE_ID}`);

  // ========================================
  // PHASE 1: Seed Annual Leave from PDF data
  // ========================================
  console.log('\n--- Phase 1: Seeding Annual Leave Balances ---');

  // Process current employees (Page 1)
  let matched = 0;
  let notFound = 0;

  for (const entry of leaveData) {
    // Find employee by name in Company 1
    const employee = await prisma.employee.findFirst({
      where: {
        company_id: COMPANY_ID,
        full_name: { contains: entry.name.split(' ')[0], mode: 'insensitive' }
      }
    });

    if (!employee) {
      // Try a looser match with first + last name
      const parts = entry.name.split(' ');
      const firstAndLast = await prisma.employee.findFirst({
        where: {
          company_id: COMPANY_ID,
          AND: [
            { full_name: { contains: parts[0], mode: 'insensitive' } },
            { full_name: { contains: parts[parts.length - 1], mode: 'insensitive' } }
          ]
        }
      });

      if (!firstAndLast) {
        console.log(`  ❌ NOT FOUND: ${entry.name}`);
        notFound++;
        continue;
      }

      // Use the found employee
      await upsertBalance(firstAndLast.id, ANNUAL_LEAVE_TYPE_ID, entry);
      matched++;
      continue;
    }

    await upsertBalance(employee.id, ANNUAL_LEAVE_TYPE_ID, entry);
    matched++;
  }

  console.log(`\n✅ Current Employees: ${matched} matched, ${notFound} not found`);

  // Process resigned employees (Page 2) — only if they exist in the DB
  let resignedMatched = 0;
  let resignedNotFound = 0;

  for (const entry of resignedLeaveData) {
    const parts = entry.name.split(' ');
    const employee = await prisma.employee.findFirst({
      where: {
        company_id: COMPANY_ID,
        AND: [
          { full_name: { contains: parts[0], mode: 'insensitive' } },
          { full_name: { contains: parts[parts.length - 1], mode: 'insensitive' } }
        ]
      }
    });

    if (!employee) {
      console.log(`  ⏭️  Resigned/Not in DB: ${entry.name}`);
      resignedNotFound++;
      continue;
    }

    await upsertBalance(employee.id, ANNUAL_LEAVE_TYPE_ID, entry);
    resignedMatched++;
  }

  console.log(`\n✅ Resigned Staff: ${resignedMatched} matched, ${resignedNotFound} not in DB`);
  console.log(`\n🎉 Annual leave balances seeded: ${matched + resignedMatched}`);

  // ========================================
  // PHASE 2: Seed all other leave type balances
  // ========================================
  console.log('\n=== Phase 2: Seeding Non-Annual Leave Type Balances ===');

  // Get all leave types for this company (excluding Annual Leave)
  const allLeaveTypes = await prisma.leaveType.findMany({
    where: { company_id: COMPANY_ID, code: { not: 'ANNUAL' } }
  });

  console.log(`Found ${allLeaveTypes.length} non-annual leave types:`);
  allLeaveTypes.forEach(t => console.log(`  ${t.name} (ID:${t.id}): default=${t.default_allowance_days} days`));

  // Get all employees for Company 1
  const allEmployees = await prisma.employee.findMany({
    where: { company_id: COMPANY_ID },
    select: { id: true, full_name: true }
  });

  let otherCreated = 0;
  let otherSkipped = 0;

  for (const emp of allEmployees) {
    // Get existing balances for this employee
    const existingBalances = await prisma.leaveBalance.findMany({
      where: {
        employee_id: emp.id,
        company_id: COMPANY_ID,
        fiscal_year: FISCAL_YEAR
      },
      select: { leave_type_id: true, total_entitlement: true }
    });
    const existingMap = new Map(existingBalances.map(b => [b.leave_type_id, Number(b.total_entitlement)]));

    for (const lt of allLeaveTypes) {
      const existingEntitlement = existingMap.get(lt.id);

      if (existingEntitlement !== undefined && existingEntitlement > 0) {
        // Already has correct balance
        otherSkipped++;
        continue;
      }

      const entitlement = lt.default_allowance_days;

      // Upsert: create if missing, update if exists with 0
      await prisma.leaveBalance.upsert({
        where: {
          employee_id_leave_type_id_fiscal_year: {
            employee_id: emp.id,
            leave_type_id: lt.id,
            fiscal_year: FISCAL_YEAR
          }
        },
        update: {
          total_entitlement: entitlement,
          remaining_days: entitlement,
        },
        create: {
          employee_id: emp.id,
          company_id: COMPANY_ID,
          leave_type_id: lt.id,
          fiscal_year: FISCAL_YEAR,
          total_entitlement: entitlement,
          used_days: 0,
          pending_days: 0,
          remaining_days: entitlement,
        }
      });
      otherCreated++;
    }
  }

  console.log(`\n✅ Non-Annual Leave Types: ${otherCreated} created/fixed, ${otherSkipped} already correct`);
  console.log(`\n🎉 Leave data seeding complete!`);
}

async function upsertBalance(employeeId: string, annualLeaveTypeId: number, entry: { name: string; totalEntitlement: number; usedDays: number; remainingDays: number }) {
  await prisma.leaveBalance.upsert({
    where: {
      employee_id_leave_type_id_fiscal_year: {
        employee_id: employeeId,
        leave_type_id: annualLeaveTypeId,
        fiscal_year: FISCAL_YEAR
      }
    },
    update: {
      total_entitlement: entry.totalEntitlement,
      used_days: entry.usedDays,
      remaining_days: entry.remainingDays,
      pending_days: 0,
    },
    create: {
      employee_id: employeeId,
      company_id: COMPANY_ID,
      leave_type_id: annualLeaveTypeId,
      fiscal_year: FISCAL_YEAR,
      total_entitlement: entry.totalEntitlement,
      used_days: entry.usedDays,
      remaining_days: entry.remainingDays,
      pending_days: 0,
    }
  });
  console.log(`  ✅ ${entry.name}: entitlement=${entry.totalEntitlement}, used=${entry.usedDays}, remaining=${entry.remainingDays}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

