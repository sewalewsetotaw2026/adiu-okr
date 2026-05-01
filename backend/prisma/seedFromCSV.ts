import { PrismaClient, Prisma, OnboardingStatus } from "@prisma/client";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may_full: 4, // 'may' is already covered
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const parseCsvDate = (value?: string): Date | null => {
  const raw = String(value || "")
    .trim()
    .replace(/^'+|'+$/g, "");
  if (!raw) return null;

  // Handle DD-MMM-YYYY or DD-Month-YYYY or DD-MM-YYYY
  // 14-May-84, 09-10-1997, 25-July-2000
  const parts = raw.split(/[-/]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let monthPart = parts[1].toLowerCase();
    let yearPart = parts[2];

    let month: number | undefined;

    if (/^\d{1,2}$/.test(monthPart)) {
      // Numeric month: Assume DD-MM-YYYY (common in Ethiopia)
      month = parseInt(monthPart, 10) - 1;
    } else {
      // Named month
      month = MONTH_MAP[monthPart];
    }

    if (month !== undefined && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      let year = parseInt(yearPart, 10);
      if (yearPart.length === 2) {
        // Convert 2-digit years
        const currentYear = new Date().getFullYear();
        const currentYearShort = currentYear % 100;
        // If year is less than current year + 5, assume 20xx, else 19xx
        // This is a common heuristic for DOB vs HireDate
        year += year <= currentYearShort + 5 ? 2000 : 1900;
      }

      const parsed = new Date(Date.UTC(year, month, day));
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  const fallback = new Date(raw);
  return isNaN(fallback.getTime()) ? null : fallback;
};

async function main() {
  // ========================================
  // STEP 0: Target Company ID 1 (existing)
  // ========================================
  const COMPANY_ID = 2;
  const company = await prisma.company.findUnique({
    where: { id: COMPANY_ID },
  });

  if (!company) {
    console.error(
      `Company with ID ${COMPANY_ID} not found! Run 'npx prisma db seed' first.`,
    );
    process.exit(1);
  }
  console.log(`Using Company: ${company.name} (ID: ${company.id})`);

  // ========================================
  // STEP 1: Ensure roles exist for Company 1
  // ========================================
  // Create Admin, HR, and Employee roles under Company 1 if they don't exist
  const rolesToEnsure = ["Admin", "HR", "Employee"];
  for (const roleName of rolesToEnsure) {
    const existing = await prisma.appRole.findFirst({
      where: { company_id: COMPANY_ID, name: roleName },
    });
    if (!existing) {
      await prisma.appRole.create({
        data: { company_id: COMPANY_ID, name: roleName },
      });
      console.log(`  Created role: ${roleName}`);
    }
  }

  const employeeRole = await prisma.appRole.findFirst({
    where: { company_id: COMPANY_ID, name: "Employee" },
  });

  if (!employeeRole) {
    console.error(
      `Failed to create/find 'Employee' role for Company ${COMPANY_ID}!`,
    );
    process.exit(1);
  }
  console.log(
    `Using Employee Role: ID ${employeeRole.id}, Name: ${employeeRole.name}`,
  );

  // ========================================
  // STEP 2: Read CSV
  // ========================================
  const csvFilePath = path.join(
    __dirname,
    "../company data/Employees Data For HRMS.csv",
  );

  if (!fs.existsSync(csvFilePath)) {
    console.log("CSV file not found! Skipping CSV seed gracefully.");
    return; // Exit normally to avoid failing build
  }

  const fileContent = fs.readFileSync(csvFilePath, "utf-8");

  const records = parse(fileContent, {
    columns: false,
    skip_empty_lines: true,
    from_line: 3, // Skip the first two header rows
  });

  // Column mapping:
  // Col 0: Empty        Col 1: No.          Col 2: S.No
  // Col 3: Employee Name Col 4: Department  Col 5: Job Title
  // Col 6: TIN No.      Col 7: Pension No.  Col 8: Cost Sharing Status
  // Col 9: Cost Sharing amount              Col 10: Employment Type
  // Col 11: Place of Work                   Col 12: Basic Salary
  // Col 13: Representation Allowance        Col 14: Meal Allowance
  // Col 15: Housing Allowance               Col 16: Transportation
  // Col 17: Project Allowance               Col 18: Gross Salary
  // Col 19: Date of Employment              Col 23: Date of Birth (GC)
  // Col 25: Gender (M/F)
  // Col 29: Phone Number

  console.log(`Found ${records.length} employee records in CSV.`);

  // ========================================
  // STEP 3: Hash a single default password (reuse for all employees)
  // ========================================
  const defaultPasswordHash = await bcrypt.hash("password123", 10);

  // ========================================
  // STEP 4: Process each row
  // ========================================
  let created = 0;
  let skipped = 0;

  const normalizeCodeBase = (name: string) => {
    const letters = (name || "")
      .toUpperCase()
      .replace(/[^A-Z\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);

    if (letters.length === 0) return "DEP";

    if (letters.length === 1) {
      return letters[0].slice(0, 3).padEnd(3, "X");
    }

    const acronym = letters
      .map((w) => w[0])
      .join("")
      .slice(0, 3);
    return acronym.padEnd(3, "X");
  };

  const generateUniqueDepartmentCode = async (deptName: string) => {
    const base = normalizeCodeBase(deptName);

    for (let seq = 1; seq <= 999; seq++) {
      const candidate = `${base}-${String(seq).padStart(3, "0")}`;
      const exists = await prisma.department.findFirst({
        where: {
          company_id: COMPANY_ID,
          department_code: candidate,
        },
        select: { id: true },
      });

      if (!exists) return candidate;
    }

    return `DEP-${Date.now().toString().slice(-6)}`;
  };

  for (const [index, record] of records.entries()) {
    const fullName = record[3]?.trim();
    if (!fullName) {
      skipped++;
      continue;
    }

    const deptName = record[4]?.trim() || "Unassigned";
    const jobTitleName = record[5]?.trim() || "Staff";
    const tinNumber = record[6]?.trim().replace(/^'/, "");
    const pensionNumber = record[7]?.trim().replace(/^'/, "");
    const employmentType = record[10]?.trim() || "Full Time";
    const placeOfWork = record[11]?.trim() || "Head Office";

    // Parse currency values
    const parseCurrency = (val: string) => {
      if (!val) return 0;
      return parseFloat(val.replace(/,/g, "").replace(/"/g, "").trim()) || 0;
    };

    const basicSalary = parseCurrency(record[12]);
    const grossSalary = parseCurrency(record[18]);
    const repAllowance = parseCurrency(record[13]);
    const mealAllowance = parseCurrency(record[14]);
    const housingAllowance = parseCurrency(record[15]);
    const transportAllowance = parseCurrency(record[16]);
    const projectAllowance = parseCurrency(record[17]);

    const dateStr = record[19]?.trim();
    const hireDate = dateStr ? new Date(dateStr) : new Date();
    const birthDate = parseCsvDate(record[23]);

    const phoneNumber = record[29]?.trim().split(/[/\n]/)[0]?.trim() || "";
    const genderCode = record[25]?.trim();
    const gender =
      genderCode === "M" ? "Male" : genderCode === "F" ? "Female" : undefined;

    console.log(`Processing: ${fullName}`);

    // --- 4a. Upsert Department + ensure non-null code ---
    const existingDepartment = await prisma.department.findUnique({
      where: {
        company_id_name: {
          company_id: COMPANY_ID,
          name: deptName,
        },
      },
      select: { id: true, department_code: true },
    });

    let departmentId: number;
    if (existingDepartment) {
      if (!existingDepartment.department_code) {
        const newCode = await generateUniqueDepartmentCode(deptName);
        const updatedDepartment = await prisma.department.update({
          where: { id: existingDepartment.id },
          data: { department_code: newCode },
        });
        departmentId = updatedDepartment.id;
      } else {
        departmentId = existingDepartment.id;
      }
    } else {
      const newCode = await generateUniqueDepartmentCode(deptName);
      const createdDepartment = await prisma.department.create({
        data: {
          company_id: COMPANY_ID,
          name: deptName,
          department_code: newCode,
        },
      });
      departmentId = createdDepartment.id;
    }

    // --- 4b. Find or Create Job Title ---
    let jobTitle = await prisma.jobTitle.findFirst({
      where: {
        company_id: COMPANY_ID,
        title: jobTitleName,
        level: null,
      },
    });

    if (!jobTitle) {
      jobTitle = await prisma.jobTitle.create({
        data: {
          company_id: COMPANY_ID,
          title: jobTitleName,
        },
      });
    }

    // --- 4c. Generate stable Employee ID ---
    const sNo = record[2]?.trim();
    const serial = sNo && /^\d+$/.test(sNo) ? sNo : String(index + 1);
    const employeeId = `EMP-${serial.padStart(3, "0")}`;

    // --- 4d. Upsert Employee ---
    const employee = await prisma.employee.upsert({
      where: {
        id_company_id: {
          id: employeeId,
          company_id: COMPANY_ID,
        },
      },
      update: {
        full_name: fullName,
        tin_number:
          tinNumber !== "NA" && tinNumber !== "New" ? tinNumber : undefined,
        pension_number:
          pensionNumber !== "NA" && pensionNumber !== "New"
            ? pensionNumber
            : undefined,
        place_of_work: placeOfWork,
        date_of_birth: birthDate ?? undefined,
      },
      create: {
        id: employeeId,
        company_id: COMPANY_ID,
        full_name: fullName,
        tin_number:
          tinNumber !== "NA" && tinNumber !== "New" ? tinNumber : undefined,
        pension_number:
          pensionNumber !== "NA" && pensionNumber !== "New"
            ? pensionNumber
            : undefined,
        place_of_work: placeOfWork,
        gender: gender,
        date_of_birth: birthDate,
      },
    });

    // --- 4e. Create/Update Employment ---
    const existingEmployment = await prisma.employment.findFirst({
      where: {
        employee_id: employee.id,
        company_id: COMPANY_ID,
        is_active: true,
      },
    });

    let employmentId: number | undefined = existingEmployment?.id;
    const validHireDate = isNaN(hireDate.getTime()) ? new Date() : hireDate;

    if (existingEmployment) {
      await prisma.employment.update({
        where: { id: existingEmployment.id },
        data: {
          department_id: departmentId,
          job_title_id: jobTitle.id,
          gross_salary: grossSalary,
          basic_salary: basicSalary,
          start_date: validHireDate,
        },
      });
    } else {
      const newEmp = await prisma.employment.create({
        data: {
          employee_id: employee.id,
          company_id: COMPANY_ID,
          department_id: departmentId,
          job_title_id: jobTitle.id,
          employment_type: employmentType,
          gross_salary: grossSalary,
          basic_salary: basicSalary,
          start_date: validHireDate,
          is_active: true,
        },
      });
      employmentId = newEmp.id;
    }

    // --- 4f. Handle Allowances ---
    const allowances = [
      { name: "Representation Allowance", amount: repAllowance },
      { name: "Meal Allowance", amount: mealAllowance },
      { name: "Housing Allowance", amount: housingAllowance },
      { name: "Transportation Allowance", amount: transportAllowance },
      { name: "Project Allowance", amount: projectAllowance },
    ];

    for (const allow of allowances) {
      if (allow.amount > 0 && employmentId) {
        const allowType = await prisma.allowanceType.upsert({
          where: { name: allow.name },
          update: {},
          create: { name: allow.name, is_taxable: true },
        });

        const existingAllow = await prisma.employeeAllowance.findFirst({
          where: {
            employment_id: employmentId,
            allowance_type_id: allowType.id,
          },
        });

        if (existingAllow) {
          await prisma.employeeAllowance.update({
            where: { id: existingAllow.id },
            data: { amount: allow.amount },
          });
        } else {
          await prisma.employeeAllowance.create({
            data: {
              employment_id: employmentId,
              allowance_type_id: allowType.id,
              amount: allow.amount,
            },
          });
        }
      }
    }

    // --- 4g. Phone Number ---
    if (phoneNumber) {
      const cleanPhone = phoneNumber.replace(/'/g, "").trim();
      const existingPhone = await prisma.employeePhone.findFirst({
        where: { employee_id: employee.id },
      });
      if (!existingPhone) {
        await prisma.employeePhone.create({
          data: {
            employee_id: employee.id,
            phone_number: cleanPhone,
            company_id: COMPANY_ID,
            is_primary: true,
          },
        });
      }
    }

    // --- 4h. Create AppUser (Login Account) ---
    // Check if this employee already has an AppUser
    const existingUser = await prisma.appUser.findFirst({
      where: {
        company_id: COMPANY_ID,
        employee_id: employee.id,
      },
    });

    if (!existingUser) {
      const nameParts = fullName.toLowerCase().split(" ");
      const firstName = nameParts[0]?.replace(/[^a-z0-9]/g, "") || "user";
      const lastName =
        nameParts.length > 1
          ? nameParts[nameParts.length - 1]?.replace(/[^a-z0-9]/g, "")
          : "user";
      let email = `${firstName}.${lastName}@kacha.com`;

      // Handle email collisions: if email exists, append a number
      let emailExists = await prisma.appUser.findUnique({ where: { email } });
      let suffix = 2;
      while (emailExists) {
        email = `${firstName}.${lastName}${suffix}@kacha.com`;
        emailExists = await prisma.appUser.findUnique({ where: { email } });
        suffix++;
      }

      await prisma.appUser.create({
        data: {
          company_id: COMPANY_ID,
          employee_id: employee.id,
          email: email,
          password_hash: defaultPasswordHash,
          role_id: employeeRole.id, // Uses the EXISTING Employee role (ID 3)
          is_active: true,
          onboarding_status: OnboardingStatus.COMPLETED,
        },
      });
      console.log(`  -> User: ${email} (Role ID: ${employeeRole.id})`);
    } else {
      console.log(`  -> User already exists: ${existingUser.email}`);
    }

    created++;
  }

  console.log(
    `\n✅ Seeding completed! Created/Updated: ${created}, Skipped: ${skipped}`,
  );
  console.log(`   Company ID: ${COMPANY_ID}`);
  console.log(`   Employee Role ID: ${employeeRole.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
