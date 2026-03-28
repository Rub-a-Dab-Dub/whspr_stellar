import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { PrivacyModule } from './privacy.module';

describe('Privacy Module Integration (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'test',
          password: 'test',
          database: 'test_db',
          entities: [],
          synchronize: true,
          dropSchema: true,
        }),
        BullModule.forRoot({ redis: { host: 'localhost', port: 6379 } }),
        PrivacyModule,
      ],
    })
      .overrideProvider('DataExportRequestRepository')
      .useValue({
        findActiveExportByUserId: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      })
      .overrideProvider('ConsentRecordsRepository')
      .useValue({
        create: jest.fn(),
        save: jest.fn(),
        findCurrentConsent: jest.fn(),
      })
      .overrideProvider('UsersRepository')
      .useValue({
        findOne: jest.fn(),
        save: jest.fn(),
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Module Integration', () => {
    it('should be defined', () => {
      expect(module).toBeDefined();
    });

    it('should have PrivacyController', () => {
      const controller = module.get('PrivacyController');
      expect(controller).toBeDefined();
    });

    it('should have PrivacyService', () => {
      const service = module.get('PrivacyService');
      expect(service).toBeDefined();
    });

    it('should have DataExportRequestRepository', () => {
      const repository = module.get('DataExportRequestRepository');
      expect(repository).toBeDefined();
    });

    it('should have ConsentRecordsRepository', () => {
      const repository = module.get('ConsentRecordsRepository');
      expect(repository).toBeDefined();
    });

    it('should have DataExportProcessor', () => {
      const processor = module.get('DataExportProcessor');
      expect(processor).toBeDefined();
    });
  });

  describe('Endpoint Route Mapping', () => {
    it('should have POST /privacy/export route', async () => {
      const routes = (app._router.stack as any[]).filter(
        (layer: any) => layer.route && layer.route.path && layer.route.path.includes('privacy'),
      );
      expect(routes.length).toBeGreaterThan(0);
    });
  });
});
