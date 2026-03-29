import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class BulkPaymentStorageService {
  private readonly logger = new Logger(BulkPaymentStorageService.name);
  private s3Client: S3Client;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: this.configService.get('R2_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.get('R2_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get('R2_SECRET_ACCESS_KEY')!,
      },
    });
  }

  async uploadCsv(buffer: Buffer, filename: string = 'bulk-payment.csv'): Promise<string> {
    const key = `bulk-payments/${randomUUID()}/${Date.now()}-${filename}`;
    
    const command = new PutObjectCommand({
      Bucket: this.configService.get('R2_BUCKET')!,
      Key: key,
      Body: buffer,
      ContentType: 'text/csv',
      CacheControl: 'private, max-age=3600',
    });

    try {
      await this.s3Client.send(command);
      this.logger.log(`Uploaded bulk payment CSV to R2: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(`R2 upload failed: ${error}`);
      throw error;
    }
  }
}

