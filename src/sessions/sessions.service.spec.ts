import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from './services/sessions.service';

describe('SessionsService', () => {
  let service: SessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: SessionService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
