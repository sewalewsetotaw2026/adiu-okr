/**
 * Certificate of Service Generator (Resigned Employee)
 *
 * Generates a Certificate of Service for resigned employees
 * based on the official HR template.
 */

const PdfPrinter = require("pdfmake/js/Printer").default;
import * as fs from "fs";
import * as path from "path";
import { getBase64Image, getRemoteImageBase64 } from "../utils/fileUtils";

// ============================================
// FONTS
// ============================================

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

// pdfmake types
type TDocumentDefinitions = any;
type Content = any;

// ============================================
// CONSTANTS
// ============================================

const BRAND = {
  primary: "#DB5E00",
  companyName: "Kacha Digital Financial Service S.C.",
  companyNameFull: "KACHA DIGITAL FINANCIAL SERVICES S.C.",
};

const SIGNATORY = {
  name: "Human Resources Department",
  title: "Kacha Digital Financial Service S.C.",
};

// ============================================
// UTILITIES
// ============================================

function formatDate(date: any): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function numberToWords(num: number): string {
  if (num === 0) return "Zero Birr";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100)
      return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000)
      return (
        ones[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 ? " " + convert(n % 100) : "")
      );
    return "";
  };

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let words = "";

  if (integerPart >= 1000) {
    words =
      convert(Math.floor(integerPart / 1000)) +
      " Thousand " +
      convert(integerPart % 1000);
  } else {
    words = convert(integerPart);
  }

  words = words.trim();

  if (decimalPart > 0) {
    words += ` and ${decimalPart}/100`;
  }

  return words + " Birr";
}

function formatSalary(amount: number): {
  numeric: string;
  words: string;
} {
  const numeric = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const words = numberToWords(amount);

  return { numeric, words };
}

function getPronouns(gender?: string) {
  const isFemale = gender?.toLowerCase() === "female";
  return {
    title: isFemale ? "Ms." : "Mr.",
    subjective: isFemale ? "She" : "He",
    possessive: isFemale ? "Her" : "His",
    possessiveLower: isFemale ? "her" : "his",
    objective: isFemale ? "her" : "him",
  };
}

// ============================================
// TEMPLATE BUILDER
// ============================================

// HTTPS module needed dynamically? Or use existing import if any.
// The file imports 'fs' and 'path'. We need 'https'.

function buildSignatureBlock(
  stampBase64: string | null,
  signerName?: string,
  signerTitle?: string,
  signerSignatureBase64?: string | null,
  companyName: string = SIGNATORY.title,
): Content {
  const resolvedSignerName = signerName?.trim() || SIGNATORY.name;
  const isCustomSigner = resolvedSignerName !== SIGNATORY.name;

  const signatureStampBlock = {
    columns: [
      signerSignatureBase64
        ? {
            image: signerSignatureBase64,
            width: 100,
            alignment: "left",
            margin: [-25, 0, 0, 5], // Nudge left
          }
        : { text: "" },

      stampBase64
        ? {
            image: stampBase64,
            width: 100,
            alignment: "left",
            margin: [-15, 0, 0, 0], // Move significantly closer
          }
        : { text: "" },
    ],
    widths: ["auto", "auto"],
    columnGap: 0,
  };

  return {
    stack: [
      { text: "Sincerely,", margin: [0, 0, 0, 5] },
      signatureStampBlock,
      {
        text: resolvedSignerName,
        italics: isCustomSigner,
        fontFamily: isCustomSigner ? "Roboto" : undefined,
        fontSize: isCustomSigner ? 14 : 11,
        bold: true,
        margin: [0, 0, 0, 0],
      },
      isCustomSigner
        ? { text: signerTitle || "", fontSize: 11, margin: [0, 2, 0, 0] }
        : { text: "" },
      { text: "", margin: [0, -4, 0, 0] },
      { text: companyName, color: "#666666", fontSize: 10, bold: true },
    ],
  };
}

function buildRoleHistory(allEmployments: any[]) {
  //
  const sortedEmployments = [...allEmployments].sort(
    (a: any, b: any) =>
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  );

  //
  return sortedEmployments.map((emp: any, index: number, arr: any[]) => {
    const nextEmp = arr[index + 1];

    const resolvedEndDate = emp.end_date
      ? formatDate(emp.end_date)
      : emp.is_active
        ? formatDate(new Date())
        : nextEmp?.start_date
          ? formatDate(
              new Date(new Date(nextEmp.start_date).getTime() - 86400000),
            )
          : formatDate(new Date());

    return {
      title: (emp.jobTitle?.title || "Employee").trim(),
      level: emp.jobTitle?.level,
      department: emp.department?.name,
      startDate: formatDate(emp.start_date),
      endDate: resolvedEndDate,
      isCurrent: emp.is_active === true,
    };
  });
}

function buildResignedCertificateOfServiceContent(data: {
  fullName: string;
  pronouns: ReturnType<typeof getPronouns>;
  employments: any[];
  salary: { numeric: string; words: string };
  refNumber: string;
  currentDate: string;
  logoBase64: string | null;
  stampBase64: string | null;
  signerName?: string;
  signerTitle?: string;
  signerSignatureBase64?: string | null;
  layoutConfig?: {
    lineHeight: number;
    paragraphMargin: [number, number, number, number];
    listMargin: [number, number, number, number];
    headerMargin: [number, number, number, number];
    signatureMargin: [number, number, number, number];
  };
  companyName: string;
  companyColor: string;
}): Content[] {
  const {
    fullName,
    pronouns,
    employments,
    salary,
    refNumber,
    currentDate,
    logoBase64,
    stampBase64,
    signerName,
    signerTitle,
    signerSignatureBase64,
    layoutConfig = {
      lineHeight: 1.7,
      paragraphMargin: [0, 0, 0, 15],
      listMargin: [0, 10, 0, 15],
      headerMargin: [0, 0, 0, 25],
      signatureMargin: [0, 0, 0, 30],
    },
    companyName,
    companyColor,
  } = data;

  const firstName = fullName.split(" ")[0];

  const roles = buildRoleHistory(employments);
  const isSingleRole = roles.length === 1;

  const roleLines = roles.map((role) => ({
    text: [
      { text: role.title, bold: true },
      `: From ${role.startDate} to ${role.endDate}`,
    ],
    margin: [0, 2, 0, 2],
  }));

  const firstRole = roles[0];
  const lastRole = roles[roles.length - 1];

  const serviceParagraph: Content = isSingleRole
    ? {
        text: [
          "This is to certify that ",
          { text: `${pronouns.title} ${fullName}`, bold: true },
          " has been a permanent employee at ",
          { text: companyName, bold: true },
          ", serving as a ",
          { text: roles[0].title, bold: true },
          " from ",
          { text: roles[0].startDate, bold: true },
          " up to ",
          { text: roles[0].endDate, bold: true },
          ".",
        ],
        lineHeight: layoutConfig.lineHeight,
        margin: layoutConfig.paragraphMargin,
      }
    : {
        text: [
          "This is to certify that ",
          { text: `${pronouns.title} ${fullName}`, bold: true },
          " has been a permanent employee at ",
          { text: companyName, bold: true },
          ", serving in the following capacities:",
        ],
        lineHeight: layoutConfig.lineHeight,
        margin: [0, 0, 0, 10],
      };

  const content: Content[] = [];

  if (logoBase64) {
    content.push({
      image: logoBase64,
      width: 35,
      alignment: "center",
      margin: [0, 0, 0, 5],
    });
  }

  content.push(
    {
      text: companyName.toUpperCase(),
      style: "brandHeader",
      alignment: "center",
      color: companyColor,
    },
    { text: "", margin: layoutConfig.headerMargin },

    {
      columns: [
        { text: "", width: "*" },
        {
          stack: [
            { text: [{ text: "Date: ", bold: true }, currentDate] },
            { text: [{ text: "Ref: ", bold: true }, refNumber] },
          ],
          alignment: "right",
        },
      ],
      margin: [0, 0, 0, 25],
    },

    {
      text: "CERTIFICATE OF SERVICE",
      style: "letterTitle",
      alignment: "center",
      decoration: "underline",
      margin: layoutConfig.headerMargin,
    },
    serviceParagraph,

    !isSingleRole
      ? [
          {
            ul: roleLines,
            margin: layoutConfig.listMargin,
          },
        ]
      : [],
    {
      text: [
        { text: `${pronouns.title} ${firstName}`, bold: true },
        " drew a monthly gross salary of Birr ",
        { text: salary.numeric, bold: true },
        " (",
        { text: salary.words, italics: true },
        ") per month.",
      ],
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },

    {
      text:
        "Income tax and pension contributions have been duly deducted from " +
        pronouns.possessiveLower +
        " salary and paid to the concerned government authority during the period of " +
        pronouns.possessiveLower +
        " employment with our company.",
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },

    {
      text: [
        { text: `${pronouns.title} ${firstName}`, bold: true },
        " has resigned from our company on ",
        pronouns.possessiveLower,
        " own accord.",
      ],
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },

    {
      text:
        companyName +
        " wishes " +
        pronouns.objective +
        " all the best in " +
        pronouns.possessiveLower +
        " future endeavors.",
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.signatureMargin,
    },

    buildSignatureBlock(
      stampBase64,
      signerName,
      signerTitle,
      signerSignatureBase64,
      companyName,
    ),
  );

  return content;
}

// ============================================
// MAIN SERVICE
// ============================================

export class ResignedCertificateOfServiceService {
  static async generate(employeeData: any): Promise<Buffer> {
    const {
      full_name,
      id,
      gender,
      employments = [],
      signer_name,
      signer_title,
      signer_signature_url,
    } = employeeData;

    const rawCompanyName = (employeeData?.company?.name || "").trim();
    const companyName =
      rawCompanyName &&
      rawCompanyName.toLowerCase() !==
        String(full_name || "")
          .trim()
          .toLowerCase()
        ? rawCompanyName
        : BRAND.companyName;
    const companyColor = employeeData?.company?.primary_color || BRAND.primary;

    // Load assets
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

    let stampBase64 = null;
    if (employeeData?.company?.stamp_url) {
      stampBase64 = await getRemoteImageBase64(employeeData.company.stamp_url);
    }

    if (!stampBase64) {
      stampBase64 = getBase64Image(stampPath);
    }

    // Fetch signer signature if available
    let signerSignatureBase64 = null;
    if (signer_signature_url) {
      signerSignatureBase64 = await getRemoteImageBase64(signer_signature_url);
    }

    // Employment data

    // Reference
    const year = new Date().getFullYear();
    const paddedId = (id || "").toString().padStart(3, "0");
    const refNumber = `KDFS/HR/RES/${year}/${paddedId}`;

    const resignedEmployments = employments.filter((e: any) => !e.is_active);

    const lastEmployment =
      resignedEmployments[resignedEmployments.length - 1] ||
      employments[employments.length - 1];

    const salary = formatSalary(Number(lastEmployment?.gross_salary) || 0);

    // Adaptive formatting based on content density
    const rolesCount = employments.length;
    let selectedPageSize = "A4";
    let headingFontSize = 20;
    let baseFontSize = 11;
    let pageMargins: [number, number, number, number] = [60, 40, 60, 60];

    // Layout configuration for content builders
    let layoutConfig = {
      lineHeight: 1.5,
      paragraphMargin: [0, 0, 0, 15] as [number, number, number, number],
      listMargin: [0, 10, 0, 15] as [number, number, number, number],
      headerMargin: [0, 0, 0, 25] as [number, number, number, number],
      signatureMargin: [0, 0, 0, 30] as [number, number, number, number],
    };

    // Heuristics to keep it on one page
    if (rolesCount > 20) {
      // EXTREME: Impossible to fit on A4, switch to A3 to maintain "one page" requirement
      console.log("Using EXTREME layout (A3)");
      selectedPageSize = "A3";
      // Use comfortable sizing since we have lots of space on A3
      baseFontSize = 12;
      headingFontSize = 22;
      pageMargins = [60, 60, 60, 60];
      layoutConfig = {
        lineHeight: 1.5,
        paragraphMargin: [0, 0, 0, 15],
        listMargin: [0, 10, 0, 15],
        headerMargin: [0, 0, 0, 30],
        signatureMargin: [0, 0, 0, 40],
      };
    } else if (rolesCount > 14) {
      // ULTRA COMPACT: 15-20 roles
      console.log("Using ULTRA COMPACT layout");
      baseFontSize = 9;
      headingFontSize = 15;
      pageMargins = [30, 15, 30, 15];
      layoutConfig = {
        lineHeight: 1.1,
        paragraphMargin: [0, 0, 0, 5],
        listMargin: [0, 2, 0, 5],
        headerMargin: [0, 0, 0, 10],
        signatureMargin: [0, 0, 0, 10],
      };
    } else if (rolesCount > 9) {
      // SUPER COMPACT: 10-14 roles
      console.log("Using SUPER COMPACT layout");
      baseFontSize = 10;
      headingFontSize = 16;
      pageMargins = [40, 20, 40, 20];
      layoutConfig = {
        lineHeight: 1.2,
        paragraphMargin: [0, 0, 0, 8],
        listMargin: [0, 5, 0, 8],
        headerMargin: [0, 0, 0, 15],
        signatureMargin: [0, 0, 0, 15],
      };
    } else if (rolesCount > 5) {
      // COMPACT: 6-9 roles
      console.log("Using COMPACT layout");
      baseFontSize = 10.5;
      headingFontSize = 18;
      pageMargins = [50, 30, 50, 30];
      layoutConfig = {
        lineHeight: 1.35,
        paragraphMargin: [0, 0, 0, 10],
        listMargin: [0, 8, 0, 10],
        headerMargin: [0, 0, 0, 20],
        signatureMargin: [0, 0, 0, 20],
      };
    } else {
      // STANDARD: <= 5 roles
      console.log("Using STANDARD layout");
      // Defaults apply
    }

    const content = buildResignedCertificateOfServiceContent({
      fullName: full_name,
      pronouns: getPronouns(gender),

      employments: employments,

      salary: {
        numeric: salary.numeric,
        words: salary.words,
      },
      refNumber,
      currentDate: formatDate(new Date()),
      logoBase64,
      stampBase64,
      signerName: signer_name,
      signerTitle: signer_title,
      signerSignatureBase64, // Pass it down
      layoutConfig, // Pass layout config
      companyName,
      companyColor,
    });

    const docDefinition: TDocumentDefinitions = {
      pageSize: selectedPageSize,
      pageMargins: pageMargins,
      content,
      styles: {
        brandHeader: {
          fontSize: headingFontSize,
          bold: true,
          color: companyColor,
          margin: [0, 0, 0, 5],
        },
        letterTitle: {
          fontSize: Math.max(12, headingFontSize - 6),
          bold: true,
        },
      },
      defaultStyle: {
        font: "Roboto",
        fontSize: baseFontSize,
        color: "#222222",
      },
    };

    try {
      const printer = new PdfPrinter(fontDescriptors);
      const pdfDoc = await printer.createPdfKitDocument(docDefinition);

      return await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];

        pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
        pdfDoc.on("error", reject);

        pdfDoc.end();
      });
    } catch (e) {
      console.error("[ResignationLetterService] PDF generation failed", e);
      throw e;
    }
  }
}
