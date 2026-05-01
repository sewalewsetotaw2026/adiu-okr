import makeCall from "../API";
import apiRoutes from "../API/apiRoutes";

// Types
export interface ExportField {
  key: string;
  label: string;
}

export interface ExportFilters {
  department_id?: number;
  job_title_id?: number;
  employment_type?: string;
  status?: string;
  gender?: string;
  hire_date_from?: string;
  hire_date_to?: string;
  is_active?: boolean;
}

export interface LeaveExportFilters {
  status?: string;
  leave_type_id?: string | number;
  start_date?: string;
  end_date?: string;
  search?: string;
  employee_id?: string;
  view?: "personal";
  year?: number;
  activeTab?: string;
}

export type ExportFormat = "pdf" | "csv" | "xlsx";

export type ExportType = "employee" | "employment" | "leave" | "leave_balance" | "on_leave";

export interface ExportRequest {
  format: ExportFormat;
  fields: string[];
  filters?: ExportFilters;
}

export interface LeaveExportRequest {
  format: ExportFormat;
  fields: string[];
  filters?: LeaveExportFilters;
  scope?: "SELECTION" | "BULK" | "SINGLE";
  ids?: Array<string | number>;
}

export interface ProfileExportRequest {
  format: ExportFormat;
  sections: string[];
}

// API Functions
const exportService = {
  /**
   * Get available export fields for a given type
   */
  getExportFields: async (type: ExportType): Promise<ExportField[]> => {
    const response: any = await makeCall({
      method: "GET",
      route: apiRoutes.exportFields(type),
      isSecureRoute: true,
    });
    return response?.data?.data?.fields || response?.data?.fields || [];
  },

  /**
   * Export employees list with selected fields and filters
   */
  exportEmployees: async (
    format: ExportFormat,
    fields: string[],
    filters?: ExportFilters,
  ): Promise<Blob> => {
    const response: any = await makeCall({
      method: "POST",
      route: apiRoutes.exportEmployees,
      body: { format, fields, filters },
      isSecureRoute: true,
      responseType: "blob",
    });
    return response?.data;
  },

  /**
   * Export employments list with selected fields and filters
   */
  exportEmployments: async (
    format: ExportFormat,
    fields: string[],
    filters?: ExportFilters,
  ): Promise<Blob> => {
    const response: any = await makeCall({
      method: "POST",
      route: apiRoutes.exportEmployments,
      body: { format, fields, filters },
      isSecureRoute: true,
      responseType: "blob",
    });
    return response?.data;
  },

  /**
   * Export leave applications with selected fields and filters
   */
  exportLeaves: async (payload: LeaveExportRequest): Promise<Blob> => {
    const response: any = await makeCall({
      method: "POST",
      route: apiRoutes.exportLeaves,
      body: payload,
      isSecureRoute: true,
      responseType: "blob",
    });
    return response?.data;
  },

  /**
   * Export leave balances with selected fields and filters
   */
  exportLeaveBalances: async (payload: LeaveExportRequest): Promise<Blob> => {
    const response: any = await makeCall({
      method: "POST",
      route: apiRoutes.exportLeaveBalances,
      body: payload,
      isSecureRoute: true,
      responseType: "blob",
    });
    return response?.data;
  },

  /**
   * Export on-leave employees with selected fields and filters
   */
  exportOnLeaveEmployees: async (payload: LeaveExportRequest): Promise<Blob> => {
    const response: any = await makeCall({
      method: "POST",
      route: apiRoutes.exportOnLeave,
      body: payload,
      isSecureRoute: true,
      responseType: "blob",
    });
    return response?.data;
  },

  /**
   * Export single employee profile with selected sections
   */
  exportEmployeeProfile: async (
    employeeId: string,
    format: ExportFormat,
    sections: string[],
  ): Promise<Blob> => {
    const response: any = await makeCall({
      method: "POST",
      route: apiRoutes.exportEmployeeProfile(employeeId),
      body: { format, sections },
      isSecureRoute: true,
      responseType: "blob",
    });
    return response?.data;
  },

  /**
   * Trigger file download from blob
   */
  downloadFile: (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Get file extension based on format
   */
  getFileExtension: (format: ExportFormat): string => {
    switch (format) {
      case "xlsx":
        return "xlsx";
      case "csv":
        return "csv";
      case "pdf":
        return "pdf";
      default:
        return "xlsx";
    }
  },
};

export default exportService;

