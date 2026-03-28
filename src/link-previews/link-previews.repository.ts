import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LinkPreview } from './link-preview.entity';

@Injectable()
export class LinkPreviewsRepository {
  constructor(
    @InjectRepository(LinkPreview)
    private readonly repo: Repository<LinkPreview>,
  ) {}

  async savePreview(preview: Partial<LinkPreview>) {
    return this.repo.save(preview);
  }

  async findByUrl(url: string) {
    return this.repo.findOne({ where: { url } });
  }

  async findByUrlOrFail(url: string) {
    return this.repo.findOneOrFail({ where: { url } });
  }

  async updateByUrl(url: string, updates: Partial<LinkPreview>) {
    return this.repo.update({ where: { url } }, updates);
  }
}
