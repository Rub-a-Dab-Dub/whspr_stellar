import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { Attachment } from '../attachments/entities/attachment.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { ConversationExportService } from './conversation-export.service';
import {
  ConversationExportFormat,
  ConversationExportJob,
  ConversationExportStatus,
} from './entities/conversation-export-job.entity';
import {
  ConversationExportGenerator,
  ConversationExportMessage,
} from './services/conversation-export.generator';

const mockQueueAdd = jest.fn();
const mockQueueClose = jest.fn();
const mockWorkerClose = jest.fn();
const mockS3Send = jest.fn();
const mockGetSignedUrl = jest.fn();
let capturedWorkerProcessor:
  | ((job: { data: { jobId: string } }) => Promise<void>)
  | null = null;

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
  })),
  Worker: jest.fn().mockImplementation((_name: string, processor: any) => {
    capturedWorkerProcessor = processor;
    return {
      close: mockWorkerClose,
    };
  }),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockS3Send,
  })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => input),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => input),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

describe('ConversationExportService', () => {
  let service: ConversationExportService;
  let exportJobsRepository: any;
  let conversationsRepository: any;
  let participantsRepository: any;
  let messagesRepository: any;
  let attachmentsRepository: any;
  let generator: jest.Mocked<ConversationExportGenerator>;

  beforeEach(async () => {
    capturedWorkerProcessor = null;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationExportService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
              const config: Record<string, unknown> = {
                STORAGE_BUCKET: 'test-bucket',
              };
              return config[key] ?? fallback;
            }),
          },
        },
        {
          provide: getRepositoryToken(ConversationExportJob),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Conversation),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ConversationParticipant),
          useValue: {
            exist: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Attachment),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: ConversationExportGenerator,
          useValue: {
            generate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ConversationExportService);
    exportJobsRepository = moduleRef.get(getRepositoryToken(ConversationExportJob));
    conversationsRepository = moduleRef.get(getRepositoryToken(Conversation));
    participantsRepository = moduleRef.get(getRepositoryToken(ConversationParticipant));
    messagesRepository = moduleRef.get(getRepositoryToken(Message));
    attachmentsRepository = moduleRef.get(getRepositoryToken(Attachment));
    generator = moduleRef.get(ConversationExportGenerator);

    mockQueueAdd.mockReset();
    mockQueueClose.mockReset();
    mockWorkerClose.mockReset();
    mockS3Send.mockReset();
    mockGetSignedUrl.mockReset();

    exportJobsRepository.create.mockReset();
    exportJobsRepository.save.mockReset();
    exportJobsRepository.findOne.mockReset();
    exportJobsRepository.createQueryBuilder.mockReset();
    conversationsRepository.findOne.mockReset();
    participantsRepository.exist.mockReset();
    messagesRepository.find.mockReset();
    attachmentsRepository.createQueryBuilder.mockReset();
    generator.generate.mockReset();
  });

  it('creates and queues a new export job', async () => {
    conversationsRepository.findOne.mockResolvedValue({ id: 'conv-1' });
    participantsRepository.exist.mockResolvedValue(true);
    exportJobsRepository.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

    const created = {
      userId: 'user-1',
      conversationId: 'conv-1',
      format: ConversationExportFormat.JSON,
      status: ConversationExportStatus.PENDING,
    };
    exportJobsRepository.create.mockReturnValue(created);
    exportJobsRepository.save.mockResolvedValue({
      ...created,
      id: 'job-1',
      requestedAt: new Date('2026-03-28T10:00:00.000Z'),
    });

    const result = await service.requestExport('user-1', 'conv-1', ConversationExportFormat.JSON);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'generate-conversation-export',
      { jobId: 'job-1' },
      { jobId: 'conversation-export:job-1', timeout: 300000 },
    );
    expect(result.id).toBe('job-1');
  });

  it('rejects when an active export already exists', async () => {
    conversationsRepository.findOne.mockResolvedValue({ id: 'conv-1' });
    participantsRepository.exist.mockResolvedValue(true);
    exportJobsRepository.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'active-job' }),
    });

    await expect(
      service.requestExport('user-1', 'conv-1', ConversationExportFormat.TXT),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns status for owned job and expires stale READY jobs', async () => {
    exportJobsRepository.findOne.mockResolvedValue({
      id: 'job-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      status: ConversationExportStatus.READY,
      format: ConversationExportFormat.HTML,
      fileUrl: 'https://signed',
      expiresAt: new Date('2026-03-27T10:00:00.000Z'),
    });
    exportJobsRepository.save.mockImplementation(async (job: any) => job);

    const result = await service.getExportStatus('user-1', 'conv-1', 'job-1');

    expect(result.status).toBe(ConversationExportStatus.EXPIRED);
    expect(result.fileUrl).toBeNull();
  });

  it('rejects status lookup when job ownership does not match', async () => {
    exportJobsRepository.findOne.mockResolvedValue({
      id: 'job-1',
      userId: 'other',
      conversationId: 'conv-1',
    });

    await expect(service.getExportStatus('user-1', 'conv-1', 'job-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns download details for READY non-expired job', async () => {
    const expiresAt = new Date('2099-03-28T10:00:00.000Z');
    exportJobsRepository.findOne.mockResolvedValue({
      id: 'job-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      status: ConversationExportStatus.READY,
      format: ConversationExportFormat.JSON,
      fileUrl: 'https://signed-url',
      fileSize: 123,
      expiresAt,
    });

    const result = await service.downloadExport('user-1', 'conv-1', 'job-1');

    expect(result.fileUrl).toBe('https://signed-url');
    expect(result.expiresAt).toBe(expiresAt);
  });

  it('worker processes export and uploads generated file', async () => {
    expect(capturedWorkerProcessor).toBeTruthy();

    exportJobsRepository.findOne.mockResolvedValue({
      id: 'job-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      format: ConversationExportFormat.JSON,
      status: ConversationExportStatus.PENDING,
    });
    exportJobsRepository.save.mockImplementation(async (job: any) => job);

    const messages: ConversationExportMessage[] = [
      {
        id: 'msg-1',
        senderId: 'user-1',
        type: 'text',
        content: 'hello',
        createdAt: new Date('2026-03-28T10:00:00.000Z'),
        attachments: [
          {
            id: 'att-1',
            fileName: 'a.png',
            mimeType: 'image/png',
            fileSize: 42,
            fileUrl: 'https://cdn/a.png',
          },
        ],
      },
    ];
    messagesRepository.find.mockResolvedValue([
      {
        id: 'msg-1',
        senderId: 'user-1',
        type: 'text',
        content: 'hello',
        createdAt: new Date('2026-03-28T10:00:00.000Z'),
      },
    ]);
    attachmentsRepository.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'att-1',
          messageId: 'msg-1',
          fileName: 'a.png',
          mimeType: 'image/png',
          fileSize: 42,
          fileUrl: 'https://cdn/a.png',
          createdAt: new Date('2026-03-28T10:00:00.000Z'),
        },
      ]),
    });
    generator.generate.mockImplementation(() => Buffer.from(JSON.stringify(messages), 'utf8'));
    mockS3Send.mockResolvedValue({});
    mockGetSignedUrl.mockResolvedValue('https://signed-export-url');

    await capturedWorkerProcessor!({ data: { jobId: 'job-1' } });

    expect(generator.generate).toHaveBeenCalled();
    expect(mockS3Send).toHaveBeenCalled();
    expect(exportJobsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job-1',
        status: ConversationExportStatus.READY,
        fileUrl: 'https://signed-export-url',
      }),
    );
  });

  it('cleanup marks expired READY jobs as EXPIRED', async () => {
    exportJobsRepository.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'job-1',
          status: ConversationExportStatus.READY,
          fileUrl: 'https://signed',
        },
      ]),
    });
    exportJobsRepository.save.mockImplementation(async (job: any) => job);

    const cleaned = await service.cleanupExpired();

    expect(cleaned).toBe(1);
    expect(exportJobsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job-1',
        status: ConversationExportStatus.EXPIRED,
        fileUrl: null,
      }),
    );
  });

  it('closes queue resources on module destroy', async () => {
    await service.onModuleDestroy();

    expect(mockWorkerClose).toHaveBeenCalled();
    expect(mockQueueClose).toHaveBeenCalled();
  });

  it('sets default format when undefined', async () => {
    conversationsRepository.findOne.mockResolvedValue({ id: 'conv-1' });
    participantsRepository.exist.mockResolvedValue(true);
    exportJobsRepository.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });
    exportJobsRepository.create.mockImplementation((payload: any) => payload);
    exportJobsRepository.save.mockImplementation(async (payload: any) => ({
      ...payload,
      id: 'job-default',
      requestedAt: new Date(),
    }));

    await service.requestExport('user-1', 'conv-1', undefined as unknown as ConversationExportFormat);

    expect(exportJobsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ format: ConversationExportFormat.JSON }),
    );
  });

  it('uses configured queue name and worker wiring', () => {
    expect(Queue).toHaveBeenCalled();
    expect(capturedWorkerProcessor).toBeTruthy();
  });
});
