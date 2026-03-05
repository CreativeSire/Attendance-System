import { logger, schedules, task } from "@trigger.dev/sdk/v3";

// Task 2: WhatsApp Manager Alerts (Mocked/Placeholder Service)
const sendWhatsAppAlert = async (managerId: string, message: string) => {
  logger.log(`📱 WHATSAPP ALERT to Manager ${managerId}: ${message}`);
  // In a real app, use Twilio:
  // await twilio.messages.create({ from: 'whatsapp:+14155238886', to: 'whatsapp:+234...', body: message });
};

export const anomalyDetection = schedules.task({
  id: "anomaly-detection",
  cron: "0 18 * * *", // 6:00 PM every day
  run: async (payload) => {
    logger.log("Starting daily attendance anomaly detection...");

    // Example logic
    const anomalies = [
      { userId: "DALA004", userName: "Emeka Eze", type: "GHOST_SHIFT", message: "User clocked in at 8:05 AM but no clock-out by 6:00 PM." },
      { userId: "DALA003", userName: "Fatima Bello", type: "LATE_PENALTY", message: "User clocked in at 9:15 AM (Penalty Applied)." }
    ];

    for (const anomaly of anomalies) {
      logger.warn(`Anomaly detected for ${anomaly.userName}!`, { anomaly });
      await sendWhatsAppAlert("ADMIN_001", `🚨 ATTENTION: ${anomaly.userName} - ${anomaly.message}`);
    }

    return {
      status: "success",
      anomaliesFound: anomalies.length,
      processedAt: payload.timestamp
    };
  },
});

export const lateArrivalAlert = task({
  id: "late-arrival-alert",
  run: async (payload: { userId: string, userName: string, time: string }) => {
    await sendWhatsAppAlert("ADMIN_001", `⏰ LATE ARRIVAL: ${payload.userName} just clocked in at ${payload.time}.`);
  }
});
