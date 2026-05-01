/**
 * Experience Letter Generator
 *
 * Generates a formal, descriptive experience letter for employees.
 * This is a more detailed letter describing:
 * - Role/position
 * - Duration of employment
 * - Key responsibilities and performance
 * - Professional recommendation
 *
 * Used for: Job applications, internships, graduate programs, immigration/visa processes
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";

// Import PdfPrinter - same pattern as working exportService
const PdfPrinter = require("pdfmake/js/Printer").default;

// Define font paths - same pattern as working exportService
const fontDescriptors = {
  Roboto: {
    normal: path.join(__dirname, "..", "assets", "fonts", "Roboto-Regular.ttf"),
    bold: path.join(__dirname, "..", "assets", "fonts", "Roboto-Medium.ttf"),
    italics: path.join(__dirname, "..", "assets", "fonts", "Roboto-Italic.ttf"),
    bolditalics: path.join(__dirname, "..", "assets", "fonts", "Roboto-MediumItalic.ttf"),
  },
};

// Type definitions for pdfmake
type TDocumentDefinitions = any;
type Content = any;

// ============================================
// CONSTANTS
// ============================================

const BRAND = {
  primary: "#DB5E00",
  companyName: "Kacha Digital Financial Service S.C.",
  companyNameFull: "KACHA DIGITAL FINANCIAL SERVICES",
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getBase64Image(filePath: string): string | null {
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

function getRemoteImageBase64(url: string): Promise<string | null> {
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

function formatDate(date: any): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getPronouns(gender: string | undefined) {
  const isFemale = gender?.toLowerCase() === "female";
  return {
    title: isFemale ? "Ms." : "Mr.",
    subjective: isFemale ? "She" : "He",
    subjectiveLower: isFemale ? "she" : "he",
    possessive: isFemale ? "Her" : "His",
    possessiveLower: isFemale ? "her" : "his",
    objective: isFemale ? "her" : "him",
  };
}

// ============================================
// MAIN SERVICE CLASS
// ============================================

export class ExperienceLetterService {
  /**
   * Generate an Experience Letter PDF based on employee data
   */
  static async generate(employeeData: any): Promise<Buffer> {
    const { full_name, id, start_date, careerEvents, employments, gender } = employeeData;

    // Sort employments to find the INITIAL one
    const sortedEmployments = [...(employments || [])].sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
    const initialEmployment = sortedEmployments[0];
    const activeEmployment =
      employments?.find((e: any) => e.is_active) ||
      sortedEmployments[sortedEmployments.length - 1];

    const initialTitle = initialEmployment?.jobTitle?.title || "Employee";
    const initialLevel = initialEmployment?.jobTitle?.level || "";
    const initialDept = initialEmployment?.department?.name || "N/A";

    const currentTitle = activeEmployment?.jobTitle?.title || initialTitle;
    const currentLevel = activeEmployment?.jobTitle?.level || initialLevel;
    const isStillWorking = activeEmployment?.is_active;

    // Get pronouns
    const pronouns = getPronouns(gender);

    // Assets
    // Use __dirname-relative paths that work in both dev (src/) and prod (dist/)
    const logoPath = path.join(__dirname, "..", "assets", "kacha_logo.jpg");
    const stampPath = path.join(__dirname, "..", "assets", "kacha-stamp.png");

    // Logic to fetch company logo or fallback
    let logoBase64 = null;
    if (employeeData?.company?.logo_url) {
      logoBase64 = await getRemoteImageBase64(employeeData.company.logo_url);
    }

    if (!logoBase64) {
      logoBase64 = getBase64Image(logoPath);
    }

    const stampBase64 = getBase64Image(stampPath);

    // Dates
    const joiningDate = formatDate(initialEmployment?.start_date || start_date);
    const endDateStr = isStillWorking ? "Present" : formatDate(activeEmployment?.end_date);
    const currentDate = formatDate(new Date());

    // Generate reference number: KDFS/HR/YYYY/001
    const refYear = new Date().getFullYear();
    const paddedId = (id || "").toString().padStart(3, "0");
    const refNumber = `KDFS/HR/${refYear}/${paddedId}`;

    // Build Narrative for career progression
    const sortedEvents = [...(careerEvents || [])].sort(
      (a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime()
    );

    const narrativeParts: any[] = [
      "Throughout ",
      { text: `${pronouns.possessiveLower} `, bold: false },
      "tenure with the company, ",
      { text: `${pronouns.title} ${full_name} `, bold: true },
      "has demonstrated exceptional professional growth and commitment. ",
      `${pronouns.subjective} initially joined the organization as `,
      { text: initialTitle, bold: true },
      initialLevel ? ` (${initialLevel}) ` : " ",
      "within the ",
      { text: initialDept, bold: true },
      " Department. ",
    ];

    if (sortedEvents.length > 0) {
      narrativeParts.push(
        `Over the course of ${pronouns.possessiveLower} employment, ${pronouns.subjectiveLower} has progressed through the following key career milestones: `
      );

      sortedEvents.forEach((event: any, idx: number) => {
        const eventType = event.event_type?.replace("_", " ") || "Career Event";
        const newTitle = event.newJobTitle?.title || "N/A";
        const effectiveDate = formatDate(event.effective_date);

        narrativeParts.push(
          { text: `${idx + 1}. ${eventType}`, bold: true },
          ` to ${newTitle} on ${effectiveDate}. `
        );
      });
    }

    narrativeParts.push(
      `Currently, ${pronouns.title} ${full_name} holds the position of `,
      { text: currentTitle, bold: true },
      currentLevel ? ` (${currentLevel})` : "",
      "."
    );

    // Extract company name and color
    const companyName = employeeData?.company?.name || BRAND.companyName;
    const companyColor = employeeData?.company?.primary_color || BRAND.primary;
    const companyNameFull = companyName.toUpperCase(); // Simple approximation for now

    // Build Document Definition
    const content: Content[] = [];

    // Header with Logo
    content.push({
      columns: [
        logoBase64
          ? { image: logoBase64, width: 80, margin: [0, 0, 0, 10] as [number, number, number, number] }
          : { text: "" },
        {
          stack: [
            { text: companyNameFull, style: "brandHeader", alignment: "right" },
            { text: "Digital Financial Services", color: "#666666", fontSize: 10, alignment: "right" },
          ],
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    });

    // Reference and Date line
    content.push({
      columns: [
        { text: `Ref: ${refNumber}`, fontSize: 10, color: "#666666" },
        { text: `Date: ${currentDate}`, fontSize: 10, color: "#666666", alignment: "right" },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    });

    // Title
    content.push({
      text: "EXPERIENCE LETTER",
      style: "letterTitle",
      alignment: "center",
      margin: [0, 0, 0, 30] as [number, number, number, number],
    });

    // To Whom It May Concern
    content.push({
      text: "TO WHOM IT MAY CONCERN",
      bold: true,
      margin: [0, 0, 0, 20] as [number, number, number, number],
    });

    // Introduction
    content.push({
      text: [
        "This is to certify that ",
        { text: `${pronouns.title} ${full_name}`, bold: true },
        ` has been employed with `,
        { text: companyName, bold: true },
        ` from `,
        { text: joiningDate, bold: true },
        ` to `,
        { text: endDateStr, bold: true },
        ".",
      ],
      lineHeight: 1.6,
      margin: [0, 0, 0, 15] as [number, number, number, number],
    });

    // Career Narrative
    content.push({
      text: narrativeParts,
      lineHeight: 1.6,
      margin: [0, 0, 0, 15] as [number, number, number, number],
    });

    // Positive note
    content.push({
      text: `During ${pronouns.possessiveLower} tenure, ${pronouns.title} ${full_name} has consistently demonstrated professionalism, dedication, and a strong work ethic. ${pronouns.subjective} has been a valuable member of our team and has contributed significantly to our organizational goals.`,
      lineHeight: 1.6,
      margin: [0, 0, 0, 15] as [number, number, number, number],
    });

    // Closing
    content.push({
      text: `We wish ${pronouns.title} ${full_name} the very best in all ${pronouns.possessiveLower} future professional endeavors and would highly recommend ${pronouns.objective} for any role that requires leadership, dedication, and expertise.`,
      lineHeight: 1.6,
      margin: [0, 0, 0, 30] as [number, number, number, number],
    });

    // Signature block
    content.push({
      columns: [
        {
          stack: [
            { text: "Sincerely,", margin: [0, 0, 0, 15] as [number, number, number, number] },
            stampBase64
              ? { image: stampBase64, width: 100, margin: [0, 0, 0, 5] as [number, number, number, number] }
              : ({ text: "", margin: [0, 0, 0, 40] } as Content),
            { text: "Human Resources Department", bold: true, fontSize: 12 },
            { text: companyName, color: "#666666", fontSize: 10 },
          ],
        },
        { text: "" },
      ],
    });

    const docDefinition: TDocumentDefinitions = {
      pageSize: "A4",
      pageMargins: [60, 40, 60, 60],
      content,
      styles: {
        brandHeader: {
          fontSize: 22,
          bold: true,
          color: companyColor,
        },
        letterTitle: {
          fontSize: 16,
          bold: true,
          decoration: "underline",
        },
      },
      defaultStyle: {
        font: "Roboto",
        fontSize: 11,
        color: "#222222",
      },
    };

    try {
      console.log("[ExperienceLetterService] Creating PDF with Printer...");

      // Create printer instance - exactly like exportService
      const printer = new PdfPrinter(fontDescriptors);
      const pdfDoc = await printer.createPdfKitDocument(docDefinition);

      return await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];

        pdfDoc.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        pdfDoc.on("end", () => {
          const buffer = Buffer.concat(chunks);
          console.log("[ExperienceLetterService] PDF generated successfully, size:", buffer.length);
          resolve(buffer);
        });

        pdfDoc.on("error", (err: Error) => {
          console.error("[ExperienceLetterService] PDF stream error:", err);
          reject(err);
        });

        pdfDoc.end();
      });
    } catch (e) {
      console.error("[ExperienceLetterService] PDF generation error:", e);
      throw e;
    }
  }
}
