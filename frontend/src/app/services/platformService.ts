import api from "./api";
// import { CompanyRegistrationData } from "../types/platform"; 

export interface CompanyRegistrationData {
  companyName: string;
  companyCode: string;
  adminName?: string;
  adminEmail: string;
  adminPassword?: string;
  phone?: string;
  address?: string;
}

const getCompanies = async () => {
  const response = await api.get("/platform/companies");
  return response.data;
};

const registerCompany = async (data: any) => {
  const response = await api.post("/platform/companies", data);
  return response.data;
};

const getCompany = async (id: number | string) => {
  const response = await api.get(`/platform/companies/${id}`);
  return response.data;
};

const updateCompany = async (id: number | string, data: any) => {
  const response = await api.patch(`/platform/companies/${id}`, data);
  return response.data;
};

const toggleCompanyStatus = async (id: number, isActive: boolean) => {
  const response = await api.patch(`/platform/companies/${id}/status`, {
    isActive,
  });
  return response.data;
};

const platformService = {
  getCompanies,
  registerCompany,
  getCompany,
  updateCompany,
  toggleCompanyStatus,
  deleteCompany: async (id: number) => {
    const response = await api.delete(`/platform/companies/${id}`);
    return response.data;
  },
};

export default platformService;
