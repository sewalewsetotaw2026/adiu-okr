import { Request, Response, NextFunction } from "express";
import { OnboardingStatus } from "@prisma/client";
import { prisma } from "src/app";
import { initializeLeaveBalancesForEmployee } from "src/utils/leaveUtils";
import { redisService } from "src/services/redisService";

// Helper function to get employee_id from authenticated user
const getEmployeeId = (req: Request): string | null => {
  // Get from req.user (set by auth middleware)
  return req.user?.employee_id || null;
};

// Helper function to update onboarding status
const updateOnboardingStatus = async (
  userId: number,
  status: OnboardingStatus,
) => {
  await prisma.appUser.update({
    where: { id: userId },
    data: { onboarding_status: status },
  });
};

// Step 1: Update Personal Information
export const updatePersonalInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const userId = parseInt(req.user?.user_id || "0");

    if (!companyId || !userId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or User ID not found in session",
      });
    }

    let employeeId = getEmployeeId(req);

    // If user doesn't have employee_id yet, check if it's provided in request body
    // This allows creating employee during onboarding
    const {
      employee_id: providedEmployeeId,
      fullName,
      gender,
      dateOfBirth,
      tinNumber,
      pensionNumber,
      placeOfWork,
    } = req.body;
    console.log("request body", req.body);

    // Use provided employee_id if user doesn't have one, or use existing one
    if (!employeeId && providedEmployeeId) {
      employeeId = providedEmployeeId;
    }

    if (!employeeId) {
      return res.status(400).json({
        status: "fail",
        message:
          "Employee ID is required. If your account was created with an employee ID, please ensure you're logged in correctly. Otherwise, please provide employee_id in the request body.",
      });
    }

    // Validation
    if (!fullName || !gender || !dateOfBirth) {
      return res.status(400).json({
        status: "fail",
        message:
          "Please provide all required fields: fullName, gender, dateOfBirth",
      });
    }

    const {
      validateFullName,
      validateIsNumeric,
    } = require("src/utils/validation");
    if (!validateFullName(fullName)) {
      return res.status(400).json({
        status: "fail",
        message:
          "Full Name must contain exactly three words (First Middle Last)",
      });
    }

    if (tinNumber && !validateIsNumeric(tinNumber)) {
      return res.status(400).json({
        status: "fail",
        message: "TIN Number must be numeric",
      });
    }

    // Pension number can now be alphanumeric, so we removed the validation

    // Check if employee exists or has placeholder name
    let employee = employeeId
      ? await prisma.employee.findUnique({
        where: {
          id_company_id: {
            id: employeeId,
            company_id: companyId,
          },
        },
      })
      : null;

    // Check for duplicate TIN if being updated
    if (tinNumber) {
      const existingTin = await prisma.employee.findFirst({
        where: { tin_number: tinNumber, company_id: companyId },
      });

      if (existingTin && existingTin.id !== employeeId) {
        return res.status(400).json({
          status: "fail",
          message: "TIN number already exists",
        });
      }
    }

    // Check if employee_id already exists in another company
    if (employeeId) {
      const existingEmployeeId = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, company_id: true },
      });

      if (existingEmployeeId && existingEmployeeId.company_id !== companyId) {
        return res.status(400).json({
          status: "fail",
          message: "Employee ID already exists in another company",
        });
      }
    }

    let updatedEmployee;

    if (!employee) {
      // Employee doesn't exist, create it
      updatedEmployee = await prisma.employee.create({
        data: {
          id: employeeId!,
          company_id: companyId,
          full_name: fullName,
          gender,
          date_of_birth: dateOfBirth ? new Date(dateOfBirth) : null,
          tin_number: tinNumber || null,
          pension_number: pensionNumber || null,
          place_of_work: placeOfWork || "Head Office",
        },
      });

      // Update user's employee_id if it was null
      if (!req.user?.employee_id) {
        await prisma.appUser.update({
          where: { id: userId },
          data: { employee_id: employeeId },
        });
      }
    } else {
      // Employee exists, update it (handles placeholder names too)
      updatedEmployee = await prisma.employee.update({
        where: {
          id_company_id: {
            id: employeeId!,
            company_id: companyId,
          },
        },
        data: {
          full_name: fullName,
          gender,
          date_of_birth: dateOfBirth ? new Date(dateOfBirth) : null,
          tin_number: tinNumber || null,
          pension_number: pensionNumber || null,
          place_of_work: placeOfWork || "Head Office",
        },
      });
    }

    // Do not change onboarding_status on partial step updates.

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
      message: "Personal information updated successfully",
      data: {
        employee: updatedEmployee,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Step 2: Update Contact Information
export const updateContactInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const userId = parseInt(req.user?.user_id || "0");

    if (!companyId || !userId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or User ID not found in session",
      });
    }

    const employeeId = getEmployeeId(req);
    if (!employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID not found. Please contact administrator.",
      });
    }

    const { region, city, subCity, woreda, phones, emergencyContacts } =
      req.body;

    // Validation
    const {
      validateFullName,
      validatePhoneNumber,
      normalizePhoneNumber,
    } = require("src/utils/validation");

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "At least one phone number is required",
      });
    }

    // Validate employee phones
    for (const phone of phones) {
      if (!phone.number) {
        return res.status(400).json({
          status: "fail",
          message: "All phone numbers must have a value",
        });
      }

      const normalizedPhone = normalizePhoneNumber(phone.number);
      if (!normalizedPhone) {
        return res.status(400).json({
          status: "fail",
          message: `Invalid phone number format: ${phone.number}. Please use international format (e.g., +251...) or local format (09...).`,
        });
      }
      // Store normalized number temporarily or directly in map later
      phone.number = normalizedPhone;
    }

    if (
      emergencyContacts &&
      (!Array.isArray(emergencyContacts) || emergencyContacts.length === 0)
    ) {
      return res.status(400).json({
        status: "fail",
        message: "At least one emergency contact is required",
      });
    }

    // Validate emergency contacts
    if (emergencyContacts) {
      for (const contact of emergencyContacts) {
        if (
          !contact.fullName ||
          !contact.relationship ||
          !contact.phoneNumber
        ) {
          return res.status(400).json({
            status: "fail",
            message:
              "All emergency contact fields (fullName, relationship, phoneNumber) are required",
          });
        }
        if (!validateFullName(contact.fullName)) {
          return res.status(400).json({
            status: "fail",
            message: `Emergency contact name '${contact.fullName}' must contain exactly three words`,
          });
        }

        const normalizedEcPhone = normalizePhoneNumber(contact.phoneNumber);
        if (!normalizedEcPhone) {
          return res.status(400).json({
            status: "fail",
            message: `Invalid emergency phone number: ${contact.phoneNumber}. Please use international format (e.g., +251...) or local format (09...).`,
          });
        }
        contact.phoneNumber = normalizedEcPhone;
      }
    }

    // Verify employee exists
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

    // Delete existing addresses, phones, and emergency contacts
    await prisma.employeeAddress.deleteMany({
      where: { employee_id: employeeId },
    });
    await prisma.employeePhone.deleteMany({
      where: { employee_id: employeeId },
    });
    if (emergencyContacts) {
      await prisma.emergencyContact.deleteMany({
        where: { employee_id: employeeId },
      });
    }

    // Create new address if provided
    if (region || city || subCity || woreda) {
      await prisma.employeeAddress.create({
        data: {
          employee_id: employeeId,
          company_id: companyId,
          region: region || null,
          city: city || null,
          sub_city: subCity || null,
          woreda: woreda || null,
        },
      });
    }

    // Create new phones
    const phoneData = phones.map((phone: any) => ({
      employee_id: employeeId,
      company_id: companyId,
      phone_number: phone.number,
      phone_type: phone.type || "Private",
      is_primary: phone.isPrimary || false,
    }));

    await prisma.employeePhone.createMany({
      data: phoneData,
      skipDuplicates: true,
    });

    // Create emergency contacts
    if (emergencyContacts && Array.isArray(emergencyContacts)) {
      const ecData = emergencyContacts.map((contact: any) => ({
        employee_id: employeeId,
        company_id: companyId,
        full_name: contact.fullName,
        relationship: contact.relationship,
        phone_number: contact.phoneNumber,
        email: contact.email || null,
        is_primary: contact.isPrimary || false,
      }));

      await prisma.emergencyContact.createMany({
        data: ecData,
        skipDuplicates: true,
      });
    }

    // Fetch updated data
    const [addresses, phoneNumbers, savedEmergencyContacts] = await Promise.all(
      [
        prisma.employeeAddress.findMany({ where: { employee_id: employeeId } }),
        prisma.employeePhone.findMany({
          where: { employee_id: employeeId },
          orderBy: [{ is_primary: "desc" }, { id: "asc" }],
        }),
        prisma.emergencyContact.findMany({
          where: { employee_id: employeeId },
          orderBy: { created_at: "desc" },
        }),
      ],
    );

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
      message: "Contact information updated successfully",
      data: {
        addresses,
        phones: phoneNumbers,
        emergencyContacts: savedEmergencyContacts,
      },
    });
  } catch (error) {
    next(error);
  }
};
// Step 2.5: Update Financial Details
export const updateFinancialDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const userId = parseInt(req.user?.user_id || "0");

    if (!companyId || !userId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or User ID not found in session",
      });
    }

    const employeeId = getEmployeeId(req);
    if (!employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID not found. Please contact administrator.",
      });
    }

    const { financialDetails } = req.body;

    if (!Array.isArray(financialDetails)) {
      return res.status(400).json({
        status: "fail",
        message: "Financial details must be an array",
      });
    }

    // Verify employee exists
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

    // Sync financial details
    // Strategy: Delete existing and recreate (simpler for wizard step) or update/create
    // For wizard, replace all seems acceptable if we assume the frontend sends the complete current state.

    const { validateIsNumeric } = require("src/utils/validation");
    for (const detail of financialDetails) {
      if (detail.accountNumber && !validateIsNumeric(detail.accountNumber)) {
        return res.status(400).json({
          status: "fail",
          message: `Account number '${detail.accountNumber}' must be numeric`,
        });
      }
    }

    await prisma.financialDetail.deleteMany({
      where: { employee_id: employeeId, company_id: companyId },
    });

    for (const detail of financialDetails) {
      if (detail.bankId && detail.accountNumber && detail.accountHolderName) {
        await prisma.financialDetail.create({
          data: {
            employee_id: employeeId,
            company_id: companyId,
            bank_id: parseInt(detail.bankId),
            account_number: detail.accountNumber,
            account_holder_name: detail.accountHolderName,
            is_primary: detail.isPrimary || false,
          },
        });
      }
    }

    // Ensure one primary
    const count = await prisma.financialDetail.count({
      where: { employee_id: employeeId, company_id: companyId },
    });
    if (count > 0) {
      const primaryCount = await prisma.financialDetail.count({
        where: {
          employee_id: employeeId,
          company_id: companyId,
          is_primary: true,
        },
      });
      if (primaryCount === 0) {
        // Make the first one primary
        const first = await prisma.financialDetail.findFirst({
          where: { employee_id: employeeId, company_id: companyId },
        });
        if (first) {
          await prisma.financialDetail.update({
            where: { id: first.id },
            data: { is_primary: true },
          });
        }
      }
    }

    const updatedDetails = await prisma.financialDetail.findMany({
      where: { employee_id: employeeId, company_id: companyId },
      include: { bank: true },
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
      message: "Financial details updated successfully",
      data: {
        financialDetails: updatedDetails,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Step 3: Update Education
export const updateEducation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const userId = parseInt(req.user?.user_id || "0");

    if (!companyId || !userId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or User ID not found in session",
      });
    }

    const employeeId = getEmployeeId(req);
    if (!employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID not found. Please contact administrator.",
      });
    }

    const { education } = req.body;
    console.log("the request body from onboarding", req.body);

    if (!Array.isArray(education)) {
      return res.status(400).json({
        status: "fail",
        message: "Education must be an array",
      });
    }

    // Verify employee exists
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

    // Delete existing educations
    await prisma.employeeEducation.deleteMany({
      where: { employee_id: employeeId },
    });

    const normalizeText = (value: any) => String(value ?? "").trim();
    const normalizeProgramType = (value: any) => {
      const v = normalizeText(value);
      const allowed = new Set(["Regular", "Extension", "Weekend", "Distance"]);
      return allowed.has(v) ? (v as any) : ("Regular" as any);
    };

    const getOrCreateEducationLevel = async (nameRaw: any) => {
      const name = normalizeText(nameRaw);
      if (!name) {
        throw new Error("Education level is required");
      }

      const existing = await prisma.educationLevel.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
      if (existing) return existing;

      try {
        return await prisma.educationLevel.create({ data: { name } });
      } catch (err: any) {
        // Handle race (or duplicates with different casing) safely
        if (err?.code === "P2002") {
          const retry = await prisma.educationLevel.findFirst({
            where: { name: { equals: name, mode: "insensitive" } },
          });
          if (retry) return retry;
        }
        throw err;
      }
    };

    const getOrCreateFieldOfStudy = async (nameRaw: any) => {
      const name = normalizeText(nameRaw);
      if (!name) {
        throw new Error("Field of study is required");
      }

      const existing = await prisma.fieldOfStudy.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
      if (existing) return existing;

      try {
        return await prisma.fieldOfStudy.create({ data: { name } });
      } catch (err: any) {
        if (err?.code === "P2002") {
          const retry = await prisma.fieldOfStudy.findFirst({
            where: { name: { equals: name, mode: "insensitive" } },
          });
          if (retry) return retry;
        }
        throw err;
      }
    };

    const getOrCreateInstitution = async (nameRaw: any) => {
      const name = normalizeText(nameRaw);
      if (!name) {
        throw new Error("Institution is required");
      }

      const existing = await prisma.institution.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
      if (existing) return existing;

      try {
        return await prisma.institution.create({
          data: {
            name,
            category: "Private", // default
          },
        });
      } catch (err: any) {
        if (err?.code === "P2002") {
          const retry = await prisma.institution.findFirst({
            where: { name: { equals: name, mode: "insensitive" } },
          });
          if (retry) return retry;
        }
        throw err;
      }
    };

    console.log("education", education);
    // Create new educations (sequential to avoid create races)
    for (const edu of education) {
      const educationLevel = await getOrCreateEducationLevel(edu?.level);
      const fieldOfStudy = await getOrCreateFieldOfStudy(edu?.fieldOfStudy);
      const institution = await getOrCreateInstitution(edu?.institution);

      const createdEducation = await prisma.employeeEducation.create({
        data: {
          employee_id: employeeId,
          education_level_id: educationLevel.id,
          field_of_study_id: fieldOfStudy.id,
          institution_id: institution.id,
          program_type: normalizeProgramType(edu?.programType),
          has_cost_sharing: edu?.hasCostSharing === true,
          cost_sharing_document_urls: Array.isArray(edu?.costSharingDocument)
            ? edu.costSharingDocument
            : edu?.costSharingDocument
              ? [edu.costSharingDocument]
              : [],
          document_urls: edu?.document_urls || [],
          start_date: edu?.startDate ? new Date(edu.startDate) : null,
          end_date: edu?.endDate ? new Date(edu.endDate) : null,
          is_verified: false,
          is_current: edu?.isCurrent === true,
        },
      });

      if (edu?.hasCostSharing === true || edu?.has_cost_sharing === true) {
        const commitmentType = edu.costSharingCommitmentType;
        const costDocNum = edu.costSharingDocumentNumber;
        const costIssueDate = edu.costSharingIssueDate;
        const costTotalCost = edu.costSharingTotalCost;
        const costpaymentStatus = edu.costSharingPaymentStatus;
        const costCurrency = edu.costSharingCurrency || "ETB";
        const costRegRef = edu.costSharingRegulationReference;
        const costRemarks = edu.costSharingRemarks;
        const costDocUrl = edu.costSharingDocument;

        await prisma.employeeCostSharing.create({
          data: {
            employee_id: employeeId,
            education_id: createdEducation.id,
            document_number: costDocNum ? normalizeText(costDocNum) : null,
            issuing_institution: institution.name, // Use education institution name
            issue_date: costIssueDate ? new Date(costIssueDate) : null,
            declared_total_cost: costTotalCost
              ? typeof costTotalCost === "string"
                ? parseFloat(costTotalCost)
                : costTotalCost
              : null,
            currency: normalizeText(costCurrency),
            payment_status: costpaymentStatus,
            commitment_type: commitmentType,
            regulation_reference: costRegRef ? normalizeText(costRegRef) : null,
            document_urls: Array.isArray(costDocUrl)
              ? costDocUrl
              : costDocUrl
                ? [costDocUrl]
                : [],
            remarks: costRemarks ? normalizeText(costRemarks) : null,
          },
        });
      }
    }

    // Do not change onboarding_status on partial step updates.

    // Fetch updated educations
    const educations = await prisma.employeeEducation.findMany({
      where: { employee_id: employeeId },
      include: {
        educationLevel: true,
        fieldOfStudy: true,
        institution: true,
      },
      orderBy: [{ is_current: "desc" }, { start_date: "desc" }],
    });

    const educationForFrontend = educations.map((e) => ({
      id: e.id,
      level: e.educationLevel?.name ?? null,
      fieldOfStudy: e.fieldOfStudy?.name ?? null,
      institution: e.institution?.name ?? null,
      programType: e.program_type,
      hasCostSharing: e.has_cost_sharing ?? false,
      costSharingDocument: e.cost_sharing_document_urls || [],
      startDate: e.start_date,
      endDate: e.end_date,
      isCurrent: e.is_current ?? false,
      isVerified: e.is_verified ?? false,
    }));

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
      message: "Education updated successfully",
      data: {
        educations: educationForFrontend,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Step 4: Update Work Experience (Employment History)
export const updateWorkExperience = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const userId = parseInt(req.user?.user_id || "0");

    if (!companyId || !userId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or User ID not found in session",
      });
    }

    const employeeId = getEmployeeId(req);
    if (!employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID not found. Please contact administrator.",
      });
    }

    const { workExperience } = req.body;

    if (!Array.isArray(workExperience)) {
      return res.status(400).json({
        status: "fail",
        message: "Work experience must be an array",
      });
    }

    // Verify employee exists
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

    // Delete existing employment history
    await prisma.employmentHistory.deleteMany({
      where: { employee_id: employeeId },
    });

    // Create new employment history records
    const historyPromises = workExperience.map(async (exp: any) => {
      // Find job title if provided
      // Find or Create job title if provided
      let jobTitleId = null;
      if (exp.position) {
        const titleName = String(exp.position).trim();
        const levelName = exp.level ? String(exp.level).trim() : null;

        if (titleName) {
          // Try to find exact match with level
          let jobTitle = await prisma.jobTitle.findFirst({
            where: {
              company_id: companyId,
              title: { equals: titleName, mode: "insensitive" },
              level: levelName
                ? { equals: levelName, mode: "insensitive" }
                : null,
            },
          });

          // If not found, create new job title with this level
          if (!jobTitle) {
            jobTitle = await prisma.jobTitle.create({
              data: {
                company_id: companyId,
                title: titleName,
                level: levelName,
              },
            });
          }
          jobTitleId = jobTitle.id;
        }
      }

      return prisma.employmentHistory.create({
        data: {
          employee_id: employeeId,
          previous_company_name: exp.companyName,
          job_title_id: jobTitleId,
          employment_type: exp.employmentType || null,

          previous_level: exp.level,
          department_name: exp.department,
          start_date: exp.startDate ? new Date(exp.startDate) : new Date(),
          end_date: exp.endDate ? new Date(exp.endDate) : null,
          is_verified: false,
          notes: exp.notes || null,
          document_urls: exp.document_urls || [],
        },
      });
    });

    await Promise.all(historyPromises);

    // Do not change onboarding_status on partial step updates.

    // Fetch updated employment history
    const history = await prisma.employmentHistory.findMany({
      where: { employee_id: employeeId },
      include: {
        jobTitle: true,
      },
      orderBy: { start_date: "desc" },
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
      message: "Work experience updated successfully",
      data: {
        workExperience: history,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Step 5: Update Certifications
export const updateCertifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const userId = parseInt(req.user?.user_id || "0");

    if (!companyId || !userId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or User ID not found in session",
      });
    }

    const employeeId = getEmployeeId(req);
    if (!employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID not found. Please contact administrator.",
      });
    }

    const { certifications } = req.body;

    if (!Array.isArray(certifications)) {
      return res.status(400).json({
        status: "fail",
        message: "Certifications must be an array",
      });
    }

    // Verify employee exists
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

    // Delete existing certifications
    await prisma.employeeLicensesAndCertifications.deleteMany({
      where: { employee_id: employeeId },
    });

    // Create new certifications
    const certificationPromises = certifications.map((cert: any) => {
      console.log("Processing certification:", cert);
      return prisma.employeeLicensesAndCertifications.create({
        data: {
          employee_id: employeeId,
          name: cert.name,
          issuing_organization:
            cert.issuingOrganization || cert.issuing_organization || null,
          issue_date:
            cert.issueDate || cert.issue_date
              ? new Date(cert.issueDate || cert.issue_date)
              : null,
          expiration_date:
            cert.expirationDate || cert.expiration_date
              ? new Date(cert.expirationDate || cert.expiration_date)
              : null,
          credential_id: cert.credentialId || cert.credential_id || null,
          credential_url: cert.credentialUrl || cert.credential_url || null,
          document_urls: cert.certificateDocument || cert.document_urls || [],
        },
      });
    });

    await Promise.all(certificationPromises);

    // Do not change onboarding_status on partial step updates.

    // Fetch updated certifications
    const certs = await prisma.employeeLicensesAndCertifications.findMany({
      where: { employee_id: employeeId },
      orderBy: { issue_date: "desc" },
    });

    console.log("certs", certs);

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
      message: "Certifications updated successfully",
      data: {
        certifications: certs,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Step 6: Update Documents (and Complete Onboarding)
export const updateDocuments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const userId = parseInt(req.user?.user_id || "0");

    if (!companyId || !userId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or User ID not found in session",
      });
    }

    const employeeId = getEmployeeId(req);
    if (!employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID not found. Please contact administrator.",
      });
    }

    // const { documents } = req.body as {
    //   documents?: {
    //     cv?: string[];
    //     certificates?: string[];
    //     photo?: string[];
    //     experienceLetters?: string[];
    //     taxForms?: string[];
    //     pensionForms?: string[];
    //   };
    // };
    const { documents } = req.body as {
      documents?: {
        cv?: string[];
        national_id?: string[];
        nationalId?: string[];
        guarantee_letter?: string[];
        guaranteeLetter?: string[];
        medical_certificate?: string[];
        medicalCertificate?: string[];
        police_certificate?: string[];
        policeCertificate?: string[];
        certificates?: string[];
        photo?: string[];
        experienceLetters?: string[];
        taxForms?: string[];
        pensionForms?: string[];
      };
    };

    // Verify employee exists
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

    await prisma.employeeDocument.upsert({
      where: {
        employee_id_company_id: {
          employee_id: employeeId,
          company_id: companyId,
        },
      },
      update: {
        cv: documents?.cv ?? [],
        national_id: documents?.national_id ?? documents?.nationalId ?? [],
        guarantee_letter:
          documents?.guarantee_letter ?? documents?.guaranteeLetter ?? [],
        medical_certificate:
          documents?.medical_certificate ?? documents?.medicalCertificate ?? [],
        police_certificate:
          documents?.police_certificate ?? documents?.policeCertificate ?? [],
        certificates: documents?.certificates ?? [],
        photo: documents?.photo ?? [],
        experienceLetters: documents?.experienceLetters ?? [],
        taxForms: documents?.taxForms ?? [],
        pensionForms: documents?.pensionForms ?? [],
      },
      create: {
        employee_id: employeeId,
        company_id: companyId,
        cv: documents?.cv ?? [],
        national_id: documents?.national_id ?? documents?.nationalId ?? [],
        guarantee_letter:
          documents?.guarantee_letter ?? documents?.guaranteeLetter ?? [],
        medical_certificate:
          documents?.medical_certificate ?? documents?.medicalCertificate ?? [],
        police_certificate:
          documents?.police_certificate ?? documents?.policeCertificate ?? [],
        certificates: documents?.certificates ?? [],
        photo: documents?.photo ?? [],
        experienceLetters: documents?.experienceLetters ?? [],
        taxForms: documents?.taxForms ?? [],
        pensionForms: documents?.pensionForms ?? [],
      },
    });

    // Persist submitted document URLs (arrays of strings per category)
    // await prisma.employeeDocument.upsert({
    //   where: {
    //     employee_id_company_id: {
    //       employee_id: employeeId,
    //       company_id: companyId,
    //     },
    //   },
    //   update: {
    //     // cv: documents?.cv ?? [],
    //     // national_id: documents?.national_id ?? [],
    //     // guarantee_letter: documents?.guarantee_letter ?? [],
    //     // taxForms: documents?. ?? [],
    //     // pensionForms: documents?.pensionForms ?? [],
    //       cv: documents?.cv ?? [],
    //       national_id: documents?.certificates ?? [],
    //       medical_certificate: documents?.photo ?? [],
    //       guarantee_letter: documents?.experienceLetters ?? [],
    //       police_certificate: documents?.taxForms ?? [],

    //   },
    //   create: {
    //     employee_id: employeeId,
    //     company_id: companyId,
    //     cv: documents?.cv ?? [],
    //     certificates: documents?.certificates ?? [],
    //     photo: documents?.photo ?? [],
    //     experienceLetters: documents?.experienceLetters ?? [],
    //     taxForms: documents?.taxForms ?? [],
    //     pensionForms: documents?.pensionForms ?? [],
    //   },
    // });

    // After documents submission, onboarding is marked PENDING_APPROVAL for admin/HR review.

    // Initialize leave balances for this user as part of onboarding completion
    try {
      await initializeLeaveBalancesForEmployee(companyId, employeeId, new Date(), prisma);
    } catch (err) {
      console.error("Failed to initialize leave balances during onboarding:", err);
      // We log but do not fail the request to ensure onboarding completion
    }

    // Update onboarding status to PENDING_APPROVAL
    await updateOnboardingStatus(userId, OnboardingStatus.PENDING_APPROVAL);

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
      message: "Documents uploaded and onboarding submitted for approval",
      data: {
        documents: documents || {},
        onboarding_status: OnboardingStatus.PENDING_APPROVAL,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get current onboarding status and data
export const getOnboardingStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const userId = parseInt(req.user?.user_id || "0");

    if (!companyId || !userId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or User ID not found in session",
      });
    }

    // Get user with onboarding status
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { onboarding_status: true, employee_id: true },
    });

    const employeeId = getEmployeeId(req);

    // If user doesn't have an employee_id yet, return status indicating onboarding hasn't started
    if (!employeeId || !user?.employee_id) {
      return res.status(200).json({
        status: "success",
        data: {
          onboarding_status: user?.onboarding_status || "PENDING",
          employee: null,
          contact: {
            addresses: [],
            phones: [],
          },
          education: [],
          workExperience: [],
          certifications: [],
          message:
            "Employee record not created yet. Please complete Step 1 (Personal Information) to create your employee profile.",
        },
      });
    }

    // Get employee data
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: employeeId,
          company_id: companyId,
        },
      },
      include: {
        addresses: true,
        phones: true,
        emergencyContacts: true,
        financialDetails: {
          include: {
            bank: true,
          },
        },
        documents: true,
        educations: {
          include: {
            educationLevel: true,
            fieldOfStudy: true,
            institution: true,
            costSharing: true,
          },
        },
        costSharing: true,
        employmentHistories: {
          include: {
            jobTitle: true,
          },
        },
        licensesAndCertifications: true,
      },
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        onboarding_status: user?.onboarding_status || "PENDING",
        employee: {
          id: employee.id,
          full_name: employee.full_name,
          gender: employee.gender,
          date_of_birth: employee.date_of_birth,
          tin_number: employee.tin_number,
          pension_number: employee.pension_number,
          place_of_work: employee.place_of_work,
          profile_picture_url: employee.profile_picture_url || null,
          signature_url: employee.signature_url || "",
        },
        documents: {
          cv: employee.documents?.cv ?? [],
          certificates: employee.documents?.certificates ?? [],
          photo: employee.documents?.photo ?? [],
          experienceLetters: employee.documents?.experienceLetters ?? [],
          taxForms: employee.documents?.taxForms ?? [],
          pensionForms: employee.documents?.pensionForms ?? [],
          national_id: employee.documents?.national_id ?? [],
          guarantee_letter: employee.documents?.guarantee_letter ?? [],
          medical_certificate: employee.documents?.medical_certificate ?? [],
          police_certificate: employee.documents?.police_certificate ?? [],
        },

        contact: {
          addresses: employee.addresses,
          phones: employee.phones,
          emergencyContacts: employee.emergencyContacts.map((ec) => ({
            fullName: ec.full_name,
            relationship: ec.relationship,
            phoneNumber: ec.phone_number,
            email: ec.email,
            isPrimary: ec.is_primary,
          })),
        },
        financialDetails: employee.financialDetails.map((fd) => ({
          id: fd.id,
          bankId: fd.bank_id,
          bankName: fd.bank?.name,
          accountNumber: fd.account_number,
          accountHolderName: fd.account_holder_name,
          isPrimary: fd.is_primary,
        })),
        education: employee.educations.map((e) => ({
          id: e.id,
          level: e.educationLevel?.name ?? null,
          fieldOfStudy: e.fieldOfStudy?.name ?? null,
          institution: e.institution?.name ?? null,
          programType: e.program_type,
          hasCostSharing: e.has_cost_sharing ?? false,
          costSharingDocument: e.costSharing?.[0]?.document_urls || [],
          document_urls: e.document_urls || [],
          // Extract cost sharing details from relation (assuming 1-to-many but only 1 active/relevant for this education context)
          costSharingDocumentNumber:
            e.costSharing?.[0]?.document_number ?? null,
          costSharingIssuingInstitution:
            e.costSharing?.[0]?.issuing_institution ?? null,
          costSharingIssueDate: e.costSharing?.[0]?.issue_date ?? null,
          costSharingTotalCost: e.costSharing?.[0]?.declared_total_cost ?? null,
          costSharingCurrency: e.costSharing?.[0]?.currency ?? "ETB",
          costSharingCommitmentType:
            e.costSharing?.[0]?.commitment_type ?? null,
          costSharingPaymentStatus: e.costSharing?.[0]?.payment_status,
          costSharingRegulationReference:
            e.costSharing?.[0]?.regulation_reference ?? null,
          costSharingRemarks: e.costSharing?.[0]?.remarks ?? null,

          startDate: e.start_date,
          endDate: e.end_date,
          isCurrent: e.is_current ?? false,
          isVerified: e.is_verified ?? false,
        })),
        workExperience: employee.employmentHistories.map((h) => ({
          id: h.id,
          employee_id: h.employee_id,
          previousCompanyName: h.previous_company_name,
          jobTitle: h.jobTitle?.title ?? null,
          previousLevel: h.previous_level ?? null,
          departmentName: h.department_name ?? null,
          startDate: h.start_date,
          endDate: h.end_date,
          employmentType: h.employment_type || null,
          document_urls: h.document_urls || [],
          isVerified: h.is_verified ?? false,
          notes: h.notes ?? null,
        })),
        certifications: employee.licensesAndCertifications.map((c) => ({
          name: c.name,
          issuingOrganization: c.issuing_organization,
          issueDate: c.issue_date,
          expirationDate: c.expiration_date,
          credentialId: c.credential_id,
          credentialUrl: c.credential_url,
          certificateDocument: c.document_urls,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Step 8: Update Signature
export const updateSignature = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const userId = parseInt(req.user?.user_id || "0");

    if (!companyId || !userId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or User ID not found in session",
      });
    }

    const employeeId = getEmployeeId(req);
    if (!employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID not found. Please contact administrator.",
      });
    }

    const { signature_url } = req.body;

    if (!signature_url) {
      return res.status(400).json({
        status: "fail",
        message: "Signature URL is required",
      });
    }

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: employeeId,
          company_id: companyId,
        },
      },
      include: {
        appUsers: true
      }
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    // Update signature
    await prisma.employee.update({
      where: {
        id_company_id: {
          id: employeeId,
          company_id: companyId,
        },
      },
      data: {
        signature_url,
      },
    });

    // Determine correctness of step completion - actually signature is step 8
    // Check if we need to update status separately or if frontend handles next step logic
    // Usually frontend calls getOnboardingStatus

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
      message: "Signature updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getSignature = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const employeeId = getEmployeeId(req);

    if (!companyId || !employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID not found",
      });
    }

    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: employeeId,
          company_id: companyId,
        },
      },
      select: {
        signature_url: true,
      },
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        signature_url: employee.signature_url || "",
      },
    });
  } catch (error) {
    next(error);
  }
};
