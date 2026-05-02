import api from "./api";

const ROLE_API_URL = "/roles";

const roleService = {
  getRoles: async () => {
    const response = await api.get(ROLE_API_URL);
    return response.data;
  },

  getRoleDetails: async (id: number | string) => {
    const response = await api.get(`${ROLE_API_URL}/${id}`);
    return response.data;
  },

  createRole: async (data: any) => {
    const response = await api.post(ROLE_API_URL, data);
    return response.data;
  },

  updatePermission: async (roleId: number | string, data: any) => {
    const response = await api.post(`${ROLE_API_URL}/${roleId}/permissions`, data);
    return response.data;
  },

  deleteRole: async (id: number | string) => {
    const response = await api.delete(`${ROLE_API_URL}/${id}`);
    return response.data;
  },

  searchUsersForMapping: async (query?: string) => {
    const response = await api.get(`/users/mapping-search`, {
      params: { query },
    });
    return response.data;
  },

  assignUsersToRole: async (roleId: number | string, userIds: (number | string)[]) => {
    const response = await api.post(`${ROLE_API_URL}/${roleId}/assign-users`, { userIds });
    return response.data;
  },

  unassignUser: async (userId: number | string) => {
    const response = await api.post(`${ROLE_API_URL}/unassign-user`, { userId });
    return response.data;
  },
};

export default roleService;
