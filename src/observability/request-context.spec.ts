import { RequestContext } from './request-context';

describe('RequestContext', () => {
  it('returns undefined outside request scope', () => {
    expect(RequestContext.getRequestId()).toBeUndefined();
  });

  it('returns request id within request scope', (done) => {
    RequestContext.run({ requestId: 'req-123' }, () => {
      expect(RequestContext.getRequestId()).toBe('req-123');
      done();
    });
  });
});
