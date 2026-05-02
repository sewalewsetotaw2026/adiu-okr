import axios from "axios";

const RAW_BASE_URL =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_BASE_URL;

if (!RAW_BASE_URL) {
  throw new Error(
    "Missing API base URL. Set VITE_API_URL (recommended) or VITE_BASE_URL in frontend/.env (example: VITE_API_URL=http://localhost:5000/api/v1)."
  );
}

const api = axios.create({
  baseURL: String(RAW_BASE_URL).replace(/\/+$/, ""),
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor to add the auth token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Avoid 304 Not Modified responses for XHR/fetch requests (Axios treats 304 as error)
    if ((config.method || "").toLowerCase() === "get") {
      config.params = { ...(config.params || {}), _ts: Date.now() };
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Auto logout if 401 response returned from api
      const storedUser = localStorage.getItem("user");
      let redirectUrl = '/login';

      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          if (user?.role?.name?.toLowerCase() === 'employee') {
            redirectUrl = '/employee-login';
          }
        } catch (e) {
          console.error("Error parsing user for redirect", e);
        }
      }

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = redirectUrl;
    }
    return Promise.reject(error);
  }
);

export default api;
