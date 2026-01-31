import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { create } from 'ipfs-http-client';

@Injectable()
export class IpfsStorageService {
  private readonly logger = new Logger(IpfsStorageService.name);
  private ipfs;

  constructor(private configService: ConfigService) {
    const ipfsUrl = this.configService.get<string>('IPFS_NODE_URL') || 'http://localhost:5001';
    try {
        this.ipfs = create({ url: ipfsUrl });
    } catch (error) {
        this.logger.error('Failed to connect to IPFS node', error);
    }
  }

  async upload(buffer: Buffer): Promise<{ path: string; size: number }> {
    try {
      const result = await this.ipfs.add(buffer);
      this.logger.log(`File uploaded to IPFS: ${result.path}`);
      return {
        path: result.path,
        size: result.size,
      };
    } catch (error) {
      this.logger.error('Error uploading to IPFS', error);
      throw error;
    }
  }

  getGatewayUrl(cid: string): string {
    const gateway = this.configService.get<string>('IPFS_GATEWAY_URL') || 'https://ipfs.io/ipfs/';
    return `${gateway}${cid}`;
  }
}
