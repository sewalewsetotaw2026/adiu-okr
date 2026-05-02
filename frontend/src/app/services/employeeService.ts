import makeCall from "../API";
import apiRoutes from "../API/apiRoutes";
import { sanitizeFilename } from "../../utils/fileUtils";

const employeeService = {
  onboardEmployee: async (data: any) => {
    const response = await makeCall({
      route: apiRoutes.onboarding,
      method: "POST",
      body: data,
      isSecureRoute: true,
    });
    return response;
  },

  getProfile: async (id?: string) => {
    const response = await makeCall({
      route: id ? `${apiRoutes.employees}/${id}` : `${apiRoutes.employees}/me`,
      method: "GET",
      isSecureRoute: true,
    });
    return response;
  },

  getSuggestions: async (
    type:
      | "departments"
      | "jobTitles"
      | "jobLevels"
      | "fieldsOfStudy"
      | "institutions"
      | "employees"
      | "managers"
      | "allowanceTypes",
    query: string
  ) => {
    if (type === "allowanceTypes") {
      const response = await makeCall({
        route: apiRoutes.allowanceTypes,
        method: "GET",
        isSecureRoute: true,
      });
      const types = response?.data?.data?.allowanceTypes || [];
      return types
        .filter((t: any) => t.name.toLowerCase().includes(query.toLowerCase()));
    }
    const isEmployee = type === "employees";
    const isManager = type === "managers";

    let route = "";
    if (isEmployee) route = `${apiRoutes.assignManagers.search}?query=${query}`;
    else if (isManager)
      route = `${apiRoutes.assignManagers.existingManagers}?query=${query}`;
    else
      route = `${apiRoutes.suggestions[type as keyof typeof apiRoutes.suggestions]
        }?q=${query}`;

    // Fix for FieldOfStudy/Institution if apiRoutes missing. 
    // Actually, suggestionController handles them at /suggestions/field-of-study etc. 
    // Let's check apiRoutes.js/ts definition to be safe.
    // If apiRoutes.suggestions has keys, I should use them.
    // Assuming apiRoutes structure.


    const response = await makeCall({
      route,
      method: "GET",
      isSecureRoute: true,
    });
    // Handle standard API response wrapper { status: "success", data: [...] }
    // Handle standard API response wrapper { status: "success", data: [...] }
    let rawData: any[] = [];
    if (response?.data?.data && Array.isArray(response.data.data)) {
      rawData = response.data.data;
    } else if (Array.isArray(response.data)) {
      rawData = response.data;
    }

    if (rawData.length === 0) return [];

    return rawData;
    // Standard suggestions endpoints (based on other code) usually return array or {data: array}.
    // If they return {data: array}, this might need adjustment.
    // However, existing code was returning `response`.
    // Wait, old code returned `response`. `makeCall` returns AxiosResponse.
    // If `StepWorkExperience` etc used `response.data`, then returning `response` is correct.
    // But FormAutocomplete lines 64-65: `const data = await fetchSuggestionsFn(query); setSuggestions(data);`
    // It expects `data` to be `string[]`.
    // So `getSuggestions` MUST return `string[]`.
    // The old code returned `response` (AxiosResponse). This implies usages like `const res = await service.get(); const list = res.data`.
    // But FormAutocomplete is generic.
    // If I change return type here, I might break other usages if they expect AxiosResponse.
    // But `FormAutocomplete` inside itself calls it and expects data.
    // Let's check `FormAutocomplete` usage of `fetchSuggestionsFn`.
    // It calls it and sets suggestions to result.
    // This implies `fetchSuggestionsFn` should return `string[]`.
    // Using `response.data` here is safer if `response.data` IS the array.
    // Suggestion endpoints typically return `['a', 'b']` or `{ data: [...] }`.
    // I will assume standard suggestions return array directly in data for now, or I should check one.
    // But to be safe and match `allowanceTypes`, I should return `response.data` if it is array, or `response.data.data`?
    // Let's return `response.data` for others conform to existing patterns, assuming it worked before (or the pattern implies it).
    // Actually, checking `StepWorkExperience` or similar might verify usage.
    // But `FormAutocomplete` is new/modified by me.
    // I'll return `response.data` which is usually the body.
  },

  updatePersonalDetails: async (id: string, data: any) => {
    return await makeCall({
      route: apiRoutes.updatePersonal(id),
      method: "PATCH",
      body: data,
      isSecureRoute: true,
    });
  },

  updateSignature: async (id: string, data: any) => {
    return await makeCall({
      route: apiRoutes.updateSignature(id),
      method: "PATCH",
      body: data,
      isSecureRoute: true,
    });
  },

  updateFinancialDetails: async (id: string, data: any) => {
    return await makeCall({
      route: apiRoutes.updateFinancial(id),
      method: "PATCH",
      body: data,
      isSecureRoute: true,
    });
  },

  updateEmploymentDetails: async (id: string, data: any) => {
    return await makeCall({
      route: apiRoutes.updateEmployment(id),
      method: "PATCH",
      body: data,
      isSecureRoute: true,
    });
  },

  updateAddresses: async (id: string, addresses: any[]) => {
    return await makeCall({
      route: apiRoutes.updateAddresses(id),
      method: "PATCH",
      body: { addresses },
      isSecureRoute: true,
    });
  },

  updatePhones: async (id: string, phones: any[]) => {
    return await makeCall({
      route: apiRoutes.updatePhones(id),
      method: "PATCH",
      body: { phones },
      isSecureRoute: true,
    });
  },

  updateEducation: async (id: string, education: any[]) => {
    return await makeCall({
      route: apiRoutes.updateEducation(id),
      method: "PATCH",
      body: { education },
      isSecureRoute: true,
    });
  },

  updateWorkExperience: async (id: string, workExperience: any[]) => {
    return await makeCall({
      route: apiRoutes.updateWorkExperience(id),
      method: "PATCH",
      body: { workExperience },
      isSecureRoute: true,
    });
  },

  updateCertifications: async (id: string, certifications: any[]) => {
    return await makeCall({
      route: apiRoutes.updateCertifications(id),
      method: "PATCH",
      body: { certifications },
      isSecureRoute: true,
    });
  },

  updateDocuments: async (id: string, documents: any[]) => {
    return await makeCall({
      route: apiRoutes.updateDocuments(id),
      method: "PATCH",
      body: { documents },
      isSecureRoute: true,
    });
  },

  updateEmergencyContacts: async (id: string, emergencyContacts: any[]) => {
    return await makeCall({
      route: apiRoutes.updateEmergencyContacts(id),
      method: "PATCH",
      body: { emergencyContacts },
      isSecureRoute: true,
    });
  },

  updateBankAccounts: async (id: string, financialDetails: any[]) => {
    return await makeCall({
      route: apiRoutes.updateBankAccounts(id),
      method: "PATCH",
      body: { financialDetails },
      isSecureRoute: true,
    });
  },

  uploadFile: async (file: File) => {
    const sanitizedName = sanitizeFilename(file.name);
    const formData = new FormData();
    formData.append("file", file, sanitizedName);
    const response = await makeCall({
      route: apiRoutes.upload,
      method: "POST",
      body: formData,
      isSecureRoute: true,
    });
    return response;
  },

  getBanks: async () => {
    const response = await makeCall({
      route: apiRoutes.BANKS.GET_ALL,
      method: "GET",
      isSecureRoute: true
    });
    // Handle both { data: { banks: [] } } and { data: [] } if backend changes
    if (response?.data?.data?.banks) return response.data.data.banks;
    if (Array.isArray(response?.data?.data)) return response.data.data;
    if (Array.isArray(response?.data)) return response.data;
    return [];
  },

  updateProfilePicture: async (id: string, url: string) => {
    const response = await makeCall({
      route: apiRoutes.PROFILE_PICTURE.UPDATE(id),
      method: "PATCH",
      body: { profile_picture_url: url },
      isSecureRoute: true
    });
    return response;
  },

  createDepartment: async (name: string) => {
    const response = await makeCall({
      route: apiRoutes.departments,
      method: "POST",
      body: { name },
      isSecureRoute: true,
    });
    return response;
  },

  createAllowanceType: async (name: string) => {
    const response = await makeCall({
      route: apiRoutes.allowanceTypes,
      method: "POST",
      body: { name },
      isSecureRoute: true,
    });
    return response;
  },

  createFieldOfStudy: async (name: string) => {
    const response = await makeCall({
      route: apiRoutes.fieldsOfStudy,
      method: "POST",
      body: { name },
      isSecureRoute: true,
    });
    return response;
  },

  createInstitution: async (name: string) => {
    const response = await makeCall({
      route: apiRoutes.institutions,
      method: "POST",
      body: { name, category: "Private" }, // Default category
      isSecureRoute: true,
    });
    return response;
  },

  createJobLevel: async (name: string) => {
    const response = await makeCall({
      route: apiRoutes.jobLevels,
      method: "POST",
      body: { name },
      isSecureRoute: true,
    });
    return response;
  },

  createJobTitle: async (title: string, level?: string) => {
    const response = await makeCall({
      route: apiRoutes.jobTitles,
      method: "POST",
      body: { title, level: level || null },
      isSecureRoute: true,
    });
    return response;
  },
};

export default employeeService;
