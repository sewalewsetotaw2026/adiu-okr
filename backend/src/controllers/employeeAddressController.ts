import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";

import { redisService } from "src/services/redisService";

export const fetchAllAddresses = async (
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

    const addresses = await prisma.employeeAddress.findMany({
      where: {
        employee_id: employeeId,
      },
      orderBy: { id: "asc" },
    });

    res.status(200).json({
      status: "success",
      message: "Addresses fetched successfully",
      data: {
        addresses,
        total: addresses.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const fetchAddress = async (
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

    const address = await prisma.employeeAddress.findUnique({
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

    if (!address) {
      return res.status(404).json({
        status: "fail",
        message: "Address not found",
      });
    }

    // verify address belongs to employee in user company
    if (address.employee?.company_id !== companyId) {
      return res.status(403).json({
        status: "fail",
        message: "Access denied",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Address fetched successfully",
      data: { address },
    });
  } catch (error) {
    next(error);
  }
};

export const createAddress = async (
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

    const { employee_id, region, city, sub_city, woreda } = req.body;

    // validation
    if (!employee_id) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide employee_id",
      });
    }

    // at least one address field should be provided
    if (!region && !city && !sub_city && !woreda) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide at least one address field",
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

    const newAddress = await prisma.employeeAddress.create({
      data: {
        employee_id,
        region,
        city,
        sub_city,
        woreda,
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
      message: "Address created successfully",
      data: { address: newAddress },
    });
  } catch (error) {
    next(error);
  }
};

export const bulkCreateAddresses = async (
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

    // validate all items have at least one address field
    const invalidItems = items.filter(
      (item) => !item.region && !item.city && !item.sub_city && !item.woreda,
    );

    if (invalidItems.length > 0) {
      return res.status(400).json({
        status: "fail",
        message: "All items must have at least one address field",
      });
    }

    // create all addresses
    const addressesToCreate = items.map((item) => ({
      company_id: companyId,
      employee_id,
      region: item.region || null,
      city: item.city || null,
      sub_city: item.sub_city || null,
      woreda: item.woreda || null,
    }));

    const createdAddresses = await prisma.employeeAddress.createMany({
      data: addressesToCreate,
    });

    // fetch created addresses to return
    const addresses = await prisma.employeeAddress.findMany({
      where: { employee_id },
      orderBy: { id: "desc" },
      take: createdAddresses.count,
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
      message: `${createdAddresses.count} addresses created successfully`,
      data: {
        created: createdAddresses.count,
        addresses,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateAddress = async (
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

    const { region, city, sub_city, woreda } = req.body;

    // check if address exists
    const existingAddress = await prisma.employeeAddress.findUnique({
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

    if (!existingAddress) {
      return res.status(404).json({
        status: "fail",
        message: "Address not found",
      });
    }

    // verify address belongs to employee in user company
    if (existingAddress.employee?.company_id !== companyId) {
      return res.status(403).json({
        status: "fail",
        message: "Access denied",
      });
    }

    const updatedAddress = await prisma.employeeAddress.update({
      where: { id: parseInt(id) },
      data: {
        ...(region !== undefined && { region }),
        ...(city !== undefined && { city }),
        ...(sub_city !== undefined && { sub_city }),
        ...(woreda !== undefined && { woreda }),
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
      message: "Address updated successfully",
      data: { address: updatedAddress },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (
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

    // check if address exists
    const existingAddress = await prisma.employeeAddress.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: {
          select: {
            company_id: true,
          },
        },
      },
    });

    if (!existingAddress) {
      return res.status(404).json({
        status: "fail",
        message: "Address not found",
      });
    }

    // verify address belongs to employee in user company
    if (existingAddress.employee?.company_id !== companyId) {
      return res.status(403).json({
        status: "fail",
        message: "Access denied",
      });
    }

    await prisma.employeeAddress.delete({
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
      message: "Address deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteAddresses = async (
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

    // verify all addresses belong to employees in user company
    const addresses = await prisma.employeeAddress.findMany({
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

    const unauthorizedAddresses = addresses.filter(
      (address) => address.employee?.company_id !== companyId,
    );

    if (unauthorizedAddresses.length > 0) {
      return res.status(403).json({
        status: "fail",
        message: "Access denied for some addresses",
      });
    }

    const deletedAddresses = await prisma.employeeAddress.deleteMany({
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
      message: `${deletedAddresses.count} addresses deleted successfully`,
      data: {
        deleted: deletedAddresses.count,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const replaceEmployeeAddresses = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = (req as any).user?.company_id;
    if (!companyId) return res.status(400).json({ status: "fail", message: "Company ID missing" });

    const { addresses } = req.body;

    await prisma.$transaction(async (tx) => {
      if (addresses && Array.isArray(addresses)) {
        await tx.employeeAddress.deleteMany({ where: { employee_id: id } });

        const validAddresses = addresses.filter((addr: any) => addr.region || addr.city);

        if (validAddresses.length > 0) {
          await tx.employeeAddress.createMany({
            data: validAddresses.map((addr: any) => ({
              employee_id: id,
              company_id: companyId,
              region: addr.region || null,
              city: addr.city || null,
              sub_city: addr.subCity || addr.sub_city || null,
              woreda: addr.woreda || null
            }))
          });
        }
      }
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);

    res.status(200).json({ status: "success", message: "Addresses updated" });
  } catch (error) {
    next(error);
  }
};
