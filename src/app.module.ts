// Unit tests stub
import { Test, TestingModule } from '@nestjs/testing';
import { CommandFrameworkService } from '../command-framework.service';

describe('CommandFrameworkService', () => {
  let service: CommandFrameworkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommandFrameworkService],
    }).compile();

    service = module.get<CommandFrameworkService>(CommandFrameworkService);
  });

  it('should parse command', () => {
    expect(service.parseCommand('/help')).toBeDefined();
  });
  // TODO: full coverage >85%
});
