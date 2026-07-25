import type { ConsumeMessage } from "amqplib";
import {
  Exchanges,
  QueueNames,
  RoutingKeys,
  RABBITMQ_DEFAULTS,
  type RabbitMessage,
  type SessionRevokedEvent,
} from "solarios";
import { getRabbitMQChannel } from "../../rabbitmq/rabbitmq.adapter";
import prisma from "src/prisma";
import logger from "src/config/logger";

/**
 * Listens for session revocation events from Auth.
 * When Auth publishes session.revoked (logout, admin revocation),
 * EDM immediately deactivates the matching ServiceSession row.
 */
export async function startSessionRevokedConsumer(): Promise<void> {
  const channel = getRabbitMQChannel();

  await channel.assertExchange(Exchanges.AUTH, "topic", {
    ...RABBITMQ_DEFAULTS.EXCHANGE_OPTIONS,
  });

  await channel.assertQueue(QueueNames.auth.sessionRevoked, {
    ...RABBITMQ_DEFAULTS.QUEUE_OPTIONS,
  });

  await channel.bindQueue(
    QueueNames.auth.sessionRevoked,
    Exchanges.AUTH,
    RoutingKeys.auth.sessionRevoked
  );

  await channel.prefetch(RABBITMQ_DEFAULTS.PREFETCH_COUNT);

  channel.consume(
    QueueNames.auth.sessionRevoked,
    async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      try {
        const envelope = JSON.parse(
          msg.content.toString()
        ) as RabbitMessage<SessionRevokedEvent>;

        const { authSessionId, userId } = envelope.payload;

        logger.debug(
          "[EDM:SessionRevoked] Processing revocation",
          { authSessionId, userId }
        );

        // Find and deactivate the ServiceSession that was opened via this authSession
        const session = await (prisma as any).serviceSession?.findFirst({
          where: { authSessionId, isActive: true },
        });

        if (session) {
          await (prisma as any).serviceSession.update({
            where: { id: session.id },
            data:  { isActive: false },
          });
          logger.info("[EDM:SessionRevoked] Session deactivated", { authSessionId, userId });
        } else {
          logger.debug("[EDM:SessionRevoked] No active session found — skipping", { authSessionId });
        }

        channel.ack(msg);
      } catch (err) {
        logger.error("[EDM:SessionRevoked] Failed to process event", err);
        channel.nack(msg, false, false);
      }
    },
    { noAck: false }
  );

  logger.info(`[EDM] Session revoked consumer listening → ${QueueNames.auth.sessionRevoked}`);
}