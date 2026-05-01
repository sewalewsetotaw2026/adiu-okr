import { Request, Response, NextFunction } from "express";
import prisma from "src/prisma";
import { redisService } from "src/services/redisService";

export const getContactInfo = async (
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
      where: { employee_id: employeeId },
      orderBy: { id: "asc" },
    });

    const phones = await prisma.employeePhone.findMany({
      where: { employee_id: employeeId },
      orderBy: [{ is_primary: "desc" }, { id: "asc" }],
    });

    const responseData = {
      addresses,
      phones,
    };

    // Filter using existing utility
    const { filterEmployeeSensitiveData } = require("../utils/permissionUtils");
    // We pass employeeId as a mock target to verify permissions for that specific employee
    const filteredData = await filterEmployeeSensitiveData(req.user, {
      id: employeeId,
      addresses,
      phones
    });

    res.status(200).json({
      status: "success",
      message: "Contact info fetched successfully",
      data: {
        addresses: filteredData.addresses,
        phones: filteredData.phones,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createContactInfo = async (
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

    const { employee_id, addresses, phones } = req.body;

    if (!employee_id) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide employee_id",
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

    const result = await prisma.$transaction(async (tx) => {
      let createdAddresses: any[] = [];
      let createdPhones: any[] = [];

      // Create Addresses
      if (addresses && Array.isArray(addresses) && addresses.length > 0) {
        const addressesToCreate = addresses.map((addr: any) => ({
          company_id: companyId,
          employee_id,
          region: addr.region || null,
          city: addr.city || null,
          sub_city: addr.sub_city || null,
          woreda: addr.woreda || null,
        }));
        await tx.employeeAddress.createMany({ data: addressesToCreate });
        createdAddresses = await tx.employeeAddress.findMany({
          where: { employee_id },
          orderBy: { id: "desc" },
          take: addresses.length,
        });
      }

      // Create Phones
      if (phones && Array.isArray(phones) && phones.length > 0) {
        // Check for primary phone in request
        const hasPrimary = phones.some((p: any) => p.is_primary);
        if (hasPrimary) {
          await tx.employeePhone.updateMany({
            where: { employee_id, is_primary: true },
            data: { is_primary: false },
          });
        }

        const phonesToCreate = phones.map((phone: any) => ({
          company_id: companyId,
          employee_id,
          phone_number: phone.phone_number,
          phone_type: phone.phone_type || "Private",
          is_primary: phone.is_primary || false,
        }));
        await tx.employeePhone.createMany({ data: phonesToCreate });
        createdPhones = await tx.employeePhone.findMany({
          where: { employee_id },
          orderBy: { id: "desc" },
          take: phones.length,
        });
      }

      return { createdAddresses, createdPhones };
    });

    // Invalidate Cache
    redisService
      .delByPattern(`company:${companyId}:employees:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:managers:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:teams:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:team_member:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:team_members_list:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:employees_search:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:analytics:*`)
      .catch(console.error);

    res.status(201).json({
      status: "success",
      message: "Contact info created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateContactInfo = async (
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

    const { addresses, phones, emergency_contacts } = req.body;

    // verify employee exists
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

    await prisma.$transaction(async (tx) => {
      // Handle Emergency Contacts
      // Since this is a full form update, we can replace the list to handle deletions/updates easily,
      // OR we can try to update in place. Replacing is safer for ensuring the list matches the form exactly.
      // Especially for 'is_primary' toggles.
      if (emergency_contacts && Array.isArray(emergency_contacts)) {
        // Check for primary
        const hasPrimary = emergency_contacts.some((c: any) => c.is_primary);

        // Strategy: Delete all for this employee and recreate. 
        // This matches the "replace" behavior often expected in these full-section forms 
        // (rendering the frontend state as the source of truth).
        await tx.emergencyContact.deleteMany({
          where: { employee_id: employeeId, company_id: companyId }
        });

        if (emergency_contacts.length > 0) {
          await tx.emergencyContact.createMany({
            data: emergency_contacts.map((contact: any) => ({
              employee_id: employeeId,
              company_id: companyId,
              full_name: contact.full_name || contact.fullName,
              relationship: contact.relationship,
              phone_number: contact.phone_number || contact.phoneNumber,
              email: contact.email,
              is_primary: contact.is_primary || false
            }))
          });
        }
      }

      // Handle Addresses
      if (addresses && Array.isArray(addresses)) {
        // 1. Identify IDs to keep
        const addressIdsToKeep = addresses
          .filter((a: any) => a.id)
          .map((a: any) => a.id);

        // 2. Delete addresses not in the list (optional, depending on requirement. 
        //    Usually "update contact info" implies "this is the new state". 
        //    But to be safe, maybe we only update/create provided ones. 
        //    However, for a full sync, we should delete missing ones.
        //    I'll assume we just update/create for now to avoid accidental data loss unless requested.)

        // Actually, let's just update existing and create new.

        for (const addr of addresses) {
          if (addr.id) {
            // Update
            await tx.employeeAddress.update({
              where: { id: addr.id },
              data: {
                region: addr.region,
                city: addr.city,
                sub_city: addr.sub_city,
                woreda: addr.woreda,
              },
            });
          } else {
            // Create
            await tx.employeeAddress.create({
              data: {
                company_id: companyId,
                employee_id: employeeId,
                region: addr.region,
                city: addr.city,
                sub_city: addr.sub_city,
                woreda: addr.woreda,
              },
            });
          }
        }
      }

      // Handle Phones
      if (phones && Array.isArray(phones)) {
        // Check if any new/updated phone is primary
        const hasPrimary = phones.some((p: any) => p.is_primary);
        if (hasPrimary) {
          // Unset all existing primary phones for this employee
          await tx.employeePhone.updateMany({
            where: { employee_id: employeeId, is_primary: true },
            data: { is_primary: false },
          });
        }

        for (const phone of phones) {
          if (phone.id) {
            // Update
            await tx.employeePhone.update({
              where: { id: phone.id },
              data: {
                phone_number: phone.phone_number,
                phone_type: phone.phone_type,
                is_primary: phone.is_primary,
              },
            });
          } else {
            // Create
            await tx.employeePhone.create({
              data: {
                company_id: companyId,
                employee_id: employeeId,
                phone_number: phone.phone_number,
                phone_type: phone.phone_type || "Private",
                is_primary: phone.is_primary || false,
              },
            });
          }
        }
      }
    });

    // Fetch updated data
    const updatedAddresses = await prisma.employeeAddress.findMany({
      where: { employee_id: employeeId },
      orderBy: { id: "asc" },
    });

    const updatedPhones = await prisma.employeePhone.findMany({
      where: { employee_id: employeeId },
      orderBy: [{ is_primary: "desc" }, { id: "asc" }],
    });

    const updatedEmergencyContacts = await prisma.emergencyContact.findMany({
      where: { employee_id: employeeId },
      orderBy: { created_at: "desc" }
    });

    // Invalidate Cache
    redisService
      .delByPattern(`company:${companyId}:employees:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:managers:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:teams:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:team_member:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:team_members_list:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:employees_search:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:analytics:*`)
      .catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Contact info updated successfully",
      data: {
        addresses: updatedAddresses,
        phones: updatedPhones,
        emergencyContacts: updatedEmergencyContacts
      },
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
    const invalidItems = items.filter((item: any) => !item.phone_number);
    if (invalidItems.length > 0) {
      return res.status(400).json({
        status: "fail",
        message: "All items must have phone_number",
      });
    }

    // check if any item is marked as primary
    const hasPrimary = items.some((item: any) => item.is_primary);
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
    const phonesToCreate = items.map((item: any) => ({
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
    redisService
      .delByPattern(`company:${companyId}:employees:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:managers:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:teams:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:team_member:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:team_members_list:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:employees_search:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:analytics:*`)
      .catch(console.error);

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
