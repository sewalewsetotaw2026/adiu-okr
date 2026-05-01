import express from "express";

import authRoutes from "src/routes/authRoutes";
import companyRoutes from "src/routes/companyRoutes";
import employeeRoutes from "src/routes/employeeRoutes";
import employmentRoutes from "src/routes/employmentRoutes";
import roleRoutes from "src/routes/roleRoutes";
import userRoutes from "src/routes/userRoutes";
import employeePhoneRoutes from "src/routes/employeePhoneRoutes";
import employeeAddressRoutes from "src/routes/employeeAddressRoutes";
import certificationRoutes from "src/routes/certificationRoutes";
import educationRoutes from "src/routes/educationRoutes";
import employmentHistoryRoutes from "src/routes/employmentHistoryRoutes";
import jobTitleRoutes from "src/routes/jobTitleRoutes";
import jobLevelRoutes from "src/routes/jobLevelRoutes";
import departmentRoutes from "src/routes/departmentRoutes";
import onboardingRoutes from "src/routes/onboardingRoutes";
import allowanceTypeRoutes from "src/routes/allowanceTypeRoutes";
import exportRoutes from "src/routes/exportRoutes";
import analyticsRoutes from "src/routes/analyticsRoutes";
import assignManagerRoutes from "src/routes/assignManagerRoutes";
import suggestionRoutes from "src/routes/suggestionRoutes";
import uploadRoutes from "src/routes/uploadRoutes";
import fieldOfStudyRoutes from "src/routes/fieldOfStudyRoutes";
import institutionRoutes from "src/routes/institutionRoutes";
import employeeSettingsRoutes from "src/routes/employeeSettingsRoutes";

import careerRoutes from "src/routes/careerRoutes";
import experienceLetterRoutes from "src/routes/experienceLetterRoutes";
import certificateOfServiceRoutes from "src/routes/certificateOfServiceRoutes";
import resignationLetterRoutes from "src/routes/resignationLetterRoutes";

// Leave Management Routes
import leaveTypeRoutes from "src/routes/leaveTypeRoutes";
import leaveApplicationRoutes from "src/routes/leaveApplicationRoutes";
import leaveBalanceRoutes from "src/routes/leaveBalanceRoutes";
import publicHolidayRoutes from "src/routes/publicHolidayRoutes";
import leaveRecallRoutes from "src/routes/leaveRecallRoutes";
import leaveSettingsRoutes from "src/routes/leaveSettingsRoutes";
import leaveCashOutRoutes from "src/routes/leaveCashOutRoutes";

// Notification & Manager Routes
import notificationRoutes from "src/routes/notificationRoutes";
import managerRoutes from "src/routes/managerRoutes";
import emergencyContactRoutes from "src/routes/emergencyContactRoutes";
import bankRoutes from "src/routes/bankRoutes";
import financialDetailRoutes from "src/routes/financialDetailRoutes";
import profilePictureRoutes from "src/routes/profilePictureRoutes";
import documentSignerConfigRoutes from "src/routes/documentSignerConfigRoutes";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/employees", employeeRoutes);
router.use("/employments", employmentRoutes);
router.use("/users", userRoutes);
router.use("/companies", companyRoutes);
router.use("/roles", roleRoutes);
router.use("/job-titles", jobTitleRoutes);
router.use("/job-levels", jobLevelRoutes);
router.use("/departments", departmentRoutes);
router.use("/employee-phones", employeePhoneRoutes);
router.use("/employee-addresses", employeeAddressRoutes);
router.use("/certifications", certificationRoutes);
router.use("/educations", educationRoutes);
router.use("/employment-history", employmentHistoryRoutes);
router.use("/onboarding", onboardingRoutes);
router.use("/allowance-types", allowanceTypeRoutes);
router.use("/export", exportRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/assign-managers", assignManagerRoutes);
router.use("/suggestions", suggestionRoutes);
router.use("/upload", uploadRoutes);
router.use("/field-of-study", fieldOfStudyRoutes);
router.use("/institutions", institutionRoutes);
router.use("/employee-settings", employeeSettingsRoutes);

// Leave Management
router.use("/leave-types", leaveTypeRoutes);
router.use("/leave-applications", leaveApplicationRoutes);
router.use("/leave-balances", leaveBalanceRoutes);
router.use("/public-holidays", publicHolidayRoutes);
router.use("/leave-recalls", leaveRecallRoutes);
router.use("/leave-settings", leaveSettingsRoutes);
router.use("/leave-cash-out", leaveCashOutRoutes);

// Career Management
router.use("/career", careerRoutes);
router.use("/experience-letter", experienceLetterRoutes);
router.use("/certificate-of-service", certificateOfServiceRoutes);
router.use("/resignation-letter", resignationLetterRoutes);

// Notifications & Manager
router.use("/notifications", notificationRoutes);
router.use("/manager", managerRoutes);

router.use("/emergency-contacts", emergencyContactRoutes);
router.use("/banks", bankRoutes);
router.use("/financial-details", financialDetailRoutes);
router.use("/employees", profilePictureRoutes); // Mount at employees for /employees/:id/profile-picture
router.use("/document-signer-config", documentSignerConfigRoutes);

// Celebration System
import celebrationRoutes from "src/routes/celebrationRoutes";
router.use("/celebrations", celebrationRoutes);

// Platform / Super Admin Routes
import platformRoutes from "src/routes/platformRoutes";
router.use("/platform", platformRoutes);

// OKR Module
import okrCycleRoutes from "src/routes/okrCycleRoutes";
import okrCompanyRoutes from "src/routes/okrCompanyRoutes";
import okrDepartmentRoutes from "src/routes/okrDepartmentRoutes";
import okrContributorRoutes from "src/routes/okrContributorRoutes";
import okrEmployeeRoutes from "src/routes/okrEmployeeRoutes";
import okrManagerRoutes from "src/routes/okrManagerRoutes";
import okrManagerPlanRoutes from "src/routes/okrManagerPlanRoutes";
import okrMetricRoutes from "src/routes/okrMetricRoutes";
import okrAuditRoutes from "src/routes/okrAuditRoutes";
import okrDashboardRoutes from "src/routes/okrDashboardRoutes";
import okrArchiveRoutes from "src/routes/okrArchiveRoutes";
import okrConfigRoutes from "src/routes/okrConfigRoutes";
import okrApprovalRoutes from "src/routes/okrApprovalRoutes";
router.use("/okr/approvals", okrApprovalRoutes);
router.use("/okr/cycles", okrCycleRoutes);
router.use("/okr/company", okrCompanyRoutes);
router.use("/okr/department", okrDepartmentRoutes);
router.use("/okr/contributors", okrContributorRoutes);
router.use("/okr/employee", okrEmployeeRoutes);
router.use("/okr/manager", okrManagerRoutes);
router.use("/okr/manager-plans", okrManagerPlanRoutes);
router.use("/okr/metrics", okrMetricRoutes);
router.use("/okr/configurations", okrConfigRoutes);
router.use("/okr/audit", okrAuditRoutes);
router.use("/okr/dashboard", okrDashboardRoutes);
router.use("/okr", okrArchiveRoutes);

export default router;
