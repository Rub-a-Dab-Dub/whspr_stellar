import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { ConversationType } from './../src/conversations/entities/conversation.entity';
import { Repository } from 'typeorm';
import { Conversation } from './../src/conversations/entities/conversation.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Message } from './../src/conversations/entities/message.entity';

describe('ConversationsController (e2e)', () => {
  let app: INestApplication;
  let conversationRepo: Repository<Conversation>;
  let messageRepo: Repository<Message>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    conversationRepo = moduleFixture.get<Repository<Conversation>>(getRepositoryToken(Conversation));
    messageRepo = moduleFixture.get<Repository<Message>>(getRepositoryToken(Message));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/conversations (POST)', () => {
    it('should create a direct conversation', async () => {
      const response = await request(app.getHttpServer())
        .post('/conversations')
        .set('x-user-id', 'user1')
        .send({
          type: ConversationType.DIRECT,
          participants: ['user1', 'user2'],
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.type).toBe(ConversationType.DIRECT);
      expect(response.body.participants).toHaveLength(2);
    });

    it('should prevent duplicate direct conversations', async () => {
      const firstResponse = await request(app.getHttpServer())
        .post('/conversations')
        .set('x-user-id', 'user1')
        .send({
          type: ConversationType.DIRECT,
          participants: ['user1', 'user3'],
        })
        .expect(201);

      const secondResponse = await request(app.getHttpServer())
        .post('/conversations')
        .set('x-user-id', 'user1')
        .send({
          type: ConversationType.DIRECT,
          participants: ['user1', 'user3'],
        })
        .expect(201);

      expect(firstResponse.body.id).toBe(secondResponse.body.id);
    });

    it('should create group conversations', async () => {
      const response = await request(app.getHttpServer())
        .post('/conversations')
        .set('x-user-id', 'user1')
        .send({
          type: ConversationType.GROUP,
          groupId: 'group-123',
          participants: ['user2', 'user3'],
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.type).toBe(ConversationType.GROUP);
      expect(response.body.groupId).toBe('group-123');
      expect(response.body.participants).toHaveLength(3); // user1 + user2 + user3
    });
  });

  describe('/conversations (GET)', () => {
    it('should return a list of conversations for user', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .set('x-user-id', 'user-list')
        .send({
          type: ConversationType.DIRECT,
          participants: ['user-list', 'user-other'],
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/conversations')
        .set('x-user-id', 'user-list')
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('unread message count', () => {
    it('should accurately calculate unread count', async () => {
      // Create a conversation
      const conversationRes = await request(app.getHttpServer())
        .post('/conversations')
        .set('x-user-id', 'user-a')
        .send({
          type: ConversationType.DIRECT,
          participants: ['user-a', 'user-b'],
        })
        .expect(201);

      const conversationId = conversationRes.body.id;

      // Add a message from user-b
      const message = messageRepo.create({
        conversationId,
        senderId: 'user-b',
        content: 'Hello user-a',
      });
      await messageRepo.save(message);

      // Fetch conversation for user-a
      let response = await request(app.getHttpServer())
        .get(`/conversations/${conversationId}`)
        .set('x-user-id', 'user-a')
        .expect(200);

      expect(response.body.unreadCount).toBe(1);

      // Mark as read
      await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/read`)
        .set('x-user-id', 'user-a')
        .expect(201);

      // Fetch again
      response = await request(app.getHttpServer())
        .get(`/conversations/${conversationId}`)
        .set('x-user-id', 'user-a')
        .expect(200);

      expect(response.body.unreadCount).toBe(0);
    });
  });

  describe('Archiving', () => {
    it('should exclude archived conversations from the default list', async () => {
      const conversationRes = await request(app.getHttpServer())
        .post('/conversations')
        .set('x-user-id', 'user-arch')
        .send({
          type: ConversationType.DIRECT,
          participants: ['user-arch', 'user-arch-other'],
        })
        .expect(201);

      const conversationId = conversationRes.body.id;

      // Archive it
      await request(app.getHttpServer())
        .patch(`/conversations/${conversationId}/archive`)
        .set('x-user-id', 'user-arch')
        .send({ isArchived: true })
        .expect(200);

      // Check default list
      const listResponse = await request(app.getHttpServer())
        .get('/conversations')
        .set('x-user-id', 'user-arch')
        .expect(200);

      const archivedInList = listResponse.body.data.find(c => c.id === conversationId);
      expect(archivedInList).toBeUndefined();

      // Check list with archived included
      const listArchResponse = await request(app.getHttpServer())
        .get('/conversations?includeArchived=true')
        .set('x-user-id', 'user-arch')
        .expect(200);

      const archivedInList2 = listArchResponse.body.data.find(c => c.id === conversationId);
      expect(archivedInList2).toBeDefined();
    });
  });
});
