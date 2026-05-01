import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { redisService } from "src/services/redisService";

/**
 * Get all public holidays for the company
 */
export const getAllPublicHolidays = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    const holidays = await prisma.publicHoliday.findMany({
      where: {
        company_id: companyId,
        OR: [
          // Recurring holidays
          { is_recurring: true },
          // Non-recurring holidays for the specified year
          {
            is_recurring: false,
            holiday_date: {
              gte: new Date(year, 0, 1),
              lte: new Date(year, 11, 31),
            },
          },
        ],
      },
      orderBy: { holiday_date: "asc" },
    });

    // For recurring holidays, adjust the year for display
    const adjustedHolidays = holidays.map((h) => {
      if (h.is_recurring) {
        const date = new Date(h.holiday_date);
        return {
          ...h,
          holiday_date: new Date(year, date.getMonth(), date.getDate()),
        };
      }
      return h;
    });

    // Sort by adjusted date
    adjustedHolidays.sort(
      (a, b) => new Date(a.holiday_date).getTime() - new Date(b.holiday_date).getTime()
    );

    res.status(200).json({
      status: "success",
      message: "Public holidays fetched successfully",
      data: {
        year,
        holidays: adjustedHolidays,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single public holiday by ID
 */
export const getPublicHolidayById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const holiday = await prisma.publicHoliday.findFirst({
      where: {
        id: Number(id),
        company_id: companyId,
      },
    });

    if (!holiday) {
      return res.status(404).json({
        status: "fail",
        message: "Public holiday not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Public holiday fetched successfully",
      data: { holiday },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new public holiday
 */
export const createPublicHoliday = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { name, holiday_date, is_recurring } = req.body;

    // Validation
    if (!name || !holiday_date) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide name and holiday_date",
      });
    }

    // Parse date ensuring we get the correct date regardless of timezone
    let parsedDate: Date;
    const dateStr = String(holiday_date);
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Date-only format: parse as local date at midnight
      const [year, month, day] = dateStr.split("-").map(Number);
      parsedDate = new Date(year, month - 1, day);
    } else {
      // Full ISO string or other format
      parsedDate = new Date(holiday_date);
    }

    const holiday = await prisma.publicHoliday.create({
      data: {
        company_id: companyId,
        name,
        holiday_date: parsedDate,
        is_recurring: is_recurring ?? true,
      },
    });

    // Invalidate Cache
    const patterns = [
      `company:${companyId}:leave_list:*`,
      `company:${companyId}:leave_stats:*`,
      `company:${companyId}:leave_my:*`,
      `company:${companyId}:analytics:*`,
      `company:${companyId}:team_leave:*`,
      `company:${companyId}:leave_balance_list:*`,
      `company:${companyId}:leave_balance_my:*`,
    ];
    Promise.all(patterns.map(p => redisService.delByPattern(p))).catch(console.error);

    res.status(201).json({
      status: "success",
      message: "Public holiday created successfully",
      data: { holiday },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a public holiday
 */
export const updatePublicHoliday = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    // Check if holiday exists
    const existingHoliday = await prisma.publicHoliday.findFirst({
      where: {
        id: Number(id),
        company_id: companyId,
      },
    });

    if (!existingHoliday) {
      return res.status(404).json({
        status: "fail",
        message: "Public holiday not found",
      });
    }

    const { name, holiday_date, is_recurring } = req.body;

    // Build update data
    const updateData: any = {};

    if (name !== undefined && name !== null) {
      updateData.name = name;
    }

    if (holiday_date !== undefined && holiday_date !== null && holiday_date !== "") {
      // Parse date ensuring we get the correct date regardless of timezone
      // If it's already a Date string like "2024-09-11", parse it as UTC to avoid timezone shifts
      const dateStr = String(holiday_date);
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Date-only format: parse as local date at midnight
        const [year, month, day] = dateStr.split("-").map(Number);
        updateData.holiday_date = new Date(year, month - 1, day);
      } else {
        // Full ISO string or other format
        updateData.holiday_date = new Date(holiday_date);
      }
    }

    if (is_recurring !== undefined) {
      updateData.is_recurring = is_recurring;
    }

    const holiday = await prisma.publicHoliday.update({
      where: { id: Number(id) },
      data: updateData,
    });

    // Invalidate Cache
    const patterns = [
      `company:${companyId}:leave_list:*`,
      `company:${companyId}:leave_stats:*`,
      `company:${companyId}:leave_my:*`,
      `company:${companyId}:analytics:*`,
      `company:${companyId}:team_leave:*`,
      `company:${companyId}:leave_balance_list:*`,
      `company:${companyId}:leave_balance_my:*`,
    ];
    Promise.all(patterns.map(p => redisService.delByPattern(p))).catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Public holiday updated successfully",
      data: { holiday },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a public holiday
 */
export const deletePublicHoliday = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    // Check if holiday exists
    const existingHoliday = await prisma.publicHoliday.findFirst({
      where: {
        id: Number(id),
        company_id: companyId,
      },
    });

    if (!existingHoliday) {
      return res.status(404).json({
        status: "fail",
        message: "Public holiday not found",
      });
    }

    await prisma.publicHoliday.delete({
      where: { id: Number(id) },
    });

    // Invalidate Cache
    const patterns = [
      `company:${companyId}:leave_list:*`,
      `company:${companyId}:leave_stats:*`,
      `company:${companyId}:leave_my:*`,
      `company:${companyId}:analytics:*`,
      `company:${companyId}:team_leave:*`,
      `company:${companyId}:leave_balance_list:*`,
      `company:${companyId}:leave_balance_my:*`,
    ];
    Promise.all(patterns.map(p => redisService.delByPattern(p))).catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Public holiday deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seed default Ethiopian public holidays
 */
export const seedDefaultHolidays = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    // Check if holidays already exist
    const existingCount = await prisma.publicHoliday.count({
      where: { company_id: companyId },
    });

    if (existingCount > 0) {
      return res.status(400).json({
        status: "fail",
        message: "Public holidays already exist for this company",
      });
    }

    // Ethiopian public holidays (approximate dates - some are based on Ethiopian calendar)
    const defaultHolidays = [
      // Fixed holidays
      { name: "Ethiopian New Year (Enkutatash)", date: "2024-09-11", recurring: true },
      { name: "Finding of the True Cross (Meskel)", date: "2024-09-27", recurring: true },
      { name: "Victory of Adwa", date: "2024-03-02", recurring: true },
      { name: "Ethiopian Patriots' Victory Day", date: "2024-05-05", recurring: true },
      { name: "International Labour Day", date: "2024-05-01", recurring: true },
      { name: "Downfall of the Derg", date: "2024-05-28", recurring: true },

      // Religious holidays (dates vary)
      { name: "Ethiopian Christmas (Genna)", date: "2024-01-07", recurring: true },
      { name: "Ethiopian Epiphany (Timkat)", date: "2024-01-19", recurring: true },

      // Islamic holidays (dates based on lunar calendar - these are approximate)
      { name: "Eid al-Fitr", date: "2024-04-10", recurring: false },
      { name: "Eid al-Adha", date: "2024-06-17", recurring: false },
      { name: "Mawlid (Prophet's Birthday)", date: "2024-09-15", recurring: false },

      // Good Friday and Easter (dates vary)
      { name: "Ethiopian Good Friday", date: "2024-05-03", recurring: false },
      { name: "Ethiopian Easter", date: "2024-05-05", recurring: false },
    ];

    const holidays = await prisma.publicHoliday.createMany({
      data: defaultHolidays.map((h) => ({
        company_id: companyId,
        name: h.name,
        holiday_date: new Date(h.date),
        is_recurring: h.recurring,
      })),
    });

    // Invalidate Cache
    const patterns = [
      `company:${companyId}:leave_list:*`,
      `company:${companyId}:leave_stats:*`,
      `company:${companyId}:leave_my:*`,
      `company:${companyId}:analytics:*`,
      `company:${companyId}:team_leave:*`,
      `company:${companyId}:leave_balance_list:*`,
      `company:${companyId}:leave_balance_my:*`,
    ];
    Promise.all(patterns.map(p => redisService.delByPattern(p))).catch(console.error);

    res.status(201).json({
      status: "success",
      message: `${holidays.count} default Ethiopian public holidays created successfully`,
      data: { count: holidays.count },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get upcoming holidays
 */
export const getUpcomingHolidays = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const limit = parseInt(req.query.limit as string) || 5;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentYear = today.getFullYear();

    // Get all holidays
    const holidays = await prisma.publicHoliday.findMany({
      where: {
        company_id: companyId,
      },
    });

    // Adjust dates for recurring holidays and filter upcoming
    const upcomingHolidays = holidays
      .map((h) => {
        if (h.is_recurring) {
          const date = new Date(h.holiday_date);
          let adjustedDate = new Date(currentYear, date.getMonth(), date.getDate());

          // If the date this year has passed, use next year
          if (adjustedDate < today) {
            adjustedDate = new Date(currentYear + 1, date.getMonth(), date.getDate());
          }

          return {
            ...h,
            holiday_date: adjustedDate,
          };
        }
        return h;
      })
      .filter((h) => new Date(h.holiday_date) >= today)
      .sort((a, b) => new Date(a.holiday_date).getTime() - new Date(b.holiday_date).getTime())
      .slice(0, limit);

    res.status(200).json({
      status: "success",
      message: "Upcoming holidays fetched successfully",
      data: { holidays: upcomingHolidays },
    });
  } catch (error) {
    next(error);
  }
};

