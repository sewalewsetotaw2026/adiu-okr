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
                department_id: true,
                manager: {
                  select: { full_name: true },
                },
              },
              take: 1,
            },
          },
        },
        headedDepartments: {
          select: { id: true },
          take: 1,
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
          company_code: (user as any).company.company_code,
          company: {
            company_code: (user as any).company.company_code,
            primary_color: (user as any).company.primary_color,
            secondary_color: (user as any).company.secondary_color,
            logo_url: (user as any).company.logo_url
          },
          role_id: user.role_id,
          role: (user as any).role,
          employee_id: user.employee_id,
          employee: (user as any).employee,
          is_department_head: (user as any).headedDepartments?.length > 0,
          headed_department_id: (user as any).headedDepartments?.[0]?.id,
          is_manager: await prisma.employment.count({
            where: {
              manager_id: user.employee_id || "",
              company_id: user.company_id,
              is_active: true,
            },
          }) > 0,
          onboarding_status: user.onboarding_status,
          permissions: await getUserPermissionMatrix(user.role_id),
        },
      },
    });
  } catch (error) {
    next(error);
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
              include: {
                employments: {
                  where: { is_active: true },
                  select: { department_id: true },
                  take: 1,
                },
              },
            },
            headedDepartments: {
              select: { id: true },
              take: 1,
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

    const primaryDeptId = resetRecord.user.employee?.employments?.[0]?.department_id || null;

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
          department_id: primaryDeptId,
          employee: resetRecord.user.employee,
          is_department_head: (resetRecord.user as any).headedDepartments?.length > 0,
          headed_department_id: (resetRecord.user as any).headedDepartments?.[0]?.id,
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
      include: {
        employee: {
          include: {
            employments: {
              where: { is_active: true },
              select: { department_id: true },
              take: 1,
            },
          },
        },
        headedDepartments: {
          select: { id: true },
          take: 1,
        },
      },
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

    // log user in with send JWT
    const token = generateToken(
      String(user.id),
      String(user.company_id),
      String(user.role_id)
    );

    const primaryDeptId = user.employee?.employments?.[0]?.department_id || null;

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
          department_id: primaryDeptId,
          employee: user.employee,
          is_department_head: (user as any).headedDepartments?.length > 0,
          headed_department_id: (user as any).headedDepartments?.[0]?.id,
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
    const user = await prisma.appUser.findFirst({
      where: { id: parseInt(userId) },
      include: {
        employee: {
          include: {
            employments: {
              where: { is_active: true },
              select: { department_id: true },
              take: 1,
            },
          },
        },
      },
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
