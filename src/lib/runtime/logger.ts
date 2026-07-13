export type LogFields = Record<string, unknown>;

export interface Logger {
  info(message: string, fields: LogFields): void;
  warn(message: string, fields: LogFields): void;
  error(message: string, fields: LogFields): void;
}

type LogLevel = "info" | "warn" | "error";

const writeLog = (
  level: LogLevel,
  message: string,
  fields: LogFields,
): void => {
  const entry = JSON.stringify({ level, message, ...fields });

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.info(entry);
};

export const systemLogger: Logger = {
  info: (message, fields) => writeLog("info", message, fields),
  warn: (message, fields) => writeLog("warn", message, fields),
  error: (message, fields) => writeLog("error", message, fields),
};
