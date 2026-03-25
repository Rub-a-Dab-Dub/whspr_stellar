import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './logger.service';
import * as winston from 'winston';

describe('LoggerService', () => {
    let service: LoggerService;
    let configService: ConfigService;
    let mockLogger: any;

    beforeEach(async () => {
        const mockConfigService = {
            get: jest.fn((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                    NODE_ENV: 'development',
                    LOG_LEVEL: 'info',
                };
                return config[key] ?? defaultValue;
            }),
        };

        service = new LoggerService(mockConfigService as any);
        configService = mockConfigService as any;

        // Mock the logger's info, error, warn, debug, verbose methods
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
        };

        service['logger'] = mockLogger;
    });

    describe('initialization', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should have a request ID', () => {
            expect(service.getRequestId()).toBeDefined();
            expect(typeof service.getRequestId()).toBe('string');
        });

        it('should set request ID', () => {
            const testId = 'test-request-id-123';
            service.setRequestId(testId);
            expect(service.getRequestId()).toBe(testId);
        });
    });

    describe('context management', () => {
        it('should set context', () => {
            const context = { module: 'AuthModule', method: 'login', userId: 'user-123' };
            service.setContext(context);
            expect(service['context']).toEqual(context);
        });

        it('should merge context', () => {
            service.setContext({ module: 'AuthModule' });
            service.setContext({ method: 'login' });
            expect(service['context']).toEqual({ module: 'AuthModule', method: 'login' });
        });
    });

    describe('sensitive data masking', () => {
        it('should mask password field', () => {
            const data = { username: 'john', password: 'secret123' };
            const masked = service['maskSensitiveData'](data);
            expect(masked.password).toBe('***');
            expect(masked.username).toBe('john');
        });

        it('should mask token field', () => {
            const data = { accessToken: 'token123', refreshToken: 'refresh456' };
            const masked = service['maskSensitiveData'](data);
            expect(masked.accessToken).toBe('***');
            expect(masked.refreshToken).toBe('***');
        });

        it('should mask privateKey field', () => {
            const data = { privateKey: 'pk_secret_key_123' };
            const masked = service['maskSensitiveData'](data);
            expect(masked.privateKey).toBe('***');
        });

        it('should partially mask walletAddress', () => {
            const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
            const data = { walletAddress };
            const masked = service['maskSensitiveData'](data);
            expect(masked.walletAddress).toBe('0x1234...5678');
        });

        it('should mask nested sensitive fields', () => {
            const data = {
                user: {
                    username: 'john',
                    password: 'secret123',
                    wallet: {
                        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
                        privateKey: 'pk_secret',
                    },
                },
            };
            const masked = service['maskSensitiveData'](data);
            expect(masked.user.password).toBe('***');
            expect(masked.user.wallet.privateKey).toBe('***');
            expect(masked.user.wallet.walletAddress).toBe('0x1234...5678');
            expect(masked.user.username).toBe('john');
        });

        it('should handle non-object data', () => {
            expect(service['maskSensitiveData']('string')).toBe('string');
            expect(service['maskSensitiveData'](123)).toBe(123);
            expect(service['maskSensitiveData'](null)).toBe(null);
        });

        it('should handle case-insensitive field matching', () => {
            const data = { PASSWORD: 'secret', Token: 'token123', PRIVATEKEY: 'pk' };
            const masked = service['maskSensitiveData'](data);
            expect(masked.PASSWORD).toBe('***');
            expect(masked.Token).toBe('***');
            expect(masked.PRIVATEKEY).toBe('***');
        });
    });

    describe('logging methods', () => {
        beforeEach(() => {
            service.setContext({ module: 'TestModule', userId: 'user-123' });
            service.setRequestId('req-123');
        });

        it('should log info message', () => {
            service.log('Test message', 'TestContext', { extra: 'data' });
            expect(mockLogger.info).toHaveBeenCalledWith('Test message', {
                context: 'TestContext',
                requestId: 'req-123',
                userId: 'user-123',
                extra: 'data',
            });
        });

        it('should log error message', () => {
            service.error('Error message', 'stack trace', 'ErrorContext', { code: 'ERR_001' });
            expect(mockLogger.error).toHaveBeenCalled();
            const call = mockLogger.error.mock.calls[0];
            expect(call[0]).toBe('Error message');
            expect(call[1].context).toBe('ErrorContext');
            expect(call[1].requestId).toBe('req-123');
            expect(call[1].code).toBe('ERR_001');
        });

        it('should not include stack trace in production', () => {
            const mockConfigProd = {
                get: jest.fn((key: string) => {
                    if (key === 'NODE_ENV') return 'production';
                    return 'info';
                }),
            };

            const prodService = new LoggerService(mockConfigProd as any);
            prodService['logger'] = mockLogger;
            prodService.setRequestId('req-123');

            prodService.error('Error message', 'stack trace', 'ErrorContext');
            const call = mockLogger.error.mock.calls[0];
            expect(call[1].stack).toBeUndefined();
        });

        it('should log warn message', () => {
            service.warn('Warning message', 'WarnContext');
            expect(mockLogger.warn).toHaveBeenCalledWith('Warning message', {
                context: 'WarnContext',
                requestId: 'req-123',
                userId: 'user-123',
            });
        });

        it('should log debug message', () => {
            service.debug('Debug message', 'DebugContext');
            expect(mockLogger.debug).toHaveBeenCalledWith('Debug message', {
                context: 'DebugContext',
                requestId: 'req-123',
                userId: 'user-123',
            });
        });

        it('should log verbose message', () => {
            service.verbose('Verbose message', 'VerboseContext');
            expect(mockLogger.verbose).toHaveBeenCalledWith('Verbose message', {
                context: 'VerboseContext',
                requestId: 'req-123',
                userId: 'user-123',
            });
        });
    });

    describe('request/response logging', () => {
        beforeEach(() => {
            service.setRequestId('req-456');
            service.setContext({ userId: 'user-456' });
        });

        it('should log request with masked sensitive data', () => {
            const body = { username: 'john', password: 'secret123' };
            const query = { token: 'token123' };

            service.logRequest('POST', '/api/auth/login', body, query);

            expect(mockLogger.info).toHaveBeenCalledWith('POST /api/auth/login', {
                context: 'HTTP',
                requestId: 'req-456',
                userId: 'user-456',
                body: { username: 'john', password: '***' },
                query: { token: '***' },
            });
        });

        it('should log response with masked sensitive data', () => {
            const responseBody = { user: { id: '123', walletAddress: '0x1234567890abcdef1234567890abcdef12345678' } };

            service.logResponse('GET', '/api/users/profile', 200, 45, responseBody);

            expect(mockLogger.info).toHaveBeenCalledWith('GET /api/users/profile - 200', {
                context: 'HTTP',
                requestId: 'req-456',
                userId: 'user-456',
                statusCode: 200,
                responseTime: '45ms',
                body: { user: { id: '123', walletAddress: '0x1234...5678' } },
            });
        });

        it('should handle undefined request body and query', () => {
            service.logRequest('GET', '/api/health');

            expect(mockLogger.info).toHaveBeenCalledWith('GET /api/health', {
                context: 'HTTP',
                requestId: 'req-456',
                userId: 'user-456',
                body: undefined,
                query: undefined,
            });
        });
    });

    describe('log level configuration', () => {
        it('should respect LOG_LEVEL environment variable', () => {
            const mockConfigDebug = {
                get: jest.fn((key: string, defaultValue?: any) => {
                    if (key === 'LOG_LEVEL') return 'debug';
                    if (key === 'NODE_ENV') return 'development';
                    return defaultValue;
                }),
            };

            const newService = new LoggerService(mockConfigDebug as any);
            expect(newService['logger'].level).toBe('debug');
        });

        it('should default to info log level', () => {
            const mockConfigDefault = {
                get: jest.fn((key: string, defaultValue?: any) => {
                    if (key === 'NODE_ENV') return 'development';
                    return defaultValue;
                }),
            };

            const newService = new LoggerService(mockConfigDefault as any);
            expect(newService['logger'].level).toBe('info');
        });
    });

    describe('environment-specific behavior', () => {
        it('should use JSON format for production console', () => {
            const mockConfigProd = {
                get: jest.fn((key: string) => {
                    if (key === 'NODE_ENV') return 'production';
                    return 'info';
                }),
            };

            const newService = new LoggerService(mockConfigProd as any);
            const consoleTransport = newService['logger'].transports.find(
                (t) => t instanceof winston.transports.Console,
            );
            expect(consoleTransport).toBeDefined();
        });

        it('should add file transports in production', () => {
            const mockConfigProd = {
                get: jest.fn((key: string) => {
                    if (key === 'NODE_ENV') return 'production';
                    return 'info';
                }),
            };

            const newService = new LoggerService(mockConfigProd as any);
            const fileTransports = newService['logger'].transports.filter(
                (t) => t instanceof winston.transports.File,
            );
            expect(fileTransports.length).toBeGreaterThan(0);
        });
    });
});
