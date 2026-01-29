import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransferTemplateService } from './transfer-template.service';
import { TransferTemplate } from '../entities/transfer-template.entity';
import { TransferValidationService } from './transfer-validation.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TransferTemplateService', () => {
  let service: TransferTemplateService;
  let repository: Repository<TransferTemplate>;
  let validationService: TransferValidationService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    increment: jest.fn(),
    update: jest.fn(),
  };

  const mockValidationService = {
    validateRecipient: jest.fn(),
    validateAmount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferTemplateService,
        {
          provide: getRepositoryToken(TransferTemplate),
          useValue: mockRepository,
        },
        {
          provide: TransferValidationService,
          useValue: mockValidationService,
        },
      ],
    }).compile();

    service = module.get<TransferTemplateService>(TransferTemplateService);
    repository = module.get<Repository<TransferTemplate>>(getRepositoryToken(TransferTemplate));
    validationService = module.get<TransferValidationService>(TransferValidationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTemplate', () => {
    it('should create a template successfully', async () => {
      const userId = 'user-uuid';
      const dto = {
        name: 'Monthly Rent',
        description: 'Rent payment template',
        recipientId: 'recipient-uuid',
        amount: 1000,
        memo: 'Rent',
        blockchainNetwork: 'stellar',
      };

      const mockTemplate = {
        id: 'template-uuid',
        userId,
        ...dto,
        amount: '1000.00000000',
        useCount: 0,
        isFavorite: false,
      };

      mockValidationService.validateRecipient.mockResolvedValue(undefined);
      mockValidationService.validateAmount.mockReturnValue(undefined);
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockTemplate);
      mockRepository.save.mockResolvedValue(mockTemplate);

      const result = await service.createTemplate(userId, dto);

      expect(result).toEqual(mockTemplate);
      expect(mockValidationService.validateRecipient).toHaveBeenCalledWith(dto.recipientId, userId);
      expect(mockValidationService.validateAmount).toHaveBeenCalledWith(dto.amount);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw error if template name already exists', async () => {
      const userId = 'user-uuid';
      const dto = {
        name: 'Monthly Rent',
        recipientId: 'recipient-uuid',
        amount: 1000,
      };

      mockValidationService.validateRecipient.mockResolvedValue(undefined);
      mockValidationService.validateAmount.mockReturnValue(undefined);
      mockRepository.findOne.mockResolvedValue({ id: 'existing-template' });

      await expect(service.createTemplate(userId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('toggleFavorite', () => {
    it('should toggle favorite status', async () => {
      const templateId = 'template-uuid';
      const userId = 'user-uuid';
      const mockTemplate = {
        id: templateId,
        userId,
        isFavorite: false,
      };

      mockRepository.findOne.mockResolvedValue(mockTemplate);
      mockRepository.save.mockResolvedValue({ ...mockTemplate, isFavorite: true });

      const result = await service.toggleFavorite(templateId, userId);

      expect(result.isFavorite).toBe(true);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('incrementUseCount', () => {
    it('should increment use count and update last used date', async () => {
      const templateId = 'template-uuid';

      mockRepository.increment.mockResolvedValue(undefined);
      mockRepository.update.mockResolvedValue(undefined);

      await service.incrementUseCount(templateId);

      expect(mockRepository.increment).toHaveBeenCalledWith(
        { id: templateId },
        'useCount',
        1,
      );
      expect(mockRepository.update).toHaveBeenCalled();
    });
  });
});
