/**
 * Certificate of Service Generator
 *
 * Generates formal certificates of service for employees with 4 template variants:
 * 1. Active Employee - Single Role
 * 2. Active Employee - Multiple Roles
 * 3. Resigned Employee - Single Role
 * 4. Resigned Employee - Multiple Roles
 */

const PdfPrinter = require("pdfmake/js/Printer").default;
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

// Define font paths at module level - same pattern as exportService
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

// Type definitions for pdfmake
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
  defaultName: "Human Resources Department",
  title: "Kacha Digital Financial Service S.C.",
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Read an image file and convert to base64 data URI
 */
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

/**
 * Fetch remote image and convert to base64
 */
function getRemoteImageBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }

    // Handle local paths or file:// protocol if any
    if (!url.startsWith("http")) {
      // Only handling http(s)
      resolve(null);
      return;
    }

    https
      .get(url, (res) => {
        const data: Buffer[] = [];
        res.on("data", (chunk) => data.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(data);
          // Simple mime type detection or fallback
          let mimeType = "image/png";
          if (
            url.toLowerCase().endsWith(".jpg") ||
            url.toLowerCase().endsWith(".jpeg")
          ) {
            mimeType = "image/jpeg";
          }
          resolve(`data:${mimeType};base64,${buffer.toString("base64")}`);
        });
        res.on("error", (e) => {
          console.error("Failed to fetch remote signature", e);
          resolve(null);
        });
      })
      .on("error", (e) => {
        console.error("Failed to fetch remote signature", e);
        resolve(null);
      });
  });
}

/**
 * Format a date to "Month Day, Year" format
 */
function formatDate(date: any): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Convert number to words (Ethiopian Birr context)
 */
function numberToWords(num: number): string {
  if (num === 0) return "Zero";

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

  const convertGroup = (n: number): string => {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100)
      return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    return (
      ones[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 ? " " + convertGroup(n % 100) : "")
    );
  };

  const intPart = Math.floor(num);
  const decimalPart = Math.round((num - intPart) * 100);

  let result = "";

  if (intPart >= 1000000) {
    result += convertGroup(Math.floor(intPart / 1000000)) + " Million ";
    result += convertGroup(Math.floor((intPart % 1000000) / 1000));
    if (Math.floor((intPart % 1000000) / 1000) > 0) result += " Thousand ";
    result += convertGroup(intPart % 1000);
  } else if (intPart >= 1000) {
    result += convertGroup(Math.floor(intPart / 1000)) + " Thousand ";
    result += convertGroup(intPart % 1000);
  } else {
    result = convertGroup(intPart);
  }

  result = result.trim();

  if (decimalPart > 0) {
    result += " and " + decimalPart + "/100";
  }

  return result + " Birr";
}

/**
 * Format salary as "Birr XX,XXX.XX (Amount in Words)"
 */
function formatSalary(amount: number): { numeric: string; words: string } {
  const numeric = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const words = numberToWords(amount);
  return { numeric, words };
}

/**
 * Get pronoun set based on gender
 */
function getPronouns(gender: string | undefined): {
  title: string;
  subjective: string;
  possessive: string;
  possessiveLower: string;
  objective: string;
} {
  const normalized = gender?.toString().trim().toLowerCase();

  const isFemale = normalized === "female" || normalized === "f";

  return {
    title: isFemale ? "Ms." : "Mr.",
    subjective: isFemale ? "She" : "He",
    possessive: isFemale ? "Her" : "His",
    possessiveLower: isFemale ? "her" : "his",
    objective: isFemale ? "her" : "him",
  };
}

// ============================================
// ROLE HISTORY BUILDER
// ============================================

interface RoleHistory {
  title: string;
  level?: string;
  department?: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
}

/**
 * Build a chronological list of roles from employments and career events
 */
function buildRoleHistory(employeeData: any): RoleHistory[] {
  const { employments = [], careerEvents = [] } = employeeData;

  // Sort employments by start date
  const sortedEmployments = [...employments].sort(
    (a, b) =>
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  );

  // If we have career events, build roles from them
  if (careerEvents.length > 0) {
    const roles: RoleHistory[] = [];

    // First role from initial employment
    const initial = sortedEmployments[0];
    if (initial) {
      const firstEventDate =
        careerEvents.length > 0
          ? new Date(careerEvents[0].effective_date)
          : null;

      roles.push({
        title: initial.jobTitle?.title || "Employee",
        level: initial.jobTitle?.level,
        department: initial.department?.name,
        startDate: formatDate(initial.start_date),
        endDate: firstEventDate
          ? formatDate(new Date(firstEventDate.getTime() - 86400000))
          : null,
        isCurrent: false,
      });
    }

    // Build roles from career events
    const sortedEvents = [...careerEvents].sort(
      (a, b) =>
        new Date(a.effective_date).getTime() -
        new Date(b.effective_date).getTime(),
    );

    sortedEvents.forEach((event, index) => {
      const nextEvent = sortedEvents[index + 1];
      const isCurrent = !nextEvent && employments.some((e: any) => e.is_active);

      roles.push({
        title: event.newJobTitle?.title || event.new_job_title || "Employee",
        level: event.newJobTitle?.level || event.new_level,
        department: event.newDepartment?.name || event.new_department,
        startDate: formatDate(event.effective_date),
        endDate: nextEvent
          ? formatDate(
            new Date(new Date(nextEvent.effective_date).getTime() - 86400000),
          )
          : null,
        isCurrent,
      });
    });

    return roles;
  }

  // No career events - use employments directly
  return sortedEmployments.map((emp, index) => ({
    title: emp.jobTitle?.title || "Employee",
    level: emp.jobTitle?.level,
    department: emp.department?.name,
    startDate: formatDate(emp.start_date),
    endDate: emp.end_date ? formatDate(emp.end_date) : null,
    isCurrent: emp.is_active === true,
  }));
}

// ============================================
// TEMPLATE BUILDERS
// ============================================

interface LayoutConfig {
  lineHeight: number;
  paragraphMargin: [number, number, number, number];
  listMargin: [number, number, number, number];
  headerMargin: [number, number, number, number];
  signatureMargin: [number, number, number, number];
}

interface TemplateData {
  fullName: string;
  pronouns: ReturnType<typeof getPronouns>;
  roles: RoleHistory[];
  grossSalary: number;
  isActive: boolean;
  refNumber: string;
  currentDate: string;
  stampBase64: string | null;
  logoBase64: string | null;
  signerName?: string;
  signerTitle?: string;
  signerSignatureBase64?: string | null;
  layoutConfig?: LayoutConfig; // Optional for backward compatibility if needed, but we'll always pass it
  companyName: string;
  companyColor: string;
}

/**
 * Build the role history list for multiple roles template
 */
function buildRolesList(
  roles: RoleHistory[],
  listMargin: [number, number, number, number] = [0, 10, 0, 15],
): Content {
  return {
    ul: roles.map((role, index) => {
      const titleText = role.title;
      const dateText = role.isCurrent
        ? `From ${role.startDate} up to now`
        : `From ${role.startDate} to ${role.endDate || "N/A"}`;

      return {
        text: [{ text: titleText, bold: true }, `: ${dateText}`],
        margin: [0, 2, 0, 2] as [number, number, number, number],
      };
    }),
    margin: listMargin,
  };
}

/**
 * Template: Active Employee - Single Role
 */
function buildActiveSingleRoleContent(data: TemplateData): Content[] {
  const {
    fullName,
    pronouns,
    roles,
    grossSalary,
    refNumber,
    currentDate,
    stampBase64,
    logoBase64,
    layoutConfig = {
      lineHeight: 1.7,
      paragraphMargin: [0, 0, 0, 15],
      listMargin: [0, 10, 0, 15],
      headerMargin: [0, 0, 0, 25],
      signatureMargin: [0, 0, 0, 30],
    },
  } = data;
  const role = roles[0];
  const salary = formatSalary(grossSalary);

  const content: Content[] = [];

  // Header with logo
  if (logoBase64) {
    content.push({
      image: logoBase64,
      width: 35,
      alignment: "center" as const,
      margin: [0, 0, 0, 5] as [number, number, number, number],
    });
  }

  content.push(
    {
      text: data.companyName.toUpperCase(),
      style: "brandHeader",
      alignment: "center" as const,
    },
    { text: "", margin: layoutConfig.headerMargin },
    // Date and Ref
    {
      columns: [
        { text: "", width: "*" },
        {
          stack: [
            { text: [{ text: "Date: ", bold: true }, currentDate] },
            {
              text: [{ text: "Ref: ", bold: true }, refNumber],
              margin: [0, 5, 0, 0] as [number, number, number, number],
            },
          ],
          width: "auto",
          alignment: "right" as const,
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    },
    // Title
    {
      text: "CERTIFICATE OF SERVICE",
      style: "certificateTitle",
      alignment: "center" as const,
      decoration: "underline",
      margin: layoutConfig.headerMargin,
    },
    // Body - Single Role Active
    {
      text: [
        "This is to certify that ",
        { text: `${pronouns.title} ${fullName}`, bold: true },
        " has been a permanent employee of ",
        { text: data.companyName, bold: true },
        " working as a ",
        {
          text: role.title,
          bold: true,
        },
        " starting from ",
        { text: role.startDate, bold: true },
        " up to now.",
      ],
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },
    // Salary paragraph
    {
      text: [
        { text: `${pronouns.title} ${fullName.split(" ")[0]}`, bold: true },
        " currently draws a monthly gross salary of ",
        { text: `Birr ${salary.numeric}`, bold: true },
        " (",
        { text: salary.words, italics: true },
        ").",
      ],
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },
    // Tax and pension paragraph
    {
      text: `Income tax and pension contributions have been duly deducted from ${pronouns.possessiveLower} salary and paid to the concerned government authority during the period of ${pronouns.possessiveLower} employment with our company.`,
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },
    // Disclaimer
    {
      text: "This certificate is issued upon the employee's request for any lawful purpose it may serve. It does not, however, constitute a clearance.",
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.signatureMargin,
    },
    // Signature block
    buildSignatureBlock(
      stampBase64,
      data.signerName,
      data.signerTitle,
      data.signerSignatureBase64,
      data.companyName,
    ),
  );

  return content;
}

/**
 * Template: Active Employee - Multiple Roles
 */
function buildActiveMultipleRolesContent(data: TemplateData): Content[] {
  const {
    fullName,
    pronouns,
    roles,
    grossSalary,
    refNumber,
    currentDate,
    stampBase64,
    logoBase64,
    layoutConfig = {
      lineHeight: 1.7,
      paragraphMargin: [0, 0, 0, 15],
      listMargin: [0, 10, 0, 15],
      headerMargin: [0, 0, 0, 25],
      signatureMargin: [0, 0, 0, 30],
    },
  } = data;
  const salary = formatSalary(grossSalary);

  const content: Content[] = [];

  if (logoBase64) {
    content.push({
      image: logoBase64,
      width: 35,
      alignment: "center" as const,
      margin: [0, 0, 0, 5] as [number, number, number, number],
    });
  }

  content.push(
    {
      text: data.companyName.toUpperCase(),
      style: "brandHeader",
      alignment: "center" as const,
    },
    { text: "", margin: layoutConfig.headerMargin },
    {
      columns: [
        { text: "", width: "*" },
        {
          stack: [
            { text: [{ text: "Date: ", bold: true }, currentDate] },
            {
              text: [{ text: "Ref: ", bold: true }, refNumber],
              margin: [0, 5, 0, 0] as [number, number, number, number],
            },
          ],
          width: "auto",
          alignment: "right" as const,
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    },
    {
      text: "CERTIFICATE OF SERVICE",
      style: "certificateTitle",
      alignment: "center" as const,
      decoration: "underline",
      margin: layoutConfig.headerMargin,
    },
    // Body - Multiple Roles Active
    {
      text: [
        "This is to certify that ",
        { text: `${pronouns.title} ${fullName}`, bold: true },
        " is a permanent employee of ",
        { text: data.companyName, bold: true },
        ", having served in the following capacities:",
      ],
      lineHeight: layoutConfig.lineHeight,
      margin: [0, 0, 0, 10] as [number, number, number, number],
    },
    // Roles list
    buildRolesList(roles, layoutConfig.listMargin),
    // Salary
    {
      text: [
        { text: `${pronouns.title} ${fullName.split(" ")[0]}`, bold: true },
        " currently draws a monthly gross salary of ",
        { text: `Birr ${salary.numeric}`, bold: true },
        " (",
        { text: salary.words, italics: true },
        ").",
      ],
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },
    {
      text: `Income tax and pension contributions have been duly deducted from ${pronouns.possessiveLower} salary and paid to the concerned government authority during the period of ${pronouns.possessiveLower} employment with our company.`,
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },
    // Disclaimer
    {
      text: "This certificate is issued upon the employee's request for any lawful purpose it may serve. It does not, however, constitute a clearance.",
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.signatureMargin,
    },
    buildSignatureBlock(
      stampBase64,
      data.signerName,
      data.signerTitle,
      data.signerSignatureBase64,
      data.companyName,
    ),
  );

  return content;
}

/**
 * Template: Resigned Employee - Single Role
 */
function buildResignedSingleRoleContent(data: TemplateData): Content[] {
  const {
    fullName,
    pronouns,
    roles,
    grossSalary,
    refNumber,
    currentDate,
    stampBase64,
    logoBase64,
    layoutConfig = {
      lineHeight: 1.7,
      paragraphMargin: [0, 0, 0, 15],
      listMargin: [0, 10, 0, 15],
      headerMargin: [0, 0, 0, 25],
      signatureMargin: [0, 0, 0, 30],
    },
  } = data;
  const role = roles[0];
  const salary = formatSalary(grossSalary);

  const content: Content[] = [];

  if (logoBase64) {
    content.push({
      image: logoBase64,
      width: 35,
      alignment: "center" as const,
      margin: [0, 0, 0, 5] as [number, number, number, number],
    });
  }

  content.push(
    {
      text: data.companyName.toUpperCase(),
      style: "brandHeader",
      alignment: "center" as const,
    },
    { text: "", margin: layoutConfig.headerMargin },
    {
      columns: [
        { text: "", width: "*" },
        {
          stack: [
            { text: [{ text: "Ref: ", bold: true }, refNumber] },
            {
              text: [{ text: "Date: ", bold: true }, currentDate],
              margin: [0, 5, 0, 0] as [number, number, number, number],
            },
          ],
          width: "auto",
          alignment: "right" as const,
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    },
    {
      text: "CERTIFICATE OF SERVICE",
      style: "certificateTitle",
      alignment: "center" as const,
      decoration: "underline",
      margin: layoutConfig.headerMargin,
    },
    // Body - Single Role Resigned
    {
      text: [
        "This is to certify that ",
        { text: `${pronouns.title} ${fullName}`, bold: true },
        " has been a permanent employee of ",
        { text: data.companyName, bold: true },
        ", serving as a ",
        {
          text: role.title,
          bold: true,
        },
        " from ",
        { text: role.startDate, bold: true },
        " up to ",
        { text: role.endDate || "N/A", bold: true },
        ".",
      ],
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },
    {
      text: [
        { text: `${pronouns.title} ${fullName.split(" ")[0]}`, bold: true },
        " drew a monthly gross salary of ",
        { text: `Birr ${salary.numeric}`, bold: true },
        " (",
        { text: salary.words, italics: true },
        ") per month.",
      ],
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },
    {
      text: `Income tax and pension contributions have been duly deducted from ${pronouns.possessiveLower} salary and paid to the concerned government authority during ${pronouns.possessiveLower} employment with our company.`,
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },
    {
      text: [
        { text: `${pronouns.title} ${fullName.split(" ").pop()}`, bold: true },
        ` has resigned from our company on ${pronouns.possessiveLower} own accord.`,
      ],
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },
    {
      text: `${data.companyName} wishes ${pronouns.objective} all the best in ${pronouns.possessiveLower} future endeavors.`,
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.signatureMargin,
    },
    buildSignatureBlock(
      stampBase64,
      data.signerName,
      data.signerTitle,
      data.signerSignatureBase64,
      data.companyName,
    ),
  );

  return content;
}

/**
 * Template: Resigned Employee - Multiple Roles
 */
function buildResignedMultipleRolesContent(data: TemplateData): Content[] {
  console.log("the data from the build resigned multipele role content", data);
  const {
    fullName,
    pronouns,
    roles,
    grossSalary,
    refNumber,
    currentDate,
    stampBase64,
    logoBase64,
    layoutConfig = {
      lineHeight: 1.7,
      paragraphMargin: [0, 0, 0, 15],
      listMargin: [0, 10, 0, 15],
      headerMargin: [0, 0, 0, 25],
      signatureMargin: [0, 0, 0, 30],
    },
  } = data;
  const salary = formatSalary(grossSalary);

  const content: Content[] = [];

  if (logoBase64) {
    content.push({
      image: logoBase64,
      width: 35,
      alignment: "center" as const,
      margin: [0, 0, 0, 5] as [number, number, number, number],
    });
  }

  content.push(
    {
      text: data.companyName.toUpperCase(),
      style: "brandHeader",
      alignment: "center" as const,
    },
    { text: "", margin: layoutConfig.headerMargin },
    {
      columns: [
        { text: "", width: "*" },
        {
          stack: [
            { text: [{ text: "Ref: ", bold: true }, refNumber] },
            {
              text: [{ text: "Date: ", bold: true }, currentDate],
              margin: [0, 5, 0, 0] as [number, number, number, number],
            },
          ],
          width: "auto",
          alignment: "right" as const,
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    },
    {
      text: "CERTIFICATE OF SERVICE",
      style: "certificateTitle",
      alignment: "center" as const,
      decoration: "underline",
      margin: layoutConfig.headerMargin,
    },
    // Body - Multiple Roles Resigned
    {
      text: [
        "This is to certify that ",
        { text: `${pronouns.title} ${fullName}`, bold: true },
        " has been a permanent employee of ",
        { text: data.companyName, bold: true },
        ", serving in the following capacities:",
      ],
      lineHeight: layoutConfig.lineHeight,
      margin: [0, 0, 0, 10] as [number, number, number, number],
    },
    buildRolesList(roles, layoutConfig.listMargin),
    {
      text: [
        { text: `${pronouns.title} ${fullName.split(" ")[0]}`, bold: true },
        " drew a monthly gross salary of ",
        { text: `Birr ${salary.numeric}`, bold: true },
        " (",
        { text: salary.words, italics: true },
        ") per month.",
      ],
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },
    {
      text: `Income tax and pension contributions have been duly deducted from ${pronouns.possessiveLower} salary and paid to the concerned government authority during the period of ${pronouns.possessiveLower} employment with our company.`,
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },
    {
      text: [
        { text: `${pronouns.title} ${fullName.split(" ").pop()}`, bold: true },
        ` has resigned from our company on ${pronouns.possessiveLower} own accord.`,
      ],
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.paragraphMargin,
    },
    {
      text: `${data.companyName} wishes ${pronouns.objective} all the best in ${pronouns.possessiveLower} future endeavors.`,
      lineHeight: layoutConfig.lineHeight,
      margin: layoutConfig.signatureMargin,
    },
    // Signature block
    buildSignatureBlock(
      stampBase64,
      data.signerName,
      data.signerTitle,
      data.signerSignatureBase64,
      data.companyName,
    ),
  );

  return content;
}

/**
 * Build the signature block with stamp
 */
function buildSignatureBlock(
  stampBase64: string | null,
  signerName: string | undefined,
  signerTitle: string | undefined,
  signerSignatureBase64: string | null | undefined,
  companyName: string = SIGNATORY.title,
): Content {
  const resolvedSignerName = signerName?.trim() || SIGNATORY.defaultName;
  const isCustomSigner = resolvedSignerName !== SIGNATORY.defaultName;

  const signatureStampBlock = {
    columns: [
      signerSignatureBase64
        ? {
          image: signerSignatureBase64,
          width: 100,
          alignment: "left",
          margin: [-25, 0, 0, 0], // Nudge further left for perfect alignment
        }
        : { text: "" },

      stampBase64
        ? {
          image: stampBase64,
          width: 100,
          alignment: "left",
          margin: [-15, 0, 0, 0], // Move significantly closer to signature
        }
        : { text: "" },
    ],
    widths: ["auto", "auto"],
    columnGap: 0,
  };

  return {
    stack: [
      {
        text: "Sincerely,",
        margin: [0, 0, 0, 5],
      },
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
        ? {
          text: signerTitle || "",
          fontSize: 11,
          margin: [0, 2, 0, 0],
        }
        : { text: "" },
      isCustomSigner
        ? {
          text: "",
          margin: [0, -4, 0, 0],
        }
        : { text: "" },
      {
        text: companyName,
        color: "#666666",
        fontSize: 10,
        bold: true,
        margin: [0, 0, 0, 0],
      },
    ],
  };
}

// ============================================
// MAIN SERVICE CLASS
// ============================================
const DEFAULT_SIGNER_NAME = "Human Resources Department";

export class CertificateOfServiceService {
  /**
   * Generate a Certificate of Service PDF based on employee data
   */
  static async generate(employeeData: any): Promise<Buffer> {
    // Extract data
    const {
      full_name,
      first_name,
      middle_name,
      last_name,
      id,
      gender,
      employments = [],
      signer_name,
      signer_title,
    } = employeeData;

    // TEMP: placeholder signer until schema supports it
    const resolvedSignerName = signer_name?.trim() || DEFAULT_SIGNER_NAME;

    console.log("Signer name resolved:", resolvedSignerName);

    // Resolve employee full name safely
    const resolvedFullName =
      full_name?.trim() ||
      [first_name, middle_name, last_name].filter(Boolean).join(" ").trim();

    if (!resolvedFullName) {
      throw new Error(
        "Employee name is missing. Cannot generate Certificate of Service.",
      );
    }

    // Load assets
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

    let stampBase64 = null;
    if (employeeData?.company?.stamp_url) {
      stampBase64 = await getRemoteImageBase64(employeeData.company.stamp_url);
    }

    if (!stampBase64) {
      stampBase64 = getBase64Image(stampPath);
    }

    // Fetch signer signature if available
    let signerSignatureBase64 = null;
    if (employeeData.signer_signature_url) {
      signerSignatureBase64 = await getRemoteImageBase64(
        employeeData.signer_signature_url,
      );
    }

    // Build role history
    const roles = buildRoleHistory(employeeData);
    const hasMultipleRoles = roles.length > 1;

    // Determine if employee is active
    const isActive = employments.some((e: any) => e.is_active === true);

    // Get current/last salary
    const activeEmployment =
      employments.find((e: any) => e.is_active) ||
      employments[employments.length - 1];
    const grossSalary = Number(activeEmployment?.gross_salary) || 0;

    // Generate reference number
    const refYear = new Date().getFullYear();
    const paddedId = (id || "").toString().padStart(3, "0");
    const refNumber = `KDFS/HR/${refYear}/${paddedId}`;

    // Get pronouns
    const pronouns = getPronouns(gender);

    // Template data
    const templateData: TemplateData = {
      fullName: resolvedFullName,
      pronouns,
      roles,
      grossSalary,
      isActive,
      refNumber,
      currentDate: formatDate(new Date()),
      stampBase64,
      logoBase64,
      signerName: resolvedSignerName,
      signerTitle: signer_title,
      signerSignatureBase64,
      companyName: employeeData?.company?.name || BRAND.companyName,
      companyColor: employeeData?.company?.primary_color || BRAND.primary,
    };

    console.log("Signer name received:", signer_name);

    // Adaptive formatting based on content density
    const rolesCount = roles.length;
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

    // Template data with layout config
    const templateDataWithLayout = {
      ...templateData,
      layoutConfig,
    };

    // Select and build appropriate template
    let content: Content[];

    if (isActive) {
      content = hasMultipleRoles
        ? buildActiveMultipleRolesContent(templateDataWithLayout)
        : buildActiveSingleRoleContent(templateDataWithLayout);
    } else {
      content = hasMultipleRoles
        ? buildResignedMultipleRolesContent(templateDataWithLayout)
        : buildResignedSingleRoleContent(templateDataWithLayout);
    }

    // Document definition
    const docDefinition: TDocumentDefinitions = {
      pageSize: selectedPageSize,
      pageMargins: pageMargins,
      content,
      styles: {
        brandHeader: {
          fontSize: headingFontSize,
          bold: true,
          color: templateData.companyColor,
          margin: [0, 0, 0, 5],
        },
        certificateTitle: {
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
      console.log("[CertificateOfServiceService] Creating PDF with Printer...");

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
          console.log(
            "[CertificateOfServiceService] PDF generated successfully, size:",
            buffer.length,
          );
          resolve(buffer);
        });

        pdfDoc.on("error", (err: Error) => {
          console.error("[CertificateOfServiceService] PDF stream error:", err);
          reject(err);
        });

        pdfDoc.end();
      });
    } catch (e) {
      console.error("[CertificateOfServiceService] PDF generation error:", e);
      throw e;
    }
  }
}
