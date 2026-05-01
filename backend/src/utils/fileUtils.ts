import * as fs from "fs";
import * as path from "path";
import * as https from "https";

/**
 * Reads a local file and returns it as a base64 Data URI
 */
export function getBase64Image(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      const file = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
      return `data:${mimeType};base64,${file.toString("base64")}`;
    }
    return null;
  } catch (e) {
    console.error(`Failed to read image at ${filePath}`, e);
    return null;
  }
}

/**
 * Fetch remote image and convert to base64
 */
export function getRemoteImageBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }

    if (!url.startsWith("http")) {
      resolve(null);
      return;
    }

    https.get(url, (res) => {
      const data: Buffer[] = [];
      res.on("data", (chunk) => data.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(data);
        let mimeType = "image/png";
        if (url.toLowerCase().endsWith(".jpg") || url.toLowerCase().endsWith(".jpeg")) {
          mimeType = "image/jpeg";
        }
        resolve(`data:${mimeType};base64,${buffer.toString("base64")}`);
      });
      res.on("error", (e) => {
        console.error("Failed to fetch remote signature", e);
        resolve(null);
      });
    }).on("error", (e) => {
      console.error("Failed to fetch remote signature", e);
      resolve(null);
    });
  });
}
