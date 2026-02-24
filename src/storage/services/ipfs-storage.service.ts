import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type IpfsAddResult = {
  path?: string;
  cid?: { toString(): string };
  size: number;
};

type IpfsClient = {
  add(data: Buffer): Promise<IpfsAddResult>;
};

@Injectable()
export class IpfsStorageService {
  private readonly logger = new Logger(IpfsStorageService.name);
  private ipfs: IpfsClient | null = null;

  constructor(private configService: ConfigService) {
    const ipfsUrl =
      this.configService.get<string>('IPFS_NODE_URL') ||
      'http://localhost:5001';
    try {
      // Lazy-require keeps tests running when ipfs-http-client is not installed.
      const { create } = require('ipfs-http-client') as {
        create: (options: { url: string }) => IpfsClient;
      };
      this.ipfs = create({ url: ipfsUrl });
    } catch (error) {
      this.logger.error('Failed to connect to IPFS node', error);
    }
  }

  async upload(buffer: Buffer): Promise<{ path: string; size: number }> {
    if (!this.ipfs) {
      throw new Error('IPFS client is not initialized');
    }

    try {
      const result = await this.ipfs.add(buffer);
      const path = result.path ?? result.cid?.toString() ?? '';
      this.logger.log(`File uploaded to IPFS: ${path}`);
      return {
        path,
        size: result.size,
      };
    } catch (error) {
      this.logger.error('Error uploading to IPFS', error);
      throw error;
    }
  }

  getGatewayUrl(cid: string): string {
    const gateway =
      this.configService.get<string>('IPFS_GATEWAY_URL') ||
      'https://ipfs.io/ipfs/';
    return `${gateway}${cid}`;
  }
}
