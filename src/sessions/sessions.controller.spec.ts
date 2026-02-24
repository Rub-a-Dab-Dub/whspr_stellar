import { Test, TestingModule } from '@nestjs/testing';
import { SessionController } from './sessions.controller';
import { SessionService } from './services/sessions.service';

describe('SessionsController', () => {
  let controller: SessionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        {
          provide: SessionService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<SessionController>(SessionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
