import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransferTemplate } from '../entities/transfer-template.entity';
import { CreateTransferTemplateDto } from '../dto/create-transfer-template.dto';
import { TransferValidationService } from './transfer-validation.service';

@Injectable()
export class TransferTemplateService {
  private readonly logger = new Logger(TransferTemplateService.name);

  constructor(
    @InjectRepository(TransferTemplate)
    private readonly templateRepository: Repository<TransferTemplate>,
    private readonly validationService: TransferValidationService,
  ) {}

  async createTemplate(
    userId: string,
    dto: CreateTransferTemplateDto,
  ): Promise<TransferTemplate> {
    // Validate recipient
    await this.validationService.validateRecipient(dto.recipientId, userId);

    // Validate amount
    this.validationService.validateAmount(dto.amount);

    // Check if template name already exists for this user
    const existing = await this.templateRepository.findOne({
      where: { userId, name: dto.name },
    });

    if (existing) {
      throw new BadRequestException('Template with this name already exists');
    }

    const template = this.templateRepository.create({
      userId,
      name: dto.name,
      description: dto.description,
      recipientId: dto.recipientId,
      amount: dto.amount.toFixed(8),
      memo: dto.memo,
      note: dto.note,
      blockchainNetwork: dto.blockchainNetwork || 'stellar',
    });

    return await this.templateRepository.save(template);
  }

  async getTemplates(userId: string): Promise<TransferTemplate[]> {
    return await this.templateRepository.find({
      where: { userId },
      order: { isFavorite: 'DESC', lastUsedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async getTemplateById(templateId: string, userId: string): Promise<TransferTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id: templateId, userId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async updateTemplate(
    templateId: string,
    userId: string,
    dto: Partial<CreateTransferTemplateDto>,
  ): Promise<TransferTemplate> {
    const template = await this.getTemplateById(templateId, userId);

    if (dto.recipientId) {
      await this.validationService.validateRecipient(dto.recipientId, userId);
      template.recipientId = dto.recipientId;
    }

    if (dto.amount) {
      this.validationService.validateAmount(dto.amount);
      template.amount = dto.amount.toFixed(8);
    }

    if (dto.name) template.name = dto.name;
    if (dto.description !== undefined) template.description = dto.description;
    if (dto.memo !== undefined) template.memo = dto.memo;
    if (dto.note !== undefined) template.note = dto.note;
    if (dto.blockchainNetwork) template.blockchainNetwork = dto.blockchainNetwork;

    return await this.templateRepository.save(template);
  }

  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    const template = await this.getTemplateById(templateId, userId);
    await this.templateRepository.remove(template);
  }

  async toggleFavorite(templateId: string, userId: string): Promise<TransferTemplate> {
    const template = await this.getTemplateById(templateId, userId);
    template.isFavorite = !template.isFavorite;
    return await this.templateRepository.save(template);
  }

  async incrementUseCount(templateId: string): Promise<void> {
    await this.templateRepository.increment(
      { id: templateId },
      'useCount',
      1,
    );
    await this.templateRepository.update(
      { id: templateId },
      { lastUsedAt: new Date() },
    );
  }

  async getFavorites(userId: string): Promise<TransferTemplate[]> {
    return await this.templateRepository.find({
      where: { userId, isFavorite: true },
      order: { lastUsedAt: 'DESC', createdAt: 'DESC' },
    });
  }
}
