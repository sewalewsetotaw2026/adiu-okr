export const APPROVAL_GUARD_MESSAGE =
  "You cannot create this plan because the parent Objective or Key Result has not yet been approved.";

export function getPlanCreationErrorMessage(
  error: any,
  fallbackMessage: string,
): string {
  const rawMessage =
    error?.data?.message ||
    error?.response?.data?.message ||
    error?.message ||
    "";
  const message = String(rawMessage).trim();

  if (
    /not yet been approved|has not yet been approved|not approved/i.test(
      message,
    )
  ) {
    return APPROVAL_GUARD_MESSAGE;
  }

  return message || fallbackMessage;
}
