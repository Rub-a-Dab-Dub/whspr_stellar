import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalDocument, LegalDocumentType } from './entities/legal-document.entity';
import { LegalDocumentsRepository } from './legal-document.repository';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
});

describe('LegalDocumentRepository', () => {
  let repo: LegalDocumentsRepository;
  let orm: jest.Mocked<Repository<LegalDocument>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LegalDocumentsRepository,
        { provide: getRepositoryToken(LegalDocument), useFactory: mockRepo },
      ],
    }).compile();

    repo = module.get(LegalDocumentsRepository);
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

  it('findActive queries by type and isActive', async () => {
    orm.findOne.mockResolvedValue(null);
    await repo.findActive(LegalDocumentType.TERMS);
    expect(orm.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: LegalDocumentType.TERMS, isActive: true },
      }),
    );
  });

  it('deactivateCurrent calls update with isActive=false', async () => {
    orm.update.mockResolvedValue({ affected: 1 } as any);
    await repo.deactivateCurrent(LegalDocumentType.TERMS);
    expect(orm.update).toHaveBeenCalledWith(
      { type: LegalDocumentType.TERMS, isActive: true },
      { isActive: false },
    );
  });
});
