import { Test, TestingModule } from '@nestjs/testing';
import { LinkPreviewsController } from '../link-previews.controller';
import { LinkPreviewsService } from '../link-previews.service';
import { getPreviewDtoMock } from './mocks';
import { ValidationPipe } from '@nestjs/common';

describe('LinkPreviewsController', () => {
  let controller: LinkPreviewsController;
  let service: jest.Mocked<LinkPreviewsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LinkPreviewsController],
      providers: [LinkPreviewsService],
    })
      .pipe(ValidationPipe)
      .compile();

    controller = module.get<LinkPreviewsController>(LinkPreviewsController);
    service = module.get(LinkPreviewsService) as any;
  });

  it('should get preview', async () => {
    const dto = getPreviewDtoMock();
    const preview = { title: 'Test' };
    service.getPreview.mockResolvedValue(preview);
    expect(await controller.getPreview(dto)).toEqual(preview);
  });

  it('should queue previews', async () => {
    const dto = { messageId: 'msg1', urls: ['https://ex.com'] };
    service.queuePreviewUrls.mockResolvedValue([]);
    expect(await controller.queuePreviewUrls(dto)).toEqual([]);
  });
});
