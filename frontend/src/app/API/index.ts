import axios, { AxiosRequestConfig, AxiosResponse, Method } from "axios";

export interface IAPICallConfig {
  route: string;
  method: Method;
  body?: any;
  query?: any;
  isSecureRoute?: boolean;
  headers?: Record<string, string>;
  responseType?:
    | "arraybuffer"
    | "blob"
    | "document"
    | "json"
    | "text"
    | "stream";
}

const makeCall = async (config: IAPICallConfig): Promise<AxiosResponse> => {
  try {
    const {
      method,
      route,
      body,
      query,
      isSecureRoute = true,
      headers: customHeaders,
      responseType,
    } = config;

    const headers: Record<string, string> = {};

    if (!(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (isSecureRoute) {
      const token = localStorage.getItem("token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    // Merge custom headers
    if (customHeaders) {
      Object.assign(headers, customHeaders);
    }

    const axiosConfig: AxiosRequestConfig = {
      method,
      url: route,
      data: body,
      params:
        String(method).toUpperCase() === "GET"
          ? { ...(query || {}), _ts: Date.now() }
          : query,
      headers,
      responseType,
      timeout: responseType === "blob" ? 60000 : 30000, // 60s for blob downloads, 30s for others
    };

    const response = await axios(axiosConfig);

    return response;
  } catch (error: any) {
    // For blob responses, we need to handle errors differently
    if (
      config.responseType === "blob" &&
      error.response?.data instanceof Blob
    ) {
      // Try to read the blob as JSON to get the actual error message
      try {
        const text = await error.response.data.text();
        const errorData = JSON.parse(text);
        throw errorData;
      } catch (parseError) {
        // If we can't parse it, throw the original error response
        throw error.response || error;
      }
    }
    throw error.response ? error.response.data : error;
  }
};

export default makeCall;
