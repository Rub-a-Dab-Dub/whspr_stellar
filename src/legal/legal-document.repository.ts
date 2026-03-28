import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalDocument, LegalDocumentStatus, LegalDocumentType } from './entities/legal-document.entity';

@Injectable()
export class LegalDocumentRepository {
  constructor(
    @InjectRepository(LegalDocument)
    private readonly repo: Repository<LegalDocument>,
  ) {}

  create(data: Partial<LegalDocument>): LegalDocument {
    return this.repo.create(data);
  }

  async save(doc: LegalDocument): Promise<LegalDocument> {
    return this.repo.save(doc);
  }

  async findById(id: string): Promise<LegalDocument | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findActive(type: LegalDocumentType): Promise<LegalDocument | null> {
    return this.repo.findOne({
      where: { type, status: LegalDocumentStatus.ACTIVE },
      order: { publishedAt: 'DESC' },
    });
  }

  async findAllActive(): Promise<LegalDocument[]> {
    return this.repo.find({
      where: { status: LegalDocumentStatus.ACTIVE },
      order: { type: 'ASC', publishedAt: 'DESC' },
    });
  }

  async findByTypeAndVersion(type: LegalDocumentType, version: string): Promise<LegalDocument | null> {
    return this.repo.findOne({ where: { type, version } });
  }

  async archiveActiveDocuments(type: LegalDocumentType): Promise<void> {
    await this.repo.update(
      { type, status: LegalDocumentStatus.ACTIVE },
      { status: LegalDocumentStatus.ARCHIVED },
    );
  }
}
