import { connect, type Channel, type ChannelModel } from "amqplib";
import logger from "src/config/logger";
// ─── In-memory fallback ───────────────────────────────────────────────────────

function createFallbackChannel(): Channel {
  const listeners: Record<string, Function[]> = {};

  const fallback = {
    assertExchange: async (name: string, type: string, _options?: any) => {
      logger.debug(`[RabbitMQ:Fallback] assertExchange → ${name} (${type})`);
      return { exchange: name };
    },
    assertQueue: async (name: string, _options?: any) => {
      logger.debug(`[RabbitMQ:Fallback] assertQueue → ${name}`);
      return { queue: name, messageCount: 0, consumerCount: 0 };
    },
    bindQueue: async (queue: string, exchange: string, key: string) => {
      logger.debug(`[RabbitMQ:Fallback] bindQueue ${queue} → ${exchange} [${key}]`);
      if (!listeners[key]) listeners[key] = [];
      return {};
    },
    publish: (exchange: string, routingKey: string, content: Buffer, options?: any): boolean => {
      logger.debug(`[RabbitMQ:Fallback] publish → ${exchange} [${routingKey}]`);
      const msg = {
        content,
        properties: options ?? {},
        fields: { exchange, routingKey, redelivered: false, deliveryTag: 0, consumerTag: "" },
      };
      (listeners[routingKey] ?? []).forEach((cb) => {
        try { cb(msg); } catch (err) { logger.error("[RabbitMQ:Fallback] consumer error", err); }
      });
      return true;
    },
    sendToQueue: (queue: string, content: Buffer, options?: any): boolean => {
      logger.debug(`[RabbitMQ:Fallback] sendToQueue → ${queue}`);
      const msg = {
        content,
        properties: options ?? {},
        fields: { exchange: "", routingKey: queue, redelivered: false, deliveryTag: 0, consumerTag: "" },
      };
      (listeners[queue] ?? []).forEach((cb) => {
        try { cb(msg); } catch (err) { logger.error("[RabbitMQ:Fallback] consumer error", err); }
      });
      return true;
    },
    consume: async (queue: string, callback: Function, _options?: any) => {
      if (!listeners[queue]) listeners[queue] = [];
      listeners[queue].push(callback);
      logger.debug(`[RabbitMQ:Fallback] consumer registered → ${queue}`);
      return { consumerTag: `fallback-${Math.random().toString(36).slice(2, 7)}` };
    },
    prefetch: async (_count: number) => {},
    ack:  (_msg: any) => {},
    nack: (_msg: any, _allUpTo?: boolean, _requeue?: boolean) => {},
    close: async () => {},
  };

  return fallback as unknown as Channel;
}

// ─── State ────────────────────────────────────────────────────────────────────

let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let _usingFallback = false;

const rabbitmqUrl = process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672";
const useFallback = process.env.ENABLE_FALLBACK_DRIVERS === "true";

// ─── Public API ───────────────────────────────────────────────────────────────

export async function initializeRabbitMQ(): Promise<void> {
  if (useFallback) {
    logger.warn("[RabbitMQ] ENABLE_FALLBACK_DRIVERS=true — booting with in-memory channel");
    channel = createFallbackChannel();
    _usingFallback = true;
    return;
  }

  try {
    logger.info(`[RabbitMQ] Connecting → ${rabbitmqUrl}`);
    connection = await connect(rabbitmqUrl);
    channel   = await connection.createChannel();

    connection.on("error", (err: Error) => {
      logger.error("[RabbitMQ] Connection error", err);
    });

    connection.on("close", () => {
      logger.warn("[RabbitMQ] Connection closed — switching to fallback");
      channel = createFallbackChannel();
      _usingFallback = true;
    });

    logger.info("[RabbitMQ] Connected and channel opened successfully");
  } catch (err) {
    logger.error("[RabbitMQ] Failed to connect — switching to fallback", err);
    channel = createFallbackChannel();
    _usingFallback = true;
  }
}

export function getRabbitMQChannel(): Channel {
  if (!channel) throw new Error("[RabbitMQ] Channel not initialised — call initializeRabbitMQ() first");
  return channel;
}

export async function shutdownRabbitMQ(): Promise<void> {
  try {
    await channel?.close();
    await connection?.close();
    logger.info("[RabbitMQ] Shutdown complete");
  } catch (err) {
    logger.error("[RabbitMQ] Error during shutdown", err);
  }
}

export const rabbitmqConnection = {
  initialize: initializeRabbitMQ,
  getChannel:  getRabbitMQChannel,
  shutdown:    shutdownRabbitMQ,
  isUsingFallback: () => _usingFallback,
};