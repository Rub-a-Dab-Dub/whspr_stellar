import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Arweave from 'arweave';

@Injectable()
export class ArweaveStorageService {
  private readonly logger = new Logger(ArweaveStorageService.name);
  private arweave: Arweave;
  private jwk: any;

  constructor(private configService: ConfigService) {
    this.arweave = Arweave.init({
      host: 'arweave.net',
      port: 443,
      protocol: 'https',
    });

    // In a real scenario, we might load the keyfile from a secret or path
    // For now, we will assume it's passed via ENV as a JSON string or handled differently
    // This is a placeholder for the actual key loading logic
    const key = this.configService.get<string>('ARWEAVE_KEY');
    if (key) {
        try {
            this.jwk = JSON.parse(key);
        } catch (e) {
            this.logger.warn('Invalid Arweave Key format');
        }
    }
  }

  async upload(buffer: Buffer, mimeType: string): Promise<{ id: string }> {
    if (!this.jwk) {
        this.logger.warn('No Arweave key found. Cannot upload.');
        throw new Error('Arweave wallet not configured');
    }

    try {
      const transaction = await this.arweave.createTransaction({
        data: buffer,
      }, this.jwk);

      transaction.addTag('Content-Type', mimeType);

      await this.arweave.transactions.sign(transaction, this.jwk);

      const response = await this.arweave.transactions.post(transaction);

      if (response.status === 200 || response.status === 208) {
          this.logger.log(`File uploaded to Arweave: ${transaction.id}`);
          return { id: transaction.id };
      } else {
          throw new Error(`Arweave upload failed with status: ${response.status}`);
      }

    } catch (error) {
      this.logger.error('Error uploading to Arweave', error);
      throw error;
    }
  }

  getGatewayUrl(id: string): string {
      return `https://arweave.net/${id}`;
  }
}
