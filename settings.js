const winston = require("winston")
const moment = require("moment-timezone")
const DailyRotateFile = require("winston-daily-rotate-file")

// Define the format for the logs
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: () =>
            moment().tz("America/New_York").format("MM/DD/YYYY HH:mm:ss"),
    }),
    winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${message}`
    })
)

// Create a logger with a DailyRotateFile transport for both activity and error logs
const logger = winston.createLogger({
    format: logFormat,
    transports: [
        // DailyRotateFile transport for activity logs
        new DailyRotateFile({
            filename: "./logs/activity-%DATE%.log",
            datePattern: "MM-DD-YYYY", // Daily rotation pattern
            zippedArchive: true,
            maxSize: "10m", // Rotate when the log file reaches 10 MB
            level: "info", // Log messages with the 'info' level or higher
        }),

        // DailyRotateFile transport for error logs
        new DailyRotateFile({
            filename: "./logs/error-%DATE%.log",
            datePattern: "MM-DD-YYYY", // Daily rotation pattern
            zippedArchive: true,
            maxSize: "10m", // Rotate when the log file reaches 10 MB
            level: "error", // Log messages with the 'error' level or higher
        }),
    ],
})
// // Example of logging activity
// logger.info("This is an activity log message.")

// // Example of logging an error
// try {
//     // Simulate an error
//     throw new Error("This is a simulated error.")
// } catch (error) {
//     logger.error("An error occurred:", error)
// }

module.exports = {
    logger,
}
