import express from "express";
import {
  createEmployee,
  fetchAllEmployee,
  fetchEmployee,
  fetchEmployeeDetail,
  countEmployees,
  updateEmployee,
  deleteEmployee,
  approveOnboarding,
  getMe,
  assignManager,
  activateEmployee,
  getTabCounts,
  getSyncReport,
} from "src/controllers/employeeController";
import { generateExperienceLetter } from "src/controllers/experienceLetterController";
import { exportEmployees } from "src/controllers/exportController";
import {
  fetchAllAddresses,
  fetchAddress,
  createAddress,
  bulkCreateAddresses,
  updateAddress,
  deleteAddress,
  bulkDeleteAddresses,
  replaceEmployeeAddresses
} from "../controllers/employeeAddressController";
import {
  fetchAllPhones,
  fetchPhone,
  createPhone,
  bulkCreatePhones,
  updatePhone,
  deletePhone,
  bulkDeletePhones,
  replaceEmployeePhones
} from "../controllers/employeePhoneController";
import {
  getContactInfo,
  createContactInfo,
  updateContactInfo,
  bulkCreatePhones as bulkCreateContactPhones,
} from "../controllers/contactInfoController";
import { replaceEmployeeEducations } from "src/controllers/educationController";
import { replaceEmployeeEmploymentHistory } from "src/controllers/employmentHistoryController";
import { replaceEmployeeCertifications } from "src/controllers/certificationController";
import { replaceEmployeeDocuments } from "src/controllers/employeeDocumentController";
import { replaceEmployeeEmploymentDetails } from "src/controllers/employmentController";
import {
  updatePersonalDetails,
  updateEmployeeSignature,
} from "src/controllers/employeePersonalController";
import { updateFinancialDetails } from "src/controllers/employeeFinancialController";
import { replaceEmployeeFinancialDetails } from "../controllers/financialDetailController";
import { protect, restrictTo } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

import { cacheMiddleware } from "src/middleware/cacheMiddleware";

const router = express.Router();

// protect all routes
router.use(protect);

router.get(
  "/",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.READ_ANY),
  cacheMiddleware("employees", 1800), // Cache for 30 minutes
  fetchAllEmployee,
);

router.post(
  "/export",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.READ_ANY),
  exportEmployees
);

router.get(
  "/count",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.READ_ANY),
  cacheMiddleware("employees", 1800),
  countEmployees,
);

router.get(
  "/tab-counts",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.READ_ANY),
  getTabCounts,
);


router.get(
  "/sync-report",
  restrictTo("Admin", "ADMIN", "Super Admin", "SUPER_ADMIN", "HR", "HR Generalist", "HR CS Manager", "HR CS Director"),
  getSyncReport,
);

router.get(
  "/me",
  getMe,
);

router.get(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.READ_OWN),
  cacheMiddleware("employees", 1800),
  fetchEmployee,
);

router.get(
  "/:id/detail",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.READ_OWN),
  cacheMiddleware("employees", 1800),
  fetchEmployeeDetail,
);

router.get(
  "/:id/experience-letter",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.READ_OWN),
  generateExperienceLetter,
);

router.post(
  "/",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.CREATE_ANY),
  createEmployee,
);

router.put(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.UPDATE_ANY),
  updateEmployee,
);

router.delete(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.DELETE_ANY),
  deleteEmployee,
);

// Contact Info Routes
router.get(
  "/:employeeId/contact-info",
  verifyAccessControl(Resources.EMERGENCY_CONTACT, ActionTypes.READ_OWN),
  getContactInfo,
);

router.post(
  "/contact-info",
  verifyAccessControl(Resources.EMERGENCY_CONTACT, ActionTypes.CREATE_OWN),
  createContactInfo,
);

router.put(
  "/:employeeId/contact-info",
  verifyAccessControl(Resources.EMERGENCY_CONTACT, ActionTypes.UPDATE_OWN),
  updateContactInfo,
);

router.post(
  "/contact-info/phones/bulk",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.CREATE_ANY),
  bulkCreateContactPhones,
);

// Emergency Contact Routes
import {
  createEmergencyContact,
  getEmergencyContacts,
  updateEmergencyContact,
  deleteEmergencyContact,
  replaceEmployeeEmergencyContacts
} from "../controllers/emergencyContactController";

router.get(
  "/:employeeId/emergency-contacts",
  verifyAccessControl(Resources.EMERGENCY_CONTACT, ActionTypes.READ_OWN),
  getEmergencyContacts
);

router.post(
  "/:employeeId/emergency-contacts",
  verifyAccessControl(Resources.EMERGENCY_CONTACT, ActionTypes.CREATE_OWN),
  createEmergencyContact
);

router.put(
  "/emergency-contacts/:id",
  verifyAccessControl(Resources.EMERGENCY_CONTACT, ActionTypes.UPDATE_OWN),
  updateEmergencyContact
);

router.delete(
  "/emergency-contacts/:id",
  verifyAccessControl(Resources.EMERGENCY_CONTACT, ActionTypes.DELETE_OWN),
  deleteEmergencyContact
);

router.patch(
  "/:id/emergency-contacts",
  verifyAccessControl(Resources.EMERGENCY_CONTACT, ActionTypes.UPDATE_OWN),
  replaceEmployeeEmergencyContacts
);

router.post(
  "/:id/approve-onboarding",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.UPDATE_ANY),
  approveOnboarding,
);

router.patch(
  "/:id/assign-manager",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.UPDATE_ANY),
  assignManager,
);

router.patch(
  "/:id/activate",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.UPDATE_ANY),
  activateEmployee,
);


// Granular Updates
router.patch(
  "/:id/personal-details",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.UPDATE_OWN),
  updatePersonalDetails
);

router.patch(
  "/:id/financial-details",
  verifyAccessControl(Resources.FINANCIAL_DETAIL, ActionTypes.UPDATE_OWN),
  updateFinancialDetails
);

router.patch(
  "/:id/employment-details",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.UPDATE_ANY), // Employment details usually Admin only
  replaceEmployeeEmploymentDetails
);

router.patch(
  "/:id/education-details",
  verifyAccessControl(Resources.EMPLOYEE_EDUCATION, ActionTypes.UPDATE_OWN),
  replaceEmployeeEducations
);

router.patch(
  "/:id/work-experience-details",
  verifyAccessControl(Resources.EMPLOYEE_EXPERIENCE, ActionTypes.UPDATE_OWN),
  replaceEmployeeEmploymentHistory
);

router.patch(
  "/:id/certifications-details",
  verifyAccessControl(Resources.EMPLOYEE_CERTIFICATE, ActionTypes.UPDATE_OWN),
  replaceEmployeeCertifications
);

router.patch(
  "/:id/documents-details",
  verifyAccessControl(Resources.EMPLOYEE_DOCUMENT, ActionTypes.UPDATE_OWN),
  replaceEmployeeDocuments
);

router.patch(
  "/:id/addresses",
  verifyAccessControl(Resources.EMPLOYEE_ADDRESS, ActionTypes.UPDATE_OWN),
  replaceEmployeeAddresses
);

router.patch(
  "/:id/phones",
  verifyAccessControl(Resources.EMPLOYEE_PHONE, ActionTypes.UPDATE_OWN),
  replaceEmployeePhones
);

router.patch(
  "/:id/bank-accounts",
  verifyAccessControl(Resources.FINANCIAL_DETAIL, ActionTypes.UPDATE_OWN),
  replaceEmployeeFinancialDetails
);

router.patch(
  "/:id/signature",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.UPDATE_OWN),
  updateEmployeeSignature
);

export default router;
