import { Request, Response, NextFunction } from "express";
import prisma from "src/prisma";
import { RoleNames, SUPERADMIN_VARIANTS } from "src/utils/roleConstants";

/**
 * Get Department-wise Gender Distribution
 * Returns a list of departments with their male/female counts.
 */
export const getDepartmentGenderDistribution = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) throw new Error("Company ID not found");

    // We need to group by Department AND Gender
    // Prisma doesn't natively support multi-level deep grouping + counting easily in one go
    // for relations without flat ids. exist.
    // However, Employment has department_id. We can fetch all active employments
    // and aggregate in memory for flexibility, or use efficient groupBy.

    // Efficient Approach: Group by department_id and join employee to check gender?
    // Prisma limitation: groupBy cannot traverse relations for the key (e.g. employee.gender).
    // So we fetch data or use raw query. Raw query is best for complex analytics but let's try Prisma way first if possible.
    // Actually, we can just fetch all active employments with { department_id, employee: { gender } } 
    // and aggregate in JS. This is fine for < 10k records, which is typical for this scale.
    // If it scales up, we switch to raw SQL.

    const employments = await prisma.employment.findMany({
      where: {
        company_id: companyId,
        is_active: true,
        department_id: { not: null },
        employee: {
          appUsers: {
            none: {
              role: {
                name: {
                  in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
                },
              },
            },
          },
        },
      },
      select: {
        department_id: true,
        department: { select: { name: true } },
        employee: { select: { gender: true } },
      },
    });

    const stats: Record<string, { name: string, gender: { male: number; female: number } }> = {};

    employments.forEach((emp) => {
      if (!emp.department_id) return;

      const deptId = emp.department_id.toString();
      const deptName = emp.department?.name || "Unknown";

      // Initialize if not exists
      if (!stats[deptId]) {
        stats[deptId] = {
          name: deptName,
          gender: { male: 0, female: 0 }
        };
      }

      const g = emp.employee.gender?.toLowerCase();
      if (g === "male") stats[deptId].gender.male++;
      else if (g === "female") stats[deptId].gender.female++;
    });

    return res.status(200).json({
      status: "success",
      data: stats,
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get Full Dashboard Advanced Analytics
 * Returns breakdown for the Dashboard "Insight Card" logic + Extra Strategic Stats
 */
/**
 * Get Full Dashboard Advanced Analytics
 * Returns a comprehensive payload with ALL dashboard stats in one go.
 */
export const getAdvancedDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) throw new Error("Company ID not found");

    // 1. Fetch Core Data (All Employments for existing active employees)
    // We only count as "Active" if they are active AND completed onboarding
    const activeEmployments = await prisma.employment.findMany({
      where: {
        company_id: companyId,
        is_active: true,
        employee: {
          appUsers: {
            some: {
              onboarding_status: "COMPLETED",
              is_active: true,
            },
            none: {
              role: {
                name: {
                  in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
                },
              },
            },
          },
        },
      },
      select: {
        department_id: true,
        department: { select: { name: true } },
        jobTitle: { select: { level: true } },
        employee: {
          select: {
            id: true, // Need ID for unique counting
            gender: true,
            date_of_birth: true,
            educations: {
              select: {
                id: true,
                educationLevel: { select: { name: true } },
              },
              orderBy: { start_date: "desc" }, // Most recent first
            },
          },
        },
        employment_type: true,
        probation_end_date: true,
        manager_id: true,
        start_date: true,
      },
    });

    // 2. Fetch Additional Counts (DB Queries for things not in activeEmployments)
    const [
      totalEmployeesCount,
      totalDepartmentsCount,
      inactiveEmployeesCount,
    ] = await Promise.all([
      // Total Employees = Unique employees who COMPLETED onboarding
      prisma.employee.count({
        where: {
          company_id: companyId,
          appUsers: {
            some: {
              onboarding_status: "COMPLETED",
            },
            none: {
              role: {
                name: {
                  in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
                },
              },
            },
          },
        },
      }),
      prisma.department.count({
        where: {
          company_id: companyId,
          employments: {
            some: {
              is_active: true,
              employee: {
                appUsers: {
                  none: {
                    role: {
                      name: {
                        in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
                      },
                    },
                  },
                },
              },
            },
          },
        }
      }),
      // Inactive Employees = Unique COMPLETED employees who lack ANY active employment
      prisma.employee.count({
        where: {
          company_id: companyId,
          appUsers: {
            some: {
              onboarding_status: "COMPLETED",
            },
            none: {
              role: {
                name: {
                  in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
                },
              },
            },
          },
          employments: {
            none: {
              is_active: true,
            },
          },
        },
      }),
    ]);

    // 3. Initialize Aggregators
    const stats = {
      // Base Counts
      totalEmployees: totalEmployeesCount,
      totalDepartments: totalDepartmentsCount,
      activeEmployees: new Set(activeEmployments.map((e) => e.employee.id)).size,
      inactiveEmployees: inactiveEmployeesCount,
      totalManagers: 0, // Calculated below

      // Global Distributions
      genderDist: { male: 0, female: 0 },
      empTypeDist: {} as Record<string, number>,
      deptDist: {} as Record<string, number>,
      jobLevelDist: {} as Record<string, number>,
      managerDist: { Managers: 0, NonManagers: 0 },
      educationDist: {} as Record<string, number>,
      ageDist: {
        "18-25": 0,
        "26-35": 0,
        "36-45": 0,
        "46-55": 0,
        "55+": 0,
        "Unknown": 0
      } as Record<string, number>,

      // Advanced / Deep-Dive
      departmentBreakdown: {} as Record<string, {
        name: string;
        gender: { male: number; female: number };
        jobLevels: Record<string, number>;
        empTypes: Record<string, number>;
        probation: { "In Probation": number, "Confirmed": number };
      }>,
      tenureDistribution: {
        "<1 Year": 0,
        "1-3 Years": 0,
        "3-5 Years": 0,
        "5+ Years": 0
      },
      probationStatus: {
        "In Probation": 0,
        "Confirmed": 0
      },
      hiringTrends: {} as Record<string, number>
    };

    const managersSet = new Set<string>(); // To count unique managers
    const now = new Date();

    // 4. Deduplicate Employments (Active Workforce Headcount for Global Demographics)
    const uniqueActiveEmploymentsMap = new Map<string, typeof activeEmployments[0]>();

    activeEmployments.forEach(emp => {
      if (!uniqueActiveEmploymentsMap.has(emp.employee.id)) {
        uniqueActiveEmploymentsMap.set(emp.employee.id, emp);
      }
    });

    const uniqueActiveEmployments = Array.from(uniqueActiveEmploymentsMap.values());

    // 5. Aggregate logic
    // - Global demographics (gender, age, education) use uniqueActiveEmployments to avoid double-counting.
    // - Department and manager stats use ALL activeEmployments to ensure every role is represented.

    // Pass 1: Global Demographics
    uniqueActiveEmployments.forEach(emp => {
      // --- Global: Gender ---
      const g = emp.employee.gender?.toLowerCase();
      if (g === "male") stats.genderDist.male++;
      else if (g === "female") stats.genderDist.female++;

      // --- Global: Employment Type ---
      const eType = emp.employment_type || "Unknown";
      stats.empTypeDist[eType] = (stats.empTypeDist[eType] || 0) + 1;

      // --- Global: Job Level ---
      const level = emp.jobTitle?.level || "Unspecified";
      stats.jobLevelDist[level] = (stats.jobLevelDist[level] || 0) + 1;

      // --- Global: Education ---
      // Simplification: Take the first (most recent) education level
      const eduLevel = emp.employee.educations[0]?.educationLevel?.name || "Unspecified";
      stats.educationDist[eduLevel] = (stats.educationDist[eduLevel] || 0) + 1;

      // --- Global: Age ---
      let ageGroup = "Unknown";
      if (emp.employee.date_of_birth) {
        const dob = new Date(emp.employee.date_of_birth);
        const age = now.getFullYear() - dob.getFullYear();
        // Simple year diff is usually sufficient for age buckets

        if (age < 26) ageGroup = "18-25";
        else if (age <= 35) ageGroup = "26-35";
        else if (age <= 45) ageGroup = "36-45";
        else if (age <= 55) ageGroup = "46-55";
        else ageGroup = "55+";
      }
      stats.ageDist[ageGroup] = (stats.ageDist[ageGroup] || 0) + 1;
    });

    // 6. Aggregate on ALL employments for accurate department/manager/tenure stats
    activeEmployments.forEach(emp => {
      // --- Global & Advanced: Department ---
      if (emp.department_id) {
        const deptName = emp.department?.name || "Unknown";
        const deptId = emp.department_id.toString();

        // Global Dept Dist
        stats.deptDist[deptName] = (stats.deptDist[deptName] || 0) + 1;

        // Advanced Breakdown
        if (!stats.departmentBreakdown[deptId]) {
          stats.departmentBreakdown[deptId] = {
            name: deptName,
            gender: { male: 0, female: 0 },
            jobLevels: {},
            empTypes: {},
            probation: { "In Probation": 0, "Confirmed": 0 }
          };
        }

        // Breakdown: Gender
        const g = emp.employee.gender?.toLowerCase();
        if (g === "male") stats.departmentBreakdown[deptId].gender.male++;
        else if (g === "female") stats.departmentBreakdown[deptId].gender.female++;

        // Breakdown: Job Level
        const level = emp.jobTitle?.level || "Unspecified";
        stats.departmentBreakdown[deptId].jobLevels[level] = (stats.departmentBreakdown[deptId].jobLevels[level] || 0) + 1;

        // Breakdown: Employment Type
        const eType = emp.employment_type || "Unknown";
        stats.departmentBreakdown[deptId].empTypes[eType] = (stats.departmentBreakdown[deptId].empTypes[eType] || 0) + 1;

        // Breakdown: Probation
        const isProbationLocal = emp.probation_end_date
          ? now < new Date(emp.probation_end_date)
          : now < new Date(new Date(emp.start_date).setMonth(new Date(emp.start_date).getMonth() + 3));

        if (isProbationLocal) stats.departmentBreakdown[deptId].probation["In Probation"]++;
        else stats.departmentBreakdown[deptId].probation["Confirmed"]++;
      }

      // --- Global: Manager Count ---
      if (emp.manager_id) {
        managersSet.add(emp.manager_id);
      }

      // --- Advanced: Tenure ---
      const startDate = new Date(emp.start_date);
      const diffYears = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (diffYears < 1) stats.tenureDistribution["<1 Year"]++;
      else if (diffYears < 3) stats.tenureDistribution["1-3 Years"]++;
      else if (diffYears < 5) stats.tenureDistribution["3-5 Years"]++;
      else stats.tenureDistribution["5+ Years"]++;

      // --- Advanced: Probation
      const isProbation = emp.probation_end_date
        ? now < new Date(emp.probation_end_date)
        : now < new Date(new Date(emp.start_date).setMonth(new Date(emp.start_date).getMonth() + 3));

      if (isProbation) stats.probationStatus["In Probation"]++;
      else stats.probationStatus["Confirmed"]++;

      // --- Advanced: Hiring Trends ---
      const startMonth = startDate.toLocaleString('default', { month: 'short', year: 'numeric' });
      stats.hiringTrends[startMonth] = (stats.hiringTrends[startMonth] || 0) + 1;
    });

    // 7. Update totalDepartments count to reflect non-empty only
    stats.totalDepartments = Object.keys(stats.departmentBreakdown).length;

    // Finalize Manager Stats
    stats.totalManagers = managersSet.size;
    stats.managerDist = {
      Managers: managersSet.size,
      NonManagers: stats.activeEmployees - managersSet.size
    };

    // Sort Hiring Trends Chronologically
    // (This simple string sort might fail for "Jan 2025" vs "Dec 2024". 
    // We should ideally sort by date but map to string. 
    // For now, let's keep it simple or do a quick sort helper if needed. 
    // Actually, sending it as an array is better for the frontend chart.)

    // Helper to sort "MMM YYYY" keys
    const sortedTrendKeys = Object.keys(stats.hiringTrends).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });

    const sortedTrends: Record<string, number> = {};
    sortedTrendKeys.forEach(key => {
      sortedTrends[key] = stats.hiringTrends[key];
    });
    stats.hiringTrends = sortedTrends;

    return res.status(200).json({
      status: "success",
      data: stats,
    });

  } catch (error) {
    next(error);
  }
};
