import { Test, TestingModule } from '@nestjs/testing';
import { MaintainanceController } from './maintainance.controller';
import { MaintainanceService } from './maintainance.service';

describe('MaintainanceController', () => {
  let controller: MaintainanceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaintainanceController],
      providers: [MaintainanceService],
    }).compile();

    controller = module.get<MaintainanceController>(MaintainanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
