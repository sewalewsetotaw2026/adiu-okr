/**
 * Celebration Service
 * Handles business logic for birthday, promotion, and anniversary celebrations
 */
import { prisma } from "src/app";
import { CelebrationType, CelebrationVisibility, Prisma } from "@prisma/client";
import {
  getZodiacSign,
  calculateAge,
  calculateYearsOfService,
  isMilestoneAnniversary,
} from "src/utils/horoscope";

interface CelebrationDetails {
  zodiacSign?: string;
  zodiacSymbol?: string;
  horoscope?: string;
  age?: number;
  previousPosition?: string;
  newPosition?: string;
  yearsOfService?: number;
  [key: string]: string | number | undefined; // Index signature for Prisma JSON compatibility
}

import { RoleNames } from "src/utils/roleConstants";

/**
 * Get today's birthdays and create/update celebration records
 */
export async function detectTodaysBirthdays(companyId: number) {
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowMonth = tomorrow.getMonth() + 1;
  const tomorrowDay = tomorrow.getDate();

  // Find employees with birthdays today
  const employees = await prisma.employee.findMany({
    where: {
      company_id: companyId,
      date_of_birth: {
        not: null,
      },
      appUsers: {
        none: {
          role: {
            name: {
              in: [RoleNames.ADMIN, RoleNames.SUPERADMIN],
            },
          },
        },
      },
      employments: {
        some: {
          is_active: true,
        },
      },
    },
    select: {
      id: true,
      company_id: true,
      full_name: true,
      date_of_birth: true,
      profile_picture_url: true,
      employments: {
        where: { is_active: true },
        select: {
          jobTitle: { select: { title: true } },
          department: { select: { name: true } },
        },
        take: 1,
      },
    },
  });

  const birthdayEmployees = employees.filter((emp) => {
    const dob = emp.date_of_birth;
    if (!dob) return false;
    const dobMonth = dob.getMonth() + 1;
    const dobDay = dob.getDate();
    return (
      (dobMonth === todayMonth && dobDay === todayDay) ||
      (dobMonth === tomorrowMonth && dobDay === tomorrowDay)
    );
  });

  const celebrations = [];

  for (const emp of birthdayEmployees) {
    const dob = emp.date_of_birth!;
    const dobMonth = dob.getMonth() + 1;
    const dobDay = dob.getDate();
    const isTomorrow = dobMonth === tomorrowMonth && dobDay === tomorrowDay;

    const targetDate = isTomorrow ? tomorrow : today;
    const celebrationDate = new Date(Date.UTC(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
    ));

    const zodiacInfo = getZodiacSign(dob);
    const age = calculateAge(dob);

    const details = {
      zodiacSign: zodiacInfo.sign,
      zodiacSymbol: zodiacInfo.symbol,
      horoscope: zodiacInfo.horoscope,
      age: isTomorrow ? age + 1 : age,
    } as Prisma.InputJsonValue;

    // Upsert celebration record
    const celebration = await prisma.celebration.upsert({
      where: {
        employee_id_company_id_type_celebration_date: {
          employee_id: emp.id,
          company_id: emp.company_id,
          type: CelebrationType.BIRTHDAY,
          celebration_date: celebrationDate,
        },
      },
      update: {
        details,
        is_active: true,
      },
      create: {
        employee_id: emp.id,
        company_id: emp.company_id,
        type: CelebrationType.BIRTHDAY,
        visibility: CelebrationVisibility.PUBLIC,
        celebration_date: celebrationDate,
        details,
      },
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
            profile_picture_url: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    celebrations.push(celebration);
  }

  return celebrations;
}

/**
 * Detect today's work anniversaries
 */
export async function detectTodaysAnniversaries(companyId: number) {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  // Find active employments with start_date matching today's month/day
  const employments = await prisma.employment.findMany({
    where: {
      company_id: companyId,
      is_active: true,
      employee: {
        appUsers: {
          none: {
            role: {
              name: {
                in: [RoleNames.ADMIN, RoleNames.SUPERADMIN],
              },
            },
          },
        },
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          full_name: true,
          profile_picture_url: true,
        },
      },
      jobTitle: true,
      department: true,
    },
  });

  const anniversaryEmployees = employments.filter((emp) => {
    const startDate = emp.start_date;
    return startDate.getMonth() + 1 === month && startDate.getDate() === day;
  });

  const celebrations = [];

  for (const emp of anniversaryEmployees) {
    const yearsOfService = calculateYearsOfService(emp.start_date);

    // Only celebrate if at least 1 year and milestone anniversary (every 5 years)
    if (yearsOfService < 1 || !isMilestoneAnniversary(yearsOfService)) {
      continue;
    }

    const details = {
      yearsOfService,
    } as Prisma.InputJsonValue;

    const celebration = await prisma.celebration.upsert({
      where: {
        employee_id_company_id_type_celebration_date: {
          employee_id: emp.employee_id,
          company_id: emp.company_id,
          type: CelebrationType.ANNIVERSARY,
          celebration_date: new Date(Date.UTC(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
          )),
        },
      },
      update: {
        details,
        is_active: true,
      },
      create: {
        employee_id: emp.employee_id,
        company_id: emp.company_id,
        type: CelebrationType.ANNIVERSARY,
        visibility: CelebrationVisibility.PRIVATE, // Only visible to the employee
        celebration_date: new Date(Date.UTC(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
        )),
        details,
      },
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
            profile_picture_url: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    celebrations.push(celebration);
  }

  return celebrations;
}

/**
 * Create a promotion celebration
 */
export async function createPromotionCelebration(
  employeeId: string,
  companyId: number,
  previousPosition: string,
  newPosition: string,
) {
  const today = new Date();

  const details = {
    previousPosition,
    newPosition,
  } as Prisma.InputJsonValue;

  const celebration = await prisma.celebration.upsert({
    where: {
      employee_id_company_id_type_celebration_date: {
        employee_id: employeeId,
        company_id: companyId,
        type: CelebrationType.PROMOTION,
        celebration_date: new Date(Date.UTC(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
        )),
      },
    },
    update: {
      details,
      is_active: true,
      // If a promotion is updated/re-triggered on the same day, reset previous
      // interactions so the new promotion is visible again to everyone.
      messages: {
        deleteMany: {},
      },
      dismissals: {
        deleteMany: {},
      },
    },
    create: {
      employee_id: employeeId,
      company_id: companyId,
      type: CelebrationType.PROMOTION,
      visibility: CelebrationVisibility.PUBLIC,
      celebration_date: new Date(Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      )),
      details,
    },
    include: {
      employee: {
        select: {
          id: true,
          full_name: true,
          profile_picture_url: true,
          employments: {
            where: { is_active: true },
            select: {
              jobTitle: { select: { title: true } },
              department: { select: { name: true } },
            },
          },
        },
      },
      messages: {
        include: {
          sender: {
            select: {
              id: true,
              full_name: true,
              profile_picture_url: true,
              employments: {
                where: { is_active: true },
                select: {
                  jobTitle: { select: { title: true } },
                },
              },
            },
          },
        },
      },
      dismissals: true,
      _count: {
        select: { messages: true },
      },
    },
  });

  return celebration;
}

/**
 * Get all active celebrations for a company
 */
export async function getActiveCelebrations(companyId: number, userId: string) {
  const today = new Date();
  const startOfToday = new Date(Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ));

  // Handle timezone differences and lingering celebrations
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);

  // Include tomorrow's celebrations
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfToday.getDate() + 1);

  const celebrations = await prisma.celebration.findMany({
    where: {
      company_id: companyId,
      celebration_date: {
        gte: startOfYesterday,
        lte: startOfTomorrow,
      },
      is_active: true,
    },
    include: {
      employee: {
        select: {
          id: true,
          full_name: true,
          profile_picture_url: true,
          employments: {
            where: { is_active: true },
            select: {
              jobTitle: { select: { title: true } },
              department: { select: { name: true } },
            },
            take: 1,
          },
        },
      },
      messages: {
        orderBy: { created_at: "desc" },
        take: 10,
        include: {
          sender: {
            select: {
              id: true,
              full_name: true,
              profile_picture_url: true,
              employments: {
                where: { is_active: true },
                select: {
                  jobTitle: { select: { title: true } },
                },
                take: 1,
              },
            },
          },
        },
      },
      dismissals: {
        where: { user_id: userId },
      },
      _count: {
        select: { messages: true },
      },
    },
    orderBy: { created_at: "desc" },
  });

  // Apply visibility rules
  return celebrations.filter((celebration) => {
    // Check if dismissed by current user
    const isDismissed = celebration.dismissals.length > 0;
    if (isDismissed) return false;

    if (celebration.visibility === CelebrationVisibility.PUBLIC) {
      // Public celebrations: show to everyone (including the celebrating employee)
      return true;
    } else {
      // Private celebrations: show ONLY to the celebrating employee
      return celebration.employee_id === userId;
    }
  });
}

/**
 * Get a specific celebration by ID
 */
export async function getCelebrationById(
  celebrationId: number,
  companyId: number,
) {
  return prisma.celebration.findFirst({
    where: {
      id: celebrationId,
      company_id: companyId,
    },
    include: {
      employee: {
        select: {
          id: true,
          full_name: true,
          profile_picture_url: true,
          employments: {
            where: { is_active: true },
            select: {
              jobTitle: { select: { title: true } },
              department: { select: { name: true } },
            },
            take: 1,
          },
        },
      },
      messages: {
        orderBy: { created_at: "desc" },
        include: {
          sender: {
            select: {
              id: true,
              full_name: true,
              profile_picture_url: true,
              employments: {
                where: { is_active: true },
                select: {
                  jobTitle: { select: { title: true } },
                },
                take: 1,
              },
            },
          },
        },
      },
      _count: {
        select: { messages: true },
      },
    },
  });
}

/**
 * Send a message to a celebration
 */
export async function sendCelebrationMessage(
  celebrationId: number,
  senderId: string,
  companyId: number,
  message: string,
  isReaction: boolean = false,
  reactionType?: string,
) {
  return prisma.celebrationMessage.create({
    data: {
      celebration_id: celebrationId,
      sender_id: senderId,
      company_id: companyId,
      message,
      is_reaction: isReaction,
      reaction_type: reactionType,
    },
    include: {
      sender: {
        select: {
          id: true,
          full_name: true,
          profile_picture_url: true,
          employments: {
            where: { is_active: true },
            select: {
              jobTitle: { select: { title: true } },
            },
            take: 1,
          },
        },
      },
    },
  });
}

/**
 * Dismiss a celebration for a user
 */
export async function dismissCelebration(
  celebrationId: number,
  userId: string,
  companyId: number,
) {
  return prisma.celebrationDismissal.upsert({
    where: {
      celebration_id_user_id: {
        celebration_id: celebrationId,
        user_id: userId,
      },
    },
    update: {
      dismissed_at: new Date(),
    },
    create: {
      celebration_id: celebrationId,
      user_id: userId,
      company_id: companyId,
    },
  });
}

/**
 * Run celebration detection for a company (called daily by cron or on demand)
 */
export async function runCelebrationDetection(companyId: number) {
  const birthdays = await detectTodaysBirthdays(companyId);
  const anniversaries = await detectTodaysAnniversaries(companyId);

  return {
    birthdays,
    anniversaries,
    total: birthdays.length + anniversaries.length,
  };
}
