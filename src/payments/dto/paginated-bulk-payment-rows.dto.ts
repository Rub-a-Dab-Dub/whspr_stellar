import { ApiProperty } from '@nestjs/swagger';
import { BulkPaymentRowDto } from './bulk-payment.dto';

export class PaginatedBulkPaymentRowsDto {
  @ApiProperty({ type: [BulkPaymentRowDto] })
  data: BulkPaymentRowDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

