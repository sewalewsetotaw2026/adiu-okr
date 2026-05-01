import * as fs from 'fs';
import * as path from 'path';

// Read the logo file and convert to base64
const logoPath = path.join(__dirname, '../assets/kacha_logo.jpg');
const logoBuffer = fs.readFileSync(logoPath);
export const KACHA_LOGO_BASE64 = `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;
