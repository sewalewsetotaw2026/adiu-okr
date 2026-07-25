import logger from "src/config/logger";
import { startSessionRevokedConsumer } from "./session-revoked.consumer";

export async function startAllConsumers(): Promise<void> {
  logger.info("[EDM] Registering event consumers...");
  await startSessionRevokedConsumer();
  logger.info("[EDM] All event consumers registered");
}