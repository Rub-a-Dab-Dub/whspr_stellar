import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MessagesGateway } from '../src/messages/messages.gateway';
import { ContentType } from '../src/messages/message.entity';

class GatewayMock {
  emitted: any[] = [];
  emitNewMessage = (payload: any) => {
    this.emitted.push(payload);
  };
}

describe('Messages e2e', () => {
  let app: INestApplication;
  let gateway: GatewayMock;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MessagesGateway)
      .useClass(GatewayMock)
      .compile();

    gateway = moduleRef.get(MessagesGateway);
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, lists, edits and deletes messages with pagination', async () => {
    // create 3 messages
    for (let i = 0; i < 3; i += 1) {
      await request(app.getHttpServer())
        .post('/conversations/conv-1/messages')
        .set('x-user-id', 'user-1')
        .send({ content: `hello-${i}`, contentType: ContentType.TEXT })
        .expect(201);
    }

    // pagination first page (2 items)
    const page1 = await request(app.getHttpServer())
      .get('/conversations/conv-1/messages?limit=2')
      .expect(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.data[0].sentAt <= page1.body.data[1].sentAt).toBe(true);
    expect(page1.body.nextCursor).toBeDefined();

    // second page
    const page2 = await request(app.getHttpServer())
      .get(`/conversations/conv-1/messages?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
      .expect(200);
    expect(page2.body.data).toHaveLength(1);

    const firstMessageId = page1.body.data[0].id;

    // edit
    const edited = await request(app.getHttpServer())
      .patch(`/messages/${firstMessageId}`)
      .send({ content: 'edited' })
      .expect(200);
    expect(edited.body.isEdited).toBe(true);
    expect(edited.body.editedAt).toBeTruthy();

    // delete
    const deleted = await request(app.getHttpServer()).delete(`/messages/${firstMessageId}`).expect(200);
    expect(deleted.body.isDeleted).toBe(true);
    expect(deleted.body.content).toBeNull();

    // websocket mock emitted at least once
    expect(gateway.emitted.length).toBeGreaterThan(0);
  });
});
