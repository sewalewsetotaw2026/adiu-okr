
import {
  Exchanges,
  RoutingKeys,
  type EdmUserUpdatedEvent,
} from "solarios";
import { publish } from "../../rabbitmq/rabbitmq.service";
import logger from "src/config/logger";

/**
 * Published whenever an employee's core record is updated in EDM.
 *
 * Consumers use this to keep their local employee caches in sync.
 * Only the changed fields are included in updatedFields — consumers
 * apply only what changed rather than replacing the whole record.
 *
 * Fire-and-forget — EDM does not wait for consumers.
 */
export function publishEmployeeUpdated(event: EdmUserUpdatedEvent): void {
  publish<EdmUserUpdatedEvent>(
    Exchanges.EDM,
    RoutingKeys.edm.userUpdated,
    event
  );

  logger.info(
    "[EDM] Published employee.updated",
    {
      employeeId:    event.userId,
      companyId:     event.companyId,
      updatedFields: Object.keys(event.updatedFields),
    }
  );
}