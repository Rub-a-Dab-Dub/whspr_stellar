import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as sharp from 'sharp';
import { User } from '../entities/user.entity';
import { IpfsService } from './ipfs.service';

@Injectable()
export class AvatarService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private ipfsService: IpfsService,
  ) {}

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<{ avatarUrl: string; ipfsHash: string }> {
    this.validateFile(file);
    
    const resizedBuffer = await this.resizeImage(file.buffer);
    const ipfsHash = await this.ipfsService.uploadFile(resizedBuffer, `avatar-${userId}.webp`);
    const avatarUrl = this.ipfsService.getGatewayUrl(ipfsHash);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    if (user.avatarIpfsHash) {
      await this.ipfsService.unpinFile(user.avatarIpfsHash);
    }

    await this.userRepository.update(userId, {
      avatarUrl,
      avatarIpfsHash: ipfsHash,
    });

    return { avatarUrl, ipfsHash };
  }

  private validateFile(file: Express.Multer.File): void {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, and WebP are allowed');
    }

    if (file.size > maxSize) {
      throw new BadRequestException('File too large. Maximum size is 5MB');
    }
  }

  private async resizeImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();
  }
}