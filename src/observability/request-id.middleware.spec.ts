import { requestIdMiddleware } from './request-id.middleware';

describe('requestIdMiddleware', () => {
  it('propagates existing X-Request-ID header', () => {
    const req = { header: jest.fn().mockReturnValue('abc-123') } as any;
    const res = { setHeader: jest.fn() } as any;
    const next = jest.fn();

    requestIdMiddleware(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'abc-123');
    expect(next).toHaveBeenCalled();
  });

  it('generates X-Request-ID when missing', () => {
    const req = { header: jest.fn().mockReturnValue(undefined) } as any;
    const res = { setHeader: jest.fn() } as any;
    const next = jest.fn();

    requestIdMiddleware(req, res, next);
    const headerValue = (res.setHeader as jest.Mock).mock.calls[0][1];
    expect(typeof headerValue).toBe('string');
    expect(headerValue.length).toBeGreaterThan(10);
    expect(next).toHaveBeenCalled();
  });
});
