import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Queue, Worker } from 'bullmq';
import { Repository } from 'typeorm';
import { Attachment } from '../attachments/entities/attachment.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import {
  ConversationExportFormat,
  ConversationExportJob,
  ConversationExportStatus,
} from './entities/conversation-export-job.entity';
import {
  ConversationExportGenerator,
  ConversationExportMessage,
} from './services/conversation-export.generator';

interface ExportWorkerJob {
  jobId: string;
}

const CONVERSATION_EXPORT_QUEUE = 'conversation-exports';
const EXPORT_JOB_NAME = 'generate-conversation-export';
const EXPORT_URL_TTL_SECONDS = 48 * 60 * 60;
const MAX_MESSAGES = 50000;

@Injectable()
export class ConversationExportService implements OnModuleDestroy {
  private readonly logger = new Logger(ConversationExportService.name);
  private readonly queue: Queue<ExportWorkerJob>;
  private readonly worker: Worker<ExportWorkerJob>;
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ConversationExportJob)
    private readonly exportJobsRepository: Repository<ConversationExportJob>,
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantsRepository: Repository<ConversationParticipant>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(Attachment)
    private readonly attachmentsRepository: Repository<Attachment>,
    private readonly generator: ConversationExportGenerator,
  ) {
    const connection = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: this.configService.get<number>('REDIS_DB', 0),
      maxRetriesPerRequest: null as number | null,
    };

    this.queue = new Queue<ExportWorkerJob>(CONVERSATION_EXPORT_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
    this.worker = new Worker<ExportWorkerJob>(
      CONVERSATION_EXPORT_QUEUE,
      async (job: { data: ExportWorkerJob }) => this.processExport(job.data.jobId),
      { connection },
    );

    const region = this.configService.get<string>('STORAGE_REGION', 'auto');
    const endpoint = this.configService.get<string>('STORAGE_ENDPOINT');
    const accessKeyId =
      this.configService.get<string>('STORAGE_ACCESS_KEY_ID') ||
      this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey =
      this.configService.get<string>('STORAGE_SECRET_ACCESS_KEY') ||
      this.configService.get<string>('S3_SECRET_ACCESS_KEY');

    this.s3Client = new S3Client({
      region,
      endpoint,
      forcePathStyle: this.configService.get<string>('STORAGE_PROVIDER') === 'r2',
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });

    this.bucket =
      this.configService.get<string>('STORAGE_BUCKET') ||
      this.configService.get<string>('S3_BUCKET') ||
      '';
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }

  async requestExport(
    userId: string,
    conversationId: string,
    format?: ConversationExportFormat,
  ): Promise<ConversationExportJob> {
    await this.ensureUserCanAccessConversation(userId, conversationId);

    const active = await this.findActiveJob(userId, conversationId);
    if (active) {
      throw new ConflictException('An active export job already exists for this conversation');
    }

    const job = this.exportJobsRepository.create({
      userId,
      conversationId,
      format: format ?? ConversationExportFormat.JSON,
      status: ConversationExportStatus.PENDING,
      fileUrl: null,
      fileKey: null,
      fileSize: null,
      completedAt: null,
      expiresAt: null,
    });

    const saved = await this.exportJobsRepository.save(job);

    await this.queue.add(
      EXPORT_JOB_NAME,
      { jobId: saved.id },
      {
        jobId: `conversation-export:${saved.id}`,
        timeout: 5 * 60 * 1000,
      },
    );

    return saved;
  }

  async getExportStatus(
    userId: string,
    conversationId: string,
    jobId: string,
  ): Promise<ConversationExportJob> {
    const job = await this.getOwnedJobOrThrow(userId, conversationId, jobId);

    if (
      job.status === ConversationExportStatus.READY &&
      job.expiresAt &&
      job.expiresAt <= new Date()
    ) {
      job.status = ConversationExportStatus.EXPIRED;
      job.fileUrl = null;
      await this.exportJobsRepository.save(job);
    }

    return job;
  }

  async downloadExport(
    userId: string,
    conversationId: string,
    jobId: string,
  ): Promise<ConversationExportJob> {
    const job = await this.getOwnedJobOrThrow(userId, conversationId, jobId);

    if (job.status !== ConversationExportStatus.READY) {
      throw new BadRequestException('Export is not ready yet');
    }

    if (!job.fileUrl || !job.expiresAt || job.expiresAt <= new Date()) {
      job.status = ConversationExportStatus.EXPIRED;
      job.fileUrl = null;
      await this.exportJobsRepository.save(job);
      throw new BadRequestException('Export link has expired. Request a new export');
    }

    return job;
  }

  async processExport(jobId: string): Promise<void> {
    const exportJob = await this.exportJobsRepository.findOne({ where: { id: jobId } });
    if (!exportJob) {
      this.logger.warn(`Conversation export job not found: ${jobId}`);
      return;
    }

    exportJob.status = ConversationExportStatus.PROCESSING;
    await this.exportJobsRepository.save(exportJob);

    try {
      const messages = await this.fetchConversationMessages(exportJob.conversationId);
      const payload = this.generator.generate(exportJob.conversationId, messages, exportJob.format);
      const fileKey = this.buildFileKey(exportJob.userId, exportJob.conversationId, exportJob.id, exportJob.format);

      await this.uploadFile(fileKey, payload, this.getMimeType(exportJob.format));
      const signed = await this.createDownloadUrl(fileKey, EXPORT_URL_TTL_SECONDS);

      exportJob.status = ConversationExportStatus.READY;
      exportJob.fileKey = fileKey;
      exportJob.fileUrl = signed.url;
      exportJob.fileSize = payload.byteLength;
      exportJob.completedAt = new Date();
      exportJob.expiresAt = signed.expiresAt;
      await this.exportJobsRepository.save(exportJob);
    } catch (error) {
      this.logger.error(`Failed processing conversation export ${jobId}: ${String(error)}`);
      exportJob.status = ConversationExportStatus.EXPIRED;
      exportJob.fileUrl = null;
      exportJob.fileKey = null;
      exportJob.fileSize = null;
      exportJob.completedAt = new Date();
      exportJob.expiresAt = new Date();
      await this.exportJobsRepository.save(exportJob);
      throw error;
    }
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();
    const expiredReadyJobs = await this.exportJobsRepository
      .createQueryBuilder('job')
      .where('job.status = :ready', { ready: ConversationExportStatus.READY })
      .andWhere('job.expiresAt IS NOT NULL')
      .andWhere('job.expiresAt <= :now', { now })
      .getMany();

    for (const job of expiredReadyJobs) {
      job.status = ConversationExportStatus.EXPIRED;
      job.fileUrl = null;
      await this.exportJobsRepository.save(job);
    }

    return expiredReadyJobs.length;
  }

  private async getOwnedJobOrThrow(
    userId: string,
    conversationId: string,
    jobId: string,
  ): Promise<ConversationExportJob> {
    const job = await this.exportJobsRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Export job not found');
    }

    if (job.userId !== userId || job.conversationId !== conversationId) {
      throw new ForbiddenException('Export job does not belong to this user or conversation');
    }

    return job;
  }

  private async ensureUserCanAccessConversation(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.conversationsRepository.findOne({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isParticipant = await this.participantsRepository.exist({
      where: { userId, conversationId },
    });

    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }
  }

  private async findActiveJob(userId: string, conversationId: string): Promise<ConversationExportJob | null> {
    const now = new Date();
    return this.exportJobsRepository
      .createQueryBuilder('job')
      .where('job.userId = :userId', { userId })
      .andWhere('job.conversationId = :conversationId', { conversationId })
      .andWhere(
        '(job.status IN (:...activeStatuses) OR (job.status = :readyStatus AND job.expiresAt > :now))',
        {
          activeStatuses: [ConversationExportStatus.PENDING, ConversationExportStatus.PROCESSING],
          readyStatus: ConversationExportStatus.READY,
          now,
        },
      )
      .orderBy('job.requestedAt', 'DESC')
      .getOne();
  }

  private async fetchConversationMessages(conversationId: string): Promise<ConversationExportMessage[]> {
    const messages: Message[] = await this.messagesRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: MAX_MESSAGES,
    });

    if (messages.length === 0) {
      return [];
    }

    const messageIds = messages.map((message: Message) => message.id);
    const attachments: Attachment[] = await this.attachmentsRepository
      .createQueryBuilder('attachment')
      .where('attachment.messageId IN (:...messageIds)', { messageIds })
      .orderBy('attachment.createdAt', 'ASC')
      .getMany();

    const byMessageId = new Map<string, Attachment[]>();
    for (const attachment of attachments) {
      const current = byMessageId.get(attachment.messageId) || [];
      current.push(attachment);
      byMessageId.set(attachment.messageId, current);
    }

    return messages.map((message: Message) => ({
      id: message.id,
      senderId: message.senderId,
      type: message.type,
      content: message.content,
      createdAt: message.createdAt,
      attachments: (byMessageId.get(message.id) || []).map((attachment: Attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        fileUrl: attachment.fileUrl,
      })),
    }));
  }

  private buildFileKey(
    userId: string,
    conversationId: string,
    exportJobId: string,
    format: ConversationExportFormat,
  ): string {
    const ext = format.toLowerCase();
    return `exports/conversations/${userId}/${conversationId}/${exportJobId}.${ext}`;
  }

  private getMimeType(format: ConversationExportFormat): string {
    if (format === ConversationExportFormat.TXT) {
      return 'text/plain; charset=utf-8';
    }
    if (format === ConversationExportFormat.HTML) {
      return 'text/html; charset=utf-8';
    }
    return 'application/json; charset=utf-8';
  }

  private async uploadFile(fileKey: string, body: Buffer, contentType: string): Promise<void> {
    if (!this.bucket) {
      throw new BadRequestException('Storage bucket is not configured');
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  private async createDownloadUrl(
    fileKey: string,
    expiresInSeconds: number,
  ): Promise<{ url: string; expiresAt: Date }> {
    if (!this.bucket) {
      throw new BadRequestException('Storage bucket is not configured');
    }

    const url = await getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      }),
      { expiresIn: expiresInSeconds },
    );

    return {
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }
}
