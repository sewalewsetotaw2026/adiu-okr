

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function format(level: LogLevel, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | META: ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [ERP-AUTH] ${message}${metaStr}`;
}

export const logInfo = (message: string, meta?: any): void => {
  console.log(format('info', message, meta));
};

export const logWarn = (message: string, meta?: any): void => {
  console.warn(format('warn', message, meta));
};

export const logError = (message: string, error?: any): void => {
  const errDetails = error instanceof Error 
    ? { message: error.message, stack: error.stack }
    : error;
  console.error(format('error', message, errDetails));
};

export const logDebug = (message: string, meta?: any): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log(format('debug', message, meta));
  }
};

export const logger = {
  info: logInfo,
  warn: logWarn,
  error: logError,
  debug: logDebug
};

export default logger;

