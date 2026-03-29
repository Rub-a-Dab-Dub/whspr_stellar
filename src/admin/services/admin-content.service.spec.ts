import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminContentService } from './admin-content.service';
import { Message } from '../../messages/entities/message.entity';
import { Repository } from 'typeorm';

describe('AdminContentService', () => {
  let service: AdminContentService;
  let repo: Repository<Message>;

  const mockMessages = [
    { id: '1', content: 'test msg 1' },
  ];

  const mockMessageRepository = {
    find: jest.fn().mockResolvedValue(mockMessages),
    findOne: jest.fn().mockResolvedValue(mockMessages[0]),
    remove: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminContentService,
        {
          provide: getRepositoryToken(Message),
          useValue: mockMessageRepository,
        },
      ],
    }).compile();

    service = module.get<AdminContentService>(AdminContentService);
    repo = module.get<Repository<Message>>(getRepositoryToken(Message));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find messages', async () => {
    const result = await service.findAllMessages();
    expect(result).toEqual(mockMessages);
  });

  it('should delete a message', async () => {
    const result = await service.deleteMessage('1');
    expect(repo.remove).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
