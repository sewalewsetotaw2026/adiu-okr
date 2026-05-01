/**
 * MOCKED Mega Service
 * Integration disabled by user request.
 */

export const uploadToMega = async (fileBuffer: Buffer, fileName: string): Promise<string> => {
  console.warn("MEGA integration disabled. File not uploaded:", fileName);
  return `https://placeholder.url/mega/${fileName}`;
};
