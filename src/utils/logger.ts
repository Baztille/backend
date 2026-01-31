import * as dotenv from "dotenv";
import * as winston from "winston";
import "winston-daily-rotate-file";

dotenv.config();

//winston.addColors({
//  info: 'bold green', // fontStyle color
//  warn: 'yellow',
//  error: 'bold red',
//  debug: 'white',
//});

const TIMESTAMP_FORMAT = "YYYY-MM-DD HH:mm:ss.SSS";
const DATE_PATTERN = "YYYY-MM-DD";

import * as util from "util";

function transform(info, opts) {
  const args = info[Symbol.for("splat")];
  if (args) {
    info.message = util.format(info.message, ...args);
  }
  return info;
}

function utilFormatter() {
  return { transform };
}

const baztilleLogFormat = winston.format.combine(
  winston.format.timestamp({
    format: TIMESTAMP_FORMAT
  }),
  utilFormatter(), // https://stackoverflow.com/questions/55387738/how-to-make-winston-logging-library-work-like-console-log
  winston.format.align(),
  winston.format.printf((info) => `${info.timestamp} [${info.level}] ${info.message}`)
);

const logger = winston.createLogger({
  level: process.env.LOG_DISPLAY_LEVEL,
  format: baztilleLogFormat,
  transports: [
    new winston.transports.DailyRotateFile({
      dirname: `${process.env.LOG_DIRECTORY}`,
      filename: "backend_%DATE%.log",
      datePattern: DATE_PATTERN,
      zippedArchive: true
    })
  ]
});

const errorLogger = winston.createLogger({
  level: "warn",
  format: baztilleLogFormat,
  transports: [
    new winston.transports.DailyRotateFile({
      dirname: `${process.env.LOG_DIRECTORY}`,
      filename: "error_backend_%DATE%.log",
      datePattern: DATE_PATTERN,
      zippedArchive: true
    })
  ]
});

const cronLogger = winston.createLogger({
  level: process.env.LOG_DISPLAY_LEVEL,
  format: baztilleLogFormat,
  transports: [
    new winston.transports.DailyRotateFile({
      dirname: `${process.env.LOG_DIRECTORY}`,
      filename: "cron_%DATE%.log",
      datePattern: DATE_PATTERN,
      zippedArchive: true
    })
  ]
});

const logText = (
  message: string | object,
  object: any,
  console_function,
  winston_functions: winston.LeveledLogMethod[],
  label: string,
  color: string
) => {
  const strMessage = typeof message == "string" ? message : JSON.stringify(message, null, 2);

  if (object.length > 0) {
    if (process.env.LOG_ALL_TO_CONSOLE && process.env.LOG_ALL_TO_CONSOLE == "true") {
      // Logging all to console whatever the error level
      console_function("\x1b[" + color + "m[" + label + "] " + strMessage + "\x1b[0m", object);
    }
    for (const winston_function of winston_functions) {
      winston_function(strMessage, object);
    }
  } else {
    if (process.env.LOG_ALL_TO_CONSOLE && process.env.LOG_ALL_TO_CONSOLE == "true") {
      // Logging all to console whatever the error level
      console_function("\x1b[" + color + "m[" + label + "] " + strMessage + "\x1b[0m");
    }
    for (const winston_function of winston_functions) {
      winston_function(strMessage);
    }
  }
};

/************* Regular logging ************/

// Log something that is useful for development / debugging
export const logDebug = (message: string | object, ...object: any) => {
  logText(message, object, console.log, [logger.debug], "DEBUG", "37");
};

// Log something that is significant to the application's business purpose (and is a normal behavior)
export const logInfo = (message: string | object, ...object: any) => {
  logText(message, object, console.log, [logger.info], "INFO", "32");
};

// Log something that should be noticed, even in production
export const logWarning = (message: string | object, ...object: any) => {
  logText(message, object, console.warn, [logger.warn, errorLogger.warn], "WARN", "43");
};

// Log something an error that should be visible everywhere
export const logError = (message: string | object, ...object: any) => {
  logText(message, object, console.error, [logger.error, errorLogger.error], "ERROR", "41");
};

/************* Cronjob logging ************/

// Log something that is useful for development / debugging
export const cronlogDebug = (message: string | object, ...object: any) => {
  logText(message, object, console.log, [cronLogger.debug], "DEBUG", "37");
};

// Log something that is significant to the application's business purpose (and is a normal behavior)
export const cronlogInfo = (message: string | object, ...object: any) => {
  logText(message, object, console.log, [cronLogger.info], "INFO", "32");
};

// Log something that should be noticed, even in production
export const cronlogWarning = (message: string | object, ...object: any) => {
  logText(message, object, console.warn, [cronLogger.warn, errorLogger.warn], "WARN", "43");
};

// Log something an error that should be visible everywhere
export const cronlogError = (message: string | object, ...object: any) => {
  logText(message, object, console.error, [cronLogger.error, errorLogger.error], "ERROR", "41");
};
