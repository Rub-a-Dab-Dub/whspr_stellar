import { Test, TestingModule } from '@nestjs/testing';
import { ContentGatesController } from './content-gates.controller';
import { ContentGatesService } from './content-gates.service';
import { GatedContentType, GateType } from './entities/content-gate.entity';
import { ContentGateRequiredException } from './exceptions/content-gate-required.exception';

describe('ContentGatesController', () => {
  let controller: ContentGatesController;
  const service = {
    createGate: jest.fn(),
    removeGate: jest.fn(),
    getGatedContent: jest.fn(),
    batchVerify: jest.fn(),
    assertAccessOr402: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentGatesController],
      providers: [{ provide: ContentGatesService, useValue: service }],
    }).compile();
    controller = module.get(ContentGatesController);
  });

  it('create delegates to service', async () => {
    const gate = { id: 'g1' };
    service.createGate.mockResolvedValue(gate);
    const dto = {
      contentType: GatedContentType.MESSAGE,
      contentId: 'c1',
      gateType: GateType.STAKING_TIER,
      gateToken: 'silver',
    };
    await expect(controller.create('user-1', dto as any)).resolves.toBe(gate);
    expect(service.createGate).toHaveBeenCalledWith('user-1', dto);
  });

  it('verify returns allowed when assert passes', async () => {
    service.assertAccessOr402.mockResolvedValue(undefined);
    await expect(
      controller.verify('u1', { contentType: GatedContentType.MESSAGE, contentId: 'x' }),
    ).resolves.toEqual({ allowed: true });
  });

  it('verify propagates 402 exception', async () => {
    service.assertAccessOr402.mockRejectedValue(new ContentGateRequiredException([]));
    await expect(
      controller.verify('u1', { contentType: GatedContentType.MESSAGE, contentId: 'x' }),
    ).rejects.toBeInstanceOf(ContentGateRequiredException);
  });

  it('verifyBatch wraps results', async () => {
    service.batchVerify.mockResolvedValue([
      { contentType: GatedContentType.MESSAGE, contentId: 'a', allowed: true },
    ]);
    const out = await controller.verifyBatch('u1', {
      items: [{ contentType: GatedContentType.MESSAGE, contentId: 'a' }],
    } as any);
    expect(out.results).toHaveLength(1);
  });

  it('listForContent delegates', async () => {
    service.getGatedContent.mockResolvedValue([]);
    await controller.listForContent(GatedContentType.THREAD, 't1');
    expect(service.getGatedContent).toHaveBeenCalledWith(GatedContentType.THREAD, 't1');
  });

  it('remove delegates', async () => {
    service.removeGate.mockResolvedValue(undefined);
    await controller.remove('u1', '550e8400-e29b-41d4-a716-446655440000');
    expect(service.removeGate).toHaveBeenCalled();
  });
});
