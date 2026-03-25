import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('getInfo', () => {
    it('should return API info', () => {
      const result = {
        name: 'Gasless Gossip API',
        version: '1.0.0',
        description: 'Backend API for Gasless Gossip',
        docs: '/api/docs',
      };

      jest.spyOn(appService, 'getInfo').mockImplementation(() => result);

      expect(appController.getInfo()).toBe(result);
    });
  });
});
