import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalDocument, LegalDocumentStatus, LegalDocumentType } from './entities/legal-document.entity';
import { LegalDocumentRepository } from './legal-document.repository';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
});

describe('LegalDocumentRepository', () => {
  let repo: LegalDocumentRepository;
  let orm: jest.Mocked<Repository<LegalDocument>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LegalDocumentRepository,
        { provide: getRepositoryToken(LegalDocument), useFactory: mockRepo },
      ],
    }).compile();

    repo = module.get(LegalDocumentRepository);
    orm = module.get(getRepositoryToken(LegalDocument));
  });

  it('delegates create to ORM', () => {
    orm.create.mockReturnValue({ id: 'x' } as any);
    expect(repo.create({ version: '1.0.0' })).toEqual({ id: 'x' });
  });

  it('delegates save to ORM', async () => {
    orm.save.mockResolvedValue({ id: 'x' } as any);
    expect(await repo.save({ id: 'x' } as any)).toEqual({ id: 'x' });
  });

  it('findActive queries by type and ACTIVE status', async () => {
    orm.findOne.mockResolvedValue(null);
    await repo.findActive(LegalDocumentType.TERMS_OF_SERVICE);
    expect(orm.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: LegalDocumentType.TERMS_OF_SERVICE, status: LegalDocumentStatus.ACTIVE },
      }),
    );
  });

  it('archiveActiveDocuments calls update with ARCHIVED status', async () => {
    orm.update.mockResolvedValue({ affected: 1 } as any);
    await repo.archiveActiveDocuments(LegalDocumentType.TERMS_OF_SERVICE);
    expect(orm.update).toHaveBeenCalledWith(
      { type: LegalDocumentType.TERMS_OF_SERVICE, status: LegalDocumentStatus.ACTIVE },
      { status: LegalDocumentStatus.ARCHIVED },
    );
  });
});
