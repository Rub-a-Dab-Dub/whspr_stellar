import { Test, TestingModule } from '@nestjs/testing';
import { MaintainanceService } from './maintainance.service';

describe('MaintainanceService', () => {
  let service: MaintainanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MaintainanceService],
    }).compile();

    service = module.get<MaintainanceService>(MaintainanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
