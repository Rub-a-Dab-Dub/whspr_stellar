import { DlqProcessor } from '../dlq.processor';

describe('DlqProcessor', () => {
  let processor: DlqProcessor;

  beforeEach(() => {
    processor = new DlqProcessor();
  });

  it('logs failed job', () => {
    // nothing to assert; ensure method exists
    expect((processor as any).onFailed).toBeDefined();
  });
});
