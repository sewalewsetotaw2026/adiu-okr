import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { sendEmail } from "src/utils/email";
import {
  getPasswordResetEmailHtml,
  getPasswordChangedEmailHtml,
} from "src/utils/emailTemplates";
import {
  hashPassword,
  comparePassword,
  generateToken,
  createPasswordResetToken,
} from "src/utils/auth";
import { getUserPermissionMatrix } from "src/utils/permissionUtils";
import crypto from "crypto";
import { buildAuthSuccessResponse } from "src/utils/buildAuthSuccessResponse";
import { AuthServiceUnavailableError, exchangeCodeWithAuth, InvalidCodeError } from "src/integration/http/auth.exchange.client";

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide email and password",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // find user by email
    const user = await prisma.appUser.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        company_id: true,
        role_id: true,
        employee_id: true,
        is_active: true,
        onboarding_status: true,
        password_hash: true,
        company: {
          select: {
            company_code: true,
            is_active: true,
            is_deleted: true, // Select it to check below
            primary_color: true,
            secondary_color: true,
            logo_url: true
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        employee: {
          select: {
            id: true,
            full_name: true,
            profile_picture_url: true,
            employments: {
              where: { is_active: true },
              select: {
                manager: {
                  select: { full_name: true },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!user || !(await comparePassword(password, user.password_hash))) {
      return res.status(401).json({
        status: "fail",
        message: "Incorrect email or password",
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        status: "fail",
        message: "Your account has been deactivated. Please contact HR.",
      });
    }

    if (!(user as any).company.is_active || (user as any).company.is_deleted) {
      return res.status(401).json({
        status: "fail",
        message: "Your company account has been deactivated or removed. Please contact support.",
      });
    }

    // generate token
    // Password verified — build the same response every auth path produces
      try {
        const response = await buildAuthSuccessResponse(user.id);
        return res.status(200).json(response);
      } catch (err: any) {
        const status = err.code === "user_not_found" ? 404 : 401;
        return res.status(status).json({
          status: "fail",
          message:
            err.code === "account_deactivated"
              ? "Your account has been deactivated. Please contact HR."
              : err.code === "company_deactivated"
                ? "Your company account has been deactivated or removed. Please contact support."
                : "Incorrect email or password",
        });
      }
  } catch (error) {
    next(error);
  }
};


/**
 * GET /auth/callback?code=xxx
 * Hit directly by the browser after Auth's 302 redirect.
 * Does NOT exchange the code itself — only hands it to the EDM
 * frontend, which has its own React/Redux app to dispatch into.
 */
export const ssoCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { code } = req.query;

  

  if (!code || typeof code !== "string") {
    return res.redirect(302, `${process.env.EDM_FRONTEND_URL}/login`);
  }
  
  return res.redirect(
    302,
    `${process.env.EDM_FRONTEND_URL}/auth/sso-callback?code=${encodeURIComponent(code)}`
  );
};

/**
 * POST /auth/sso-exchange
 * Called by the EDM frontend's SsoCallback page via axios — never
 * hit directly by a browser redirect. Exchanges the code with Auth,
 * then returns the exact same shape login() returns.
 */
export const ssoExchange = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code } = req.body;
 
    if (!code) {
      return res.status(400).json({ status: "fail", message: "Missing code" });
    }
    

    const { user_id } = await exchangeCodeWithAuth(code);
    const userId=Number(user_id)
   
    const response = await buildAuthSuccessResponse(userId);
    return res.status(200).json(response);

    

  } catch (err: any) {
    if (err instanceof InvalidCodeError) {
      return res.status(401).json({ status: "fail", message: "Sign-in link expired or already used" });
    }
    if (err instanceof AuthServiceUnavailableError) {
      return res.status(503).json({ status: "fail", message: "Authentication service unavailable" });
    }
    if (err.code === "user_not_found") {
      return res.status(404).json({ status: "fail", message: "No matching EDM account found" });
    }
    if (err.code === "account_deactivated") {
      return res.status(401).json({ status: "fail", message: "Your account has been deactivated. Please contact HR." });
    }
    if (err.code === "company_deactivated") {
      return res.status(401).json({ status: "fail", message: "Your company account has been deactivated or removed." });
    }
    return res.status(401).json({ status: "fail", message: "Sign-in failed" });
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide email",
      });
    }

    const normalizedEmail = String(email).trim();
    if (!normalizedEmail) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide email",
      });
    }

    // get user email
    const user = await prisma.appUser.findUnique({
      where: { email: normalizedEmail },
      include: {
        company: true,
        employee: {
          select: { full_name: true },
        },
      },
    });

    if (!user || user.company?.is_deleted) {
      return res.status(404).json({
        status: "fail",
        message: "There is no user with that email address or the account is inaccessible.",
      });
    }

    // generate the random reset token
    const { resetToken, passwordResetToken } = createPasswordResetToken();

    // save it to database
    await prisma.passwordReset.create({
      data: {
        user_id: user.id,
        token_hash: passwordResetToken,
        expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    const resetPageUrl =
      process.env.PASSWORD_RESET_URL || "http://localhost:5173/reset-password";
    const resetUrl = `${resetPageUrl}?token=${resetToken}`;

    const companyName = user.company?.name || "Kacha HRIS";
    const primaryColor = user.company?.primary_color || "#e55400";
    const secondaryColor = user.company?.secondary_color || "#ffda00";
    const logoUrl = user.company?.logo_url || undefined;
    const userName = (user as any).employee?.full_name || "";

    const resetEmailInfo = await sendEmail({
      to: user.email,
      subject: `Reset Your Password - ${companyName}`,
      text: `You requested a password reset. Use the link below to set a new password.\n\n${resetUrl}\n\nThis link expires in 10 minutes. If you did not request this, you can ignore this email.`,
      html: getPasswordResetEmailHtml(
        resetUrl,
        userName,
        companyName,
        logoUrl,
        primaryColor,
        secondaryColor
      ),
    });

    // Don't hard-fail the endpoint based on mail provider flakiness.
    // In dev, include diagnostic info so issues can be fixed quickly.
    return res.status(200).json({
      status: "success",
      message: resetEmailInfo.success
        ? "Password reset link sent to email!"
        : "Password reset request received. If the email exists, a reset link will be sent.",
      ...(process.env.NODE_ENV !== "production"
        ? {
          resetToken,
          emailSent: resetEmailInfo.success,
          emailError: resetEmailInfo.success
            ? undefined
            : resetEmailInfo.error,
        }
        : {}),
    });
  } catch (error) {
    next(error);
  }
};

export const verifyResetToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        status: "fail",
        message: "Reset token is required",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        token_hash: hashedToken,
      },
    });

    if (!resetRecord) {
      return res.status(400).json({
        status: "fail",
        message: "Token is invalid.",
      });
    }

    if (resetRecord.used) {
      return res.status(400).json({
        status: "fail",
        message: "Token has already been used.",
        isUsed: true,
      });
    }

    if (resetRecord.expires_at < new Date()) {
      return res.status(400).json({
        status: "fail",
        message: "Token has expired.",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Token is valid.",
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) {
      return res.status(400).json({
        status: "fail",
        message: "Reset token is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        status: "fail",
        message: "New password is required",
      });
    }

    // get user based on the token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        token_hash: hashedToken,
        expires_at: { gt: new Date() },
        used: false,
      },
      include: {
        user: {
          include: {
            company: true,
            employee: {
              select: { full_name: true },
            },
          },
        },
      },
    });

    if (!resetRecord) {
      return res.status(400).json({
        status: "fail",
        message: "Token is invalid or has expired",
      });
    }

    // if token has not expired and there is user set the new password
    const hashedPassword = await hashPassword(password);

    await prisma.appUser.update({
      where: { id: resetRecord.user_id },
      data: {
        password_hash: hashedPassword,
        // password_changed_at: new Date() // later to implement this
      },
    });

    // mark token as used
    await prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { used: true },
    });

    const companyName = resetRecord.user.company?.name || "Kacha HRIS";
    const primaryColor = resetRecord.user.company?.primary_color || "#e55400";
    const secondaryColor = resetRecord.user.company?.secondary_color || "#ffda00";
    const logoUrl = resetRecord.user.company?.logo_url || undefined;
    const userName = (resetRecord.user as any).employee?.full_name || "";

    await sendEmail({
      to: resetRecord.user.email,
      subject: `Password Changed Successfully - ${companyName}`,
      text: `Your password was changed successfully. If you did not make this change, please contact support immediately.`,
      html: getPasswordChangedEmailHtml(
        userName,
        companyName,
        logoUrl,
        primaryColor,
        secondaryColor
      ),
    });

    // log the user in send JWT
    const tokenJWT = generateToken(
      String(resetRecord.user.id),
      String(resetRecord.user.company_id),
      String(resetRecord.user.role_id)
    );

    res.status(200).json({
      status: "success",
      token: tokenJWT,
      data: {
        user: {
          id: resetRecord.user.id,
          email: resetRecord.user.email,
          company_id: resetRecord.user.company_id,
          role_id: resetRecord.user.role_id,
          employee_id: resetRecord.user.employee_id,
          onboarding_status: resetRecord.user.onboarding_status,
          permissions: await getUserPermissionMatrix(resetRecord.user.role_id),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // get user
    const user = await prisma.appUser.findUnique({
      where: { id: parseInt(req.user!.user_id) },
    });

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // check if current password is correct
    const { currentPassword, newPassword } = req.body;
    if (!(await comparePassword(currentPassword, user.password_hash))) {
      return res.status(401).json({
        status: "fail", 
        message: "Your current password is wrong",
      });
    }

    // update password
    const hashedPassword = await hashPassword(newPassword);

    await prisma.appUser.update({
      where: { id: user.id },
      data: {
        password_hash: hashedPassword,
      },
    });

    await prisma.passwordChangeLog.create({
      data: {
        target_user_id: user.id,
        changed_by_id: user.id, // same user changing own password
        company_id: user.company_id,
        // ip_address: req.ip,
        // user_agent: req.headers["user-agent"] as string,
      },
    });

    // log user in with send JWT
    const token = generateToken(
      String(user.id),
      String(user.company_id),
      String(user.role_id)
    );

    
    res.status(200).json({
      status: "success",
      token,
      data: {
        user: {
          id: user.id,
          email: user.email,
          company_id: user.company_id,
          role_id: user.role_id,
          employee_id: user.employee_id,
          onboarding_status: user.onboarding_status,
          permissions: await getUserPermissionMatrix(user.role_id),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        status: "fail",
        message: "You are not logged in!",
      });
    }

    const { currentPassword, newEmail } = req.body;

    if (!currentPassword || !newEmail) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide currentPassword and newEmail",
      });
    }

    // 1. Get user
    const user = await prisma.appUser.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // 2. Check if current password is correct
    if (!(await comparePassword(currentPassword, user.password_hash))) {
      return res.status(401).json({
        status: "fail",
        message: "Your current password is wrong",
      });
    }

    // 3. Check if new email is already in use
    const existingUser = await prisma.appUser.findUnique({
      where: { email: newEmail.toLowerCase().trim() },
    });

    if (existingUser && existingUser.id !== user.id) {
      return res.status(400).json({
        status: "fail",
        message: "Email is already in use by another account",
      });
    }

    // 4. Update email
    await prisma.appUser.update({
      where: { id: user.id },
      data: { email: newEmail.toLowerCase().trim() },
    });

    res.status(200).json({
      status: "success",
      message: "Email updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getCompanyPasswordAudit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({ status: "fail", message: "Company ID missing" });
    }

    const { startDate, endDate, employeeId } = req.query;

    // Build the raw SQL query dynamically
    let sql = `
      SELECT
        pcl.id,
        pcl.changed_at,
        pcl.user_agent,
        target.id as target_user_id,
        target.email as target_email,
        target_emp.full_name as target_full_name,
        target_emp.id as target_employee_id,
        changer.id as changer_user_id,
        changer.email as changer_email,
        changer_emp.full_name as changer_full_name
      FROM password_change_log pcl
      LEFT JOIN app_user target ON pcl.target_user_id = target.id
      LEFT JOIN employee target_emp ON target.employee_id = target_emp.id
      LEFT JOIN app_user changer ON pcl.changed_by_id = changer.id
      LEFT JOIN employee changer_emp ON changer.employee_id = changer_emp.id
      WHERE pcl.company_id = $1
    `;
    const params: any[] = [companyId];
    let paramIndex = 2;

    if (employeeId) {
      sql += ` AND pcl.target_user_id = $${paramIndex++}`;
      params.push(Number(employeeId));
    }
    if (startDate) {
      sql += ` AND pcl.changed_at >= $${paramIndex++}`;
      params.push(new Date(startDate as string));
    }
    if (endDate) {
      sql += ` AND pcl.changed_at <= $${paramIndex++}`;
      params.push(new Date(endDate as string));
    }

    sql += ` ORDER BY pcl.changed_at DESC`;

    const rawLogs: any[] = await prisma.$queryRawUnsafe(sql, ...params);

    // Transform to match the frontend’s expected shape (nested target_user / changed_by)
    const logs = rawLogs.map(log => ({
      id: log.id,
      changed_at: log.changed_at,
      user_agent: log.user_agent,
      target_user: {
        id: log.target_user_id,
        email: log.target_email,
        employee: log.target_employee_id ? {
          id: log.target_employee_id,
          full_name: log.target_full_name,
        } : null,
      },
      changed_by: {
        id: log.changer_user_id,
        email: log.changer_email,
        employee: log.changer_full_name ? {
          full_name: log.changer_full_name,
        } : null,
      },
    }));

    res.status(200).json({ status: "success", data: logs });
  } catch (error) {
    next(error);
  }
};