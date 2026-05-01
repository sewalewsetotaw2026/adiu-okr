/**
 * Sanitizes a filename to be URL-safe by replacing spaces and special characters.
 * @param {string} name - The original filename
 * @returns {string} - The sanitized filename
 */
export const sanitizeFilename = (name: string): string => {
  if (!name) return "unnamed_file";
  
  // Replace anything that isn't alphanumeric, dot, underscore, or hyphen with an underscore
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
};
