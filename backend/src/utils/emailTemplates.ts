/**
 *
 * Design System:
 * - Primary: #e55400 (Kacha Orange)
 * - Secondary: #ffda00 (Kacha Yellow)
 * - Dark: #1a1a2e
 * - Glass: rgba(255, 255, 255, 0.95)
 * - Gradient: linear-gradient(135deg, #e55400, #ff8c42)
 */

// ============================================
// BRAND CONSTANTS
// ============================================
const BRAND = {
  primary: "#e55400",
  primaryDark: "#c44800",
  secondary: "#ffda00",
  dark: "#1a1a2e",
  darkGray: "#2d2d44",
  lightGray: "#f8f9fa",
  glass: "rgba(255, 255, 255, 0.95)",
  text: "#333333",
  textMuted: "#666666",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  companyName: "Kacha Digital Financial Service S.C",
};

// ============================================
// HELPER FUNCTIONS
// ============================================
const formatCurrency = (amount: number, currency: string = "ETB"): string => {
  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// ============================================
// BASE EMAIL WRAPPER
// ============================================
const getBaseEmailHtml = (
  content: string,
  options: {
    title?: string;
    preheader?: string;
    showFooter?: boolean;
    primaryColor?: string;
    secondaryColor?: string;
    companyName?: string;
  } = {},
): string => {
  const {
    title = "",
    preheader = "",
    showFooter = true,
    primaryColor = BRAND.primary,
    secondaryColor = BRAND.secondary,
    companyName = BRAND.companyName,
  } = options;
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    
    /* Base */
    body {
      margin: 0 !important;
      padding: 0 !important;
      background: linear-gradient(135deg, ${BRAND.dark} 0%, ${
        BRAND.darkGray
      } 100%);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    
    /* Container */
    .email-container {
      max-width: 700px;
      margin: 0 auto;
      background: ${BRAND.glass};
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    
    /* Header */
    .header {
      background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor} 100%);
      padding: 40px 30px;
      text-align: center;
      position: relative;
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 5px;
      background: ${secondaryColor};
    }
    .header-logo {
      width: 80px;
      height: auto;
      background: white;
      border-radius: 12px;
      padding: 10px;
      display: inline-block;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header h1 {
      margin: 0;
      color: white;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header-subtitle {
      color: rgba(255,255,255,0.9);
      font-size: 16px;
      margin-top: 8px;
    }
    
    /* Content */
    .content {
      padding: 40px 35px;
      background: white;
      text-align: left;
    }
    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: ${BRAND.dark};
      margin-bottom: 20px;
      text-align: left;
    }
    .message {
      font-size: 15px;
      line-height: 1.7;
      color: ${BRAND.text};
      margin-bottom: 20px;
      text-align: left;
    }
    
    /* Info Box */
    .info-box {
      background: linear-gradient(135deg, #fff9e6 0%, #fff3cc 100%);
      border-left: 4px solid ${secondaryColor};
      border-radius: 0 12px 12px 0;
      padding: 20px 25px;
      margin: 25px 0;
    }
    .info-box-title {
      font-size: 14px;
      font-weight: 700;
      color: ${BRAND.dark};
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px dashed rgba(0,0,0,0.1);
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: ${BRAND.textMuted};
      font-size: 14px;
    }
    .info-value {
      font-weight: 600;
      color: ${BRAND.dark};
      font-size: 14px;
    }
    
    /* Highlight Box */
    .highlight-box {
      background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor} 100%);
      border-radius: 16px;
      padding: 25px 30px;
      margin: 25px 0;
      text-align: center;
    }
    .highlight-box .label {
      color: rgba(255,255,255,0.9);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .highlight-box .value {
      color: white;
      font-size: 32px;
      font-weight: 700;
      margin-top: 5px;
    }
    
    /* Button */
    .button-container {
      text-align: center;
      margin: 35px 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor} 100%);
      color: white !important;
      padding: 16px 40px;
      text-decoration: none;
      border-radius: 50px;
      font-weight: 700;
      font-size: 16px;
      letter-spacing: 0.5px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
    }
    .button-secondary {
      background: ${BRAND.dark};
      box-shadow: 0 10px 30px rgba(26, 26, 46, 0.3);
    }
    
    /* Alert Boxes */
    .alert {
      border-radius: 12px;
      padding: 16px 20px;
      margin: 20px 0;
      font-size: 14px;
    }
    .alert-success {
      background: #ecfdf5;
      border-left: 4px solid ${BRAND.success};
      color: #065f46;
    }
    .alert-warning {
      background: #fffbeb;
      border-left: 4px solid ${BRAND.warning};
      color: #92400e;
    }
    .alert-error {
      background: #fef2f2;
      border-left: 4px solid ${BRAND.error};
      color: #991b1b;
    }
    
    /* Divider */
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #e0e0e0, transparent);
      margin: 30px 0;
    }
    
    /* Footer */
    .footer {
      background: ${BRAND.lightGray};
      padding: 30px 35px;
      text-align: center;
      border-top: 1px solid #eee;
    }
    .footer-text {
      font-size: 12px;
      color: ${BRAND.textMuted};
      line-height: 1.6;
    }
    .footer-link {
      color: ${primaryColor};
      text-decoration: none;
    }
    .social-links {
      margin-top: 15px;
    }
    .social-link {
      display: inline-block;
      width: 36px;
      height: 36px;
      background: white;
      border-radius: 50%;
      margin: 0 5px;
      line-height: 36px;
      color: ${primaryColor};
      text-decoration: none;
      font-size: 14px;
    }
    
    /* Responsive */
    @media screen and (max-width: 600px) {
      .email-container { margin: 10px !important; border-radius: 15px !important; }
      .header { padding: 30px 20px !important; }
      .content { padding: 30px 20px !important; }
      .header h1 { font-size: 22px !important; }
      .button { padding: 14px 30px !important; }
    }
  </style>
</head>
<body>
  <!-- Preheader (hidden text for email preview) -->
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader}
  </div>
  
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, ${
    BRAND.dark
  } 0%, ${BRAND.darkGray} 100%); padding: 40px 20px;">
    <tr>
      <td align="center">
        <div class="email-container">
          ${content}
          ${
            showFooter
              ? `
          <div class="footer">
            <div class="footer-text">
              <strong>${companyName}</strong><br>
              Addis Ababa, Ethiopia<br><br>
              &copy; ${year} All rights reserved.
            </div>
          </div>
          `
              : ""
          }
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

// ============================================
// OFFER OF EMPLOYMENT EMAIL
// ============================================
export const getOfferEmailHtml = (
  employeeName: string,
  role: string,
  employmentType: string,
  grossSalary: number,
  basicSalary: number,
  allowances: Array<{ name: string; amount: number }> = [],
  startDate: string,
  setupLink: string,
  companyName: string = BRAND.companyName,
  logoUrl?: string,
  primaryColor: string = BRAND.primary,
  secondaryColor: string = BRAND.secondary,
): string => {
  const allowanceRows = allowances
    .map(
      (a) => `
      <tr>
        <td style="padding: 10px 0; color: ${
          BRAND.textMuted
        }; font-size: 14px;">${a.name}</td>
        <td style="padding: 10px 0; font-weight: 600; color: ${
          BRAND.dark
        }; font-size: 14px; text-align: right;">${formatCurrency(a.amount)}</td>
      </tr>
    `,
    )
    .join("");

  const content = `
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} Logo" class="header-logo" style="max-width: 150px; height: auto;" />` : ""}
      <div style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;">${companyName}</div>
      <h1>Offer of Employment</h1>
    </div>
    
    <div class="content">
      <div class="greeting">Dear ${employeeName},</div>
      
      <div class="message">
        On behalf of <strong>${companyName}</strong>, I am delighted to extend an offer of employment to you for the position of <strong style="color: ${
          primaryColor
        };">${role}</strong>.
      </div>
      
      <div class="highlight-box">
        <div class="label">Gross Monthly Salary</div>
        <div class="value">${formatCurrency(grossSalary)}</div>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">💰 Compensation Breakdown</div>
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; color: ${
              BRAND.textMuted
            }; font-size: 14px;">Basic Salary</td>
            <td style="padding: 12px 0; font-weight: 700; color: ${
              BRAND.dark
            }; font-size: 16px; text-align: right;">${formatCurrency(
              basicSalary,
            )}</td>
          </tr>
          ${allowanceRows}
        </table>
      </div>
      
      <div class="message">
        We are confident that you will execute your roles and responsibilities to the best of your efforts. You will be provided with all necessary opportunities and empowerment to excel in your function.
      </div>

      <div class="alert alert-warning">
      <strong>💼 Employment Type:</strong> ${employmentType}
      </div>

      
      <div class="alert alert-success">
        <strong>🗓️ Start Date:</strong> ${formatDate(startDate)}
      </div>
      
      <div class="message">
        Please click the button below to accept this offer and set up your account.
      </div>
      
      <div class="button-container">
        <a href="${setupLink}" class="button">Accept Offer & Setup Account</a>
      </div>

      <div class="message" style="margin-top: 15px;">
        We kindly request you to accept this offer, activate your account, and complete all necessary pre-employment formalities and documentation to proceed with the onboarding process.
      </div>

      
      <div class="divider"></div>
      
      <div style="font-size: 12px; color: ${
        BRAND.textMuted
      }; text-align: center;">
        <p>If the button doesn't work, copy this link:</p>
        <p style="word-break: break-all;"><a href="${setupLink}" style="color: ${
          primaryColor
        };">${setupLink}</a></p>
        <p>This link expires in 24 hours.</p>
      </div>
    </div>
  `;

  return getBaseEmailHtml(content, {
    title: "Offer of Employment",
    preheader: `Congratulations! You've been offered the ${role} position at ${companyName}`,
    primaryColor,
    companyName,
    secondaryColor,
  });
};

// ============================================
// PASSWORD RESET EMAIL
// ============================================
export const getPasswordResetEmailHtml = (
  resetLink: string,
  userName?: string,
  companyName: string = BRAND.companyName,
  logoUrl?: string,
  primaryColor: string = BRAND.primary,
  secondaryColor: string = BRAND.secondary,
): string => {
  const greeting = userName ? `Hello ${userName},` : "Hello,";

  const content = `
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} Logo" class="header-logo" style="max-width: 150px; height: auto;" />` : ""}
      <div style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;">${companyName}</div>
      <h1>Password Reset</h1>
      <div class="header-subtitle">Security Request</div>
    </div>
    
    <div class="content">
      <div class="greeting">${greeting}</div>
      
      <div class="message">
        We received a request to reset the password for your account at <strong>${companyName}</strong>.
      </div>
      
      <div class="alert alert-warning">
        <strong>⏰ Important:</strong> This link expires in <strong>10 minutes</strong>.
      </div>
      
      <div class="button-container">
        <a href="${resetLink}" class="button">Reset My Password</a>
      </div>
      
      <div class="divider"></div>
      
      <div class="message" style="font-size: 14px;">
        If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
      </div>
      
      <div style="font-size: 12px; color: ${BRAND.textMuted}; text-align: center;">
        <p>If the button doesn't work, copy this link:</p>
        <p style="word-break: break-all;"><a href="${resetLink}" style="color: ${primaryColor};">${resetLink}</a></p>
      </div>
    </div>
  `;

  return getBaseEmailHtml(content, {
    title: "Reset Your Password",
    preheader: "Reset your password for " + companyName,
    primaryColor,
    companyName,
    secondaryColor,
  });
};

// ============================================
// PASSWORD CHANGED CONFIRMATION EMAIL
// ============================================
// ============================================
// PASSWORD CHANGED CONFIRMATION EMAIL
// ============================================
export const getPasswordChangedEmailHtml = (
  userName?: string,
  companyName: string = BRAND.companyName,
  logoUrl?: string,
  primaryColor: string = BRAND.primary,
  secondaryColor: string = BRAND.secondary,
): string => {
  const greeting = userName ? `Hello ${userName},` : "Hello,";
  const changeTime = new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const content = `
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} Logo" class="header-logo" style="max-width: 150px; height: auto;" />` : ""}
      <div style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;">${companyName}</div>
      <h1>Password Changed</h1>
      <div class="header-subtitle">Security Notification</div>
    </div>
    
    <div class="content">
      <div class="greeting">${greeting}</div>
      
      <div class="alert alert-success">
        <strong>✓ Success!</strong> Your password was successfully changed.
      </div>
      
      <div class="info-box">
        <div class="info-box-title">📋 Change Details</div>
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 8px 0; color: ${BRAND.textMuted};">Date & Time</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${changeTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: ${BRAND.textMuted};">Account</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${companyName}</td>
          </tr>
        </table>
      </div>
      
      <div class="message">
        If you made this change, no further action is required.
      </div>
      
      <div class="alert alert-error">
        <strong>⚠️ Didn't make this change?</strong><br>
        If you did not change your password, please contact our support team immediately to secure your account.
      </div>
    </div>
  `;

  return getBaseEmailHtml(content, {
    title: "Password Changed Successfully",
    preheader: "Your password was changed successfully",
    primaryColor,
    companyName,
    secondaryColor,
  });
};

// ============================================
// LEAVE APPLICATION SUBMITTED EMAIL
// ============================================
// ============================================
// LEAVE APPLICATION SUBMITTED EMAIL
// ============================================
export const getLeaveApplicationEmailHtml = (
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  status: "submitted" | "approved" | "rejected",
  reason?: string,
  managerName?: string,
  companyName: string = BRAND.companyName,
  logoUrl?: string,
  primaryColor: string = BRAND.primary,
  secondaryColor: string = BRAND.secondary,
): string => {
  const statusConfig = {
    submitted: {
      icon: "📝",
      color: BRAND.warning,
      title: "Leave Application Submitted",
      alert: "alert-warning",
    },
    approved: {
      icon: "✅",
      color: BRAND.success,
      title: "Leave Application Approved",
      alert: "alert-success",
    },
    rejected: {
      icon: "❌",
      color: BRAND.error,
      title: "Leave Application Rejected",
      alert: "alert-error",
    },
  };

  const config = statusConfig[status];

  const content = `
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} Logo" class="header-logo" style="max-width: 150px; height: auto;" />` : ""}
      <div style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;">${
        companyName
      }</div>
      <h1>${config.title}</h1>
      <div class="header-subtitle">${leaveType}</div>
    </div>
    
    <div class="content">
      <div class="greeting">Dear ${employeeName},</div>
      
      <div class="message">
        ${
          status === "submitted"
            ? "Your leave application has been submitted and is pending approval."
            : status === "approved"
              ? `Your leave application has been <strong style="color: ${
                  BRAND.success
                };">approved</strong>${managerName ? ` by ${managerName}` : ""}.`
              : `Your leave application has been <strong style="color: ${
                  BRAND.error
                };">rejected</strong>${managerName ? ` by ${managerName}` : ""}.`
        }
      </div>
      
      <div class="info-box">
        <div class="info-box-title">📅 Leave Details</div>
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 10px 0; color: ${
              BRAND.textMuted
            };">Leave Type</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right;">${leaveType}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${
              BRAND.textMuted
            };">Start Date</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right;">${formatDate(
              startDate,
            )}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${
              BRAND.textMuted
            };">End Date</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right;">${formatDate(
              endDate,
            )}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${
              BRAND.textMuted
            };">Total Days</td>
            <td style="padding: 10px 0; font-weight: 700; font-size: 18px; text-align: right; color: ${
              primaryColor
            };">${totalDays} day${totalDays > 1 ? "s" : ""}</td>
          </tr>
        </table>
      </div>
      
      ${
        reason
          ? `
      <div class="alert ${config.alert}">
        <strong>📝 ${
          status === "rejected" ? "Reason for Rejection" : "Note"
        }:</strong><br>
        ${reason}
      </div>
      `
          : ""
      }
      
      ${
        status === "submitted"
          ? `
      <div class="message" style="font-size: 14px; color: ${BRAND.textMuted};">
        You will receive a notification once your manager reviews your application.
      </div>
      `
          : ""
      }
    </div>
  `;

  return getBaseEmailHtml(content, {
    title: config.title,
    preheader: `${config.title} - ${totalDays} day(s) of ${leaveType}`,
    primaryColor,
    companyName,
    secondaryColor,
  });
};

// ============================================
// LEAVE REQUEST MANAGER EMAIL (ACTION REQUIRED)
// ============================================
export const getLeaveRequestManagerEmailHtml = (
  managerName: string,
  employeeDetails: {
    name: string;
    jobTitle: string;
    department: string;
    phone: string;
    email: string;
  },
  leaveDetails: {
    type: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason?: string;
  },
  companyName: string = BRAND.companyName,
  logoUrl?: string,
  primaryColor: string = BRAND.primary,
  secondaryColor: string = BRAND.secondary,
): string => {
  const content = `
    <div class="header">
      <div style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;">${companyName}</div>
      <h1>Action Required</h1>
      <div class="header-subtitle">New Leave Request</div>
    </div>
    
    <div class="content">
      <div class="greeting">Dear ${managerName},</div>
      
      <div class="message">
        <strong>${employeeDetails.name}</strong> has submitted a leave request that requires your approval.
      </div>

      <div class="info-box">
        <div class="info-box-title">👤 Employee Details</div>
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 6px 0; color: ${BRAND.textMuted}; font-size: 14px;">Name</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right; font-size: 14px;">${employeeDetails.name}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: ${BRAND.textMuted}; font-size: 14px;">Job Title</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right; font-size: 14px;">${employeeDetails.jobTitle}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: ${BRAND.textMuted}; font-size: 14px;">Department</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right; font-size: 14px;">${employeeDetails.department}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: ${BRAND.textMuted}; font-size: 14px;">Phone</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right; font-size: 14px;">${employeeDetails.phone}</td>
          </tr>
           <tr>
            <td style="padding: 6px 0; color: ${BRAND.textMuted}; font-size: 14px;">Email</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right; font-size: 14px;">${employeeDetails.email}</td>
          </tr>
        </table>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">📅 Leave Application Details</div>
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.textMuted};">Leave Type</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right;">${leaveDetails.type}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.textMuted};">Start Date</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right;">${formatDate(leaveDetails.startDate)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.textMuted};">End Date</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right;">${formatDate(leaveDetails.endDate)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.textMuted};">Total Days</td>
            <td style="padding: 10px 0; font-weight: 700; font-size: 18px; text-align: right; color: ${primaryColor};">${leaveDetails.totalDays} day${leaveDetails.totalDays > 1 ? "s" : ""}</td>
          </tr>
        </table>
      </div>
      
      ${
        leaveDetails.reason
          ? `
      <div class="alert alert-warning">
        <strong>📝 Reason for Leave:</strong><br>
        ${leaveDetails.reason}
      </div>
      `
          : ""
      }
      
      <div class="button-container">
        <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/manager/team-leaves" class="button">Review Application</a>
      </div>
      
      <div class="message" style="font-size: 14px; text-align: center; color: ${BRAND.textMuted};">
        Please login to the HR Portal to approve or reject this request.
      </div>
    </div>
  `;

  return getBaseEmailHtml(content, {
    title: "Action Required: Leave Approval",
    preheader: `${employeeDetails.name} has requested ${leaveDetails.totalDays} day(s) of ${leaveDetails.type}`,
    primaryColor,
    companyName,
    secondaryColor,
  });
};

// ============================================
// ONBOARDING APPROVED EMAIL
// ============================================
export const getOnboardingApprovedEmailHtml = (
  employeeName: string,
  loginLink: string,
  employmentType?: string,
  companyName: string = BRAND.companyName,
  logoUrl?: string,
  primaryColor: string = BRAND.primary,
  secondaryColor: string = BRAND.secondary,
): string => {
  const content = `
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} Logo" class="header-logo" style="max-width: 150px; height: auto;" />` : ""}
      <div style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;">${companyName}</div>
      <h1>Account Approved</h1>
    </div>

    <div class="content">
      <div class="greeting">Dear ${employeeName},</div>

      <div class="alert alert-success">
        <strong>✅ Approved!</strong> Your onboarding details have been reviewed and your account has been approved.
      </div>

      <div class="message">
        You can now sign in and access the employee dashboard.
      </div>

      ${
        employmentType
          ? `<div class="info-box" style="margin-top: 16px;">
            <div class="info-box-title">Employment Details</div>
            <p style="margin: 0;"><strong>Employment Type:</strong> ${employmentType}</p>
          </div>`
          : ""
      }

      <div class="button-container">
        <a href="${loginLink}" class="button">Go to Login</a>
      </div>

      <div class="divider"></div>

      <div style="font-size: 12px; color: ${BRAND.textMuted}; text-align: center;">
        <p>If the button doesn't work, copy this link:</p>
        <p style="word-break: break-all;"><a href="${loginLink}" style="color: ${primaryColor};">${loginLink}</a></p>
      </div>
    </div>
  `;

  return getBaseEmailHtml(content, {
    title: "Account Approved",
    preheader:
      "Your account has been approved. You can now access the dashboard.",
    primaryColor,
    companyName,
    secondaryColor,
  });
};

// ============================================
// WELCOME EMAIL (ACCOUNT SETUP)
// ============================================
export const getWelcomeEmailHtml = (
  employeeName: string,
  setupLink: string,
  companyName: string = BRAND.companyName,
  logoUrl?: string,
  primaryColor: string = BRAND.primary,
  secondaryColor: string = BRAND.secondary,
): string => {
  const content = `
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} Logo" class="header-logo" style="max-width: 150px; height: auto;" />` : ""}
      <div style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;">${companyName}</div>
      <h1>Welcome to the Team!</h1>
    </div>
    
    <div class="content">
      <div class="greeting">Hello ${employeeName},</div>
      
      <div class="message">
        Welcome to <strong>${companyName}</strong>! We're thrilled to have you on board.
      </div>
      
      <div class="message">
        To get started, please set up your account by clicking the button below. This will allow you to access the HR portal and all its features.
      </div>
      
      <div class="button-container">
        <a href="${setupLink}" class="button">Set Up My Account</a>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">🚀 What's Next?</div>
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.text};">
              <strong>1.</strong> Set up your password
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.text};">
              <strong>2.</strong> Complete your profile information
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.text};">
              <strong>3.</strong> Explore the HR portal features
            </td>
          </tr>
        </table>
      </div>
      
      <div class="divider"></div>
      
      <div style="font-size: 12px; color: ${BRAND.textMuted}; text-align: center;">
        <p>If the button doesn't work, copy this link:</p>
        <p style="word-break: break-all;"><a href="${setupLink}" style="color: ${primaryColor};">${setupLink}</a></p>
      </div>
    </div>
  `;

  return getBaseEmailHtml(content, {
    title: "Welcome to " + companyName,
    preheader: "Welcome to the team! Set up your account to get started.",
    primaryColor,
    companyName,
  });
};

// ============================================
// PROMOTION/DEMOTION NOTIFICATION EMAIL
// ============================================
export const getCareerEventEmailHtml = (
  employeeName: string,
  eventType: "promotion" | "demotion" | "transfer",
  previousTitle: string,
  newTitle: string,
  effectiveDate: string,
  newSalary?: number,
  message?: string,
  companyName: string = BRAND.companyName,
  logoUrl?: string,
  primaryColor: string = BRAND.primary,
  secondaryColor: string = BRAND.secondary,
): string => {
  const eventConfig = {
    promotion: {
      icon: "🎊",
      color: BRAND.success,
      title: "Congratulations on Your Promotion!",
    },
    demotion: {
      icon: "📋",
      color: BRAND.warning,
      title: "Position Change Notice",
    },
    transfer: {
      icon: "🔄",
      color: primaryColor,
      title: "Department Transfer Notice",
    },
  };

  const config = eventConfig[eventType];

  const content = `
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} Logo" class="header-logo" style="max-width: 150px; height: auto;" />` : ""}
      <div style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;">${
        companyName
      }</div>
      <h1>${config.title}</h1>
    </div>
    
    <div class="content">
      <div class="greeting">Dear ${employeeName},</div>
      
      <div class="message">
        ${
          eventType === "promotion"
            ? "We are pleased to inform you of your promotion! Your hard work and dedication have been recognized."
            : eventType === "transfer"
              ? "We would like to inform you about your upcoming position change."
              : "We would like to inform you about a change in your position."
        }
      </div>
      
      <div class="info-box">
        <div class="info-box-title">📋 Position Details</div>
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 10px 0; color: ${
              BRAND.textMuted
            };">Previous Position</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right;">${previousTitle}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${
              BRAND.textMuted
            };">New Position</td>
            <td style="padding: 10px 0; font-weight: 700; text-align: right; color: ${
              primaryColor
            };">${newTitle}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${
              BRAND.textMuted
            };">Effective Date</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right;">${formatDate(
              effectiveDate,
            )}</td>
          </tr>
          ${
            newSalary
              ? `
          <tr>
            <td style="padding: 10px 0; color: ${
              BRAND.textMuted
            };">New Salary</td>
            <td style="padding: 10px 0; font-weight: 700; text-align: right; color: ${
              BRAND.success
            };">${formatCurrency(newSalary)}</td>
          </tr>
          `
              : ""
          }
        </table>
      </div>
      
      ${
        message
          ? `
      <div class="message">
        ${message}
      </div>
      `
          : ""
      }
      
      ${
        eventType === "promotion"
          ? `
      <div class="alert alert-success">
        <strong>🌟 Keep up the great work!</strong><br>
        We look forward to your continued success in your new role.
      </div>
      `
          : ""
      }
    </div>
  `;

  return getBaseEmailHtml(content, {
    title: config.title,
    preheader: `${config.title} - From ${previousTitle} to ${newTitle}`,
    primaryColor,
    companyName,
    secondaryColor,
  });
};

// ============================================
// LEAVE RECALL REQUEST EMAIL
// ============================================
export const getLeaveRecallRequestEmailHtml = (
  employeeName: string,
  managerName: string,
  recallDate: string,
  reason: string,
  companyName: string = BRAND.companyName,
  logoUrl?: string,
  primaryColor: string = BRAND.primary,
  secondaryColor: string = BRAND.secondary,
): string => {
  const content = `
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} Logo" class="header-logo" style="max-width: 150px; height: auto;" />` : ""}
      <div style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;">${companyName}</div>
      <h1>🔔 Leave Recall Request</h1>
      <div class="header-subtitle">Immediate Attention Required</div>
    </div>
    
    <div class="content">
      <div class="greeting">Dear ${employeeName},</div>
      
      <div class="alert alert-warning">
        <strong>⚠️ Urgent:</strong> Your manager has requested you to return early from your leave.
      </div>
      
      <div class="message">
        ${managerName} has requested that you return to work earlier than planned.
      </div>
      
      <div class="info-box">
        <div class="info-box-title">📋 Recall Details</div>
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.textMuted};">Requested By</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right;">${managerName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.textMuted};">Requested Return Date</td>
            <td style="padding: 10px 0; font-weight: 700; text-align: right; color: ${primaryColor};">${recallDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.textMuted};" colspan="2">
              <strong>Reason:</strong><br>
              <div style="margin-top: 8px; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 8px;">${reason}</div>
            </td>
          </tr>
        </table>
      </div>
      
      <div class="message">
        Please log in to the employee portal to accept or decline this recall request. If you accept, the system will automatically adjust your leave balance.
      </div>
      
      <div class="divider"></div>
      
      <div style="font-size: 13px; color: ${BRAND.textMuted}; text-align: center;">
        <p>⏰ Please respond to this recall request as soon as possible.</p>
      </div>
    </div>
  `;

  return getBaseEmailHtml(content, {
    title: "Leave Recall Request",
    preheader: `${managerName} has requested you to return early from leave`,
    primaryColor,
    companyName,
    secondaryColor,
  });
};

// ============================================
// LEAVE RECALL RESPONSE EMAIL
// ============================================
export const getLeaveRecallResponseEmailHtml = (
  managerName: string,
  employeeName: string,
  response: "ACCEPTED" | "DECLINED",
  returnDate?: string,
  companyName: string = BRAND.companyName,
  logoUrl?: string,
  primaryColor: string = BRAND.primary,
  secondaryColor: string = BRAND.secondary,
): string => {
  const isAccepted = response === "ACCEPTED";
  const config = {
    color: isAccepted ? BRAND.success : BRAND.error,
    icon: isAccepted ? "✅" : "❌",
    title: isAccepted ? "Recall Accepted" : "Recall Declined",
    alert: isAccepted ? "alert-success" : "alert-error",
  };

  const content = `
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} Logo" class="header-logo" style="max-width: 150px; height: auto;" />` : ""}
      <div style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;">${companyName}</div>
      <h1>${config.icon} ${config.title}</h1>
      <div class="header-subtitle">Recall Response</div>
    </div>
    
    <div class="content">
      <div class="greeting">Dear ${managerName},</div>
      
      <div class="alert ${config.alert}">
        <strong>${config.icon} ${isAccepted ? "Accepted" : "Declined"}!</strong> ${employeeName} has ${isAccepted ? "accepted" : "declined"} your recall request.
      </div>
      
      <div class="message">
        ${
          isAccepted
            ? `${employeeName} has agreed to return early from their leave${returnDate ? ` on ${returnDate}` : ""}.`
            : `${employeeName} has declined the recall request and will continue with their original leave schedule.`
        }
      </div>
      
      ${
        returnDate && isAccepted
          ? `
      <div class="highlight-box">
        <div class="label">Actual Return Date</div>
        <div class="value" style="font-size: 24px;">${returnDate}</div>
      </div>
      `
          : ""
      }
      
      <div class="message" style="font-size: 14px; color: ${BRAND.textMuted};">
        ${
          isAccepted
            ? "The employee's leave balance will be automatically adjusted to reflect the early return."
            : "No changes will be made to the employee's leave schedule."
        }
      </div>
    </div>
  `;

  return getBaseEmailHtml(content, {
    title: config.title,
    preheader: `${employeeName} has ${isAccepted ? "accepted" : "declined"} your recall request`,
    primaryColor,
    companyName,
    secondaryColor,
  });
};

// ============================================
// LEAVE EXPIRING SOON EMAIL
// ============================================
export const getLeaveExpiringEmailHtml = (
  employeeName: string,
  leaveType: string,
  daysRemaining: number,
  expiryDate: string,
  companyName: string = BRAND.companyName,
  logoUrl?: string,
  primaryColor: string = BRAND.primary,
  secondaryColor: string = BRAND.secondary,
): string => {
  const content = `
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} Logo" class="header-logo" style="max-width: 150px; height: auto;" />` : ""}
      <div style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;">${companyName}</div>
      <h1>⏰ Leave Balance Expiring Soon</h1>
      <div class="header-subtitle">Action Required</div>
    </div>
    
    <div class="content">
      <div class="greeting">Dear ${employeeName},</div>
      
      <div class="alert alert-warning">
        <strong>⚠️ Reminder:</strong> You have unused leave days that are about to expire!
      </div>
      
      <div class="message">
        Your ${leaveType} balance includes days that will expire soon. Please plan to use them before they're lost.
      </div>
      
      <div class="highlight-box" style="background: linear-gradient(135deg, ${BRAND.warning} 0%, #f59e0b 100%);">
        <div class="label">Days Expiring</div>
        <div class="value">${daysRemaining} ${daysRemaining === 1 ? "Day" : "Days"}</div>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">📅 Leave Balance Details</div>
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.textMuted};">Leave Type</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right;">${leaveType}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.textMuted};">Days Remaining</td>
            <td style="padding: 10px 0; font-weight: 700; text-align: right; color: ${primaryColor};">${daysRemaining}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.textMuted};">Expiry Date</td>
            <td style="padding: 10px 0; font-weight: 700; text-align: right; color: ${BRAND.error};">${expiryDate}</td>
          </tr>
        </table>
      </div>
      
      <div class="message">
        We recommend applying for leave soon to avoid losing these days. You can submit your leave application through the employee portal.
      </div>
      
      <div class="alert alert-error">
        <strong>🚨 Important:</strong> Any unused days will be forfeited after the expiry date and cannot be recovered.
      </div>
    </div>
  `;

  return getBaseEmailHtml(content, {
    title: "Leave Balance Expiring Soon",
    preheader: `${daysRemaining} day(s) of ${leaveType} expiring on ${expiryDate}`,
    primaryColor,
    companyName,
    secondaryColor,
  });
};

// ============================================
// LEAVE CANCELLATION REQUEST EMAIL (FOR MANAGER)
// ============================================
export const getLeaveCancellationRequestEmailHtml = (
  managerName: string,
  employeeName: string,
  leaveType: string,
  originalEndDate: string,
  requestedReturnDate: string,
  reason: string,
  companyName: string = BRAND.companyName,
  logoUrl?: string,
  primaryColor: string = BRAND.primary,
  secondaryColor: string = BRAND.secondary,
): string => {
  const content = `
    <div class="header">
      <div style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;">${companyName}</div>
      <h1>Action Required</h1>
      <div class="header-subtitle">Early Return Request</div>
    </div>
    
    <div class="content">
      <div class="greeting">Dear ${managerName},</div>
      
      <div class="message">
        <strong>${employeeName}</strong> has requested to return early from their <strong>${leaveType}</strong> leave.
      </div>

      <div class="info-box">
        <div class="info-box-title">📋 Request Details</div>
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.textMuted};">Original End Date</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right;">${formatDate(originalEndDate)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: ${BRAND.textMuted};">New Return Date</td>
            <td style="padding: 10px 0; font-weight: 700; text-align: right; color: ${primaryColor};">${formatDate(requestedReturnDate)}</td>
          </tr>
        </table>
      </div>
      
      <div class="alert alert-warning">
        <strong>📝 Reason for Early Return:</strong><br>
        ${reason}
      </div>
      
      <div class="message">
        Please log in to the HR portal to review and take action on this request.
      </div>
    </div>
  `;

  return getBaseEmailHtml(content, {
    title: "Action Required: Early Return Request",
    preheader: `Early Return Request from ${employeeName}`,
    primaryColor,
    companyName,
    secondaryColor,
  });
};

// ============================================
// LEAVE CANCELLATION STATUS EMAIL (FOR EMPLOYEE)
// ============================================
export const getLeaveCancellationStatusEmailHtml = (
  employeeName: string,
  leaveType: string,
  status: "approved" | "rejected" | "signed",
  details: {
    returnDate?: string;
    reason?: string;
    comments?: string;
    actionBy?: string;
  },
  companyName: string = BRAND.companyName,
  logoUrl?: string,
  primaryColor: string = BRAND.primary,
  secondaryColor: string = BRAND.secondary,
): string => {
  const statusConfig = {
    approved: {
      title: "Early Return Fully Approved",
      icon: "✅",
      alert: "alert-success",
      message: `Your request to return early from <strong>${leaveType}</strong> leave has been <strong style="color: ${BRAND.success};">fully approved</strong>.`
    },
    rejected: {
      title: "Early Return Request Rejected",
      icon: "❌",
      alert: "alert-error",
      message: `Your request to return early from <strong>${leaveType}</strong> leave has been <strong style="color: ${BRAND.error};">rejected</strong>.`
    },
    signed: {
      title: "Early Return Request Signed",
      icon: "✍️",
      alert: "alert-warning",
      message: `Your early return request for <strong>${leaveType}</strong> leave has been approved by your manager and moved to HR for final processing.`
    }
  };

  const config = statusConfig[status];

  const content = `
    <div class="header">
      <div style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;">${companyName}</div>
      <h1>${config.title}</h1>
      <div class="header-subtitle">${leaveType}</div>
    </div>
    
    <div class="content">
      <div class="greeting">Dear ${employeeName},</div>
      
      <div class="message">${config.message}</div>

      ${details.returnDate ? `
      <div class="highlight-box">
        <div class="label">Confirmed Return Date</div>
        <div class="value">${formatDate(details.returnDate)}</div>
      </div>
      ` : ""}
      
      <div class="alert ${config.alert}">
        <strong>💬 ${status === "rejected" ? "Reason for Rejection" : "Comments"}:</strong><br>
        ${details.comments || details.reason || "No comments provided."}
      </div>
      
      <div class="message" style="font-size: 14px; color: ${BRAND.textMuted};">
        Action taken by: <strong>${details.actionBy || "Human Resources"}</strong>
      </div>
    </div>
  `;

  return getBaseEmailHtml(content, {
    title: config.title,
    preheader: `${config.title} - ${leaveType}`,
    primaryColor,
    companyName,
    secondaryColor,
  });
};
