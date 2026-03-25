import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

interface LogContext {
    module?: string;
    method?: string;
    userId?: string;
    requestId?: string;
    [key: string]: any;
}

@Injectable()
export class LoggerService implements NestLoggerService {
    private logger: winston.Logger;
    private context: LogContext = {};
    private requestId: string;

    constructor(private configService: ConfigService) {
        this.requestId = uuidv4();
        this.logger = this.createLogger();
    }

    private createLogger(): winston.Logger {
        const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
        const logLevel = this.configService.get<string>('LOG_LEVEL', 'info');

        const transports: winston.transport[] = [];

        // Console transport for all environments
        transports.push(
            new winston.transports.Console({
                format:
                    nodeEnv === 'production'
                        ? winston.format.json()
                        : winston.format.combine(
                            winston.format.colorize(),
                            winston.format.printf(this.formatConsoleLog.bind(this)),
                        ),
            }),
        );

        // File transports for production
        if (nodeEnv === 'production') {
            transports.push(
                new winston.transports.File({
                    filename: 'logs/error.log',
                    level: 'error',
                    format: winston.format.json(),
                }),
                new winston.transports.File({
                    filename: 'logs/combined.log',
                    format: winston.format.json(),
                }),
            );
        }

        return winston.createLogger({
            level: logLevel,
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.errors({ stack: true }),
                winston.format.splat(),
            ),
            defaultMeta: { service: 'gasless-gossip-api' },
            transports,
        });
    }

    private formatConsoleLog(info: any): string {
        const { timestamp, level, message, context, requestId, userId, stack } = info;
        const contextStr = context ? `[${context}]` : '';
        const requestIdStr = requestId ? `[${requestId}]` : '';
        const userIdStr = userId ? `[user:${userId}]` : '';
        const stackStr = stack ? `\n${stack}` : '';

        return `${timestamp} ${level} ${contextStr}${requestIdStr}${userIdStr} ${message}${stackStr}`;
    }

    private maskSensitiveData(data: any): any {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const sensitiveFields = ['password', 'token', 'privateKey', 'walletAddress'];
        const masked = JSON.parse(JSON.stringify(data));

        const maskField = (obj: any) => {
            for (const key in obj) {
                if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
                    if (key.toLowerCase() === 'walletaddress') {
                        // Partial mask for wallet address: show first 6 and last 4 chars
                        obj[key] = typeof obj[key] === 'string' ? `${obj[key].slice(0, 6)}...${obj[key].slice(-4)}` : '***';
                    } else {
                        obj[key] = '***';
                    }
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    maskField(obj[key]);
                }
            }
        };

        maskField(masked);
        return masked;
    }

    setContext(context: LogContext): void {
        this.context = { ...this.context, ...context };
    }

    setRequestId(requestId: string): void {
        this.requestId = requestId;
    }

    getRequestId(): string {
        return this.requestId;
    }

    log(message: string, context?: string, meta?: any): void {
        this.logger.info(message, {
            context: context || this.context.module,
            requestId: this.requestId,
            userId: this.context.userId,
            ...meta,
        });
    }

    error(message: string, trace?: string, context?: string, meta?: any): void {
        const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
        const stack = nodeEnv === 'production' ? undefined : trace;

        this.logger.error(message, {
            context: context || this.context.module,
            requestId: this.requestId,
            userId: this.context.userId,
            stack,
            ...meta,
        });
    }

    warn(message: string, context?: string, meta?: any): void {
        this.logger.warn(message, {
            context: context || this.context.module,
            requestId: this.requestId,
            userId: this.context.userId,
            ...meta,
        });
    }

    debug(message: string, context?: string, meta?: any): void {
        this.logger.debug(message, {
            context: context || this.context.module,
            requestId: this.requestId,
            userId: this.context.userId,
            ...meta,
        });
    }

    verbose(message: string, context?: string, meta?: any): void {
        this.logger.verbose(message, {
            context: context || this.context.module,
            requestId: this.requestId,
            userId: this.context.userId,
            ...meta,
        });
    }

    logRequest(method: string, url: string, body?: any, query?: any): void {
        const maskedBody = this.maskSensitiveData(body);
        const maskedQuery = this.maskSensitiveData(query);

        this.logger.info(`${method} ${url}`, {
            context: 'HTTP',
            requestId: this.requestId,
            userId: this.context.userId,
            body: maskedBody,
            query: maskedQuery,
        });
    }

    logResponse(method: string, url: string, statusCode: number, responseTime: number, body?: any): void {
        const maskedBody = this.maskSensitiveData(body);

        this.logger.info(`${method} ${url} - ${statusCode}`, {
            context: 'HTTP',
            requestId: this.requestId,
            userId: this.context.userId,
            statusCode,
            responseTime: `${responseTime}ms`,
            body: maskedBody,
        });
    }
}
