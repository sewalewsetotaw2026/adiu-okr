import {
  Exchanges,
  RoutingKeys,
  type EdmUserCreatedEvent,
} from "solarios";
import logger from "src/config/logger";
import { publish } from "src/integration/rabbitmq/rabbitmq.service";

/**
 * Published immediately after a new employee is created in EDM.
 *
 * Consumers (Auth, Payroll, etc.) use this to:
 * - Create an account for the employee (Auth)
 * - Add the employee to payroll system (Payroll)
 * - Trigger onboarding workflows
 *
 * Fire-and-forget — EDM does not wait for consumers to process.
 */
export function publishEmployeeCreated(event: EdmUserCreatedEvent): void {
  publish<EdmUserCreatedEvent>(
    Exchanges.EDM,
    RoutingKeys.edm.userCreated,
    event
  );

  logger.info(
    "[EDM] Published employee.created",
    { employeeId: event.userId, companyId: event.companyId }
  );
}