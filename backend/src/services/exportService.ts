/**
 * Export Service for Kacha HRIS
 *
 * Provides functionality to export data in multiple formats:
 * - PDF (using pdfmake with Printer for Node.js)
 * - CSV
 * - Excel (using exceljs)
 */

import ExcelJS from "exceljs";
import path from "path";
import { getRemoteImageBase64, getBase64Image } from "../utils/fileUtils";

// Import PdfPrinter from the correct path and access the default export
const PdfPrinter = require("pdfmake/js/Printer").default;

// Define font paths for pdfmake Printer
const fontDescriptors = {
  Roboto: {
    normal: path.join(__dirname, "..", "assets", "fonts", "Roboto-Regular.ttf"),
    bold: path.join(__dirname, "..", "assets", "fonts", "Roboto-Medium.ttf"),
    italics: path.join(__dirname, "..", "assets", "fonts", "Roboto-Italic.ttf"),
    bolditalics: path.join(
      __dirname,
      "..",
      "assets",
      "fonts",
      "Roboto-MediumItalic.ttf",
    ),
  },
};

// Use any types for pdfmake to avoid module resolution issues
type TDocumentDefinitions = any;
type Content = any;
type TableCell = any;

// ============================================
// TYPES
// ============================================

export interface ExportField {
  key: string;
  label: string;
  width?: number; // For Excel column width
}

export interface ExportOptions {
  format: "pdf" | "csv" | "xlsx";
  fields: ExportField[];
  data: Record<string, any>[];
  title?: string;
  subtitle?: string;
  orientation?: "portrait" | "landscape";
  pageSize?: "A4" | "LETTER" | "LEGAL" | "A3" | "A2";
  companyName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export interface ExportResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

// ============================================
// BRAND CONSTANTS (matching email templates)
// ============================================
const BRAND = {
  primary: "#e55400",
  secondary: "#ffda00",
  dark: "#1a1a2e",
  lightGray: "#f8f9fa",
  companyName: "Kacha Digital Financial Service S.C",
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return value.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  if (typeof value === "object") {
    // Handle nested objects like { name: "Engineering" }
    if (value.name) return value.name;
    if (value.title) return value.title;
    if (value.full_name) return value.full_name;
    // Avoid JSON.stringify on complex objects to prevent circular ref crashes
    return "[Object]";
  }
  if (typeof value === "number") {
    // Special handling for years - if it's an integer between 1900 and 2100, don't format with decimals
    if (Number.isInteger(value) && value >= 1900 && value <= 2100) {
      return value.toString();
    }

    // Format currency-like numbers
    if (value >= 1000) {
      return value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return value.toString();
  }
  return String(value);
};

const getNestedValue = (obj: Record<string, any>, path: string): any => {
  if (!obj || !path) return undefined;
  // Support bracket indexes like employments[0] by converting to dot notation
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  return parts.reduce((current: any, key: string) => {
    if (current == null) return undefined;
    if (key === "") return current;
    const idx = Number(key);
    if (!Number.isNaN(idx) && Array.isArray(current)) {
      return current[idx];
    }
    return current?.[key];
  }, obj);
};

// ============================================
// CSV EXPORT
// ============================================

const exportToCSV = (options: ExportOptions): Buffer => {
  const { fields, data } = options;

  // Header row
  const header = fields
    .map((f) => `"${f.label.replace(/"/g, '""')}"`)
    .join(",");

  // Data rows
  const rows = data.map((record) => {
    return fields
      .map((field) => {
        const value = getNestedValue(record, field.key);
        const formatted = formatValue(value);
        // Escape quotes and wrap in quotes
        return `"${formatted.replace(/"/g, '""')}"`;
      })
      .join(",");
  });

  const csv = [header, ...rows].join("\n");
  return Buffer.from(csv, "utf-8");
};

// ============================================
// EXCEL EXPORT
// ============================================

const exportToExcel = async (options: ExportOptions): Promise<Buffer> => {
  const { fields, data, title, subtitle, companyName, primaryColor } = options;

  const brandPrimary = primaryColor || BRAND.primary;
  const brandName = companyName || BRAND.companyName;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = brandName;
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(title || "Export");

  // Title row
  if (title) {
    const titleRow = worksheet.addRow([title]);
    titleRow.font = { size: 16, bold: true, color: { argb: "FF1A1A2E" } };
    titleRow.height = 25;
    worksheet.mergeCells(1, 1, 1, fields.length);
  }

  // Subtitle row
  if (subtitle) {
    const subtitleRow = worksheet.addRow([subtitle]);
    subtitleRow.font = { size: 11, italic: true, color: { argb: "FF666666" } };
    worksheet.mergeCells(2, 1, 2, fields.length);
  }

  // Empty row for spacing
  if (title || subtitle) {
    worksheet.addRow([]);
  }

  // Header row
  const headerRow = worksheet.addRow(fields.map((f) => f.label));
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF" + brandPrimary.replace("#", "") }, // Dynamic primary color
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 22;

  // Data rows
  data.forEach((record, index) => {
    const rowData = fields.map((field) => {
      const value = getNestedValue(record, field.key);
      return formatValue(value);
    });
    const row = worksheet.addRow(rowData);

    // Alternating row colors
    if (index % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8F9FA" },
        };
      });
    }

    // Borders and Alignment
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
        left: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } },
      };
      cell.alignment = { wrapText: true, vertical: "top" };
    });
  });

  // Auto-fit columns
  fields.forEach((field, index) => {
    const column = worksheet.getColumn(index + 1);
    let maxLength = field.label.length + 4; // Header length padding

    // Check data length for this column (up to a reasonable limit to avoid performance hit)
    // Only check first 50 rows to be safe on performance
    const sampleSize = Math.min(data.length, 50);
    for (let i = 0; i < sampleSize; i++) {
      const val = getNestedValue(data[i], field.key);
      const strVal = formatValue(val);
      if (strVal.length > maxLength) {
        maxLength = strVal.length;
      }
    }

    // Apply width with max cap
    column.width = field.width || Math.min(Math.max(maxLength + 2, 15), 60);
  });

  // Footer
  const footerRowIndex = worksheet.rowCount + 2;
  const footerRow = worksheet.addRow([
    `Generated by ${brandName} on ${new Date().toLocaleString()}`,
  ]);
  footerRow.font = { size: 9, italic: true, color: { argb: "FF999999" } };
  worksheet.mergeCells(footerRowIndex, 1, footerRowIndex, fields.length);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

// ============================================
// PDF EXPORT
// ============================================
// ============================================
// PDF EXPORT (PROFESSIONAL ERP STYLE)
// ============================================

const exportToPDF = async (options: ExportOptions): Promise<Buffer> => {
  console.log("[ExportService:PDF] Starting PDF generation");

  const {
    fields,
    data,
    title,
    subtitle,
    orientation = "landscape",
    pageSize = "A3",
    companyName,
    logoUrl,
    primaryColor,
  } = options;

  const brandPrimary = primaryColor || BRAND.primary;
  const brandName = companyName || BRAND.companyName;

  // Resolve logo
  let logoBase64: string | null = null;
  if (logoUrl) {
    logoBase64 = await getRemoteImageBase64(logoUrl);
  }

  console.log("[ExportService:PDF] Building table with", data.length, "rows");

  const content: Content[] = [];

  // ============================
  // TITLE
  // ============================
  if (title) {
    content.push({
      text: title,
      style: "title",
      margin: [0, 0, 0, 4],
    });
  }

  if (subtitle) {
    content.push({
      text: subtitle,
      style: "subtitle",
      margin: [0, 0, 0, 8],
    });
  }

  if (fields.length === 0) {
    content.push({ text: "No fields selected", style: "tableCell" });
  } else {
    // ============================
    // BUILD SINGLE TABLE
    // ============================

    // Header
    const tableHeader: TableCell[] = fields.map((f) => ({
      text: f.label,
      style: "tableHeader",
      alignment: "center",
      noWrap: false,
    }));

    // Body
    const tableBody: TableCell[][] = data.map((record, index) =>
      fields.map((field) => {
        const value = getNestedValue(record, field.key);
        // Special handling for index/iteration if needed, but we use data
        const formatted = formatValue(value);
        return {
          text: formatted || "",
          style: "tableCell",
          noWrap: false,
        };
      }),
    );

    // Table Construction
    content.push({
      table: {
        headerRows: 1,
        // Use auto width for all columns to fit content
        widths: fields.map(() => "auto"),
        body: [tableHeader, ...tableBody],
        dontBreakRows: true,
      },
      layout: {
        hLineWidth: () => 0.3,
        vLineWidth: () => 0.3,
        hLineColor: () => "#E0E0E0",
        vLineColor: () => "#E0E0E0",

        // Compact but readable padding
        paddingLeft: () => 2,
        paddingRight: () => 2,
        paddingTop: () => 2,
        paddingBottom: () => 2,

        fillColor: (rowIndex: number) => {
          if (rowIndex === 0) return brandPrimary;
          return rowIndex % 2 === 0 ? "#F8F9FA" : null;
        },
      },
    });
  }

  // ============================
  // SUMMARY
  // ============================
  content.push({
    text: `Total Records: ${data.length}`,
    style: "summary",
    margin: [0, 6, 0, 0],
  });

  // ============================
  // DOCUMENT DEFINITION
  // ============================
  const docDefinition: TDocumentDefinitions = {
    pageSize,
    pageOrientation: orientation,

    // Small margins to maximize space
    pageMargins: [10, 10, 10, 10],

    header: {
      columns: [
        logoBase64
          ? {
            image: logoBase64,
            width: 40,
            margin: [10, 5, 0, 0],
          }
          : { text: "" },
        {
          text: brandName,
          style: "companyName",
          margin: [10, 5, 0, 0],
        },
        {
          text: new Date().toLocaleDateString(),
          alignment: "right",
          style: "date",
          margin: [0, 5, 10, 0],
        },
      ],
    },

    footer: (currentPage: number, pageCount: number) => ({
      stack: [
        {
          text: `Generated by ${brandName} on ${new Date().toLocaleString()}`,
          alignment: "right",
          style: "footer",
          margin: [0, 0, 10, 2],
          italics: true,
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          alignment: "center",
          style: "footer",
          margin: [0, 0, 0, 5],
        },
      ],
    }),

    content,

    styles: {
      companyName: {
        fontSize: 10,
        bold: true,
        color: BRAND.dark,
      },
      date: {
        fontSize: 8,
        color: "#666666",
      },
      title: {
        fontSize: 14,
        bold: true,
        color: BRAND.dark,
      },
      subtitle: {
        fontSize: 10,
        italics: true,
        color: "#666666",
      },
      tableHeader: {
        fontSize: 9, // Professional compact header
        bold: true,
        color: "#FFFFFF",
      },
      tableCell: {
        fontSize: 8, // Professional compact data
        color: "#333333",
      },
      footer: {
        fontSize: 8,
        color: "#999999",
      },
      summary: {
        fontSize: 10,
        bold: true,
        color: BRAND.dark,
      },
    },

    defaultStyle: {
      fontSize: 8,
      font: "Roboto",
    },
  };

  // ============================
  // PDF GENERATION
  // ============================
  try {
    const printer = new PdfPrinter(fontDescriptors);
    const pdfDoc = await printer.createPdfKitDocument(docDefinition);

    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", (err: Error) => reject(err));

      pdfDoc.end();
    });
  } catch (error) {
    console.error("[ExportService:PDF] PDF generation error:", error);
    throw error;
  }
};

// const exportToPDF = async (options: ExportOptions): Promise<Buffer> => {
//   console.log("[ExportService:PDF] Starting PDF generation");
//   const {
//     fields,
//     data,
//     title,
//     subtitle,
//     orientation = "portrait",
//     pageSize = "A4",
//   } = options;

//   console.log("[ExportService:PDF] Building table with", data.length, "rows");

//   // Build content array procedurally
//   const content: Content[] = [];

//   // Title
//   if (title) {
//     content.push({
//       text: title,
//       style: "title",
//       margin: [0, 0, 0, 5],
//     });
//   }

//   // Subtitle
//   if (subtitle) {
//     content.push({
//       text: subtitle,
//       style: "subtitle",
//       margin: [0, 0, 0, 15],
//     });
//   }

//   // Chunk columns to avoid horizontal overflow
//   // Use a max of 7 columns per table (trying to fit more per user request)
//   const MAX_COLS = 7;

//   if (fields.length === 0) {
//     content.push({ text: "No fields selected", style: "tableCell" });
//   } else {
//     // First chunk is standard (takes first MAX_COLS fields)
//     const firstChunk = fields.slice(0, MAX_COLS);
//     const chunks = [firstChunk];

//     // Create subsequent chunks, always repeating the first field (usually ID/Name)
//     // We start slicing from MAX_COLS
//     if (fields.length > MAX_COLS) {
//       const firstField = fields[0];
//       const remainingFields = fields.slice(MAX_COLS);

//       // We can fit (MAX_COLS - 1) new fields per chunk because we repeat the first one
//       const chunkSize = MAX_COLS - 1;

//       for (let i = 0; i < remainingFields.length; i += chunkSize) {
//         const nextBatch = remainingFields.slice(i, i + chunkSize);
//         chunks.push([firstField, ...nextBatch]);
//       }
//     }

//     chunks.forEach((chunkFields, index) => {
//       const isFirst = index === 0;

//       // Build table header for this chunk
//       const tableHeader: TableCell[] = chunkFields.map((f) => ({
//         text: f.label,
//         style: "tableHeader",
//         alignment: "center" as const,
//       }));

//       // Build table body for this chunk
//       const tableBody: TableCell[][] = data.map((record) =>
//         chunkFields.map((field) => {
//           const value = getNestedValue(record, field.key);
//           const formatted = formatValue(value);
//           return {
//             text: formatted || "",
//             style: "tableCell",
//           };
//         }),
//       );

//       // Add Spacer/Header for continued tables if not the first chunk
//       if (!isFirst) {
//         content.push({
//           text: `Continued (Columns ${index * (MAX_COLS - 1) + MAX_COLS + 1} ...)...`,
//           style: "subtitle",
//           margin: [0, 20, 0, 5],
//         });
//       }

//       // Add Table
//       content.push({
//         table: {
//           headerRows: 1,
//           widths: chunkFields.map(() => "auto"),
//           body: [tableHeader, ...tableBody],
//           dontBreakRows: true,
//         },
//         layout: {
//           hLineWidth: () => 0.5,
//           vLineWidth: () => 0.5,
//           hLineColor: () => "#E0E0E0",
//           vLineColor: () => "#E0E0E0",
//           // Minimal padding to fit more content (1px)
//           paddingLeft: (i: number) => 1,
//           paddingRight: (i: number) => 1,
//           fillColor: (rowIndex: number) => {
//             if (rowIndex === 0) return BRAND.primary;
//             return rowIndex % 2 === 0 ? "#F8F9FA" : null;
//           },
//         },
//       });
//     });
//   }

//   // Summary
//   content.push({
//     text: `Total Records: ${data.length}`,
//     style: "summary",
//     margin: [0, 15, 0, 0],
//   });

//   // Document definition
//   const docDefinition: TDocumentDefinitions = {
//     pageSize,
//     pageOrientation: orientation,
//     // Ultra-compact page margins
//     pageMargins: [5, 10, 5, 10],

//     header: {
//       columns: [
//         {
//           text: BRAND.companyName,
//           style: "companyName",
//           margin: [20, 10, 0, 0],
//         },
//         {
//           text: new Date().toLocaleDateString(),
//           alignment: "right" as const,
//           style: "date",
//           margin: [0, 10, 20, 0],
//         },
//       ],
//     },

//     footer: (currentPage: number, pageCount: number) => ({
//       columns: [
//         {
//           text: `Page ${currentPage} of ${pageCount}`,
//           alignment: "center" as const,
//           style: "footer",
//           margin: [0, 0, 0, 10],
//         },
//       ],
//     }),

//     content: content,

//     styles: {
//       companyName: {
//         fontSize: 12,
//         bold: true,
//         color: BRAND.dark,
//       },
//       date: {
//         fontSize: 10,
//         color: "#666666",
//       },
//       title: {
//         fontSize: 18,
//         bold: true,
//         color: BRAND.dark,
//       },
//       subtitle: {
//         fontSize: 12,
//         italics: true,
//         color: "#666666",
//       },
//       tableHeader: {
//         fontSize: 12, // Larger header
//         bold: true,
//         color: "#FFFFFF",
//       },
//       tableCell: {
//         fontSize: 12, // Larger data text
//         color: "#333333",
//       },
//       footer: {
//         fontSize: 10,
//         color: "#999999",
//       },
//       summary: {
//         fontSize: 12,
//         bold: true,
//         color: BRAND.dark,
//       },
//     },

//     defaultStyle: {
//       fontSize: 12,
//       font: "Roboto",
//     },
//   };

//   try {
//     console.log("[ExportService:PDF] Creating PDF with Printer...");

//     // Create printer instance with fonts
//     const printer = new PdfPrinter(fontDescriptors);
//     const pdfDoc = await printer.createPdfKitDocument(docDefinition);

//     return await new Promise<Buffer>((resolve, reject) => {
//       const chunks: Buffer[] = [];

//       pdfDoc.on("data", (chunk: Buffer) => {
//         chunks.push(chunk);
//       });

//       pdfDoc.on("end", () => {
//         const buffer = Buffer.concat(chunks);
//         console.log(
//           "[ExportService:PDF] PDF generated successfully, size:",
//           buffer.length,
//         );
//         resolve(buffer);
//       });

//       pdfDoc.on("error", (err: Error) => {
//         console.error("[ExportService:PDF] PDF stream error:", err);
//         reject(err);
//       });

//       pdfDoc.end();
//     });
//   } catch (error) {
//     console.error("[ExportService:PDF] PDF generation error:", error);
//     throw error;
//   }
// };

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

export const exportData = async (
  options: ExportOptions,
): Promise<ExportResult> => {
  console.log("[ExportService] Starting export with format:", options.format);
  console.log("[ExportService] Data count:", options.data.length);
  console.log("[ExportService] Fields count:", options.fields.length);

  const timestamp = new Date().toISOString().slice(0, 10);
  const baseFilename = (options.title || "export")
    .toLowerCase()
    .replace(/\s+/g, "_");

  try {
    switch (options.format) {
      case "csv":
        console.log("[ExportService] Generating CSV...");
        return {
          buffer: exportToCSV(options),
          mimeType: "text/csv",
          filename: `${baseFilename}_${timestamp}.csv`,
        };

      case "xlsx":
        console.log("[ExportService] Generating XLSX...");
        return {
          buffer: await exportToExcel(options),
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          filename: `${baseFilename}_${timestamp}.xlsx`,
        };

      case "pdf":
        console.log("[ExportService] Generating PDF...");
        const pdfBuffer = await exportToPDF(options);
        console.log("[ExportService] PDF generated successfully");
        return {
          buffer: pdfBuffer,
          mimeType: "application/pdf",
          filename: `${baseFilename}_${timestamp}.pdf`,
        };

      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  } catch (error) {
    console.error("[ExportService] Export failed:", error);
    throw error;
  }
};

// ============================================
// PREDEFINED FIELD SETS
// ============================================

export const EMPLOYEE_EXPORT_FIELDS: ExportField[] = [
  { key: "id", label: "Employee ID", width: 15 },
  { key: "full_name", label: "Full Name", width: 25 },
  { key: "gender", label: "Gender", width: 10 },
  { key: "date_of_birth", label: "Date of Birth", width: 15 },
  { key: "tin_number", label: "TIN Number", width: 15 },
  { key: "pension_number", label: "Pension Number", width: 15 },
  { key: "place_of_work", label: "Place of Work", width: 25 },
];

export const EMPLOYMENT_EXPORT_FIELDS: ExportField[] = [
  { key: "employee.id", label: "Employee ID", width: 15 },
  { key: "employee.full_name", label: "Employee Name", width: 25 },
  { key: "department.name", label: "Department", width: 20 },
  { key: "jobTitle.title", label: "Job Title", width: 30 },
  { key: "employment_type", label: "Employment Type", width: 25 },
  { key: "gross_salary", label: "Gross Salary", width: 15 },
  { key: "basic_salary", label: "Basic Salary", width: 15 },
  { key: "start_date", label: "Start Date", width: 15 },
  { key: "is_active", label: "Status", width: 10 },
];

export const LEAVE_EXPORT_FIELDS: ExportField[] = [
  { key: "employee.id", label: "Employee ID", width: 15 },
  { key: "employee.full_name", label: "Full Name", width: 25 },
  { key: "start_date", label: "Start Date", width: 15 },
  { key: "end_date", label: "End Date", width: 15 },
  { key: "duration_days", label: "Days", width: 10 },
  { key: "department_name", label: "Department", width: 20 },
  { key: "job_title", label: "Job Title", width: 25 },
  { key: "leaveType.name", label: "Leave Type", width: 20 },
  { key: "current_status", label: "Status", width: 15 },
];
