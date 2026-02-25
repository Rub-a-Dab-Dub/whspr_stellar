import { Test, TestingModule } from '@nestjs/testing';
import { SessionKeysController } from './session-keys.controller';
import { SessionKeysService } from './session-keys.service';

describe('SessionKeysController', () => {
  let controller: SessionKeysController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionKeysController],
      providers: [SessionKeysService],
    }).compile();

    controller = module.get<SessionKeysController>(SessionKeysController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
