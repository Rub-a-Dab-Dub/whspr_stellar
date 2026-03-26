import { BlockchainProcessor } from '../workers/blockchain.processor';

describe('BlockchainProcessor', () => {
  let processor: BlockchainProcessor;

  beforeEach(() => {
    processor = new BlockchainProcessor();
  });

  it('submits tx and returns txHash', async () => {
    const mockJob: any = {
      id: '1',
      data: { txPayload: { a: 1 } },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    };
    const res = await (processor as any).process(mockJob);
    expect(res).toHaveProperty('txHash');
    expect(mockJob.updateProgress).toHaveBeenCalled();
  });
});
