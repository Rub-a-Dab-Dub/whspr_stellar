import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinataSDK } from 'pinata';

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private pinata: PinataSDK;

  constructor(private configService: ConfigService) {
    this.pinata = new PinataSDK({
      pinataJwt: this.configService.get<string>('PINATA_JWT'),
      pinataGateway: this.configService.get<string>('PINATA_GATEWAY'),
    });
  }

  async uploadFile(buffer: Buffer, filename: string): Promise<string> {
    try {
      const file = new File([buffer], filename);
      const upload = await this.pinata.upload.file(file);
      return upload.IpfsHash;
    } catch (error) {
      this.logger.error('Failed to upload to IPFS', error);
      throw new Error('IPFS upload failed');
    }
  }

  async unpinFile(hash: string): Promise<void> {
    try {
      await this.pinata.unpin([hash]);
    } catch (error) {
      this.logger.warn(`Failed to unpin ${hash}`, error);
    }
  }

  getGatewayUrl(hash: string): string {
    const gateway = this.configService.get<string>('PINATA_GATEWAY');
    return `https://${gateway}/ipfs/${hash}`;
  }
}