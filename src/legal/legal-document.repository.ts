import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalDocument, LegalDocumentType } from './entities/legal-document.entity';

@Injectable()
export class LegalDocumentsRepository {
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
      where: { type, isActive: true },
      order: { effectiveDate: 'DESC' },
    });
  }

  async findAllActive(): Promise<LegalDocument[]> {
    return this.repo.find({
      where: { isActive: true },
      order: { type: 'ASC', effectiveDate: 'DESC' },
    });
  }

  async findByTypeAndVersion(type: LegalDocumentType, version: string): Promise<LegalDocument | null> {
    return this.repo.findOne({ where: { type, version } });
  }

  async deactivateCurrent(type: LegalDocumentType): Promise<void> {
    await this.repo.update(
      { type, isActive: true },
      { isActive: false },
    );
  }
}

// Backward-compatible alias used by existing imports.
export { LegalDocumentsRepository as LegalDocumentRepository };
