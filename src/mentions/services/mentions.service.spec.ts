import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MentionsService } from './mentions.service';
import { MentionsRepository } from '../repositories/mentions.repository';
import { Mention } from '../entities/mention.entity';

describe('MentionsService', () => {
  let service: MentionsService;
  let repository: MentionsRepository;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockOtherUserId = '550e8400-e29b-41d4-a716-446655440001';
  const mockMessageId = '550e8400-e29b-41d4-a716-446655440002';
  const mockConversationId = '550e8400-e29b-41d4-a716-446655440003';

  const mockMention: Mention = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    messageId: mockMessageId,
    mentionedUserId: mockUserId,
    mentionedBy: mockOtherUserId,
    conversationId: mockConversationId,
    isRead: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentionsService,
        {
          provide: MentionsRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOneBy: jest.fn(),
            findUnreadMentions: jest.fn(),
            getUnreadCount: jest.fn(),
            getMentionsByMessageId: jest.fn(),
            getMentionsInConversation: jest.fn(),
            getMentionsForUser: jest.fn(),
            markMentionAsRead: jest.fn(),
            markAllUserMentionsAsRead: jest.fn(),
            deleteMentionByMessageId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MentionsService>(MentionsService);
    repository = module.get<MentionsRepository>(MentionsRepository);
  });

  describe('parseMentions', () => {
    it('should parse @username mentions from content', () => {
      const content = 'Hey @john and @sarah, check this out!';
      const mentions = service.parseMentions(content);

      expect(mentions).toHaveLength(2);
      expect(mentions[0].username).toBe('john');
      expect(mentions[1].username).toBe('sarah');
    });

    it('should parse mentions with dots and dashes', () => {
      const content = 'Cc @user.name and @user-name';
      const mentions = service.parseMentions(content);

      expect(mentions).toHaveLength(2);
      expect(mentions[0].username).toBe('user.name');
      expect(mentions[1].username).toBe('user-name');
    });

    it('should return empty array when no mentions', () => {
      const content = 'No mentions here!';
      const mentions = service.parseMentions(content);

      expect(mentions).toHaveLength(0);
    });

    it('should handle multiple mentions of same user', () => {
      const content = '@john called @john twice';
      const mentions = service.parseMentions(content);

      expect(mentions).toHaveLength(2);
      expect(mentions[0].username).toBe('john');
      expect(mentions[1].username).toBe('john');
    });

    it('should include mention position and length', () => {
      const content = 'Hello @john!';
      const mentions = service.parseMentions(content);

      expect(mentions[0].position).toBe(6);
      expect(mentions[0].length).toBe(5); // "@john"
    });
  });

  describe('createMentions', () => {
    it('should create mention records for message', async () => {
      jest.spyOn(repository, 'create').mockReturnValue(mockMention);
      jest.spyOn(repository, 'save').mockResolvedValue([mockMention]);

      const result = await service.createMentions(
        mockMessageId,
        mockConversationId,
        mockOtherUserId,
        [mockUserId],
      );

      expect(result).toHaveLength(1);
      expect(result[0].mentionedUserId).toBe(mockUserId);
      expect(result[0].isRead).toBe(false);
    });

    it('should deduplicate mentioned user IDs', async () => {
      jest.spyOn(repository, 'create').mockReturnValue(mockMention);
      jest.spyOn(repository, 'save').mockResolvedValue([mockMention]);

      await service.createMentions(
        mockMessageId,
        mockConversationId,
        mockOtherUserId,
        [mockUserId, mockUserId], // Duplicate
      );

      // Should only create one mention (deduplicated)
      expect(repository.create).toHaveBeenCalledTimes(1);
    });

    it('should handle empty mention list', async () => {
      const result = await service.createMentions(
        mockMessageId,
        mockConversationId,
        mockOtherUserId,
        [],
      );

      expect(result).toHaveLength(0);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('markMentionRead', () => {
    it('should mark mention as read', async () => {
      const readMention = { ...mockMention, isRead: true };

      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockMention);
      jest.spyOn(repository, 'markMentionAsRead').mockResolvedValue(undefined);
      jest.spyOn(repository, 'findOneBy').mockResolvedValueOnce(mockMention);
      jest.spyOn(repository, 'findOneBy').mockResolvedValueOnce(readMention);

      const result = await service.markMentionRead('550e8400-e29b-41d4-a716-446655440010');

      expect(repository.markMentionAsRead).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440010',
      );
      expect(result.isRead).toBe(true);
    });

    it('should throw NotFoundException for non-existent mention', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(null);

      await expect(service.markMentionRead('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnreadMentions', () => {
    it('should return unread mentions for user', async () => {
      jest.spyOn(repository, 'findUnreadMentions').mockResolvedValue([mockMention]);

      const result = await service.getUnreadMentions(mockUserId);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].isRead).toBe(false);
    });

    it('should return empty list when no unread mentions', async () => {
      jest.spyOn(repository, 'findUnreadMentions').mockResolvedValue([]);

      const result = await service.getUnreadMentions(mockUserId);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread mentions', async () => {
      jest.spyOn(repository, 'getUnreadCount').mockResolvedValue(5);

      const result = await service.getUnreadCount(mockUserId);

      expect(result).toBe(5);
    });

    it('should return 0 when no unread mentions', async () => {
      jest.spyOn(repository, 'getUnreadCount').mockResolvedValue(0);

      const result = await service.getUnreadCount(mockUserId);

      expect(result).toBe(0);
    });
  });

  describe('markAllRead', () => {
    it('should mark all user mentions as read', async () => {
      jest.spyOn(repository, 'getUnreadCount').mockResolvedValueOnce(5);
      jest.spyOn(repository, 'markAllUserMentionsAsRead').mockResolvedValue(undefined);
      jest.spyOn(repository, 'getUnreadCount').mockResolvedValueOnce(0);

      const result = await service.markAllRead(mockUserId);

      expect(result.count).toBe(5);
      expect(repository.markAllUserMentionsAsRead).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('getMentionsInConversation', () => {
    it('should return mentions in conversation', async () => {
      jest.spyOn(repository, 'getMentionsInConversation').mockResolvedValue([[mockMention], 1]);

      const result = await service.getMentionsInConversation(mockConversationId);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getMentionsForUser', () => {
    it('should return mentions for user', async () => {
      jest.spyOn(repository, 'getMentionsForUser').mockResolvedValue([[mockMention], 1]);

      const result = await service.getMentionsForUser(mockUserId);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('Mention parsing accuracy', () => {
    it('should correctly parse complex mention scenarios', () => {
      const content = 'Hey @user1, did you see @user.2 and @user-3 messages? @user1 replied.';
      const mentions = service.parseMentions(content);

      const usernames = mentions.map((m) => m.username);
      expect(usernames).toContain('user1');
      expect(usernames).toContain('user.2');
      expect(usernames).toContain('user-3');
      expect(usernames.filter((u) => u === 'user1')).toHaveLength(2);
    });
  });

  describe('deleteByMessageId', () => {
    it('should delete mentions when message is deleted', async () => {
      jest.spyOn(repository, 'deleteMentionByMessageId').mockResolvedValue(undefined);

      await service.deleteByMessageId(mockMessageId);

      expect(repository.deleteMentionByMessageId).toHaveBeenCalledWith(mockMessageId);
    });
  });

  describe('Unread count accuracy', () => {
    it('should maintain accurate unread count after marking as read', async () => {
      jest.spyOn(repository, 'getUnreadCount').mockResolvedValueOnce(3);
      jest.spyOn(repository, 'markAllUserMentionsAsRead').mockResolvedValue(undefined);
      jest.spyOn(repository, 'getUnreadCount').mockResolvedValueOnce(0);

      const result = await service.markAllRead(mockUserId);

      expect(result.count).toBe(3);
    });
  });
});
