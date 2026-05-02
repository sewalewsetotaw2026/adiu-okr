import { SERVER_URL } from "../API/apiRoutes";

/**
 * Returns the full URL for a file path.
 * If the path is relative (starts with /uploads), it prefixes it with SERVER_URL.
 * Otherwise, it returns the path as-is (for base64 or external URLs).
 */
export const getFileUrl = (path: string | null | undefined): string => {
  if (!path) return "/avatar.jpg"; // Default avatar

  // If it's a data URL (base64) or absolute URL, return as is
  if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // Normalize SERVER_URL (remove trailing slash)
  const baseUrl = SERVER_URL.endsWith("/") ? SERVER_URL.slice(0, -1) : SERVER_URL;

  // Normalize path (ensure leading slash)
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
};
