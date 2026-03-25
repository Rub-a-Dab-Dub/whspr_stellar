import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Attachment } from './entities/attachment.entity';

@Injectable()
export class AttachmentsRepository extends Repository<Attachment> {
  constructor(private readonly dataSource: DataSource) {
    super(Attachment, dataSource.createEntityManager());
  }

  findById(id: string): Promise<Attachment | null> {
    return this.findOne({ where: { id } });
  }

  findByIdAndUploaderId(id: string, uploaderId: string): Promise<Attachment | null> {
    return this.findOne({ where: { id, uploaderId } });
  }
}
