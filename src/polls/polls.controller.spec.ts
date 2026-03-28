import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from '../messaging/gateways/chat.gateway';
import { PollsController } from './polls.controller';
import { PollsService } from './polls.service';

describe('PollsController', () => {
  let controller: PollsController;
  let service: jest.Mocked<PollsService>;
  let gateway: jest.Mocked<ChatGateway>;

  const pollResponse = {
    id: '11111111-1111-1111-1111-111111111111',
    conversationId: '22222222-2222-2222-2222-222222222222',
    createdBy: '33333333-3333-3333-3333-333333333333',
    question: 'Best option?',
    options: ['A', 'B'],
    allowMultiple: false,
    isAnonymous: false,
    expiresAt: null,
    isClosed: false,
    createdAt: new Date('2026-03-27T09:00:00.000Z'),
    totalVoters: 1,
    results: [],
    currentUserVote: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PollsController],
      providers: [
        {
          provide: PollsService,
          useValue: {
            createPoll: jest.fn(),
            getPollsInConversation: jest.fn(),
            getPollResults: jest.fn(),
            castVote: jest.fn(),
            retractVote: jest.fn(),
            closePoll: jest.fn(),
            getPollRealtimePayload: jest.fn(),
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

    controller = module.get(PollsController);
    service = module.get(PollsService);
    gateway = module.get(ChatGateway);
  });

  it('emits a websocket update when a vote is cast', async () => {
    service.castVote.mockResolvedValue(pollResponse as never);
    service.getPollRealtimePayload.mockResolvedValue(pollResponse as never);

    const result = await controller.castVote(
      '44444444-4444-4444-4444-444444444444',
      pollResponse.id,
      { optionIndexes: [0] },
    );

    expect(result).toBe(pollResponse);
    expect(gateway.sendPollUpdated).toHaveBeenCalledWith(pollResponse.conversationId, pollResponse);
  });

  it('emits a websocket update when a vote is retracted', async () => {
    service.retractVote.mockResolvedValue(pollResponse as never);
    service.getPollRealtimePayload.mockResolvedValue(pollResponse as never);

    await controller.retractVote('44444444-4444-4444-4444-444444444444', pollResponse.id);

    expect(gateway.sendPollUpdated).toHaveBeenCalledWith(pollResponse.conversationId, pollResponse);
  });
});
