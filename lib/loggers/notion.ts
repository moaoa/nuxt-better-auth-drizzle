import winston from "winston";
import "winston-daily-rotate-file";

// const transport = new winston.transports.DailyRotateFile({
//   filename: "logs/notion/notion-%DATE%.log",
//   datePattern: "YYYY-MM-DD-HH",
//   zippedArchive: true,
//   maxSize: "20m",
//   maxFiles: "14d",
// });

const attachRequestId = winston.format((info) => {
  // const event = useEvent();
  // const reqId = event?.context?.reqId;

  // info.reqId = reqId ?? "";

  return info;
});

export const notionLogger = winston.createLogger({
  format: winston.format.combine(
    // attachRequestId(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, reqId }) => {
      return `${timestamp} [${reqId || ""}] ${level}: ${message}`;
    })
  ),
  // transports: [transport],
});
