import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), "logs", "webhooks");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const transport = new DailyRotateFile({
  filename: "logs/webhooks/webhooks-%DATE%.log",
  datePattern: "YYYY-MM-DD-HH",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
});

export const webhooksLogger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
      
      // Add metadata if present
      if (Object.keys(meta).length > 0) {
        log += `\n${JSON.stringify(meta, null, 2)}`;
      }
      
      return log;
    })
  ),
  transports: [
    transport,
    // Also log to console in development
    ...(process.env.NODE_ENV === "development"
      ? [new winston.transports.Console()]
      : []),
  ],
});
