import api from "./api";

// Types
export interface Department {
  id: number;
  name: string;
  company_id: number;
}

export interface JobTitle {
  id: number;
  title: string;
  level: string;
  company_id: number;
}

export interface AllowanceType {
  id: number;
  name: string;
  description: string;
  is_taxable: boolean;
}

export interface Employee {
  id: string; // "EMP-0001"
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  jobTitle?: string;
}

// API Functions
const adminService = {
  // Departments
  getDepartments: async (): Promise<Department[]> => {
    const response = await api.get("/departments");
    return response.data?.data?.department || response.data?.department || [];
  },

  createDepartment: async (name: string): Promise<Department> => {
    const response = await api.post("/departments", { name });
    return response.data?.data?.department || response.data?.department;
  },

  // Job Titles
  getJobTitles: async (): Promise<JobTitle[]> => {
    const response = await api.get("/job-titles");
    return response.data?.data?.jobTitles || response.data?.jobTitles || [];
  },

  createJobTitle: async (title: string, level: string): Promise<JobTitle> => {
    const response = await api.post("/job-titles", { title, level });
    return response.data?.data?.jobTitle || response.data?.jobTitle;
  },

  // Allowance Types
  getAllowanceTypes: async (): Promise<AllowanceType[]> => {
    const response = await api.get("/allowance-types");
    return response.data?.data?.allowanceTypes || response.data?.allowanceTypes || [];
  },

  createAllowanceType: async (data: {
    name: string;
    description?: string;
    is_taxable?: boolean;
  }): Promise<AllowanceType> => {
    const response = await api.post("/allowance-types", data);
    return response.data?.data?.allowanceType || response.data?.allowanceType;
  },

  // Employees (for manager dropdown)
  getEmployees: async (): Promise<Employee[]> => {
    const response = await api.get("/employees");
    return response.data?.data?.employees || response.data?.employees || [];
  },

  // Employee Detail
  getEmployeeDetail: async (id: string): Promise<any> => {
    const response = await api.get(`/employees/${id}/detail`);
    return response.data;
  },

  // Employee Self-Profile (for employees to fetch their own details)
  getMyProfile: async (): Promise<any> => {
    const response = await api.get(`/employees/me`);
    return response.data;
  },
};

export default adminService;
