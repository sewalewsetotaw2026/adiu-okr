import fs from 'fs';
import path from 'path';

/**
 * Ensures that a directory exists, creating it if necessary.
 */
const ensureDir = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Saves a buffer to a local file and returns the public URL path.
 */
export const saveFileLocally = async (
  buffer: Buffer,
  fileName: string,
  subDir: string = 'others'
): Promise<string> => {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', subDir);
  ensureDir(uploadDir);

  const filePath = path.join(uploadDir, fileName);
  await fs.promises.writeFile(filePath, buffer);

  // Return the relative URL path
  return `/uploads/${subDir}/${fileName}`;
};

/**
 * Saves base64 data to a local file and returns the public URL path.
 */
export const saveBase64Locally = async (
  dataUrl: string,
  namePrefix: string,
  subDir: string = 'others'
): Promise<string | null> => {
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

  if (!matches || matches.length !== 3) {
    return null;
  }

  const buffer = Buffer.from(matches[2], 'base64');
  const extension = matches[1].split('/')[1] || 'bin';
  const fileName = `${Date.now()}-${namePrefix}.${extension}`;

  return await saveFileLocally(buffer, fileName, subDir);
};
