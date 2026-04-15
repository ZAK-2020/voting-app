const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");

const getEnvValue = (key) => trimTrailingSlash(process.env[key] || "");

export const API_BASE_URL = getEnvValue("REACT_APP_API_URL");
export const SOCKET_URL = getEnvValue("REACT_APP_SOCKET_URL") || API_BASE_URL;

export const buildApiUrl = (path) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
};
