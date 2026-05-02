import makeCall from "../API";
import apiRoutes from "../API/apiRoutes";

// Types
export interface PromotionRequest {
  employee_id: string;
  new_job_title_id: number;
  new_salary: number;
  new_department_id?: number;
  effective_date: string;
  justification: string;
  approved_by?: string;
  notes?: string;
  allowances?: Array<{ allowance_type_id: number; amount: number; currency?: string }>;
}

export interface DemotionRequest {
  employee_id: string;
  new_job_title_id: number;
  new_salary: number;
  effective_date: string;
  justification: string;
  allowances?: Array<{ allowance_type_id: number; amount: number; currency?: string }>;
}

export interface TransferRequest {
  employee_id: string;
  new_department_id: number;
  new_job_title_id?: number;
  effective_date: string;
  justification: string;
  allowances?: Array<{ allowance_type_id: number; amount: number; currency?: string }>;
}

export interface CareerEvent {
  id: number;
  employee_id: string;
  event_type: "Promotion" | "Demotion" | "Transfer";
  event_date: string;
  effective_date: string;
  previous_job_title_id?: number;
  new_job_title_id?: number;
  previous_department_id?: number;
  new_department_id?: number;
  previous_salary?: string;
  new_salary?: string;
  justification?: string;
  notes?: string;
  approved_by?: string;
  previousJobTitle?: { title: string; level?: string };
  newJobTitle?: { title: string; level?: string };
  previousDepartment?: { name: string };
  newDepartment?: { name: string };
  document_url?: string;
  previousEmployment?: {
    manager?: {
      id: string;
      full_name: string;
    } | null;
  };
  newEmployment?: {
    manager?: {
      id: string;
      full_name: string;
    } | null;
  };
}

export interface CareerEventResponse {
  careerEvent: CareerEvent;
  employment: any;
}

export interface CareerHistoryResponse {
  employee: {
    id: string;
    full_name: string;
  };
  careerEvents: CareerEvent[];
}

// API Functions
const careerService = {
  /**
   * Promote an employee
   */
  promoteEmployee: async (
    data: PromotionRequest
  ): Promise<CareerEventResponse> => {
    const response: any = await makeCall({
      method: "POST",
      route: apiRoutes.careerPromote,
      body: data,
      isSecureRoute: true,
    });
    return response?.data?.data || response?.data;
  },

  /**
   * Demote an employee
   */
  demoteEmployee: async (
    data: DemotionRequest
  ): Promise<CareerEventResponse> => {
    const response: any = await makeCall({
      method: "POST",
      route: apiRoutes.careerDemote,
      body: data,
      isSecureRoute: true,
    });
    return response?.data?.data || response?.data;
  },

  /**
   * Transfer an employee
   */
  transferEmployee: async (
    data: TransferRequest
  ): Promise<CareerEventResponse> => {
    const response: any = await makeCall({
      method: "POST",
      route: apiRoutes.careerTransfer,
      body: data,
      isSecureRoute: true,
    });
    return response?.data?.data || response?.data;
  },

  /**
   * Get career history for an employee
   */
  getCareerHistory: async (
    employeeId: string
  ): Promise<CareerHistoryResponse> => {
    const response: any = await makeCall({
      method: "GET",
      route: apiRoutes.careerEventsByEmployee(employeeId),
      isSecureRoute: true,
    });
    return response?.data?.data || response?.data;
  },

  /**
   * Get all career events with optional filters
   */
  getCareerEvents: async (filters?: {
    event_type?: string;
    employee_id?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }): Promise<{ careerEvents: CareerEvent[]; pagination?: any }> => {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          queryParams.append(key, String(value));
        }
      });
    }
    const url = queryParams.toString()
      ? `${apiRoutes.careerEvents}?${queryParams.toString()}`
      : apiRoutes.careerEvents;

    const response: any = await makeCall({
      method: "GET",
      route: url,
      isSecureRoute: true,
    });
    return response?.data?.data || response?.data;
  },
};

export default careerService;
