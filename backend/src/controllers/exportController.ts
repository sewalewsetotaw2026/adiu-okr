/**
 * Export Controller for Kacha HRIS
 *
 * Handles export requests for employees, employments, and other data.
 * Supports PDF, CSV, and Excel formats with field selection.
 */

import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import {
  exportData,
  ExportField,
  EMPLOYEE_EXPORT_FIELDS,
  EMPLOYMENT_EXPORT_FIELDS,
} from "src/services/exportService";
import { calculateAccruedBalance, AccruedBalanceResult } from "src/utils/leaveUtils";
import { RoleNames, SUPERADMIN_VARIANTS } from "src/utils/roleConstants";

// ============================================
// AVAILABLE FIELDS FOR EXPORT
// ============================================

const ALL_EMPLOYEE_FIELDS: ExportField[] = [
  { key: "id", label: "Employee ID", width: 15 },
  { key: "full_name", label: "Full Name", width: 25 },
  { key: "gender", label: "Gender", width: 10 },
  { key: "date_of_birth", label: "Date of Birth", width: 15 },
  { key: "tin_number", label: "TIN Number", width: 15 },
  { key: "pension_number", label: "Pension Number", width: 15 },
  { key: "place_of_work", label: "Place of Work", width: 20 },
  { key: "created_at", label: "Created At", width: 15 },
  // Employment-related (from active employment)
  { key: "employment.department.name", label: "Department", width: 20 },
  { key: "employment.jobTitle.title", label: "Job Title", width: 25 },
  { key: "employment.employment_type", label: "Employment Type", width: 15 },
  { key: "employment.gross_salary", label: "Gross Salary", width: 15 },
  { key: "employment.basic_salary", label: "Basic Salary", width: 15 },
  { key: "employment.start_date", label: "Hire Date", width: 15 },
  { key: "employment.end_date", label: "End Date", width: 15 },
  { key: "employment.is_active", label: "Status", width: 10 },
  { key: "employment.manager.full_name", label: "Manager", width: 20 },
  // Contact info
  { key: "primary_phone", label: "Phone Number", width: 18 },
  { key: "primary_email", label: "Email", width: 25 },
  { key: "emergency_contacts_summary", label: "Emergency Contacts", width: 40 },
  { key: "addresses_summary", label: "Addresses", width: 35 },
  // Summaries
  { key: "experience_summary", label: "Work Experience", width: 40 },
  { key: "education_summary", label: "Education", width: 40 },
  // { key: "certifications_summary", label: "Certifications", width: 35 }, // Removed as per request
  // { key: "documents_summary", label: "Documents", width: 35 }, // Removed as per request
  { key: "cost_sharing_summary", label: "Cost Sharing", width: 35 },
  { key: "allowance_summary", label: "Allowances", width: 30 },
];

const ALL_EMPLOYMENT_FIELDS: ExportField[] = [
  { key: "id", label: "Employment ID", width: 15 },
  { key: "employee.id", label: "Employee ID", width: 15 },
  { key: "employee.full_name", label: "Employee Name", width: 25 },
  { key: "employee.gender", label: "Gender", width: 10 },
  { key: "department.name", label: "Department", width: 20 },
  { key: "jobTitle.title", label: "Job Title", width: 25 },
  { key: "employment_type", label: "Employment Type", width: 15 },
  { key: "gross_salary", label: "Gross Salary", width: 15 },
  { key: "basic_salary", label: "Basic Salary", width: 15 },
  { key: "start_date", label: "Start Date", width: 15 },
  { key: "end_date", label: "End Date", width: 15 },
  { key: "probation_end_date", label: "Probation End", width: 15 },
  { key: "manager.full_name", label: "Manager", width: 20 },
  { key: "is_active", label: "Active", width: 10 },
  { key: "cost_sharing_status", label: "Cost Sharing", width: 15 },
  { key: "notes", label: "Notes", width: 30 },
];

// ============================================
// GET AVAILABLE FIELDS
// ============================================

export const getAvailableFields = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { type } = req.query;

    let fields: ExportField[] = [];
    if (type === "employee") {
      fields = ALL_EMPLOYEE_FIELDS;
    } else if (type === "employment") {
      fields = ALL_EMPLOYMENT_FIELDS;
    } else if (type === "leave") {
      fields = ALL_LEAVE_FIELDS;
    } else if (type === "leave_balance") {
      fields = ALL_LEAVE_BALANCE_FIELDS;
    } else if (type === "on_leave") {
      fields = ALL_ON_LEAVE_FIELDS;
    } else {
      return res.status(400).json({
        status: "fail",
        message: "Invalid type. Must be 'employee', 'employment', 'leave', 'leave_balance', or 'on_leave'",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        fields: fields.map((f) => ({ key: f.key, label: f.label })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// HELPER: GET COMPANY BRANDING
// ============================================

const getCompanyBranding = async (companyId: number) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, logo_url: true, primary_color: true },
  });
  return {
    companyName: company?.name || "Kacha Digital Financial Service S.C",
    logoUrl: company?.logo_url || undefined,
    primaryColor: company?.primary_color || undefined,
  };
};

// ============================================
// EXPORT EMPLOYEES
// ============================================

export const exportEmployees = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    console.log("[Export] exportEmployees called");
    console.log("[Export] Request body:", req.body);

    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { format, fields: selectedFields, filters } = req.body;

    // Validate format
    if (!["pdf", "csv", "xlsx"].includes(format)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid format. Must be 'pdf', 'csv', or 'xlsx'",
      });
    }

    // Validate fields
    if (
      !selectedFields ||
      !Array.isArray(selectedFields) ||
      selectedFields.length === 0
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Please select at least one field to export",
      });
    }

    // Build where clause from filters
    const where: any = {
      company_id: companyId,
      appUsers: {
        none: {
          role: {
            name: {
              in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
            },
          },
        },
      },
    };

    if (filters?.search) {
      where.OR = [
        { full_name: { contains: filters.search, mode: "insensitive" } },
        { id: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const employmentFilters: any = { is_active: true };

    if (filters?.cost_sharing_status) {
      employmentFilters.cost_sharing_status = filters.cost_sharing_status;
    }

    if (filters?.department_id) {
      // Check if it's a numeric ID or a name
      const deptId = parseInt(filters.department_id);
      if (!isNaN(deptId)) {
        employmentFilters.department_id = deptId;
      } else {
        employmentFilters.department = { name: filters.department_id };
      }
    }

    if (filters?.job_title_id) {
      const titleId = parseInt(filters.job_title_id);
      if (!isNaN(titleId)) {
        employmentFilters.job_title_id = titleId;
      } else {
        // If it's a level or title text
        employmentFilters.jobTitle = {
          OR: [
            { title: { contains: filters.job_title_id, mode: "insensitive" } },
            { level: { contains: filters.job_title_id, mode: "insensitive" } },
          ],
        };
      }
    }

    if (filters?.status === "active") {
      employmentFilters.is_active = true;
    } else if (filters?.status === "inactive") {
      employmentFilters.is_active = false;
    }

    if (Object.keys(employmentFilters).length > 0) {
      where.employments = { some: employmentFilters };
    }

    if (filters?.gender) {
      where.gender = filters.gender;
    }

    if (filters?.ids && Array.isArray(filters.ids) && filters.ids.length > 0) {
      where.id = { in: filters.ids };
    }

    // Fetch employees
    const employees = await prisma.employee.findMany({
      where,
      orderBy: { full_name: "asc" },
      include: {
        employments: {
          where: { is_active: true },
          include: {
            department: true,
            jobTitle: true,
            manager: { select: { id: true, full_name: true } },
            allowances: { include: { allowanceType: true } },
          },
          take: 1,
        },
        phones: { where: { is_primary: true }, take: 1 },
        appUsers: { select: { email: true }, take: 1 },
        emergencyContacts: true,
        // Include relations for summary fields
        employmentHistories: {
          orderBy: { start_date: "desc" },
          include: { jobTitle: true },
        },
        educations: {
          include: {
            educationLevel: true,
            institution: true,
            fieldOfStudy: true,
          },
          orderBy: { start_date: "desc" },
        },
        licensesAndCertifications: {
          orderBy: { issue_date: "desc" },
        },
        documents: true,
        costSharing: {
          orderBy: [{ issue_date: "desc" }, { created_at: "desc" }],
          take: 1,
          include: {
            education: { include: { educationLevel: true, institution: true } },
          },
        },
      },
    });

    // Transform data for export
    const exportData_ = employees.map((emp: any) => {
      const employment = emp.employments[0];
      const safeEmployment = employment
        ? {
          ...employment,
          gross_salary: employment.gross_salary
            ? Number(employment.gross_salary)
            : null,
          basic_salary: employment.basic_salary
            ? Number(employment.basic_salary)
            : null,
          probation_end_date: employment.probation_end_date || (employment.start_date ? new Date(new Date(employment.start_date).getTime() + 90 * 24 * 60 * 60 * 1000) : null),
        }
        : null;

      // Format complex fields
      const formatDate = (d: any) =>
        d ? new Date(d).toLocaleDateString() : "";

      const experience_summary = emp.employmentHistories?.length
        ? emp.employmentHistories
          .map(
            (h: any) =>
              `• ${h.previous_job_title_text ||
              h.jobTitle?.title ||
              "Unknown Role"
              } at ${h.previous_company_name} (${formatDate(
                h.start_date
              )} - ${h.end_date ? formatDate(h.end_date) : "Present"})`
          )
          .join("\n")
        : "";

      const education_summary = emp.educations?.length
        ? emp.educations
          .map(
            (e: any) =>
              `• ${e.educationLevel?.name || "Unknown"} in ${e.fieldOfStudy?.name || "Unknown"
              } at ${e.institution?.name || "Unknown"}`,
          )
          .join("\n")
        : "";

      const allowance_summary = employment?.allowances?.length
        ? employment.allowances
          .map(
            (a: any) =>
              `• ${a.allowanceType?.name || "Allowance"}: ${a.amount} ${a.currency
              }`,
          )
          .join("\n")
        : "";

      const certifications_summary = emp.licensesAndCertifications?.length
        ? emp.licensesAndCertifications
          .map(
            (c: any) =>
              `• ${c.name} (${c.issuing_organization}) - ${c.issue_date ? formatDate(c.issue_date) : "No Date"
              }`,
          )
          .join("\n")
        : "";

      const doc = emp.documents;
      const documents_summary = doc
        ? [
          ...(doc.cv?.map((u: string) => `• CV: ${u}`) || []),
          ...(doc.certificates?.map((u: string) => `• Certificate: ${u}`) ||
            []),
          ...(doc.experienceLetters?.map(
            (u: string) => `• Exp Letter: ${u}`,
          ) || []),
          ...(doc.taxForms?.map((u: string) => `• Tax Form: ${u}`) || []),
          ...(doc.pensionForms?.map((u: string) => `• Pension Form: ${u}`) ||
            []),
          ...(doc.photo?.map((u: string) => `• Photo: ${u}`) || []),
        ]
          .filter(Boolean)
          .join("\n")
        : "";

      const emergency_contacts_summary = emp.emergencyContacts?.length
        ? emp.emergencyContacts
          .map(
            (ec: any) =>
              `• ${ec.full_name} (${ec.relationship}): ${ec.phone_number}`,
          )
          .join("\n")
        : "";

      const addresses_summary = emp.addresses?.length
        ? emp.addresses
          .map(
            (a: any) =>
              `• ${a.city}${a.sub_city ? `, ${a.sub_city}` : ""}${a.woreda ? ` (W: ${a.woreda})` : ""
              }`,
          )
          .join("\n")
        : "";

      const cost_sharing_summary = emp.costSharing?.length
        ? emp.costSharing
          .map(
            (cs: any) =>
              `• Amount: ${cs.declared_total_cost} ${cs.currency
              }\n  Payment Status: ${cs.payment_status}\n  Education: ${cs.education?.educationLevel?.name || "N/A"
              } at ${cs.education?.institution?.name || "N/A"}`,
          )
          .join("\n")
        : employment?.cost_sharing_amount
          ? `Amount: ${employment.cost_sharing_amount}\nPayment Status: ${employment.cost_sharing_payment_status || "N/A"
          }`
          : "N/A";

      return {
        ...emp,
        employment: safeEmployment,
        primary_phone: emp.phones[0]?.phone_number || "",
        primary_email: emp.appUsers[0]?.email || "",
        experience_summary,
        education_summary,
        allowance_summary,
        certifications_summary,
        documents_summary,
        cost_sharing_summary,
        emergency_contacts_summary,
        addresses_summary,
      };
    });

    // Get field definitions for selected fields
    const exportFields = selectedFields
      .map((key: string) => ALL_EMPLOYEE_FIELDS.find((f) => f.key === key))
      .filter(Boolean) as ExportField[];

    if (exportFields.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "No valid fields selected",
      });
    }

    // Check if there's data to export
    if (exportData_.length === 0) {
      return res.status(404).json({
        status: "fail",
        message: "No employees found matching the specified filters",
      });
    }

    // Generate export
    console.log(
      "[Export] Generating export with",
      exportFields.length,
      "fields for",
      exportData_.length,
      "employees",
    );
    // Get branding
    const { companyName, logoUrl, primaryColor } = await getCompanyBranding(
      companyId,
    );

    const result = await exportData({
      format,
      fields: exportFields,
      data: exportData_,
      title: "Employee Report",
      subtitle: `Generated on ${new Date().toLocaleDateString()}`,
      orientation: exportFields.length > 4 ? "landscape" : "portrait",
      pageSize:
        exportFields.length > 18
          ? "A2"
          : exportFields.length > 12
            ? "A3"
            : exportFields.length > 7
              ? "LEGAL"
              : "A4",
      companyName,
      logoUrl,
      primaryColor,
    });

    console.log("[Export] Export generated successfully, sending file");
    // Send file
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  } catch (error) {
    console.error("Export error:", error);
    next(error);
  }
};

// ============================================
// EXPORT EMPLOYMENTS
// ============================================

export const exportEmployments = async (
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

    const { format, fields: selectedFields, filters } = req.body;

    // Validate format
    if (!["pdf", "csv", "xlsx"].includes(format)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid format. Must be 'pdf', 'csv', or 'xlsx'",
      });
    }

    // Validate fields
    if (
      !selectedFields ||
      !Array.isArray(selectedFields) ||
      selectedFields.length === 0
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Please select at least one field to export",
      });
    }

    // Build where clause from filters
    const where: any = {
      company_id: companyId,
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
    };

    if (filters?.department_id) {
      where.department_id = parseInt(filters.department_id);
    }
    if (filters?.job_title_id) {
      where.job_title_id = parseInt(filters.job_title_id);
    }
    if (filters?.employment_type) {
      where.employment_type = filters.employment_type;
    }
    if (filters?.is_active !== undefined) {
      where.is_active =
        filters.is_active === true || filters.is_active === "true";
    }

    // Fetch employments
    const employments = await prisma.employment.findMany({
      where,
      include: {
        employee: { select: { id: true, full_name: true, gender: true } },
        department: true,
        jobTitle: true,
        manager: { select: { id: true, full_name: true } },
      },
      orderBy: { created_at: "desc" },
    });

    // Get field definitions for selected fields
    const exportFields = selectedFields
      .map((key: string) => ALL_EMPLOYMENT_FIELDS.find((f) => f.key === key))
      .filter(Boolean) as ExportField[];

    if (exportFields.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "No valid fields selected",
      });
    }

    // Get branding
    const { companyName, logoUrl, primaryColor } = await getCompanyBranding(
      companyId,
    );

    // Transform data for export to include implicit probation end date
    const transformedEmployments = employments.map(emp => ({
      ...emp,
      probation_end_date: emp.probation_end_date || (emp.start_date ? new Date(new Date(emp.start_date).getTime() + 90 * 24 * 60 * 60 * 1000) : null),
    }));

    // Generate export
    const result = await exportData({
      format,
      fields: exportFields,
      data: transformedEmployments,
      title: "Employment Report",
      subtitle: `Generated on ${new Date().toLocaleDateString()}`,
      orientation: exportFields.length > 4 ? "landscape" : "portrait",
      pageSize:
        exportFields.length > 18
          ? "A2"
          : exportFields.length > 12
            ? "A3"
            : exportFields.length > 7
              ? "LEGAL"
              : "A4",
      companyName,
      logoUrl,
      primaryColor,
    });

    // Send file
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
};

// ============================================
// EXPORT SINGLE EMPLOYEE PROFILE
// ============================================

export const exportEmployeeProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    const { format, sections } = req.body;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    // Validate format
    if (!["pdf", "csv", "xlsx"].includes(format)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid format. Must be 'pdf', 'csv', or 'xlsx'",
      });
    }

    // Fetch comprehensive employee data
    const employee = await prisma.employee.findFirst({
      where: { id, company_id: companyId },
      include: {
        addresses: true,
        phones: true,
        employments: {
          include: {
            department: true,
            jobTitle: true,
            manager: { select: { id: true, full_name: true } },
            allowances: { include: { allowanceType: true } },
          },
          orderBy: { created_at: "desc" },
        },
        educations: {
          include: {
            educationLevel: true,
            fieldOfStudy: true,
            institution: true,
          },
        },
        licensesAndCertifications: true,
        careerEvents: {
          include: {
            previousJobTitle: true,
            newJobTitle: true,
          },
          orderBy: { event_date: "desc" },
        },
        appUsers: { select: { email: true, onboarding_status: true } },
        leaveBalances: {
          include: { leaveType: true },
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    // For single employee export, we'll create a simplified version
    // A full implementation would create a multi-section document
    const activeEmployment = employee.employments.find((e) => e.is_active);
    const profileData = [
      {
        field: "Employee ID",
        value: employee.id,
      },
      {
        field: "Full Name",
        value: employee.full_name,
      },
      {
        field: "Gender",
        value: employee.gender || "N/A",
      },
      {
        field: "Date of Birth",
        value: employee.date_of_birth?.toLocaleDateString() || "N/A",
      },
      {
        field: "Department",
        value: activeEmployment?.department?.name || "N/A",
      },
      {
        field: "Job Title",
        value: activeEmployment?.jobTitle?.title || "N/A",
      },
      {
        field: "Employment Type",
        value: activeEmployment?.employment_type || "N/A",
      },
      {
        field: "Gross Salary",
        value: activeEmployment?.gross_salary?.toString() || "N/A",
      },
      {
        field: "Start Date",
        value: activeEmployment?.start_date?.toLocaleDateString() || "N/A",
      },
      {
        field: "Probation End Date",
        value: (activeEmployment?.probation_end_date || (activeEmployment?.start_date ? new Date(new Date(activeEmployment.start_date).getTime() + 90 * 24 * 60 * 60 * 1000) : null))?.toLocaleDateString() || "N/A",
      },
      {
        field: "Manager",
        value: activeEmployment?.manager?.full_name || "N/A",
      },
      {
        field: "TIN Number",
        value: employee.tin_number || "N/A",
      },
      {
        field: "Pension Number",
        value: employee.pension_number || "N/A",
      },
      {
        field: "Email",
        value: employee.appUsers[0]?.email || "N/A",
      },
      {
        field: "Phone",
        value: employee.phones.find((p) => p.is_primary)?.phone_number || "N/A",
      },
    ];

    // Get branding
    const { companyName, logoUrl, primaryColor } = await getCompanyBranding(
      companyId,
    );

    // Generate export
    const result = await exportData({
      format,
      fields: [
        { key: "field", label: "Field", width: 25 },
        { key: "value", label: "Value", width: 40 },
      ],
      data: profileData,
      title: `Employee Profile - ${employee.full_name}`,
      subtitle: `Employee ID: ${employee.id}`,
      orientation: "portrait",
      companyName,
      logoUrl,
      primaryColor,
    });

    // Send file
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
};

// ============================================
// EXPORT LEAVE APPLICATIONS
// ============================================

const ALL_LEAVE_FIELDS: ExportField[] = [
  // Most important first: Employee identifiers
  { key: "employee.id", label: "Employee ID", width: 15 },
  { key: "employee.full_name", label: "Full Name", width: 25 },
  // Optional employee info
  { key: "employee.gender", label: "Gender", width: 10 },
  { key: "employee_phone", label: "Phone Number", width: 18 },
  { key: "employee_email", label: "Email", width: 25 },
  // Date range and duration
  { key: "start_date", label: "Start Date", width: 15 },
  { key: "end_date", label: "End Date", width: 15 },
  { key: "duration_days", label: "Days", width: 10 },
  { key: "requested_days", label: "Days", width: 10 },
  // Leave details
  { key: "leaveType.name", label: "Leave Type", width: 20 },
  { key: "return_date", label: "Return Date", width: 15 },
  // Status and meta
  { key: "current_status", label: "Status", width: 20 },
  { key: "created_at", label: "Applied On", width: 15 },
  // Reasons
  { key: "reason", label: "Reason", width: 30 },
  { key: "rejection_reason", label: "Rejection Reason", width: 30 },
  // Relief officer
  { key: "reliefOfficer.full_name", label: "Relief Officer", width: 25 },
  // Application identifier (optional, at end)
  { key: "id", label: "Application ID", width: 15 },
  // Organization context (legacy keys for FE compatibility)
  {
    key: "employee.employments[0].department.name",
    label: "Department",
    width: 20,
  },
  {
    key: "employee.employments[0].jobTitle.title",
    label: "Job Title",
    width: 25,
  },
];

export const exportLeaves = async (
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

    const { format, fields: selectedFields, filters, scope } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        status: "fail",
        message: "User not authenticated",
      });
    }

    // Validate format
    if (!["pdf", "csv", "xlsx"].includes(format)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid format. Must be 'pdf', 'csv', or 'xlsx'",
      });
    }

    // Validate fields
    if (
      !selectedFields ||
      !Array.isArray(selectedFields) ||
      selectedFields.length === 0
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Please select at least one field to export",
      });
    }

    // Build Type-Safe Where Clause
    const where: any = {
      company_id: companyId,
    };

    // --- Role Based Filtering ---
    // If explicit personal view requested OR role is just Employee
    const userRole = (user as any)?.role || "";
    const isEmployee = userRole === "Employee";
    const isManager =
      userRole?.toLowerCase().includes("manager") ||
      userRole?.toLowerCase().includes("supervisor");
    const isAdmin = userRole.includes("Admin") || userRole.includes("HR");

    if (isEmployee || filters?.view === "personal") {
      where.employee_id = user.employee_id;
    } else if (isManager && !isAdmin) {
      // Team View Logic
      where.OR = [
        { employee_id: user.employee_id }, // Own leaves
        {
          employee: {
            employments: {
              some: {
                is_active: true,
                manager_id: user.employee_id,
              },
            },
          },
        },
      ];
    }
    // Admin sees all (no extra filter needed) but respects passed filters

    // --- Pending Tab Logic ---
    if (filters?.activeTab === "pending") {
      if (userRole === RoleNames.HR) {
        where.current_status = "PENDING_HR";
      } else if (
        ["CEO", "Managing Director", "General Manager"].includes(userRole)
      ) {
        where.current_status = "PENDING_CEO";
      } else if (
        user.employee_id &&
        userRole !== RoleNames.ADMIN &&
        userRole !== RoleNames.SUPERADMIN
      ) {
        // Supervisor - get applications from direct reports
        where.current_status = "PENDING_SUPERVISOR";
        where.employee = {
          ...where.employee,
          employments: {
            some: {
              ...(where.employee?.employments?.some || { is_active: true }),
              manager_id: user.employee_id,
            },
          },
        };
      } else {
        // Default Admin/HR/Superadmin sees all pending
        where.current_status = {
          in: ["PENDING_SUPERVISOR", "PENDING_HR", "PENDING_CEO"],
        };
      }
    }

    // --- General Filters ---
    // --- Scope / Selection Logic ---
    const ids = req.body.ids;
    if (
      (scope === "SELECTION" || (ids && ids.length > 0)) &&
      Array.isArray(ids)
    ) {
      where.id = { in: ids.map((id: any) => parseInt(id) || id) }; // Handle string/int IDs
    }

    // --- General Filters (Only apply if NOT Selection Scope, although technically selection overrides general filters usually) ---
    // User requested: "i want to select them on the frontned ... export only for thos peoples or employee i have selected"

    // --- General Filters (Only apply if NOT Selection Scope) ---
    if (
      filters?.status &&
      filters.status !== "ALL" &&
      filters.status !== "__all__"
    ) {
      const statusUpper = String(filters.status).toUpperCase();
      if (statusUpper === "PENDING") {
        where.current_status = {
          in: ["PENDING_SUPERVISOR", "PENDING_HR", "PENDING_CEO"],
        };
      } else {
        where.current_status = filters.status;
      }
    }

    if (filters?.leave_type_id && filters.leave_type_id !== "__all__") {
      where.leave_type_id = parseInt(filters.leave_type_id);
    }

    if (filters?.start_date) {
      where.start_date = { gte: new Date(filters.start_date) };
    }
    if (filters?.end_date) {
      where.end_date = { lte: new Date(filters.end_date) };
    }

    if (filters?.search) {
      where.OR = [
        ...(where.OR || []),
        {
          employee: {
            full_name: { contains: filters.search, mode: "insensitive" },
          },
        },
      ];
    }

    if (filters?.employee_id) {
      where.employee_id = filters.employee_id;
    }

    // Fetch Data
    const leaves = await prisma.leaveApplication.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        employee: {
          include: {
            employments: {
              orderBy: { created_at: "desc" },
              include: {
                department: true,
                jobTitle: true,
                manager: { select: { full_name: true } },
              },
              take: 1,
            },
            phones: { where: { is_primary: true }, take: 1 },
            appUsers: { select: { email: true }, take: 1 },
          },
        },
        leaveType: true,
        reliefOfficer: { select: { full_name: true } },
      },
    });

    // Flatten fields to avoid "object" in export and array indexing in keys
    const exportLeavesData = leaves.map((l: any) => {
      const activeEmployment = l.employee?.employments?.[0];
      return {
        ...l,
        // Ensure requested_days/duration are numeric
        requested_days: l.requested_days ? Number(l.requested_days) : null,
        duration_days: l.requested_days ? Number(l.requested_days) : null,
        // Flatten org fields for easy access in export
        department_name: activeEmployment?.department?.name || "",
        job_title: activeEmployment?.jobTitle?.title || "",
        // Flatten optional employee info
        employee_phone: l.employee?.phones?.[0]?.phone_number || "",
        employee_email: l.employee?.appUsers?.[0]?.email || "",
      };
    });

    // Normalize and de-duplicate selected fields while preserving order
    const KEY_SYNONYMS: Record<string, string> = {
      department_name: "employee.employments[0].department.name",
      job_title: "employee.employments[0].jobTitle.title",
    };
    const normalizedSelectedFields: string[] = Array.from(
      new Set(
        (selectedFields || [])
          .map((s: any) => String(s))
          .map((k: string) => KEY_SYNONYMS[k] || k),
      ),
    );

    // Get field definitions
    const exportFields = normalizedSelectedFields
      .map((key: string) => ALL_LEAVE_FIELDS.find((f) => f.key === key))
      .filter(Boolean) as ExportField[];

    if (exportFields.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "No valid fields selected",
      });
    }

    // Determine dynamic title
    let dynamicTitle = "Leave Applications Report";
    if (filters?.activeTab === "pending") {
      dynamicTitle = "Pending Leave Approvals Report";
    } else if (filters?.view === "personal" || scope === "SINGLE") {
      dynamicTitle = "Employee Leave History Report";
    } else if (filters?.activeTab === "on_leave") {
      dynamicTitle = "Currently On Leave Report";
    } else if (filters?.activeTab === "all") {
      dynamicTitle = "All Leave Applications Report";
    }

    // Get branding
    const { companyName, logoUrl, primaryColor } = await getCompanyBranding(
      companyId,
    );

    // Generate export
    const result = await exportData({
      format,
      fields: exportFields,
      data: exportLeavesData,
      title: dynamicTitle,
      subtitle: `Generated on ${new Date().toLocaleString()}`,
      orientation: exportFields.length > 6 ? "landscape" : "portrait",
      companyName,
      logoUrl,
      primaryColor,
    });

    // Send file
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
};

// ============================================
// EXPORT LEAVE BALANCES
// ============================================

const ALL_LEAVE_BALANCE_FIELDS: ExportField[] = [
  { key: "employee.id", label: "Employee ID", width: 15 },
  { key: "employee.full_name", label: "Full Name", width: 25 },
  { key: "employee.gender", label: "Gender", width: 10 },
  { key: "department_name", label: "Department", width: 20 },
  { key: "job_title", label: "Job Title", width: 25 },
  { key: "leaveType.name", label: "Leave Type", width: 20 },
  { key: "total_entitlement", label: "Total Entitlement", width: 15 },
  { key: "used_days", label: "Used Days", width: 12 },
  { key: "remaining_days", label: "Remaining Days", width: 15 },
  { key: "carried_over", label: "Carried Over", width: 12 },
  { key: "expiry_date", label: "Expiry Date", width: 15 },
  { key: "fiscal_year", label: "Year", width: 10 },
];

export const exportLeaveBalances = async (
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

    const { format, fields: selectedFields, filters, scope } = req.body;
    const ids = req.body.ids;

    // Validate format
    if (!["pdf", "csv", "xlsx"].includes(format)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid format. Must be 'pdf', 'csv', or 'xlsx'",
      });
    }

    // Validate fields
    if (
      !selectedFields ||
      !Array.isArray(selectedFields) ||
      selectedFields.length === 0
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Please select at least one field to export",
      });
    }

    // Build where clause
    const where: any = {
      company_id: companyId,
    };

    // Selection filter
    if (
      (scope === "SELECTION" || (ids && ids.length > 0)) &&
      Array.isArray(ids)
    ) {
      where.id = { in: ids.map((id: any) => parseInt(id) || id) };
    }

    // Year filter (fiscal_year)
    if (filters?.year) {
      where.fiscal_year = parseInt(filters.year);
    } else {
      where.fiscal_year = new Date().getFullYear();
    }

    // Leave type filter
    if (filters?.leave_type_id && filters.leave_type_id !== "" && filters.leave_type_id !== "__all__") {
      where.leave_type_id = parseInt(filters.leave_type_id as string);
    }

    // Department filter
    if (filters?.department_id && filters.department_id !== "") {
      where.employee = {
        ...where.employee,
        employments: {
          some: {
            department_id: parseInt(filters.department_id as string),
            is_active: true
          }
        }
      };
    }

    // Search filter
    if (filters?.search) {
      where.employee = {
        ...where.employee,
        full_name: { contains: filters.search, mode: "insensitive" }
      };
    }

    // Fetch leave balances
    const balances = await prisma.leaveBalance.findMany({
      where,
      orderBy: [{ employee_id: "asc" }, { leave_type_id: "asc" }],
      include: {
        employee: {
          include: {
            employments: {
              where: { is_active: true },
              include: {
                department: true,
                jobTitle: true,
              },
              take: 1,
            },
          },
        },
        leaveType: true,
      },
    });

    // Fetch leave settings for accrual configuration
    const leaveSettings = await prisma.leaveSettings.findUnique({
      where: { company_id: companyId },
    });
    const settings = leaveSettings as any;

    const accrualConfig = {
      baseDays: settings?.annual_leave_base_days ?? 16,
      divisor: settings?.accrual_divisor ?? 365,
      fiscalYearStartMonth: settings?.fiscal_year_start_month ?? 1,
      accrualBasis: settings?.accrual_basis ?? "ANNIVERSARY",
      incrementPeriodYears: settings?.increment_period_years ?? 2,
      incrementAmount: settings?.increment_amount ?? 1,
      maxCap: settings?.max_annual_leave_cap ?? null,
    };

    const round2 = (value: number): number => Number(value.toFixed(2));
    const toNum = (value: unknown): number => Number(value ?? 0);
    const today = new Date();

    // Flatten data for export with accrual calculation
    const exportData_ = balances.map((b: any) => {
      const activeEmployment = b.employee?.employments?.[0];
      const hireDate = activeEmployment?.start_date ?? null;
      const isAnnualLeave = b.leaveType?.code === "ANNUAL";

      let totalEntitlement = toNum(b.total_entitlement);
      let usedDays = toNum(b.used_days);
      let pendingDays = toNum(b.pending_days);
      let remainingDays = toNum(b.remaining_days);

      // Apply accrual calculation for Annual Leave (matching getMyLeaveBalance logic)
      if (isAnnualLeave && hireDate) {
        const baseDays = b.leaveType?.default_allowance_days || accrualConfig.baseDays;
        const incrementPeriod = b.leaveType?.incremental_period_years ?? accrualConfig.incrementPeriodYears;
        const incrementAmount = b.leaveType?.incremental_days_per_year ?? accrualConfig.incrementAmount;

        const accrualDetails = calculateAccruedBalance(
          new Date(hireDate),
          today,
          baseDays,
          accrualConfig.divisor,
          accrualConfig.fiscalYearStartMonth,
          incrementPeriod,
          incrementAmount,
          accrualConfig.maxCap,
          accrualConfig.accrualBasis as any
        );

        // Carried over + Accrued Current Year
        const carriedOverDays = toNum(b.total_entitlement);
        totalEntitlement = round2(carriedOverDays + accrualDetails.accruedDays);
        remainingDays = round2(Math.max(0, totalEntitlement - usedDays - pendingDays));
      }

      return {
        ...b,
        department_name: activeEmployment?.department?.name || "",
        job_title: activeEmployment?.jobTitle?.title || "",
        total_entitlement: totalEntitlement,
        used_days: usedDays,
        remaining_days: remainingDays,
        carried_over: toNum(b.carried_over),
        fiscal_year: b.fiscal_year ? String(b.fiscal_year) : "", // Cast to string to prevent numeric formatting in export
      };
    });

    // Get field definitions
    const exportFields = selectedFields
      .map((key: string) => ALL_LEAVE_BALANCE_FIELDS.find((f) => f.key === key))
      .filter(Boolean) as ExportField[];

    if (exportFields.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "No valid fields selected",
      });
    }

    // Get branding
    const { companyName, logoUrl, primaryColor } = await getCompanyBranding(
      companyId,
    );

    // Generate export
    const result = await exportData({
      format,
      fields: exportFields,
      data: exportData_,
      title: "Employee Leave Balances Report",
      subtitle: `Generated on ${new Date().toLocaleString()}`,
      orientation: exportFields.length > 6 ? "landscape" : "portrait",
      companyName,
      logoUrl,
      primaryColor,
    });

    // Send file
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
};

// ============================================
// EXPORT ON-LEAVE EMPLOYEES
// ============================================

const ALL_ON_LEAVE_FIELDS: ExportField[] = [
  { key: "employee_id", label: "Employee ID", width: 15 },
  { key: "full_name", label: "Full Name", width: 25 },
  { key: "gender", label: "Gender", width: 10 },
  { key: "email", label: "Email", width: 25 },
  { key: "phone_number", label: "Phone", width: 18 },
  { key: "department", label: "Department", width: 20 },
  { key: "job_title", label: "Job Title", width: 25 },
  { key: "manager_name", label: "Line Manager", width: 20 },
  { key: "leave_type", label: "Leave Type", width: 20 },
  { key: "start_date", label: "Start Date", width: 15 },
  { key: "end_date", label: "End Date", width: 15 },
  { key: "return_date", label: "Return Date", width: 15 },
  { key: "requested_days", label: "Days", width: 10 },
  { key: "is_paid", label: "Paid Leave", width: 10 },
  { key: "current_status", label: "Status", width: 20 },
  { key: "reason", label: "Reason", width: 30 },
  { key: "relief_officer", label: "Relief Officer", width: 25 },
  { key: "created_at", label: "Applied On", width: 15 },
  { key: "id", label: "Application ID", width: 15 },
];

export const exportOnLeaveEmployees = async (
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

    const { format, fields: selectedFields, scope, filters, ids } = req.body;

    // Validate format
    if (!["pdf", "csv", "xlsx"].includes(format)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid format. Must be 'pdf', 'csv', or 'xlsx'",
      });
    }

    // Validate fields
    if (
      !selectedFields ||
      !Array.isArray(selectedFields) ||
      selectedFields.length === 0
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Please select at least one field to export",
      });
    }

    // Robust Date Construction to ensure we get exactly today
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayString = `${year}-${month}-${day}`;

    // Force UTC comparison to avoid timezone shifts
    const today = new Date(`${todayString}T00:00:00.000Z`);
    const endOfDay = new Date(`${todayString}T23:59:59.999Z`);

    // Build where clause for on-leave employees
    const where: any = {
      company_id: companyId,
      current_status: "APPROVED",
      start_date: { lte: endOfDay },
      end_date: { gte: today },
      requested_days: { gt: 0 },
    };

    // --- Apply Filters ---

    // Selection filter
    if (
      (scope === "SELECTION" || (ids && ids.length > 0)) &&
      Array.isArray(ids)
    ) {
      where.id = { in: ids.map((id: any) => parseInt(id) || id) };
    }

    // Leave type filter
    if (filters?.leave_type_id && filters.leave_type_id !== "" && filters.leave_type_id !== "__all__") {
      where.leave_type_id = parseInt(filters.leave_type_id as string);
    }

    // Department filter
    if (filters?.department_id && filters.department_id !== "") {
      where.employee = {
        ...where.employee,
        employments: {
          some: {
            department_id: parseInt(filters.department_id as string),
            is_active: true
          }
        }
      };
    }

    // Search filter
    if (filters?.search) {
      where.employee = {
        ...where.employee,
        full_name: { contains: filters.search, mode: "insensitive" }
      };
    }

    // Fetch on-leave employees
    const onLeaveApplications = await prisma.leaveApplication.findMany({
      where,
      orderBy: { start_date: "asc" },
      include: {
        employee: {
          include: {
            employments: {
              where: { is_active: true },
              include: {
                department: true,
                jobTitle: true,
                manager: { select: { full_name: true } },
              },
              take: 1,
            },
            phones: { where: { is_primary: true }, take: 1 },
            appUsers: { select: { email: true }, take: 1 },
          },
        },
        leaveType: true,
        reliefOfficer: { select: { full_name: true } },
      },
    });

    // Flatten data for export
    const exportData_ = onLeaveApplications.map((app: any) => {
      const activeEmployment = app.employee?.employments?.[0];
      return {
        id: app.id,
        current_status: app.current_status,
        employee_id: app.employee?.id || "",
        full_name: app.employee?.full_name || "",
        gender: app.employee?.gender || "",
        email: app.employee?.appUsers?.[0]?.email || "",
        phone_number: app.employee?.phones?.[0]?.phone_number || "",
        department: activeEmployment?.department?.name || "",
        job_title: activeEmployment?.jobTitle?.title || "",
        manager_name: activeEmployment?.manager?.full_name || "",
        leave_type: app.leaveType?.name || "",
        start_date: app.start_date,
        end_date: app.end_date,
        return_date: app.return_date,
        requested_days: app.requested_days ? Number(app.requested_days) : 0,
        is_paid: app.leaveType?.is_paid ?? true ? "Yes" : "No",
        reason: app.reason || "",
        relief_officer: app.reliefOfficer?.full_name || "N/A",
        created_at: app.created_at,
      };
    });

    // Get field definitions
    const exportFields = selectedFields
      .map((key: string) => ALL_ON_LEAVE_FIELDS.find((f) => f.key === key))
      .filter(Boolean) as ExportField[];

    if (exportFields.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "No valid fields selected",
      });
    }

    // Get branding
    const { companyName, logoUrl, primaryColor } = await getCompanyBranding(
      companyId,
    );

    // Generate export
    const result = await exportData({
      format,
      fields: exportFields,
      data: exportData_,
      title: "Currently On Leave Report",
      subtitle: `Generated on ${new Date().toLocaleString()}`,
      orientation: exportFields.length > 6 ? "landscape" : "portrait",
      companyName,
      logoUrl,
      primaryColor,
    });

    // Send file
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
};
