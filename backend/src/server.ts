import dotenv from "dotenv";
dotenv.config();

import app, { prisma } from "src/app";
import { checkAndNotifyExpiringLeaves, retryFailedEmails } from "./services/leaveNotificationService";
import { checkAndNotifyProbationMilestones } from "./services/probationNotificationService";
import { checkAndNotifyPensionMilestones } from "./services/pensionNotificationService";

const PORT = process.env.PORT || 5000;

async function main() {
  try {
    // connect to database
    await prisma.$connect();
    console.log("Connected to database");

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
