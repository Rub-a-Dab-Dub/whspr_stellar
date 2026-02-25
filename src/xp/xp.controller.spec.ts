import { Test, TestingModule } from '@nestjs/testing';
import { XpController } from './xp.controller';
import { XpService } from './xp.service';

describe('XpController', () => {
  let controller: XpController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [XpController],
      providers: [XpService],
    }).compile();

    controller = module.get<XpController>(XpController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
