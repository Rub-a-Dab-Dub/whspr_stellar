import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NameResolutionController } from './name-resolution.controller';
import { NameResolutionService } from './name-resolution.service';
import { Keypair } from '@stellar/stellar-sdk';

describe('NameResolutionController', () => {
  let controller: NameResolutionController;
  const svc = {
    resolveAny: jest.fn(),
    reverseResolve: jest.fn(),
    resolveBatch: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [NameResolutionController],
      providers: [{ provide: NameResolutionService, useValue: svc }],
    }).compile();
    controller = moduleRef.get(NameResolutionController);
  });

  it('resolve requires name', async () => {
    await expect(controller.resolve(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reverse requires address', async () => {
    await expect(controller.reverse(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolve delegates', async () => {
    const g = Keypair.random().publicKey();
    svc.resolveAny.mockResolvedValue({ name: g, type: 'native', stellarAddress: g });
    const out = await controller.resolve(g);
    expect(out.resolved?.stellarAddress).toBe(g);
  });

  it('batch delegates', async () => {
    svc.resolveBatch.mockResolvedValue([null]);
    const out = await controller.batch({ names: ['x'] });
    expect(out.results).toEqual([null]);
  });
});
