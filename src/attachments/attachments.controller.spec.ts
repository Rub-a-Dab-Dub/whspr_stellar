import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { UserTier } from '../users/entities/user.entity';
import { UserResponseDto } from '../users/dto/user-response.dto';

describe('AttachmentsController', () => {
  let controller: AttachmentsController;
  let service: jest.Mocked<AttachmentsService>;

  const user: UserResponseDto = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'user',
    walletAddress: '0xabc',
    email: null,
    displayName: null,
    avatarUrl: null,
    bio: null,
    tier: UserTier.SILVER,
    isActive: true,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [
        {
          provide: AttachmentsService,
          useValue: {
            generateUploadUrl: jest.fn(),
            getAttachment: jest.fn(),
            deleteAttachment: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AttachmentsController);
    service = module.get(AttachmentsService);
  });

  it('presign delegates to service', async () => {
    service.generateUploadUrl.mockResolvedValue({
      uploadUrl: 'https://signed',
      fileKey: 'uploads/k',
      fileUrl: 'https://cdn/uploads/k',
      expiresIn: 300,
      expiresAt: new Date().toISOString(),
      maxAllowedFileSize: 10485760,
    });

    const result = await controller.presign(user, {
      messageId: '123e4567-e89b-12d3-a456-426614174111',
      fileName: 'a.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg',
    });

    expect(result.uploadUrl).toBe('https://signed');
    expect(service.generateUploadUrl).toHaveBeenCalled();
  });

  it('getAttachment delegates to service', async () => {
    service.getAttachment.mockResolvedValue({
      id: '123e4567-e89b-12d3-a456-426614174999',
      messageId: '123e4567-e89b-12d3-a456-426614174111',
      uploaderId: user.id,
      fileUrl: 'https://cdn/file',
      fileKey: 'uploads/file',
      fileName: 'file.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg',
      width: 10,
      height: 10,
      duration: null,
      createdAt: new Date(),
    });

    const result = await controller.getAttachment('123e4567-e89b-12d3-a456-426614174999');
    expect(result.fileName).toBe('file.jpg');
  });

  it('deleteAttachment delegates to service', async () => {
    service.deleteAttachment.mockResolvedValue(undefined);

    await controller.deleteAttachment('123e4567-e89b-12d3-a456-426614174999', user.id);

    expect(service.deleteAttachment).toHaveBeenCalledWith(
      '123e4567-e89b-12d3-a456-426614174999',
      user.id,
    );
  });
});
