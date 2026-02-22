import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AdminPlatformErrorFilter,
  emitPlatformError,
} from './admin-platform-error.filter';
import { ADMIN_STREAM_EVENTS } from '../gateways/admin-event-stream.gateway';

describe('AdminPlatformErrorFilter', () => {
  const eventEmitter = {
    emit: jest.fn(),
  } as unknown as EventEmitter2;

  const makeHost = (response: any, request: any): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    }) as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emitPlatformError emits platform.error event', () => {
    emitPlatformError(eventEmitter, 'boom', 'GET /admin/health');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      ADMIN_STREAM_EVENTS.PLATFORM_ERROR,
      expect.objectContaining({
        type: 'platform.error',
        entity: expect.objectContaining({
          message: 'boom',
          context: 'GET /admin/health',
        }),
      }),
    );
  });

  it('emits stream event for 5xx exceptions and writes response', () => {
    const filter = new AdminPlatformErrorFilter(eventEmitter);
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const response = { status, json };
    const request = { method: 'GET', url: '/admin/users' };

    filter.catch(
      new HttpException('server down', HttpStatus.INTERNAL_SERVER_ERROR),
      makeHost(response, request),
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      ADMIN_STREAM_EVENTS.PLATFORM_ERROR,
      expect.objectContaining({
        type: 'platform.error',
      }),
    );
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalled();
  });

  it('does not emit stream event for 4xx exceptions', () => {
    const filter = new AdminPlatformErrorFilter(eventEmitter);
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();

    filter.catch(
      new HttpException('bad request', HttpStatus.BAD_REQUEST),
      makeHost({ status, json }, { method: 'POST', url: '/admin/users' }),
    );

    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalled();
  });
});
