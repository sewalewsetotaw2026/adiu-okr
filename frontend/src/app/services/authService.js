import api from "./api";

const authService = {
  login: async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    if (response.data.token) {
      localStorage.setItem("token", response.data.token);
      // User object is nested in data.data.user
      localStorage.setItem("user", JSON.stringify(response.data.data.user));
    }
    return response.data;
  },

  forgotPassword: async ({ email }) => {
    const response = await api.post("/auth/forgotPassword", { email });
    return response.data;
  },

  resetPassword: async ({ token, password }) => {
    const response = await api.patch(`/auth/resetPassword/${token}`, {
      password,
    });

    if (response.data?.token) {
      localStorage.setItem("token", response.data.token);
      if (response.data?.data?.user) {
        localStorage.setItem("user", JSON.stringify(response.data.data.user));
      }
    }

    return response.data;
  },

  register: async (data) => {
    const response = await api.post("/auth/register", data);
    return response.data;
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  getCurrentUser: () => {
    return JSON.parse(localStorage.getItem("user"));
  },
};

export default authService;
