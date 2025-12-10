import winston from "winston";
import "winston-daily-rotate-file";

// const transport = new winston.transports.DailyRotateFile({
//   filename: "logs/drizzle/drizzle-%DATE%.log",
//   datePattern: "YYYY-MM-DD-HH",
//   zippedArchive: true,
//   maxSize: "20m",
//   maxFiles: "14d",
// });

const attachRequestId = winston.format((info) => {
  try {
    const event = useEvent();
    const reqId = event?.context?.reqId;
    info.reqId = reqId ?? "";
  } catch (error) {
    // useEvent() not available (e.g., in background jobs, cron tasks)
    info.reqId = "";
  }

  return info;
});

export const drizzleLogger = winston.createLogger({
  format: winston.format.combine(
    attachRequestId(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, reqId }) => {
      return `${timestamp} [${reqId || ""}] ${level}: ${message}`;
    })
  ),
  // transports: [transport],
});
