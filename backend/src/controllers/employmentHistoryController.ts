import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { redisService } from "src/services/redisService";

export const fetchAllHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { employeeId } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId)
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });

    const employee = await prisma.employee.findUnique({
      where: { id_company_id: { id: employeeId, company_id: companyId } },
    });
    if (!employee)
      return res
        .status(404)
        .json({ status: "fail", message: "Employee not found" });

    const history = await prisma.employmentHistory.findMany({
      where: { employee_id: employeeId },
      include: { jobTitle: true },
      orderBy: { start_date: "desc" },
    });

    res.status(200).json({
      status: "success",
      message: "Employment history fetched successfully",
      data: { history, total: history.length },
    });
  } catch (error) {
    next(error);
  }
};

export const fetchHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId)
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });

    const history = await prisma.employmentHistory.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: { select: { id: true, full_name: true, company_id: true } },
        jobTitle: true,
      },
    });

    if (!history)
      return res
        .status(404)
        .json({ status: "fail", message: "Employment history not found" });
    if (history.employee?.company_id !== companyId)
      return res.status(403).json({ status: "fail", message: "Access denied" });

    res.status(200).json({
      status: "success",
      message: "Employment history fetched successfully",
      data: { history },
    });
  } catch (error) {
    next(error);
  }
};

export const createHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId)
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });

    const {
      employee_id,
      previous_company_name,
      job_title_id,

      previous_level,
      department_name,
      start_date,
      end_date,
      is_verified,
      notes,
      document_urls,
      employment_type,
    } = req.body;

    if (!employee_id || !previous_company_name || !start_date) {
      return res.status(400).json({
        status: "fail",
        message:
          "Please provide employee_id, previous_company_name, and start_date",
      });
    }

    const employee = await prisma.employee.findUnique({
      where: { id_company_id: { id: employee_id, company_id: companyId } },
    });
    if (!employee)
      return res
        .status(404)
        .json({ status: "fail", message: "Employee not found" });

    const newHistory = await prisma.employmentHistory.create({
      data: {
        employee_id,
        previous_company_name,
        job_title_id: job_title_id ? parseInt(job_title_id) : null,
        previous_level,
        department_name,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        document_urls: document_urls || [], // Handle document URLs
        is_verified,
        notes,
        employment_type: employment_type || null,
      },
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(201).json({
      status: "success",
      message: "Employment history created successfully",
      data: { history: newHistory },
    });
  } catch (error) {
    next(error);
  }
};

export const bulkCreateHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId)
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });

    const { employee_id, items } = req.body;
    if (!employee_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide employee_id and items array",
      });
    }

    const employee = await prisma.employee.findUnique({
      where: { id_company_id: { id: employee_id, company_id: companyId } },
    });
    if (!employee)
      return res
        .status(404)
        .json({ status: "fail", message: "Employee not found" });

    const invalidItems = items.filter(
      (item) => !item.previous_company_name || !item.start_date,
    );
    if (invalidItems.length > 0)
      return res.status(400).json({
        status: "fail",
        message: "All items must have previous_company_name and start_date",
      });

    const historyToCreate = items.map((item) => ({
      employee_id,
      previous_company_name: item.previous_company_name,
      job_title_id: item.job_title_id ? parseInt(item.job_title_id) : null,
      previous_job_title_text: item.previous_job_title_text || null,
      previous_level: item.previous_level || null,
      department_name: item.department_name || null,
      start_date: new Date(item.start_date),
      end_date: item.end_date ? new Date(item.end_date) : null,
      is_verified: item.is_verified || false,
      notes: item.notes || null,
      employment_type: item.employment_type || null,
    }));

    const createdHistory = await prisma.employmentHistory.createMany({
      data: historyToCreate,
    });
    const history = await prisma.employmentHistory.findMany({
      where: { employee_id },
      orderBy: { id: "desc" },
      take: createdHistory.count,
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(201).json({
      status: "success",
      message: `${createdHistory.count} employment history records created successfully`,
      data: { created: createdHistory.count, history },
    });
  } catch (error) {
    next(error);
  }
};

export const updateHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId)
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });

    const existingHistory = await prisma.employmentHistory.findUnique({
      where: { id: parseInt(id) },
      include: { employee: { select: { company_id: true } } },
    });

    if (!existingHistory)
      return res
        .status(404)
        .json({ status: "fail", message: "Employment history not found" });
    if (existingHistory.employee?.company_id !== companyId)
      return res.status(403).json({ status: "fail", message: "Access denied" });

    const {
      previous_company_name,
      job_title_id,

      previous_level,
      department_name,
      start_date,
      end_date,
      is_verified,
      notes,
      employment_type,
    } = req.body;

    const updatedHistory = await prisma.employmentHistory.update({
      where: { id: parseInt(id) },
      data: {
        ...(previous_company_name && { previous_company_name }),
        ...(job_title_id !== undefined && {
          job_title_id: job_title_id ? parseInt(job_title_id) : null,
        }),
        ...(previous_level !== undefined && { previous_level }),
        ...(department_name !== undefined && { department_name }),
        ...(start_date && { start_date: new Date(start_date) }),
        ...(end_date !== undefined && {
          end_date: end_date ? new Date(end_date) : null,
        }),
        ...(is_verified !== undefined && { is_verified }),
        ...(notes !== undefined && { notes }),
        ...(employment_type !== undefined && { employment_type }),
      },
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Employment history updated successfully",
      data: { history: updatedHistory },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId)
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });

    const existingHistory = await prisma.employmentHistory.findUnique({
      where: { id: parseInt(id) },
      include: { employee: { select: { company_id: true } } },
    });

    if (!existingHistory)
      return res
        .status(404)
        .json({ status: "fail", message: "Employment history not found" });
    if (existingHistory.employee?.company_id !== companyId)
      return res.status(403).json({ status: "fail", message: "Access denied" });

    await prisma.employmentHistory.delete({ where: { id: parseInt(id) } });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Employment history deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId)
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });

    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0)
      return res
        .status(400)
        .json({ status: "fail", message: "Please provide ids array" });

    const history = await prisma.employmentHistory.findMany({
      where: { id: { in: ids.map((id) => parseInt(id)) } },
      include: { employee: { select: { company_id: true } } },
    });

    const unauthorizedHistory = history.filter(
      (h) => h.employee?.company_id !== companyId,
    );
    if (unauthorizedHistory.length > 0)
      return res.status(403).json({
        status: "fail",
        message: "Access denied for some employment history records",
      });

    const deletedHistory = await prisma.employmentHistory.deleteMany({
      where: { id: { in: ids.map((id) => parseInt(id)) } },
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: `${deletedHistory.count} employment history records deleted successfully`,
      data: { deleted: deletedHistory.count },
    });
  } catch (error) {
    next(error);
  }
};

export const replaceEmployeeEmploymentHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = (req as any).user?.company_id;
    if (!companyId)
      return res
        .status(400)
        .json({ status: "fail", message: "Company ID missing" });

    const { workExperience } = req.body;

    await prisma.$transaction(async (tx) => {
      if (workExperience && Array.isArray(workExperience)) {
        await tx.employmentHistory.deleteMany({ where: { employee_id: id } });

        for (const exp of workExperience) {
          const startDate = exp.startDate || exp.start_date;
          const endDate = exp.endDate || exp.end_date;

          // Resolve Job Title ID
          let jobTitleId: number | null = null;
          // Frontend sends 'jobTitle' or 'job_title' as text
          const titleName = exp.jobTitle || exp.job_title || exp.position;

          if (titleName) {
            // Find existing title in company
            const existingTitle = await tx.jobTitle.findFirst({
              where: {
                company_id: companyId,
                title: { equals: String(titleName).trim(), mode: "insensitive" },
              },
            });

            if (existingTitle) {
              jobTitleId = existingTitle.id;
            } else {
              // Create new Job Title if not found (matching onboarding logic)
              const newTitle = await tx.jobTitle.create({
                data: {
                  company_id: companyId,
                  title: String(titleName).trim(),
                  // level can be updated separately if needed, but here we just need name
                },
              });
              jobTitleId = newTitle.id;
            }
          }

          // Validate Start Date
          const validStartDate = startDate ? new Date(startDate) : new Date();
          if (isNaN(validStartDate.getTime())) continue; // Skip invalid dates

          const validEndDate = endDate ? new Date(endDate) : null;

          await tx.employmentHistory.create({
            data: {
              employee_id: id,
              previous_company_name: exp.companyName || exp.company_name || "",
              job_title_id: jobTitleId,
              // previous_job_title_text removed as it's not in schema
              previous_level: exp.level || exp.job_level || "",
              department_name: exp.department || "",
              employment_type:
                exp.employmentType || exp.employment_type || "Full Time",
              start_date: validStartDate,
              end_date: validEndDate && !isNaN(validEndDate.getTime()) ? validEndDate : null,
              is_verified: !!(exp.isVerified || exp.is_verified),
              notes: exp.notes || null,
              document_urls: exp.documentUrls || exp.document_urls || [],
            },
          });
        }
      }
    });



    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);

    res
      .status(200)
      .json({ status: "success", message: "Work experience updated" });
  } catch (error) {
    next(error);
  }
};
