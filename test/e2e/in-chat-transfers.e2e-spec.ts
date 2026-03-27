import request from 'supertest';
import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import {
  Conversation,
  ConversationType,
} from '../../src/conversations/entities/conversation.entity';
import { ConversationParticipant } from '../../src/conversations/entities/conversation-participant.entity';
import { User } from '../../src/users/entities/user.entity';
import { Wallet } from '../../src/wallets/entities/wallet.entity';
import { Message, MessageType } from '../../src/messages/entities/message.entity';
import { AUTH_WALLETS } from './factories';
import {
  authenticateViaChallenge,
  createTestApp,
  getUserByWallet,
  truncateAllTables,
} from './setup/create-test-app';

describe('In-chat transfers (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(dataSource);
  });

  it('covers estimate -> preview -> confirm -> chat message creation', async () => {
    const senderAuth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);
    await authenticateViaChallenge(app, AUTH_WALLETS.secondary);

    const sender = await getUserByWallet(dataSource, AUTH_WALLETS.primary);
    const recipient = await getUserByWallet(dataSource, AUTH_WALLETS.secondary);

    expect(sender).not.toBeNull();
    expect(recipient).not.toBeNull();

    const userRepository = dataSource.getRepository(User);
    await userRepository.update({ id: recipient!.id }, { username: 'recipient_434' });
    await userRepository.update({ id: sender!.id }, { username: 'sender_434' });

    const conversation = await dataSource.getRepository(Conversation).save(
      dataSource.getRepository(Conversation).create({
        type: ConversationType.DIRECT,
        title: 'Transfer room',
      }),
    );

    await dataSource.getRepository(ConversationParticipant).save([
      { conversationId: conversation.id, userId: sender!.id },
      { conversationId: conversation.id, userId: recipient!.id },
    ]);

    await dataSource.getRepository(Wallet).save({
      userId: sender!.id,
      walletAddress: AUTH_WALLETS.primary,
      isPrimary: true,
      isVerified: true,
      label: 'sender primary',
    });

    await dataSource.getRepository(Wallet).save({
      userId: recipient!.id,
      walletAddress: AUTH_WALLETS.secondary,
      isPrimary: true,
      isVerified: true,
      label: 'recipient primary',
    });

    const estimate = await request(app.getHttpServer())
      .get('/api/transfers/estimate')
      .query({ asset: 'XLM', amount: 10, recipientCount: 1 })
      .set('Authorization', `Bearer ${senderAuth.accessToken}`)
      .expect(200);

    expect(estimate.body.feeEstimate).toEqual(expect.any(String));

    const preview = await request(app.getHttpServer())
      .post(`/api/conversations/${conversation.id}/transfers`)
      .set('Authorization', `Bearer ${senderAuth.accessToken}`)
      .send({ rawCommand: '/send @recipient_434 10 XLM' })
      .expect(201);

    expect(preview.body.transferId).toEqual(expect.any(String));

    const confirmed = await request(app.getHttpServer())
      .post(`/api/transfers/${preview.body.transferId}/confirm`)
      .set('Authorization', `Bearer ${senderAuth.accessToken}`)
      .expect(201);

    expect(confirmed.body.status).toMatch(/submitted|completed/i);

    const message = await dataSource
      .getRepository(Message)
      .findOne({ where: { conversationId: conversation.id, type: MessageType.TRANSFER } });

    expect(message).not.toBeNull();
  });
});
