import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AUTH_WALLETS } from './factories';
import {
  authenticateViaChallenge,
  createTestApp,
  truncateAllTables,
} from './setup/create-test-app';
import { MessageDraft } from '../../src/message-drafts/entities/message-draft.entity';
import { Conversation, ConversationType } from '../../src/conversations/entities/conversation.entity';

describe('Message Drafts (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let userId: string;
  let conversationId: string;
  let draftRepo: Repository<MessageDraft>;
  let convRepo: Repository<Conversation>;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    draftRepo = dataSource.getRepository(MessageDraft);
    convRepo = dataSource.getRepository(Conversation);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(dataSource);

    const auth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);
    accessToken = auth.accessToken;
    userId = auth.user.id;

    // Create a conversation to use in tests
    const conv = convRepo.create({ type: ConversationType.DIRECT, title: null, chainGroupId: null });
    const saved = await convRepo.save(conv);
    conversationId = saved.id;
  });

  it('PUT /conversations/:id/draft — saves a new draft', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/conversations/${conversationId}/draft`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'Hello from Device A' })
      .expect(200);

    expect(res.body.content).toBe('Hello from Device A');
    expect(res.body.userId).toBe(userId);
    expect(res.body.conversationId).toBe(conversationId);
  });

  it('PUT /conversations/:id/draft — upserts (updates existing draft)', async () => {
    await request(app.getHttpServer())
      .put(`/api/conversations/${conversationId}/draft`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'First version' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .put(`/api/conversations/${conversationId}/draft`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'Updated version' })
      .expect(200);

    expect(res.body.content).toBe('Updated version');

    // Only one row in DB
    const rows = await draftRepo.find({ where: { userId, conversationId } });
    expect(rows).toHaveLength(1);
  });

  it('GET /conversations/:id/draft — retrieves the saved draft', async () => {
    await request(app.getHttpServer())
      .put(`/api/conversations/${conversationId}/draft`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'Hello from Device A' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}/draft`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.content).toBe('Hello from Device A');
  });

  it('GET /drafts — returns all active drafts for the user', async () => {
    await request(app.getHttpServer())
      .put(`/api/conversations/${conversationId}/draft`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'Draft one' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/drafts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('Draft one');
  });

  it('DELETE /conversations/:id/draft — clears the draft', async () => {
    await request(app.getHttpServer())
      .put(`/api/conversations/${conversationId}/draft`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'To be deleted' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/conversations/${conversationId}/draft`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const row = await draftRepo.findOne({ where: { userId, conversationId } });
    expect(row).toBeNull();
  });

  it('auto-deletes draft when deleteDraftOnSend is called (simulates message send)', async () => {
    // Save draft on "Device A"
    await request(app.getHttpServer())
      .put(`/api/conversations/${conversationId}/draft`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'About to send this' })
      .expect(200);

    // Verify it exists
    const before = await draftRepo.findOne({ where: { userId, conversationId } });
    expect(before).not.toBeNull();

    // Simulate the MessagesService calling deleteDraftOnSend after a successful send
    const draftsService = app.get('MessageDraftsService', { strict: false });
    await draftsService.deleteDraftOnSend(userId, conversationId);

    // Verify it's gone
    const after = await draftRepo.findOne({ where: { userId, conversationId } });
    expect(after).toBeNull();
  });

  it('GET /conversations/:id/draft — returns 404 when no draft exists', async () => {
    await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}/draft`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});
