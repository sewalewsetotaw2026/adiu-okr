import {
  PrismaClient,
  OnboardingStatus,
  InstitutionCategory,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  departments,
  jobTitles,
  roles,
  resources,
  allActions,
  employeePermissions,
  educationLevels,
  fieldsOfStudy,
  institutions,
  separationReasons,
  publicHolidays,
  getLeaveTypes,
  allowanceTypes,
  banks,
} from "./seedData";

const prisma = new PrismaClient();

async function seedRolesAndPermissionsForCompany(
  companyId: number,
  resourceMap: Map<string, any>,
) {
  const allRolesToSeed = ["Super Admin", ...roles];
  console.log(`Seeding ${allRolesToSeed.length} roles for company ID ${companyId}...`);
  for (const roleName of allRolesToSeed) {
    await prisma.appRole.upsert({
      where: {
        company_id_name: {
          company_id: companyId,
          name: roleName,
        },
      },
      update: {},
      create: {
        company_id: companyId,
        name: roleName,
        description: `Default ${roleName} role`,
      },
    });
  }

  const companyRoles = await prisma.appRole.findMany({
    where: { company_id: companyId },
  });
  const companyRoleMap = new Map(companyRoles.map((r) => [r.name, r]));

  const superAdminR = companyRoleMap.get("Super Admin");
  const adminR = companyRoleMap.get("Admin");
  const hrR = companyRoleMap.get("HR");
  const employeeR = companyRoleMap.get("Employee");

  const privilegedRs = [superAdminR, adminR, hrR].filter(Boolean);

  // Grant full permissions to privileged roles
  console.log(`Granting full permissions to privileged roles for company ID ${companyId}...`);
  for (const role of privilegedRs) {
    if (!role) continue;
    const permissionsData = [];
    for (const res of resources) {
      const resource = resourceMap.get(res.code);
      if (!resource) continue;

      for (const action of allActions) {
        permissionsData.push({
          role_id: role.id,
          resource_id: resource.id,
          action: action,
        });
      }
    }
    await prisma.appPermission.createMany({
      data: permissionsData,
      skipDuplicates: true,
    });
  }

  // Grant Employee permissions
  if (employeeR) {
    console.log(`Granting specific permissions to Employee role for company ID ${companyId}...`);
    const employeePermissionsData = [];
    for (const perm of employeePermissions) {
      const resource = resourceMap.get(perm.resource);
      if (!resource) continue;

      for (const action of perm.actions) {
        employeePermissionsData.push({
          role_id: employeeR.id,
          resource_id: resource.id,
          action: action,
        });
      }
    }

    await prisma.appPermission.createMany({
      data: employeePermissionsData,
      skipDuplicates: true,
    });
  }
}

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

async function generateUniqueDepartmentCode(companyId: number, deptName: string) {
  const base = normalizeCodeBase(deptName);

  for (let seq = 1; seq <= 999; seq++) {
    const candidate = `${base}-${String(seq).padStart(3, "0")}`;
    const exists = await prisma.department.findFirst({
      where: {
        company_id: companyId,
        department_code: candidate,
      },
      select: { id: true },
    });

    if (!exists) return candidate;
  }

  return `DEP-${Date.now().toString().slice(-6)}`;
}

async function seedTenantData(
  companyId: number,
  resourceMap: Map<string, any>,
) {
  // seed departments
  console.log(`Seeding departments for company ID ${companyId}...`);
  for (const name of departments) {
    const existing = await prisma.department.findUnique({
      where: {
        company_id_name: {
          company_id: companyId,
          name: name,
        },
      },
    });

    if (existing) {
      if (!existing.department_code) {
        const code = await generateUniqueDepartmentCode(companyId, name);
        await prisma.department.update({
          where: { id: existing.id },
          data: { department_code: code },
        });
      }
    } else {
      const code = await generateUniqueDepartmentCode(companyId, name);
      await prisma.department.create({
        data: {
          company_id: companyId,
          name: name,
          department_code: code,
        },
      });
    }
  }

  // seed job titles
  for (const jt of jobTitles) {
    const level = jt.level ?? null;
    await prisma.jobTitle.upsert({
      where: {
        company_id_title_level: {
          company_id: companyId,
          title: jt.title,
          level: level,
        },
      },
      update: {},
      create: {
        company_id: companyId,
        title: jt.title,
        level: level,
      },
    });
  }

  // seed job levels
  const jobLevelNamesList = [
    "Intern",
    "Entry Level",
    "Junior",
    "Mid-Level",
    "Senior",
    "Lead",
    "Manager",
    "Senior Manager",
    "Director",
    "Vice President",
    "Chief Officer (C-Level)",
  ];

  for (const name of jobLevelNamesList) {
    await prisma.jobLevel.upsert({
      where: {
        company_id_name: {
          company_id: companyId,
          name: name,
        },
      },
      update: {},
      create: {
        company_id: companyId,
        name: name,
      },
    });
  }

  // roles and permissions
  await seedRolesAndPermissionsForCompany(companyId, resourceMap);

  // Create default leave types
  const leaveTypesData = getLeaveTypes(companyId);
  for (const lt of leaveTypesData) {
    await prisma.leaveType.upsert({
      where: {
        company_id_code: {
          company_id: companyId,
          code: lt.code,
        },
      },
      update: lt,
      create: lt,
    });
  }

  // Seed Public Holidays
  for (const holiday of publicHolidays) {
    const holidayDate = new Date(holiday.date);
    const existingHoliday = await prisma.publicHoliday.findFirst({
      where: {
        company_id: companyId,
        name: holiday.name,
        holiday_date: holidayDate,
      },
    });

    if (existingHoliday) {
      await prisma.publicHoliday.update({
        where: { id: existingHoliday.id },
        data: { is_recurring: true },
      });
    } else {
      await prisma.publicHoliday.create({
        data: {
          company_id: companyId,
          name: holiday.name,
          holiday_date: holidayDate,
          is_recurring: true,
        },
      });
    }
  }
}

async function main() {
  console.log("Start seeding ...");

  // --- PLATFORM COMPANY SEEDING ---
  const platformCompanyCode = "PLATFORM";
  const platformCompany = await prisma.company.upsert({
    where: { company_code: platformCompanyCode },
    update: { name: "Platform Administration" },
    create: {
      company_code: platformCompanyCode,
      name: "Platform Administration",
      is_active: true,
    },
  });
  console.log(`Ensured Platform Company: ${platformCompany.name}`);

  // --- KACHA COMPANY SEEDING ---
  const kachaCompanyCode = "KACHA";
  const kachaCompany = await prisma.company.upsert({
    where: { company_code: kachaCompanyCode },
    update: { name: "Kacha Digital Financial Service S.C." },
    create: {
      company_code: kachaCompanyCode,
      name: "Kacha Digital Financial Service S.C.",
      is_active: true,
    },
  });
  console.log(`Ensured Kacha Company: ${kachaCompany.name}`);

  // --- ADIU COMPANY SEEDING ---
const adiuCompanyCode = "ADIU";
const adiuCompany = await prisma.company.upsert({
  where: { company_code: adiuCompanyCode },
  update: { name: "ADIU Communications Service PLC" },
  create: {
    company_code: adiuCompanyCode,
    name: "ADIU Communications Service PLC",
    is_active: true,
  },
});

console.log(`Ensured ADIU Company: ${adiuCompany.name}`);

  // Ensure test company also gets roles/permissions for E2E suites
  const testCompany = await prisma.company.upsert({
    where: { company_code: "TEST01" },
    update: {},
    create: {
      company_code: "TEST01",
      name: "Test Company 01",
      is_active: true,
    },
  });

  // --- GLOBAL LOOKUP DATA SEEDING ---

  // create resources
  console.log("Seeding globally unique resources...");
  for (const res of resources) {
    await prisma.appResource.upsert({
      where: { code: res.code },
      update: { name: res.name },
      create: {
        code: res.code,
        name: res.name,
      },
    });
  }
  const fetchedResources = await prisma.appResource.findMany();
  const resourceMap = new Map();
  fetchedResources.forEach((r) => resourceMap.set(r.code, r));
  console.log(`Seeded resources.`);

  // Seed Allowance Types
  console.log("Seeding allowance types...");
  for (const at of allowanceTypes) {
    await prisma.allowanceType.upsert({
      where: { name: at.name },
      update: { description: at.description },
      create: {
        name: at.name,
        description: at.description,
        is_taxable: true,
      },
    });
  }

  // Seed Education Levels
  for (const level of educationLevels) {
    await prisma.educationLevel.upsert({
      where: { name: level.name },
      update: { display_order: level.display_order },
      create: {
        name: level.name,
        display_order: level.display_order,
      },
    });
  }

  // Seed Fields of Study
  for (const name of fieldsOfStudy) {
    await prisma.fieldOfStudy.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Seed Institutions
  for (const inst of institutions) {
    await prisma.institution.upsert({
      where: { name: inst.name },
      update: { category: InstitutionCategory[inst.category] },
      create: {
        name: inst.name,
        category: InstitutionCategory[inst.category],
        is_verified: true,
      },
    });
  }

  // Seed Separation Reasons
  for (const sep of separationReasons) {
    const existingReason = await prisma.separationReason.findFirst({
      where: {
        reason_category: sep.reason_category,
        reason_detail: sep.reason_detail,
      },
    });

    if (existingReason) {
      await prisma.separationReason.update({
        where: { id: existingReason.id },
        data: {
          requires_exit_interview: sep.requires_exit_interview,
        },
      });
    } else {
      await prisma.separationReason.create({
        data: sep,
      });
    }
  }

  // Seed Banks
  for (const bank of banks) {
    await prisma.bank.upsert({
      where: { name: bank.name },
      update: { swift_code: bank.swift_code },
      create: bank,
    });
  }

  // --- SEED TENANT DATA FOR ALL COMPANIES ---
  console.log("Seeding tenant-specific data...");
  await seedTenantData(platformCompany.id, resourceMap);
  await seedTenantData(kachaCompany.id, resourceMap);
  await seedTenantData(adiuCompany.id, resourceMap);  
  await seedTenantData(testCompany.id, resourceMap);

  // --- ADMIN USERS SEEDING ---
  console.log("Seeding Admin Users...");

  // Platform Super Admin
  const platformRoles = await prisma.appRole.findMany({
    where: { company_id: platformCompany.id },
  });
  const platformRoleMap = new Map(platformRoles.map((r) => [r.name, r]));

  // Create Platform Super Admin Employee
  const platformEmployee = await prisma.employee.upsert({
    where: { id: "EMP-PLATFORM-001" },
    update: { full_name: "Super Admin", company_id: platformCompany.id },
    create: {
      id: "EMP-PLATFORM-001",
      company_id: platformCompany.id,
      full_name: "Super Admin",
      gender: "Male",
    },
  });

  const platformPasswordHash = await bcrypt.hash("superpassword123", 12);
  const superAdminRole = platformRoleMap.get("Super Admin");

  // Clean up any existing users with same employee_id/company_id or old email to avoid unique constraint issues
  await prisma.appUser.deleteMany({
    where: {
      OR: [
        { email: "superadmin@kacha.com" },
        { email: "superadmin@platform.com" },
        {
          company_id: platformCompany.id,
          employee_id: platformEmployee.id
        }
      ]
    }
  });

  await prisma.appUser.upsert({
    where: { email: "superadmin@platform.com" },
    update: {
      password_hash: platformPasswordHash,
      role_id: superAdminRole?.id ?? 0,
      company_id: platformCompany.id,
      employee_id: platformEmployee.id,
    },
    create: {
      company_id: platformCompany.id,
      employee_id: platformEmployee.id,
      email: "superadmin@platform.com",
      password_hash: platformPasswordHash,
      role_id: superAdminRole?.id ?? 0,
      is_active: true,
      onboarding_status: OnboardingStatus.COMPLETED,
    },
  });

  // Kacha Admin
  const kachaRoles = await prisma.appRole.findMany({
    where: { company_id: kachaCompany.id },
  });
  const kachaRoleMap = new Map(kachaRoles.map((r) => [r.name, r]));

  const kachaEmployee = await prisma.employee.upsert({
    where: { id: "EMP-ADMIN" },
    update: { full_name: "Kacha Admin", company_id: kachaCompany.id },
    create: {
      id: "EMP-ADMIN",
      company_id: kachaCompany.id,
      full_name: "Kacha Admin",
      gender: "Male",
    },
  });

  const kachaPasswordHash = await bcrypt.hash("password123", 12);
  const kachaAdminRole = kachaRoleMap.get("Admin");

  await prisma.appUser.upsert({
    where: { email: "admin@kacha.com" },
    update: {
      password_hash: kachaPasswordHash,
      role_id: kachaAdminRole?.id ?? 0,
      company_id: kachaCompany.id,
      employee_id: kachaEmployee.id,
    },
    create: {
      company_id: kachaCompany.id,
      employee_id: kachaEmployee.id,
      email: "admin@kacha.com",
      password_hash: kachaPasswordHash,
      role_id: kachaAdminRole?.id ?? 0,
      is_active: true,
      onboarding_status: OnboardingStatus.COMPLETED,
    },
  });

  // Employment for Kacha Admin (HR Manager)
  const hrDepartment = await prisma.department.findFirst({
    where: { company_id: kachaCompany.id, name: "Human Resource" },
  });
  const hrManagerJobTitle = await prisma.jobTitle.findFirst({
    where: { company_id: kachaCompany.id, title: "HR Manager" },
  });

  if (hrDepartment && hrManagerJobTitle) {
    const existingEmployment = await prisma.employment.findFirst({
      where: {
        employee_id: kachaEmployee.id,
        company_id: kachaCompany.id,
        is_active: true,
      },
    });

    if (existingEmployment) {
      await prisma.employment.update({
        where: { id: existingEmployment.id },
        data: {
          department_id: hrDepartment.id,
          job_title_id: hrManagerJobTitle.id,
        },
      });
    } else {
      const startDate = new Date("2020-01-01");
      const probationEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);
      await prisma.employment.create({
        data: {
          employee_id: kachaEmployee.id,
          company_id: kachaCompany.id,
          department_id: hrDepartment.id,
          job_title_id: hrManagerJobTitle.id,
          employment_type: "Full Time",
          start_date: startDate,
          probation_end_date: probationEndDate,
          is_active: true,
        },
      });
    }
  }

// --- ADIU ADMIN ---
const adiuRoles = await prisma.appRole.findMany({
  where: { company_id: adiuCompany.id },
});
const adiuRoleMap = new Map(adiuRoles.map((r) => [r.name, r]));

const adiuEmployee = await prisma.employee.upsert({
  where: { id: "EMP-ADIU-ADMIN" },
  update: {
    full_name: "ADIU Admin",
    company_id: adiuCompany.id,
  },
  create: {
    id: "EMP-ADIU-ADMIN",
    company_id: adiuCompany.id,
    full_name: "ADIU Admin",
    gender: "Male",
  },
});

const adiuPasswordHash = await bcrypt.hash("password123", 12);
const adiuAdminRole = adiuRoleMap.get("Admin");

// Clean existing (safe)
await prisma.appUser.deleteMany({
  where: {
    OR: [
      { email: "admin@adiu.com" },
      {
        company_id: adiuCompany.id,
        employee_id: adiuEmployee.id,
      },
    ],
  },
});

await prisma.appUser.upsert({
  where: { email: "admin@adiu.com" },
  update: {
    password_hash: adiuPasswordHash,
    role_id: adiuAdminRole?.id ?? 0,
    company_id: adiuCompany.id,
    employee_id: adiuEmployee.id,
  },
  create: {
    company_id: adiuCompany.id,
    employee_id: adiuEmployee.id,
    email: "admin@adiu.com",
    password_hash: adiuPasswordHash,
    role_id: adiuAdminRole?.id ?? 0,
    is_active: true,
    onboarding_status: OnboardingStatus.COMPLETED,
  },
});
const adiuHRDepartment = await prisma.department.findFirst({
  where: { company_id: adiuCompany.id, name: "Human Resource" },
});

const adiuHRManagerJobTitle = await prisma.jobTitle.findFirst({
  where: { company_id: adiuCompany.id, title: "HR Manager" },
});

if (adiuHRDepartment && adiuHRManagerJobTitle) {
  const existingEmployment = await prisma.employment.findFirst({
    where: {
      employee_id: adiuEmployee.id,
      company_id: adiuCompany.id,
      is_active: true,
    },
  });

  if (existingEmployment) {
    await prisma.employment.update({
      where: { id: existingEmployment.id },
      data: {
        department_id: adiuHRDepartment.id,
        job_title_id: adiuHRManagerJobTitle.id,
      },
    });
  } else {
    const startDate = new Date("2024-01-01");
    const probationEndDate = new Date(
      startDate.getTime() + 90 * 24 * 60 * 60 * 1000
    );

    await prisma.employment.create({
      data: {
        employee_id: adiuEmployee.id,
        company_id: adiuCompany.id,
        department_id: adiuHRDepartment.id,
        job_title_id: adiuHRManagerJobTitle.id,
        employment_type: "Full Time",
        start_date: startDate,
        probation_end_date: probationEndDate,
        is_active: true,
      },
    });
  }
}

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
