import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getInfo', () => {
    it('should return API information', () => {
      const info = service.getInfo();

      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('description');
      expect(info).toHaveProperty('docs');
      expect(info.name).toBe('Gasless Gossip API');
      expect(info.version).toBe('1.0.0');
      expect(info.docs).toBe('/api/docs');
    });
  });
});
