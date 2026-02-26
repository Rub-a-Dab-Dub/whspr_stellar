import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import winston from 'winston';

const sensitiveFields = new Set(['password', 'privateKey', 'token']);

const redactValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (seen.has(value as object)) {
    return '[Circular]';
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      sensitiveFields.has(key) ? '[REDACTED]' : redactValue(entry, seen),
    ]),
  );
};

const redactSensitive = winston.format((info) => {
  const redacted = redactValue(info) as Record<string, unknown>;
  Object.assign(info, redacted);
  return info;
});

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  const logDir = join(process.cwd(), 'logs');
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    redactSensitive(),
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: isProduction
    ? [
        new winston.transports.File({
          filename: join(process.cwd(), 'logs/error.log'),
          level: 'error',
        }),
        new winston.transports.File({
          filename: join(process.cwd(), 'logs/combined.log'),
        }),
      ]
    : [new winston.transports.Console()],
});

export default logger;
