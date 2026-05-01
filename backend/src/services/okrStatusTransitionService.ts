import { prisma } from "src/app";

// Allow generic string due to potential generated enum export variations
export type EntityTypeKeys =
  | "CYCLE"
  | "COMPANY_OBJECTIVE"
  | "COMPANY_KR"
  | "DEPARTMENT_OBJECTIVE"
  | "DEPARTMENT_KR"
  | "DEPARTMENT_MONTH_PLAN"
  | "KR_CONTRIBUTOR"
  | "EMPLOYEE_OBJECTIVE"
  | "EMPLOYEE_KR"
  | "EMPLOYEE_MONTH_PLAN"
  | "WEEKLY_PLAN"
  | "SUBTASK"
  | "DAILY_PLAN"
  | "PROGRESS_UPDATE"
  | "ARCHIVE"
  | "EXPORT"
  | "SUBMISSION";

export interface TransitionValidationParams {
  companyId: number;
  entityType: EntityTypeKeys;
  fromStatus: string;
  toStatus: string;
  userRole?: string;
}

interface FallbackTransitionRule {
  from: string[];
  to: string[];
  requiresApproval?: boolean;
  requiredRole?: string;
}

const DEFAULT_FALLBACK_TRANSITIONS: FallbackTransitionRule[] = [
  { from: ["draft"], to: ["submitted", "pending_approval"] },
  { from: ["draft"], to: ["approved"] },
  // 'assigned' status behaves like 'draft' — department objectives created via
  // department assignment start in 'assigned' and need the same transitions.
  { from: ["assigned"], to: ["draft"] },
  { from: ["assigned"], to: ["submitted", "pending_approval"] },
  { from: ["assigned"], to: ["approved"] },
  { from: ["assigned"], to: ["published"] },
  {
    from: ["submitted", "pending_approval"],
    to: ["approved"],
    requiresApproval: true,
  },
  {
    from: ["submitted", "pending_approval"],
    to: ["published"],
    requiresApproval: true,
  },
  { from: ["submitted", "pending_approval"], to: ["draft"] },
  { from: ["approved"], to: ["published"] },
  { from: ["approved"], to: ["draft"] },
  { from: ["published"], to: ["in_progress", "active"] },
  { from: ["in_progress", "active"], to: ["blocked", "completed", "draft"] },
  { from: ["blocked"], to: ["in_progress", "active"] },
  { from: ["completed"], to: ["archived", "active"] },
];

const ENTITY_TRANSITION_OVERRIDES: Partial<
  Record<EntityTypeKeys, FallbackTransitionRule[]>
> = {
  COMPANY_OBJECTIVE: [
    {
      from: ["draft", "submitted", "pending_approval"],
      to: ["published"],
      requiresApproval: true,
      requiredRole: "Admin",
    },
  ],
  DEPARTMENT_OBJECTIVE: [
    {
      from: ["draft", "assigned", "submitted", "pending_approval"],
      to: ["published"],
      requiresApproval: true,
      requiredRole: "Admin",
    },
  ],
};

function normalizeStatusCode(status: string): string {
  return status.trim().toLowerCase();
}

function hasStatusAlias(status: string, expected: string) {
  const normalized = normalizeStatusCode(status);
  if (normalized === expected) return true;

  // Backward compatibility between submitted and pending_approval naming.
  if (
    (normalized === "submitted" && expected === "pending_approval") ||
    (normalized === "pending_approval" && expected === "submitted")
  ) {
    return true;
  }

  return false;
}

function findFallbackTransition(
  entityType: EntityTypeKeys,
  fromStatus: string,
  toStatus: string,
) {
  const allRules = [
    ...DEFAULT_FALLBACK_TRANSITIONS,
    ...(ENTITY_TRANSITION_OVERRIDES[entityType] || []),
  ];

  return allRules.find(
    (rule) =>
      rule.from.some((s) => hasStatusAlias(fromStatus, s)) &&
      rule.to.some((s) => hasStatusAlias(toStatus, s)),
  );
}

function getStatusAliases(status: string): string[] {
  const normalized = status.trim().toLowerCase();

  // Backward compatibility for legacy status naming in seeded transition data.
  // Some environments use "submitted" while newer flows use "pending_approval".
  if (normalized === "pending_approval" || normalized === "submitted") {
    return ["pending_approval", "submitted"];
  }

  return [normalized];
}

/**
 * Validates whether a state transition is permitted based on the 'okr_status_transition' rules.
 */
export async function validateStatusTransition(
  params: TransitionValidationParams,
) {
  const { companyId, entityType, fromStatus, toStatus, userRole } = params;
  const fromStatusAliases = getStatusAliases(fromStatus);
  const toStatusAliases = getStatusAliases(toStatus);
  const normalizedFromStatus = normalizeStatusCode(fromStatus);
  const normalizedToStatus = normalizeStatusCode(toStatus);

  // Trivial transition
  if (normalizedFromStatus === normalizedToStatus) {
    return { valid: true };
  }

  const transition = await prisma.okrStatusTransition.findFirst({
    where: {
      company_id: companyId,
      entity_type: entityType as any, // Cast to any to bypass Prisma strict typing if needed
      from_status_code: { in: fromStatusAliases },
      to_status_code: { in: toStatusAliases },
      is_active: true,
    },
  });

  if (!transition) {
    const fallback = findFallbackTransition(entityType, fromStatus, toStatus);

    if (!fallback) {
      throw new Error(
        `Invalid status transition from '${fromStatus}' to '${toStatus}' for entity type '${entityType}'.`,
      );
    }

    if (fallback.requiresApproval && fallback.requiredRole && userRole) {
      if (fallback.requiredRole.toUpperCase() !== userRole.toUpperCase()) {
        throw new Error(
          `Role '${userRole}' is not authorized to transition status to '${toStatus}'. Required: '${fallback.requiredRole}'.`,
        );
      }
    }

    return {
      valid: true,
      transition: {
        from_status_code: normalizedFromStatus,
        to_status_code: normalizedToStatus,
        requires_approval: fallback.requiresApproval || false,
        required_role: fallback.requiredRole || null,
        source: "fallback",
      },
    };
  }

  // Validate approval requirements
  if (transition.requires_approval) {
    // If explicit role is required, check it
    if (transition.required_role && userRole) {
      if (transition.required_role.toUpperCase() !== userRole.toUpperCase()) {
        throw new Error(
          `Role '${userRole}' is not authorized to transition status to '${toStatus}'. Required: '${transition.required_role}'.`,
        );
      }
    }
  }

  return { valid: true, transition };
}
