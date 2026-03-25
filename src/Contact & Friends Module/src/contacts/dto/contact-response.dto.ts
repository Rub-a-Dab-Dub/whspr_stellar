import { ContactStatus } from '../entities/contact.entity';

export class ContactResponseDto {
  id: string;
  ownerId: string;
  contactId: string;
  status: ContactStatus;
  label: string | null;
  createdAt: Date;

  constructor(partial: Partial<ContactResponseDto>) {
    Object.assign(this, partial);
  }
}

export class PaginatedContactsDto {
  data: ContactResponseDto[];
  total: number;
  page: number;
  limit: number;
}
