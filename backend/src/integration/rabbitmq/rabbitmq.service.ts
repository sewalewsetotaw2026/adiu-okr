import { v4 as uuidv4 } from "uuid";
import type { ConsumeMessage } from "amqplib";
import { RABBITMQ_DEFAULTS, type RabbitMessage } from "solarios";
import { getRabbitMQChannel } from "./rabbitmq.adapter";
import logger from "src/config/logger";

// ─── Exchange declarations ────────────────────────────────────────────────────

export async function declareExchanges(): Promise<void> {
  const channel = getRabbitMQChannel();

  await channel.assertExchange("edm",  "topic", { durable: true });
  await channel.assertExchange("auth", "topic", { durable: true });

  logger.debug("[EDM:RabbitMQ] Exchanges declared");
}

// ─── Publish ──────────────────────────────────────────────────────────────────

export function publish<TPayload>(
  exchange: string,
  routingKey: string,
  payload: TPayload
): void {
  const channel = getRabbitMQChannel();

  const envelope: RabbitMessage<TPayload> = {
    messageId:   uuidv4(),
    messageType: routingKey,
    timestamp:   new Date().toISOString(),
    payload,
  };

  channel.publish(
    exchange,
    routingKey,
    Buffer.from(JSON.stringify(envelope)),
    { persistent: true, contentType: "application/json" }
  );

  logger.debug(`[RabbitMQ] Published → ${exchange} [${routingKey}]`, { messageId: envelope.messageId });
}

// ─── Consume ──────────────────────────────────────────────────────────────────

export async function consume<TPayload>(
  queue: string,
  handler: (payload: TPayload, msg: ConsumeMessage) => Promise<void>
): Promise<void> {
  const channel = getRabbitMQChannel();
  await channel.prefetch(RABBITMQ_DEFAULTS.PREFETCH_COUNT);

  channel.consume(
    queue,
    async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      try {
        const envelope = JSON.parse(msg.content.toString()) as RabbitMessage<TPayload>;
        await handler(envelope.payload, msg);
        channel.ack(msg);
      } catch (err) {
        logger.error(`[RabbitMQ] Consumer error on queue: ${queue}`, err);
        channel.nack(msg, false, false);
      }
    },
    { noAck: false }
  );

  logger.info(`[RabbitMQ] Consumer registered → ${queue}`);
}

// ─── sendToQueue ──────────────────────────────────────────────────────────────

export function sendToQueue(queue: string, payload: unknown, options?: object): void {
  const channel = getRabbitMQChannel();
  channel.sendToQueue(
    queue,
    Buffer.from(JSON.stringify(payload)),
    { contentType: "application/json", ...options }
  );
}