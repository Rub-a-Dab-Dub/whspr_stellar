import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { ContactImportController } from './contact-import.controller';
import { ContactImportService } from './contact-import.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const OWNER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TARGET = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const mockJwtGuard = {
  canActivate: (ctx: ExecutionContext) => {
    ctx.switchToHttp().getRequest().user = {
      sub: OWNER,
      username: 'alice',
    };
    return true;
  },
};

describe('ContactImportController (e2e)', () => {
  let app: INestApplication;
  let service: jest.Mocked<ContactImportService>;

  beforeAll(async () => {
    const serviceMock: Partial<jest.Mocked<ContactImportService>> = {
      importContacts: jest.fn(),
      getMatches: jest.fn(),
      addMatchedAsContact: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactImportController],
      providers: [{ provide: ContactImportService, useValue: serviceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    service = module.get(ContactImportService);
  });

  afterAll(() => app.close());

  describe('POST /contacts/import', () => {
    it('201 - imports contact list and returns matches', async () => {
      service.importContacts.mockResolvedValue({
        importedCount: 1,
        matchedCount: 1,
        matches: [{ userId: TARGET, username: 'bob', displayName: 'Bob', avatarUrl: null }],
      });

      await request(app.getHttpServer())
        .post('/contacts/import')
        .send({ contacts: [{ phone: '+15551234567' }] })
        .expect(201)
        .expect((res) => {
          expect(res.body.importedCount).toBe(1);
          expect(res.body.matches[0].userId).toBe(TARGET);
        });
    });

    it('400 - rejects payload with more than 500 contacts', async () => {
      const contacts = new Array(501).fill(null).map((_, idx) => ({ phone: `+1555000${idx}` }));
      await request(app.getHttpServer()).post('/contacts/import').send({ contacts }).expect(400);
    });
  });

  describe('GET /contacts/import/matches', () => {
    it('200 - returns matched user list', async () => {
      service.getMatches.mockResolvedValue([
        { userId: TARGET, username: 'bob', displayName: 'Bob', avatarUrl: null },
      ]);

      await request(app.getHttpServer())
        .get('/contacts/import/matches')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(1);
          expect(res.body[0].username).toBe('bob');
          expect(res.body[0].hash).toBeUndefined();
        });
    });
  });

  describe('POST /contacts/import/add-all', () => {
    it('201 - adds all currently matched users as contacts', async () => {
      service.addMatchedAsContact.mockResolvedValue({ totalMatched: 3, addedCount: 2 });

      await request(app.getHttpServer())
        .post('/contacts/import/add-all')
        .expect(201)
        .expect((res) => {
          expect(res.body.totalMatched).toBe(3);
          expect(res.body.addedCount).toBe(2);
        });
    });
  });
});
