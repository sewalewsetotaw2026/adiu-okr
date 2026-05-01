import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { redisService } from "src/services/redisService";

export const fetchAllPhones = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { employeeId } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    // verify employee exists and belongs to company
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: employeeId,
          company_id: companyId,
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    const phones = await prisma.employeePhone.findMany({
      where: {
        employee_id: employeeId,
      },
      orderBy: [{ is_primary: "desc" }, { id: "asc" }],
    });

    res.status(200).json({
      status: "success",
      message: "Phone numbers fetched successfully",
      data: {
        phones,
        total: phones.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const fetchPhone = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

    const phone = await prisma.employeePhone.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
            company_id: true,
          },
        },
      },
    });

    if (!phone) {
      return res.status(404).json({
        status: "fail",
        message: "Phone number not found",
      });
    }

    // verify phone belongs to employee in user company
    if (phone.employee?.company_id !== companyId) {
      return res.status(403).json({
        status: "fail",
        message: "Access denied",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Phone number fetched successfully",
      data: { phone },
    });
  } catch (error) {
    next(error);
  }
};

export const createPhone = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { employee_id, phone_number, phone_type, is_primary } = req.body;

    // validation
    if (!employee_id || !phone_number) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide employee_id and phone_number",
      });
    }

    // verify employee exists
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: employee_id,
          company_id: companyId,
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    // if setting as primary unset other primary phones
    if (is_primary) {
      await prisma.employeePhone.updateMany({
        where: {
          employee_id: employee_id,
          is_primary: true,
        },
        data: {
          is_primary: false,
        },
      });
    }

    const newPhone = await prisma.employeePhone.create({
      data: {
        employee_id,
        phone_number,
        phone_type: phone_type || "Private",
        is_primary: is_primary || false,
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
      message: "Phone number created successfully",
      data: { phone: newPhone },
    });
  } catch (error) {
    next(error);
  }
};

export const bulkCreatePhones = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { employee_id, items } = req.body;

    // validation
    if (!employee_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide employee_id and items array",
      });
    }

    // verify employee exists
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: employee_id,
          company_id: companyId,
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    // validate all items have phone_number
    const invalidItems = items.filter((item) => !item.phone_number);
    if (invalidItems.length > 0) {
      return res.status(400).json({
        status: "fail",
        message: "All items must have phone_number",
      });
    }

    // check if any item is marked as primary
    const hasPrimary = items.some((item) => item.is_primary);
    if (hasPrimary) {
      // Unset existing primary phones
      await prisma.employeePhone.updateMany({
        where: {
          employee_id: employee_id,
          is_primary: true,
        },
        data: {
          is_primary: false,
        },
      });
    }

    // create all phones
    const phonesToCreate = items.map((item) => ({
      company_id: companyId,
      employee_id,
      phone_number: item.phone_number,
      phone_type: item.phone_type || "Private",
      is_primary: item.is_primary || false,
    }));

    const createdPhones = await prisma.employeePhone.createMany({
      data: phonesToCreate,
    });

    // fetch created phones to return
    const phones = await prisma.employeePhone.findMany({
      where: { employee_id },
      orderBy: [{ is_primary: "desc" }, { id: "desc" }],
      take: createdPhones.count,
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
      message: `${createdPhones.count} phone numbers created successfully`,
      data: {
        created: createdPhones.count,
        phones,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePhone = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

    const { phone_number, phone_type, is_primary } = req.body;

    // check if phone exists
    const existingPhone = await prisma.employeePhone.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: {
          select: {
            id: true,
            company_id: true,
          },
        },
      },
    });

    if (!existingPhone) {
      return res.status(404).json({
        status: "fail",
        message: "Phone number not found",
      });
    }

    // verify phone belongs to employee in user's company
    if (existingPhone.employee?.company_id !== companyId) {
      return res.status(403).json({
        status: "fail",
        message: "Access denied",
      });
    }

    // if setting as primary unset other primary phones
    if (is_primary && !existingPhone.is_primary) {
      await prisma.employeePhone.updateMany({
        where: {
          employee_id: existingPhone.employee_id!,
          is_primary: true,
        },
        data: {
          is_primary: false,
        },
      });
    }

    const updatedPhone = await prisma.employeePhone.update({
      where: { id: parseInt(id) },
      data: {
        ...(phone_number && { phone_number }),
        ...(phone_type && { phone_type }),
        ...(is_primary !== undefined && { is_primary }),
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
      message: "Phone number updated successfully",
      data: { phone: updatedPhone },
    });
  } catch (error) {
    next(error);
  }
};

export const deletePhone = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

    // check if phone exists
    const existingPhone = await prisma.employeePhone.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: {
          select: {
            company_id: true,
          },
        },
      },
    });

    if (!existingPhone) {
      return res.status(404).json({
        status: "fail",
        message: "Phone number not found",
      });
    }

    // verify phone belongs to employee in user company
    if (existingPhone.employee?.company_id !== companyId) {
      return res.status(403).json({
        status: "fail",
        message: "Access denied",
      });
    }

    await prisma.employeePhone.delete({
      where: { id: parseInt(id) },
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
      message: "Phone number deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const bulkDeletePhones = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { ids } = req.body;

    // validation
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide ids array",
      });
    }

    // verify all phones belong to employees in user company
    const phones = await prisma.employeePhone.findMany({
      where: {
        id: { in: ids.map((id) => parseInt(id)) },
      },
      include: {
        employee: {
          select: {
            company_id: true,
          },
        },
      },
    });

    const unauthorizedPhones = phones.filter(
      (phone) => phone.employee?.company_id !== companyId,
    );

    if (unauthorizedPhones.length > 0) {
      return res.status(403).json({
        status: "fail",
        message: "Access denied for some phone numbers",
      });
    }

    const deletedPhones = await prisma.employeePhone.deleteMany({
      where: {
        id: { in: ids.map((id) => parseInt(id)) },
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
      message: `${deletedPhones.count} phone numbers deleted successfully`,
      data: {
        deleted: deletedPhones.count,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const replaceEmployeePhones = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = (req as any).user?.company_id;
    if (!companyId) return res.status(400).json({ status: "fail", message: "Company ID missing" });

    const { phones } = req.body;

    await prisma.$transaction(async (tx) => {
      if (phones && Array.isArray(phones)) {
        await tx.employeePhone.deleteMany({ where: { employee_id: id } });

        const validPhones = phones.filter((p: any) => p.phoneNumber || p.phone_number);

        if (validPhones.length > 0) {
          await tx.employeePhone.createMany({
            data: validPhones.map((p: any) => ({
              employee_id: id,
              company_id: companyId,
              phone_number: p.phoneNumber || p.phone_number,
              phone_type: p.phoneType || p.phone_type || "Private",
              is_primary: !!(p.isPrimary || p.is_primary)
            }))
          });
        }
      }
    });




    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);

    res.status(200).json({ status: "success", message: "Phones updated" });
  } catch (error) {
    next(error);
  }
};
