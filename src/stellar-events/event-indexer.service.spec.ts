import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventIndexerService } from '../../src/stellar-events/event-indexer.service';
import { SorobanRpcService } from '../../src/stellar-events/soroban-rpc.service';
import { ContractEvent } from '../../src/stellar-events/contract-event.entity';
import { IndexerCursor } from '../../src/stellar-events/indexer-cursor.entity';
import { CONTRACT_EVENTS } from '../../src/stellar-events/event-schemas';
import type { RawContractEvent } from '../../src/stellar-events/soroban-rpc.service';

// Mock stellar-sdk XDR parsing so tests don't need real XDR-encoded topics
jest.mock('stellar-sdk', () => ({
  xdr: {
    ScVal: {
      fromXDR: jest.fn(() => ({})),
      scvSymbol: jest.fn((s: string) => ({ toXDR: () => s })),
    },
  },
  scValToNative: jest.fn((v: unknown) => v), // identity: returns the mock ScVal as-is
}));

const CONTRACT_ID = 'CTEST000000000000000000000000000000000000000000000000000001';

function makeRawEvent(overrides: Partial<RawContractEvent> = {}): RawContractEvent {
  return {
    eventId: '100-0-0',
    contractId: CONTRACT_ID,
    ledgerSequence: 100,
    eventIndex: 0,
    topics: [CONTRACT_EVENTS.TIP_SENT, 'GSENDER', 'GRECEIVER'],
    valueXdr: 'AAAAAA==',
    pagingToken: '100-0-0',
    ...overrides,
  };
}

describe('EventIndexerService', () => {
  let service: EventIndexerService;
  let rpcService: jest.Mocked<SorobanRpcService>;

  const mockInsertQb = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  };

  const mockSelectQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  const mockEventRepo = {
    createQueryBuilder: jest.fn((alias?: string) => (alias ? mockSelectQb : mockInsertQb)),
  };

  const mockCursorRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventIndexerService,
        {
          provide: SorobanRpcService,
          useValue: {
            getEvents: jest.fn(),
            getLatestLedger: jest.fn().mockResolvedValue(200),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('https://soroban-testnet.stellar.org'),
            get: jest.fn().mockReturnValue(CONTRACT_ID),
          },
        },
        { provide: getRepositoryToken(ContractEvent), useValue: mockEventRepo },
        { provide: getRepositoryToken(IndexerCursor), useValue: mockCursorRepo },
      ],
    }).compile();

    service = module.get(EventIndexerService);
    rpcService = module.get(SorobanRpcService) as jest.Mocked<SorobanRpcService>;
    service.onModuleInit();
  });

  describe('poll — event ingestion', () => {
    it('fetches events from ledger 1 when no cursor exists', async () => {
      rpcService.getEvents.mockResolvedValue({ events: [], nextCursor: null });

      await service.poll();

      expect(rpcService.getEvents).toHaveBeenCalledWith(CONTRACT_ID, 1, undefined, undefined);
    });

    it('resumes from lastLedger + 1 when cursor exists', async () => {
      mockCursorRepo.findOne.mockResolvedValueOnce({ contractId: CONTRACT_ID, lastLedger: 50 });
      rpcService.getEvents.mockResolvedValue({ events: [], nextCursor: null });

      await service.poll();

      expect(rpcService.getEvents).toHaveBeenCalledWith(CONTRACT_ID, 51, undefined, undefined);
    });

    it('paginates until nextCursor is null', async () => {
      rpcService.getEvents
        .mockResolvedValueOnce({ events: [makeRawEvent()], nextCursor: 'cursor1' })
        .mockResolvedValueOnce({
          events: [makeRawEvent({ eventId: '100-0-1', pagingToken: '100-0-1' })],
          nextCursor: null,
        });

      await service.poll();

      expect(rpcService.getEvents).toHaveBeenCalledTimes(2);
      expect(mockInsertQb.execute).toHaveBeenCalledTimes(2);
    });

    it('updates cursor to max ledger after successful poll', async () => {
      rpcService.getEvents.mockResolvedValue({
        events: [makeRawEvent({ ledgerSequence: 120 })],
        nextCursor: null,
      });

      await service.poll();

      expect(mockCursorRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ contractId: CONTRACT_ID, lastLedger: 120 }),
        ['contractId'],
      );
    });
  });

  describe('deduplication', () => {
    it('uses orIgnore() to skip duplicate eventId entries', async () => {
      rpcService.getEvents.mockResolvedValue({
        events: [makeRawEvent(), makeRawEvent()],
        nextCursor: null,
      });

      await service.poll();

      expect(mockInsertQb.orIgnore).toHaveBeenCalled();
    });
  });

  describe('findByContract', () => {
    it('queries by contractId and optional topic0', async () => {
      await service.findByContract(CONTRACT_ID, CONTRACT_EVENTS.TIP_SENT, 1, 20);

      expect(mockSelectQb.where).toHaveBeenCalledWith('e.contractId = :contractId', {
        contractId: CONTRACT_ID,
      });
      expect(mockSelectQb.andWhere).toHaveBeenCalledWith('e.topic0 = :topic0', {
        topic0: CONTRACT_EVENTS.TIP_SENT,
      });
      expect(mockSelectQb.take).toHaveBeenCalledWith(20);
      expect(mockSelectQb.skip).toHaveBeenCalledWith(0);
    });

    it('skips topic filter when not provided', async () => {
      await service.findByContract(CONTRACT_ID);

      expect(mockSelectQb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('error resilience', () => {
    it('logs error and continues polling other contracts on RPC failure', async () => {
      rpcService.getEvents.mockRejectedValue(new Error('RPC timeout'));
      const logSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

      await expect(service.poll()).resolves.not.toThrow();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('RPC timeout'));
    });
  });
});
