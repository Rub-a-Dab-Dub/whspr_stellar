import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

export const winstonConfig: WinstonModuleOptions = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, context, stack }) => {
          const contextStr = context ? `[${context}]` : '';
          const stackStr = stack ? `\n${stack}` : '';
          return `${timestamp} ${level} ${contextStr} ${message}${stackStr}`;
        }),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: logFormat,
    }),
  ],
};
