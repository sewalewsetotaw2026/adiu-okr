import { call, put, takeLatest, select } from "redux-saga/effects";
import { employeeDetailActions } from ".";
import { selectEmployee } from "./selectors";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import { uploadService } from "../../../../services/uploadService";
import employeeService from "../../../../services/employeeService";
import ToastService from "../../../../../utils/ToastService";

// Remove the local uploadFile helper since we use uploadService now

// Helper to invoke uploadService which is promise-based
const uploadFileService = async (file: File) => {
  try {
    const path = await uploadService.uploadFile(file);
    return path;
  } catch (error) {
    console.error("Upload Service Failed:", error);
    throw error;
  }
};

const enrichEmployeeDetail = (employee: any) => {
  const emp = employee.employments?.[0] || {};
  return {
    ...employee,
    email: employee.email || employee.appUsers?.[0]?.email || "-",
    onboarding_status:
      employee.onboarding_status || employee.appUsers?.[0]?.onboarding_status,
    profilePicture:
      employee.profilePicture ||
      employee.profile_picture ||
      employee.appUsers?.[0]?.profile_picture,
    role: employee.role || employee.appUsers?.[0]?.role?.name || "-",
    phone: employee.phone || employee.phones?.[0]?.phone_number || "-",
    department:
      employee.department?.name ||
      (typeof employee.department === "string" ? employee.department : null) ||
      emp.department?.name ||
      "Unassigned",
    job_title:
      employee.job_title ||
      employee.jobTitle ||
      emp.jobTitle?.title ||
      emp.job_title ||
      "-",
    job_level: employee.job_level || emp.jobTitle?.level || "-",
    start_date: employee.start_date || emp.start_date || "-",
    employment_type: employee.employment_type || emp.employment_type || "-",
  };
};

export function* fetchEmployee(
  action: ReturnType<typeof employeeDetailActions.fetchEmployeeRequest>,
): Generator<any, void, any> {
  try {
    const id = action.payload;
    const response: any = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.employeeDetail(id),
      isSecureRoute: true,
    });

    console.log("the fetchEmployee response", response);

    if (response?.data?.data?.employee) {
      const employee = response.data.data.employee;
      const enrichedEmployee = enrichEmployeeDetail(employee);
      yield put(employeeDetailActions.fetchEmployeeSuccess(enrichedEmployee));
    } else {
      throw new Error("Invalid response format: employee data missing");
    }
  } catch (error: any) {
    yield put(
      employeeDetailActions.fetchEmployeeFailure(
        error.message || "Failed to fetch employee details",
      ),
    );
  }
}

export function* approveEmployee(
  action: ReturnType<typeof employeeDetailActions.approveEmployeeRequest>,
): Generator<any, void, any> {
  try {
    const id = action.payload;
    yield call(makeCall, {
      method: "POST",
      route: apiRoutes.approveOnboarding(id),
      isSecureRoute: true,
    });
    yield put(employeeDetailActions.approveEmployeeSuccess());
    yield put(employeeDetailActions.fetchEmployeeRequest(id)); // Refresh details
  } catch (error: any) {
    yield put(employeeDetailActions.approveEmployeeFailure(error.message));
  }
}

export function* updateEmployee(
  action: ReturnType<typeof employeeDetailActions.updateEmployeeRequest>,
): Generator<any, void, any> {
  try {
    const { id, section, ...body }: any = action.payload;

    // Handle File Uploads using Triangular Workflow (uploadService)

    // 1. Education Documents
    // 1. Education Documents - Handled in main education block below
    // if ((!section || section === "education") && body.education) { ... }

    // 2. Work Experience
    if ((!section || section === "experience") && body.work_experience) {
      for (const exp of body.work_experience) {
        if (exp.document instanceof File) {
          try {
            exp.documentUrl = yield call(uploadFileService, exp.document);
          } catch (e: any) {
            throw new Error(
              `Failed to upload experience document: ${e.message}`,
            );
          }
          delete exp.document;
        }
      }
    }

    // 3. Certifications
    if ((!section || section === "certifications") && body.certifications) {
      for (const cert of body.certifications) {
        if (cert.certificateDocument instanceof File) {
          try {
            cert.documentUrl = yield call(
              uploadFileService,
              cert.certificateDocument,
            );
          } catch (e: any) {
            throw new Error(`Failed to upload certification: ${e.message}`);
          }
          delete cert.certificateDocument;
        }
      }
    }

    // 4. Documents
    if (
      (!section || section === "documents" || section === "personal") &&
      body.documents
    ) {
      // Note: 'personal' check added because Profile Picture logic is often entwined with 'documents' (PHOTO type)
      // but specific profile picture field is handled in personalData.
      // If the user updates profile pic in Personal tab, it might come as a file in documents['photo'].

      const finalDocs: any[] = [];
      for (const item of body.documents as any[]) {
        // Optimization: Only process relevant document types if section is specific?
        // For now, process all if the section matches 'documents' or 'personal' to be safe.

        if (item.file instanceof File) {
          try {
            // Unified upload for ALL types, including PHOTO
            const path: string = yield call(uploadFileService, item.file);

            if (item.type === "PHOTO") {
              // For Photo, we put the path on the root 'profilePicture' field too
              body.profilePicture = path;
              // Also add to documents array as usual
              finalDocs.push({
                type: "PHOTO",
                url: path,
                name: item.file.name,
              });
            } else {
              finalDocs.push({
                type: item.type,
                url: path,
                name: item.file.name,
              });
            }
          } catch (e: any) {
            throw new Error(
              `Failed to upload document (${item.type}): ${e.message}`,
            );
          }
        } else if (item.url || item.document_url || item.documentUrl) {
          // If it's an existing document, ensure it uses type/url/name keys
          finalDocs.push({
            id: item.id,
            type: item.type,
            url: item.url || item.document_url || item.documentUrl,
            name: item.name || item.file_name,
          });
        }
      }
      body.documents = finalDocs;
    }

    // Clean payload of helper fields and map camelCase to snake_case
    const cleanCollection = (arr: any[]) => {
      // NOTE: We only use this for non-education collections now OR manual invocation inside education loop
      if (!arr) return [];
      return arr.map((item) => {
        const newItem = { ...item };

        // Map camelCase to snake_case
        if (newItem.documentUrl) {
          newItem.document_url = newItem.documentUrl;
          delete newItem.documentUrl;
        }
        if (newItem.costSharingDocumentUrl) {
          newItem.cost_sharing_document_url = newItem.costSharingDocumentUrl;
          delete newItem.costSharingDocumentUrl;
        }
        if (newItem.credentialUrl) {
          newItem.credential_url = newItem.credentialUrl;
          delete newItem.credentialUrl;
        }

        // Remove helper fields used by wizard steps
        delete newItem.document;
        delete newItem.certificateDocument;
        delete newItem.costSharingDocument;
        delete newItem.costSharingDocumentUrls; // Added removal of new helper

        // Also remove any literal nulls
        if (newItem.document_url === null) delete newItem.document_url;
        if (newItem.cost_sharing_document_url === null)
          delete newItem.cost_sharing_document_url;
        if (newItem.credential_url === null) delete newItem.credential_url;

        return newItem;
      });
    };

    // Removed body.education cleaning here to preserve files for the loop below
    if (body.work_experience)
      body.work_experience = cleanCollection(body.work_experience);
    if (body.certifications)
      body.certifications = cleanCollection(body.certifications);

    // Split payload into granular chunks
    const p = body;
    const personalData = {
      full_name: p.full_name,
      gender: p.gender,
      date_of_birth: p.date_of_birth,
      tin_number: p.tin_number,
      pension_number: p.pension_number,
      place_of_work: p.place_of_work,
      profile_picture: p.profilePicture, // mapped from upload step
      onboarding_status: p.onboarding_status,
    };

    const employmentData = {
      job_title: p.job_title,
      job_title_id: p.job_title_id,
      job_level: p.job_level,
      department: p.department,
      department_id: p.department_id,
      employment_type: p.employment_type,
      start_date: p.start_date,
      gross_salary: p.gross_salary,
      basic_salary: p.basic_salary,
      allowances: p.allowances,
    };

    const contactData = {
      addresses: p.address, // API expects addresses
      phones: p.phones,
    };

    const educationData = { education: p.education };
    const xpData = { workExperience: p.work_experience };
    const certData = { certifications: p.certifications };
    const docData = { documents: p.documents };

    // Build local update object
    const localUpdate: any = {};
    const promises: any[] = [];

    // Personal
    if (!section || section === "personal") {
      Object.assign(localUpdate, personalData);
      if (personalData.profile_picture)
        localUpdate.profile_picture = personalData.profile_picture;
      // Use service
      promises.push(employeeService.updatePersonalDetails(id, personalData));
    }

    // Financial (New Section)
    if (!section || section === "financial") {
      // Since financial data comes from the same form state as employment in some steps, we need to extract it carefully.
      // The 'employmentData' object constructed above has gross/basic/allowances.
      const financialPayload = {
        gross_salary: employmentData.gross_salary,
        basic_salary: employmentData.basic_salary,
        allowances: employmentData.allowances,
        bank_account_number: p.bank_account_number,
        bank_name: p.bank_name,
        tin_number: p.tin_number,
      };
      promises.push(
        employeeService.updateFinancialDetails(id, financialPayload),
      );

      // Handle bank accounts (financialDetails array)
      if (p.financialDetails && Array.isArray(p.financialDetails)) {
        localUpdate.financialDetails = p.financialDetails;
        promises.push(
          employeeService.updateBankAccounts(id, p.financialDetails),
        );
      }

      // Update local state for optimistic UI (if needed)
      // Note: complex nested updates like allowances might need refetch or careful reducer handling
    }

    // Employment
    if (!section || section === "employment") {
      Object.assign(localUpdate, employmentData);
      promises.push(
        employeeService.updateEmploymentDetails(id, employmentData),
      );

      if (
        employmentData.basic_salary !== undefined ||
        employmentData.gross_salary !== undefined ||
        employmentData.allowances
      ) {
        const currentEmployee: any = yield select(selectEmployee);
        if (currentEmployee && currentEmployee.employments) {
          const newEmployments = currentEmployee.employments.map((emp: any) => {
            if (emp.is_active) {
              return {
                ...emp,
                basic_salary: employmentData.basic_salary ?? emp.basic_salary,
                gross_salary: employmentData.gross_salary ?? emp.gross_salary,
                allowances:
                  employmentData.allowances?.map((a: any) => ({
                    allowanceType: { name: a.name },
                    amount: a.amount,
                  })) || emp.allowances,
              };
            }
            return emp;
          });
          localUpdate.employments = newEmployments;
        }
      }
    }

    // Contact
    if (!section || section === "contact") {
      if (contactData.addresses) {
        localUpdate.addresses = contactData.addresses;
        promises.push(
          employeeService.updateAddresses(id, contactData.addresses),
        );
      }
      if (contactData.phones) {
        localUpdate.phones = contactData.phones;
        promises.push(employeeService.updatePhones(id, contactData.phones));
      }

      if (p.emergencyContacts) {
        localUpdate.emergencyContacts = p.emergencyContacts;
        promises.push(
          employeeService.updateEmergencyContacts(id, p.emergencyContacts),
        );
      }
    }

    // Signature
    if (section === "signature") {
      localUpdate.signature_url = body.signature_url;
      promises.push(employeeService.updateSignature(id, { signature_url: body.signature_url }));
    }

    // Collections
    if ((!section || section === "education") && body.education) {
      const educationPayload: any[] = [];

      for (const edu of body.education) {
        // Handle new multi-file upload for education documents
        const processedDocUrls: string[] = [];

        // Keep existing URLs
        if (edu.document_urls && Array.isArray(edu.document_urls)) {
          edu.document_urls.forEach((doc: any) => {
            if (typeof doc === "string") processedDocUrls.push(doc);
            else if (doc.url) processedDocUrls.push(doc.url);
          });
        } else if (edu.documentUrl) {
          const docUrl = Array.isArray(edu.documentUrl) ? edu.documentUrl : [edu.documentUrl];
          processedDocUrls.push(...docUrl);
        }

        // Handle new file uploads in document_urls array
        if (edu.document_urls && Array.isArray(edu.document_urls)) {
          for (const doc of edu.document_urls) {
            if (doc.file instanceof File) {
              try {
                const url = yield call(uploadFileService, doc.file);
                processedDocUrls.push(url);
              } catch (e: any) {
                console.error("Education Document Upload Failed", e);
              }
            }
          }
        }

        // Legacy single document handling (fallback)
        if (edu.document instanceof File) {
          try {
            const url = yield call(uploadFileService, edu.document);
            processedDocUrls.push(url);
          } catch (e: any) {
            throw new Error(
              `Failed to upload education document: ${e.message}`,
            );
          }
        }

        // Handle Cost Sharing Documents (Multi-file)
        const processedCostSharingUrls: string[] = [];

        // Process costSharingDocumentUrls array if present (passed from frontend)
        const csDocs = edu.costSharingDocumentUrls ||
          (Array.isArray(edu.costSharingDocument) ? edu.costSharingDocument : (edu.costSharingDocument ? [edu.costSharingDocument] : []));

        if (Array.isArray(csDocs)) {
          for (const doc of csDocs) {
            if (doc instanceof File) {
              try {
                const path = yield call(uploadFileService, doc);
                processedCostSharingUrls.push(path);
              } catch (e: any) {
                console.error("Cost Sharing Upload Failed", e);
                throw new Error(
                  `Failed to upload cost sharing document: ${e.message}`,
                );
              }
            } else if (typeof doc === "string") {
              processedCostSharingUrls.push(doc);
            } else if (doc && doc.url) {
              processedCostSharingUrls.push(doc.url);
            }
          }
        }

        // Fallback for single existing url if not covered above
        if (
          processedCostSharingUrls.length === 0 &&
          edu.costSharingDocumentUrl
        ) {
          processedCostSharingUrls.push(edu.costSharingDocumentUrl);
        }

        // Construct backend payload item
        educationPayload.push({
          ...edu,
          // Manually apply snake_case mapping for this item since we skipped cleanCollection
          document_urls: processedDocUrls,
          document_url: processedDocUrls[0] || null, // Backwards compatibility
          cost_sharing_document_urls: processedCostSharingUrls,
          cost_sharing_document_url: processedCostSharingUrls[0] || null,
          // Map nested cost sharing fields to flat snake_case fields expected by backend
          cost_sharing_document_number: edu.costSharing?.documentNumber,
          cost_sharing_issuing_institution: edu.costSharing?.issuingInstitution,
          cost_sharing_issue_date: edu.costSharing?.issueDate,
          has_cost_sharing: edu.hasCostSharing,
          payment_status: edu.costSharing?.paymentStatus,
          cost_sharing_details: edu.costSharing?.remarks, // Mapping remarks to details if needed
          cost_sharing_amount: edu.costSharing?.declaredTotalCost, // Backend expects declared_total_cost or amount? Controller says 'declared_total_cost' at line 203 but takes 'cost_sharing_amount' from body?
          // Checking controller line 186/203: `declared_total_cost: cost_sharing_amount ? parseFloat(cost_sharing_amount) : 0`
          // So we send `cost_sharing_amount`.
          currency: edu.costSharing?.currency,
          commitment_type: edu.costSharing?.commitmentType,
          regulation_reference: edu.costSharing?.regulationReference,
          cost_sharing_remarks: edu.costSharing?.remarks,
        });
      }
      console.log("cost sharing info from shared employee", educationPayload);

      // Optimistic Update mapping
      localUpdate.educations = educationPayload.map((e: any) => ({
        ...e,
        institution: {
          name:
            typeof e.institution === "string"
              ? e.institution
              : e.institution?.name,
          category:
            e.institution_category ||
            e.institutionCategory ||
            e.institution?.category,
        },
        fieldOfStudy: {
          name:
            typeof e.field_of_study === "string"
              ? e.field_of_study
              : e.fieldOfStudy?.name,
        },
        educationLevel: {
          name:
            typeof e.level === "string" ? e.level : e.educationLevel || e.level,
        },
        costSharings: e.has_cost_sharing
          ? [
            {
              document_number: e.cost_sharing_document_number,
              issuing_institution: e.cost_sharing_issuing_institution,
              issue_date: e.cost_sharing_issue_date,
              declared_total_cost: e.cost_sharing_amount,
              remarks: e.cost_sharing_remarks,
              document_urls: e.cost_sharing_document_urls,
              payment_status: e.payment_status,
              currency: e.currency,
              commitment_type: e.commitment_type,
              regulation_reference: e.regulation_reference,
            },
          ]
          : [],
      }));

      promises.push(employeeService.updateEducation(id, educationPayload));
    }
    if ((!section || section === "experience") && xpData.workExperience) {
      localUpdate.employmentHistories = xpData.workExperience;
      promises.push(
        employeeService.updateWorkExperience(id, xpData.workExperience),
      );
    }
    if ((!section || section === "certifications") && certData.certifications) {
      localUpdate.licensesAndCertifications = certData.certifications;
      promises.push(
        employeeService.updateCertifications(id, certData.certifications),
      );
    }
    if ((!section || section === "documents") && docData.documents) {
      const docsPayload = docData.documents.map((d: any) => ({
        ...d,
        document_type: d.type,
        document_url: d.url,
        file_name: d.name,
      }));

      // Update local state with array format
      localUpdate.documents = docsPayload;

      // Transform to Object format for Backend Controller
      const backendPayload: any = {
        cv: [],
        national_id: [],
        guarantee_letter: [],
        medical_certificate: [],
        police_certificate: [],
        tax_forms: [],
        pension_forms: [],
      };

      docsPayload.forEach((d: any) => {
        if (d.url && backendPayload[d.type]) {
          backendPayload[d.type].push(d.url);
        }
      });

      promises.push(employeeService.updateDocuments(id, backendPayload));
    }

    if (promises.length > 0) {
      yield Promise.all(promises);
    }

    // Trigger refetch to get complete nested objects (avoid white screen from optimistic flat data)
    yield put(employeeDetailActions.fetchEmployeeRequest(id));

    // Pass undefined to skip optimistic update since we are refetching
    yield put(employeeDetailActions.updateEmployeeSuccess(undefined));
    ToastService.success("Information updated successfully");
  } catch (error: any) {
    yield put(employeeDetailActions.updateEmployeeFailure(error.message));
    ToastService.error(error.message || "Failed to update information");
  }
}

export function* generateExperienceLetter(
  action: ReturnType<
    typeof employeeDetailActions.generateExperienceLetterRequest
  >,
): Generator<any, void, any> {
  try {
    const id = action.payload;

    const response: any = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.experienceLetter(id),
      isSecureRoute: true,
      responseType: "blob",
    });

    const file = new Blob([response.data], { type: "application/pdf" });
    const fileURL = URL.createObjectURL(file);

    const link = document.createElement("a");
    link.href = fileURL;
    link.download = `Experience_Letter_${id}.pdf`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    yield put(employeeDetailActions.generateExperienceLetterSuccess());
  } catch (error: any) {
    yield put(
      employeeDetailActions.generateExperienceLetterFailure(
        error.message || "Failed to generate experience letter",
      ),
    );
  }
}

export function* generateCertificateOfService(
  action: ReturnType<
    typeof employeeDetailActions.generateCertificateOfServiceRequest
  >,
): Generator<any, void, any> {
  try {
    const id = action.payload;

    const response: any = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.certificateOfService(id),
      isSecureRoute: true,
      responseType: "blob",
    });

    const file = new Blob([response.data], { type: "application/pdf" });
    const fileURL = URL.createObjectURL(file);

    const link = document.createElement("a");
    link.href = fileURL;
    link.download = `Certificate_of_Service_${id}.pdf`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    yield put(employeeDetailActions.generateCertificateOfServiceSuccess());
  } catch (error: any) {
    yield put(
      employeeDetailActions.generateCertificateOfServiceFailure(
        error.message || "Failed to generate certificate of service",
      ),
    );
  }
}

export function* generateResignationLetter(
  action: ReturnType<
    typeof employeeDetailActions.generateResignationLetterRequest
  >,
): Generator<any, void, any> {
  try {
    const id = action.payload;

    const response: any = yield call(makeCall, {
      method: "GET",
      route: apiRoutes.resignationLetter(id),
      isSecureRoute: true,
      responseType: "blob",
    });

    const file = new Blob([response.data], {
      type: "application/pdf",
    });
    const fileURL = URL.createObjectURL(file);

    const link = document.createElement("a");
    link.href = fileURL;
    link.download = `Resignation_Letter_${id}.pdf`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(fileURL);

    yield put(employeeDetailActions.generateResignationLetterSuccess());
  } catch (error: any) {
    yield put(
      employeeDetailActions.generateResignationLetterFailure(
        error.message || "Failed to generate resignation letter",
      ),
    );
  }
}

export function* employeeDetailSaga() {
  yield takeLatest(
    employeeDetailActions.fetchEmployeeRequest.type,
    fetchEmployee,
  );
  yield takeLatest(
    employeeDetailActions.approveEmployeeRequest.type,
    approveEmployee,
  );
  yield takeLatest(
    employeeDetailActions.updateEmployeeRequest.type,
    updateEmployee,
  );
  yield takeLatest(
    employeeDetailActions.generateExperienceLetterRequest.type,
    generateExperienceLetter,
  );
  yield takeLatest(
    employeeDetailActions.generateCertificateOfServiceRequest.type,
    generateCertificateOfService,
  );
  yield takeLatest(
    employeeDetailActions.generateResignationLetterRequest.type,
    generateResignationLetter,
  );
}
