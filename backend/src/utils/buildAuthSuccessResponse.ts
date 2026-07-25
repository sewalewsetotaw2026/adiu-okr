import { prisma } from "src/app";
import { generateToken } from "src/utils/auth";
import { getUserPermissionMatrix } from "src/utils/permissionUtils";

/**
 * The exact response shape EDM's frontend expects after any successful
 * login. Extracted from authController.login so both password-based
 * login and Auth-SSO login produce byte-identical responses.
 */
export async function buildAuthSuccessResponse(appUserId: number) {
  const user = await prisma.appUser.findUnique({
    where: { id: appUserId },
    select: {
      id: true,
      email: true,
      company_id: true,
      role_id: true,
      employee_id: true,
      is_active: true,
      onboarding_status: true,
      company: {
        select: {
          company_code: true,
          is_active: true,
          is_deleted: true,
          primary_color: true,
          secondary_color: true,
          logo_url: true,
        },
      },
      role: {
        select: { id: true, name: true },
      },
      employee: {
        select: {
          id: true,
          full_name: true,
          profile_picture_url: true,
          employments: {
            where: { is_active: true },
            select: {
              manager: { select: { full_name: true } },
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!user) {
    throw Object.assign(new Error("user_not_found"), { code: "user_not_found" });
  }
  if (!user.is_active) {
    throw Object.assign(new Error("account_deactivated"), { code: "account_deactivated" });
  }
  if (!(user as any).company.is_active || (user as any).company.is_deleted) {
    throw Object.assign(new Error("company_deactivated"), { code: "company_deactivated" });
  }

  const token = generateToken(
    String(user.id),
    String(user.company_id),
    String(user.role_id)
  );

  return {
    status: "success" as const,
    token,
    data: {
      user: {
        id:            user.id,
        email:         user.email,
        company_id:    user.company_id,
        company_code:  (user as any).company.company_code,
        company: {
          company_code:    (user as any).company.company_code,
          primary_color:   (user as any).company.primary_color,
          secondary_color: (user as any).company.secondary_color,
          logo_url:        (user as any).company.logo_url,
        },
        role_id:           user.role_id,
        role:              (user as any).role,
        employee_id:       user.employee_id,
        employee:          (user as any).employee,
        onboarding_status: user.onboarding_status,
        permissions:       await getUserPermissionMatrix(user.role_id),
      },
    },
  };
}