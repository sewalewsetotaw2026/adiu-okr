
import { getRabbitMQChannel } from "../../rabbitmq/rabbitmq.adapter";
import { sendToQueue } from "../../rabbitmq/rabbitmq.service";
import { QueueNames }         from "solarios";
import type {
  PaidLeaveRequest,
  PaidLeaveResponse,
  PaidLeaveRecord,
} from "solarios";
import logger from "../../../config/logger";
import { getPaidLeaveDaysPerEmployee } from "src/payrollLeaveData.service";

/**
 * RPC server — listens on rpc.edm.paid.leave.request
 * Called by Payroll before each payroll run to get approved paid leave
 * days per employee for the billing period.
 *
 * prefetch(1): each query joins LeaveApplication + LeaveType across
 * potentially many employees — serialize to keep DB load predictable.
 */
export async function startPaidLeaveRpcServer(): Promise<void> {
  const channel = getRabbitMQChannel();

  await channel.assertQueue(QueueNames.rpc.paidLeave.request, {
    durable: true,
  });

  await channel.prefetch(1);

  channel.consume(
    QueueNames.rpc.paidLeave.request,
    async (msg) => {
      if (!msg) return;

      const { replyTo, correlationId } = msg.properties;

      if (!replyTo || !correlationId) {
        channel.nack(msg, false, false);
        return;
      }

      let response: PaidLeaveResponse;

      try {
        const request = JSON.parse(
          msg.content.toString()
        ) as PaidLeaveRequest;

        logger.info(
          "[EDM:PaidLeaveRPC] Received paid leave request"
        ,
          {
            companyId: request.companyId,
            startDate: request.startDate,
            endDate:   request.endDate,
          },
        );

        const leaveMap = await getPaidLeaveDaysPerEmployee(
          request.companyId,
          request.startDate,
          request.endDate
        );

        // Convert Map to serializable array
        const records: PaidLeaveRecord[] = Array.from(leaveMap.entries()).map(
          ([employeeId, paidLeaveDays]) => ({ employeeId, paidLeaveDays })
        );

        response = {
          companyId: request.companyId,
          startDate: request.startDate,
          endDate:   request.endDate,
          records,
          total: records.length,
        };

        logger.info(
          "[EDM:PaidLeaveRPC] Replying with paid leave records"
        ,
          {
            companyId: request.companyId,
            total:     records.length,
          },
        );
      } catch (err) {
        logger.error(
          "[EDM:PaidLeaveRPC] Error processing request — replying with empty"
        ,
          { err },
        );

        // Always reply — never leave Payroll hanging for 10 seconds
        response = {
          companyId: 0,
          startDate: "",
          endDate:   "",
          records:   [],
          total:     0,
        };
      }

      sendToQueue(replyTo, response, { correlationId });
      channel.ack(msg);
    },
    { noAck: false }
  );

  logger.info("[EDM:PaidLeaveRPC] Server listening on rpc.edm.paid.leave.request");
}