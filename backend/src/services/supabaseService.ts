/**
 * MOCKED Supabase Service
 * Integration disabled by user request to prevent runtime errors.
 */

export const uploadToSupabase = async (
  fileBuffer: Buffer,
  fileName: string,
  subFolder: string = "uploads",
): Promise<string> => {
  console.warn("Supabase integration disabled. File not uploaded:", fileName);
  return `https://placeholder.url/${subFolder}/${fileName}`;
};

export const createSignedUploadUrl = async (
  fileName: string,
  subFolder: string = "uploads",
): Promise<{ signedUrl: string; token: string; path: string }> => {
  console.warn("Supabase integration disabled. Mock signed URL generation.");
  return {
    signedUrl: "https://placeholder.url/upload",
    token: "mock-token",
    path: `${subFolder}/${fileName}`
  };
};

export const verifyFileExists = async (path: string): Promise<boolean> => {
  return true; // Assume existence to bypass checks
};

export const getSignedUrls = async (
  paths: string[],
): Promise<Map<string, string>> => {
  const urlMap = new Map<string, string>();
  if (!paths) return urlMap;
  // Return original paths
  paths.forEach(p => urlMap.set(p, p));
  return urlMap;
};

export const getSignedUrl = async (
  path: string | null | undefined,
): Promise<string | null> => {
  return path || null;
};

export const signEmployeeFiles = async (employee: any): Promise<any> => {
  return employee; // Return as is, no signing
};

export const sanitizeFileUrl = (
  url: string | null | undefined,
): string | null => {
  return url || null; // Return as is
};
