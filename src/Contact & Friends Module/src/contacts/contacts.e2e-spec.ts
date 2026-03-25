import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContactStatus } from './entities/contact.entity';
import { ContactResponseDto, PaginatedContactsDto } from './dto/contact-response.dto';

const OWNER  = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TARGET = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

/** Stub guard that injects a fixed user into request.user */
const mockJwtGuard = {
  canActivate: (ctx: ExecutionContext) => {
    ctx.switchToHttp().getRequest().user = { sub: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', username: 'alice' };
    return true;
  },
};

function makeDto(overrides: Partial<ContactResponseDto> = {}): ContactResponseDto {
  return new ContactResponseDto({
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    ownerId: OWNER,
    contactId: TARGET,
    status: ContactStatus.PENDING,
    label: null,
    createdAt: new Date(),
    ...overrides,
  });
}

describe('ContactsController (e2e)', () => {
  let app: INestApplication;
  let service: jest.Mocked<ContactsService>;

  beforeAll(async () => {
    const serviceMock: Partial<jest.Mocked<ContactsService>> = {
      addContact: jest.fn(),
      acceptContact: jest.fn(),
      removeContact: jest.fn(),
      blockUser: jest.fn(),
      unblockUser: jest.fn(),
      getContacts: jest.fn(),
      getBlockedUsers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [{ provide: ContactsService, useValue: serviceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    service = module.get(ContactsService);
  });

  afterAll(() => app.close());

  // ── POST /contacts ──────────────────────────────────────────────────────────

  describe('POST /contacts', () => {
    it('201 — creates a contact request', async () => {
      service.addContact.mockResolvedValue(makeDto());

      const res = await request(app.getHttpServer())
        .post('/contacts')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ contactId: TARGET }));

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(ContactStatus.PENDING);
    });

    it('400 — rejects invalid UUID body', async () => {
      await request(app.getHttpServer())
        .post('/contacts')
        .send({ contactId: 'not-a-uuid' })
        .expect(400);
    });
  });

  // ── GET /contacts ───────────────────────────────────────────────────────────

  describe('GET /contacts', () => {
    it('200 — returns paginated contacts', async () => {
      const paginated: PaginatedContactsDto = {
        data: [makeDto({ status: ContactStatus.ACCEPTED })],
        total: 1,
        page: 1,
        limit: 20,
      };
      service.getContacts.mockResolvedValue(paginated);

      await request(app.getHttpServer())
        .get('/contacts')
        .expect(200)
        .expect(res => {
          expect(res.body.total).toBe(1);
          expect(res.body.data[0].status).toBe(ContactStatus.ACCEPTED);
        });
    });

    it('200 — passes search param through to service', async () => {
      service.getContacts.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

      await request(app.getHttpServer())
        .get('/contacts?search=alice')
        .expect(200);

      expect(service.getContacts).toHaveBeenCalledWith(OWNER, 1, 20, 'alice');
    });
  });

  // ── GET /contacts/blocked ───────────────────────────────────────────────────

  describe('GET /contacts/blocked', () => {
    it('200 — returns blocked users', async () => {
      service.getBlockedUsers.mockResolvedValue([makeDto({ status: ContactStatus.BLOCKED })]);

      await request(app.getHttpServer())
        .get('/contacts/blocked')
        .expect(200)
        .expect(res => expect(res.body[0].status).toBe(ContactStatus.BLOCKED));
    });
  });

  // ── PATCH /contacts/:id/accept ──────────────────────────────────────────────

  describe('PATCH /contacts/:id/accept', () => {
    it('200 — accepts a contact request', async () => {
      service.acceptContact.mockResolvedValue(makeDto({ status: ContactStatus.ACCEPTED }));

      await request(app.getHttpServer())
        .patch(`/contacts/${TARGET}/accept`)
        .expect(200)
        .expect(res => expect(res.body.status).toBe(ContactStatus.ACCEPTED));
    });

    it('400 — rejects non-UUID param', async () => {
      await request(app.getHttpServer())
        .patch('/contacts/not-a-uuid/accept')
        .expect(400);
    });
  });

  // ── DELETE /contacts/:id ────────────────────────────────────────────────────

  describe('DELETE /contacts/:id', () => {
    it('204 — removes a contact', async () => {
      service.removeContact.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/contacts/${TARGET}`)
        .expect(204);
    });
  });

  // ── POST /contacts/:id/block ────────────────────────────────────────────────

  describe('POST /contacts/:id/block', () => {
    it('201 — blocks a user', async () => {
      service.blockUser.mockResolvedValue(makeDto({ status: ContactStatus.BLOCKED }));

      await request(app.getHttpServer())
        .post(`/contacts/${TARGET}/block`)
        .expect(201)
        .expect(res => expect(res.body.status).toBe(ContactStatus.BLOCKED));
    });
  });

  // ── DELETE /contacts/:id/block ──────────────────────────────────────────────

  describe('DELETE /contacts/:id/block', () => {
    it('204 — unblocks a user', async () => {
      service.unblockUser.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/contacts/${TARGET}/block`)
        .expect(204);
    });
  });
});
