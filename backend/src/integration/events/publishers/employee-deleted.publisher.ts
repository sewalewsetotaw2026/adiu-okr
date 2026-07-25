import {
  Exchanges,
  RoutingKeys,
  type EdmUserDeletedEvent,
} from "solarios";
import { publish } from "../../rabbitmq/rabbitmq.service";
import logger from "src/config/logger";

/**
 * Published when an employee is deleted (hard or soft) in EDM.
 *
 * hardDelete: true  → permanent deletion — consumers must remove all local data
 * hardDelete: false → soft deactivation — consumers should deactivate, not delete
 *
 * Fire-and-forget — EDM does not wait for consumers.
 */
export function publishEmployeeDeleted(event: EdmUserDeletedEvent): void {
  publish<EdmUserDeletedEvent>(
    Exchanges.EDM,
    RoutingKeys.edm.userDeleted,
    event
  );

  logger.info(
    "[EDM] Published employee.deleted",
    {
      employeeId: event.userId,
      companyId:  event.companyId,
      deletedAt: event.deletedAt
    }
  );
}