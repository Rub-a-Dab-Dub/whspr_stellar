import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from '../messaging/gateways/chat.gateway';
import { PollsExpiryJob } from './polls-expiry.job';
import { PollsService } from './polls.service';

describe('PollsExpiryJob', () => {
  let job: PollsExpiryJob;
  let service: jest.Mocked<PollsService>;
  let gateway: jest.Mocked<ChatGateway>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PollsExpiryJob,
        {
          provide: PollsService,
          useValue: {
            closeExpiredPolls: jest.fn(),
          },
        },
        {
          provide: ChatGateway,
          useValue: {
            sendPollUpdated: jest.fn(),
          },
        },
      ],
    }).compile();

    job = module.get(PollsExpiryJob);
    service = module.get(PollsService);
    gateway = module.get(ChatGateway);
  });

  it('broadcasts updates for expired polls that were auto-closed', async () => {
    service.closeExpiredPolls.mockResolvedValue([
      {
        id: '11111111-1111-1111-1111-111111111111',
        conversationId: '22222222-2222-2222-2222-222222222222',
        createdBy: '33333333-3333-3333-3333-333333333333',
        question: 'Best option?',
        options: ['A', 'B'],
        allowMultiple: false,
        isAnonymous: false,
        expiresAt: null,
        isClosed: true,
        createdAt: new Date('2026-03-27T09:00:00.000Z'),
        totalVoters: 1,
        results: [],
      },
    ] as never);

    await job.closeExpiredPolls();

    expect(gateway.sendPollUpdated).toHaveBeenCalledTimes(1);
    expect(gateway.sendPollUpdated).toHaveBeenCalledWith(
      '22222222-2222-2222-2222-222222222222',
      expect.objectContaining({ isClosed: true }),
    );
  });
});
