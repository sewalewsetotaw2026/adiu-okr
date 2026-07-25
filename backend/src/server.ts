import dotenv from "dotenv";
dotenv.config();

import app, { prisma } from "src/app";
import { checkAndNotifyExpiringLeaves, retryFailedEmails } from "./services/leaveNotificationService";
import { checkAndNotifyProbationMilestones } from "./services/probationNotificationService";
import { checkAndNotifyPensionMilestones } from "./services/pensionNotificationService";
import { declareExchanges } from "./integration/rabbitmq/rabbitmq.service";
import { startAllConsumers } from "./integration/events/consumers";
import { startEmployeeDataRpcServer, startPaidLeaveRpcServer } from "./integration/rpc/servers";
import { initializeRabbitMQ } from "./integration/rabbitmq/rabbitmq.adapter";

const PORT = process.env.PORT || 5000;

async function main() {
  try {
    // 1. Connect to database
        await prisma.$connect();
        console.log("Connected to database");
    
        // 2. Initialize RabbitMQ Connection & Channel
        console.log("Initializing RabbitMQ connection...");
        await initializeRabbitMQ();
        console.log("RabbitMQ initialized successfully.");
    
        // 3. Declare exchanges & start messaging services
        console.log("Declaring RabbitMQ exchanges...");
        await declareExchanges();
        
        console.log("Starting RabbitMQ consumers...");
        await startAllConsumers();
        
        console.log("Starting RabbitMQ RPC servers...");
        await startEmployeeDataRpcServer();
        await startPaidLeaveRpcServer();  

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);

      // Schedule daily leave expiry check (runs once on startup, then every 24h)
      checkAndNotifyExpiringLeaves(); // Initial check
      checkAndNotifyProbationMilestones(); // Initial check for probation
      checkAndNotifyPensionMilestones(); // Initial check for pension

      setInterval(() => {
        checkAndNotifyExpiringLeaves();
        checkAndNotifyProbationMilestones();
        checkAndNotifyPensionMilestones();
      }, 24 * 60 * 60 * 1000); // 24 hours

      // Schedule email retry (every 1 hour)
      setInterval(() => {
        retryFailedEmails();
      }, 60 * 60 * 1000); // 1 hour
    });
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1);
  }
}

main();
