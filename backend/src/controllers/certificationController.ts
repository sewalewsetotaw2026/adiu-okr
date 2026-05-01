import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { redisService } from "src/services/redisService";

export const fetchAllCertifications = async (
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

    const certifications =
      await prisma.employeeLicensesAndCertifications.findMany({
        where: {
          employee_id: employeeId,
        },
        orderBy: { issue_date: "desc" },
      });

    res.status(200).json({
      status: "success",
      message: "Certifications fetched successfully",
      data: {
        certifications,
        total: certifications.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const fetchCertification = async (
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

    const certification =
      await prisma.employeeLicensesAndCertifications.findUnique({
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

    if (!certification) {
      return res.status(404).json({
        status: "fail",
        message: "Certification not found",
      });
    }

    // verify certification belongs to employee in user's company
    if (certification.employee?.company_id !== companyId) {
      return res.status(403).json({
        status: "fail",
        message: "Access denied",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Certification fetched successfully",
      data: { certification },
    });
  } catch (error) {
    next(error);
  }
};

export const createCertification = async (
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

    const {
      employee_id,
      name,
      issuing_organization,
      issue_date,
      expiration_date,
      credential_id,
      credential_url,
      document_urls,
    } = req.body;

    // validation
    if (!employee_id || !name) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide employee_id and name",
      });
    }

    // date validation
    if (issue_date && expiration_date) {
      const issueDate = new Date(issue_date);
      const expirationDate = new Date(expiration_date);
      if (issueDate >= expirationDate) {
        return res.status(400).json({
          status: "fail",
          message: "Issue date must be before expiration date",
        });
      }
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

    const newCertification =
      await prisma.employeeLicensesAndCertifications.create({
        data: {
          employee_id,
          name,
          issuing_organization,
          issue_date: issue_date ? new Date(issue_date) : null,
          expiration_date: expiration_date ? new Date(expiration_date) : null,
          credential_id,
          credential_url,
          document_urls: document_urls || [],
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
      message: "Certification created successfully",
      data: { certification: newCertification },
    });
  } catch (error) {
    next(error);
  }
};

export const bulkCreateCertifications = async (
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

    // validate all items have name
    const invalidItems = items.filter((item) => !item.name);
    if (invalidItems.length > 0) {
      return res.status(400).json({
        status: "fail",
        message: "All items must have name",
      });
    }

    // create all certifications
    const certificationsToCreate = items.map((item) => ({
      employee_id,
      name: item.name,
      issuing_organization: item.issuing_organization || null,
      issue_date: item.issue_date ? new Date(item.issue_date) : null,
      expiration_date: item.expiration_date
        ? new Date(item.expiration_date)
        : null,
      credential_id: item.credential_id || null,
      credential_url: item.credential_url || null,
      document_urls: item.document_urls || item.certificateDocument || [],
    }));

    const createdCertifications =
      await prisma.employeeLicensesAndCertifications.createMany({
        data: certificationsToCreate,
      });

    // fetch created certifications to return
    const certifications =
      await prisma.employeeLicensesAndCertifications.findMany({
        where: { employee_id },
        orderBy: { id: "desc" },
        take: createdCertifications.count,
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
      message: `${createdCertifications.count} certifications created successfully`,
      data: {
        created: createdCertifications.count,
        certifications,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCertification = async (
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

    const {
      name,
      issuing_organization,
      issue_date,
      expiration_date,
      credential_id,
      credential_url,
      document_urls,
    } = req.body;

    // check if certification exists
    const existingCertification =
      await prisma.employeeLicensesAndCertifications.findUnique({
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

    if (!existingCertification) {
      return res.status(404).json({
        status: "fail",
        message: "Certification not found",
      });
    }

    // verify certification belongs to employee in user company
    if (existingCertification.employee?.company_id !== companyId) {
      return res.status(403).json({
        status: "fail",
        message: "Access denied",
      });
    }

    const updatedCertification =
      await prisma.employeeLicensesAndCertifications.update({
        where: { id: parseInt(id) },
        data: {
          ...(name && { name }),
          ...(issuing_organization !== undefined && { issuing_organization }),
          ...(issue_date !== undefined && {
            issue_date: issue_date ? new Date(issue_date) : null,
          }),
          ...(expiration_date !== undefined && {
            expiration_date: expiration_date ? new Date(expiration_date) : null,
          }),
          ...(credential_id !== undefined && { credential_id }),
          ...(credential_url !== undefined && { credential_url }),
          ...(document_urls !== undefined && { document_urls }),
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
      message: "Certification updated successfully",
      data: { certification: updatedCertification },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCertification = async (
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

    // check if certification exists
    const existingCertification =
      await prisma.employeeLicensesAndCertifications.findUnique({
        where: { id: parseInt(id) },
        include: {
          employee: {
            select: {
              company_id: true,
            },
          },
        },
      });

    if (!existingCertification) {
      return res.status(404).json({
        status: "fail",
        message: "Certification not found",
      });
    }

    // verify certification belongs to employee in user company
    if (existingCertification.employee?.company_id !== companyId) {
      return res.status(403).json({
        status: "fail",
        message: "Access denied",
      });
    }

    await prisma.employeeLicensesAndCertifications.delete({
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
      message: "Certification deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteCertifications = async (
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

    // verify all certifications belong to employees in user company
    const certifications =
      await prisma.employeeLicensesAndCertifications.findMany({
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

    const unauthorizedCertifications = certifications.filter(
      (cert) => cert.employee?.company_id !== companyId,
    );

    if (unauthorizedCertifications.length > 0) {
      return res.status(403).json({
        status: "fail",
        message: "Access denied for some certifications",
      });
    }

    const deletedCertifications =
      await prisma.employeeLicensesAndCertifications.deleteMany({
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
      message: `${deletedCertifications.count} certifications deleted successfully`,
      data: {
        deleted: deletedCertifications.count,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const replaceEmployeeCertifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = (req as any).user?.company_id;
    if (!companyId) return res.status(400).json({ status: "fail", message: "Company ID missing" });

    const { certifications } = req.body;

    await prisma.$transaction(async (tx) => {
      if (certifications && Array.isArray(certifications)) {
        await tx.employeeLicensesAndCertifications.deleteMany({ where: { employee_id: id } });
        await tx.employeeLicensesAndCertifications.createMany({
          data: certifications.map((cert: any) => {
            const rawIssueDate = cert.issueDate || cert.issue_date;
            const rawExpDate = cert.expirationDate || cert.expiration_date;
            const issueDate = rawIssueDate ? new Date(rawIssueDate) : null;
            const expDate = rawExpDate ? new Date(rawExpDate) : null;

            return {
              employee_id: id,
              name: cert.name || "",
              issuing_organization: cert.issuingOrganization || cert.issuing_organization || "",
              issue_date: issueDate && !isNaN(issueDate.getTime()) ? issueDate : null,
              expiration_date: expDate && !isNaN(expDate.getTime()) ? expDate : null,
              credential_id: cert.credentialId || cert.credential_id || "",
              credential_url: cert.credentialUrl || cert.credential_url || null,
              document_urls: cert.document_urls || cert.certificateDocument || cert.documentUrl || []
            };
          })
        });
      }
    });



    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({ status: "success", message: "Certifications updated" });
  } catch (error) {
    next(error);
  }
};
