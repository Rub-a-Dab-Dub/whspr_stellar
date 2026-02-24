import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinataSDK } from 'pinata';

interface MulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class PinataService {
  private readonly logger = new Logger(PinataService.name);
  private pinata: PinataSDK;
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly allowedFormats = ['image/jpeg', 'image/jpg', 'image/png'];

  constructor(private configService: ConfigService) {
    this.pinata = new PinataSDK({
      pinataJwt: this.configService.get<string>('pinata.jwt'),
      pinataGateway: this.configService.get<string>('pinata.gatewayUrl'),
    });
  }

  async uploadAvatar(file: MulterFile): Promise<{ cid: string; url: string }> {
    try {
      this.validateFile(file);

      const blob = new Blob([file.buffer]);
      const fileToUpload = new File([blob], file.originalname, {
        type: file.mimetype,
      });

      const upload = await (this.pinata as any).upload.file(fileToUpload);

      const gatewayUrl = this.configService.get<string>('pinata.gatewayUrl');
      const url = `https://${gatewayUrl}/ipfs/${upload.cid}`;

      this.logger.log(`Avatar uploaded successfully: ${upload.cid}`);

      return {
        cid: upload.cid,
        url,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to upload avatar: ${errorMessage}`);
      throw new BadRequestException('Failed to upload avatar to IPFS');
    }
  }

  async getFile(cid: string): Promise<Response> {
    try {
      const file = await (this.pinata as any).gateways.get(cid);
      return file;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retrieve file: ${errorMessage}`);
      throw new BadRequestException('Failed to retrieve file from IPFS');
    }
  }

  private validateFile(file: MulterFile): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum of ${this.maxFileSize / (1024 * 1024)}MB`,
      );
    }

    if (!this.allowedFormats.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file format. Allowed formats: ${this.allowedFormats.join(', ')}`,
      );
    }
  }
}
