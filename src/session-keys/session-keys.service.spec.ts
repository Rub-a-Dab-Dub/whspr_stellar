import { Test, TestingModule } from '@nestjs/testing';
import { SessionKeysService } from './session-keys.service';

describe('SessionKeysService', () => {
  let service: SessionKeysService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionKeysService],
    }).compile();

    service = module.get<SessionKeysService>(SessionKeysService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
