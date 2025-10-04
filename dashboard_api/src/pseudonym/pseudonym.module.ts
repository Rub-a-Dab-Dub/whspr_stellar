import { Module } from '@nestjs/common';
import { PseudonymService } from './pseudonym.service';
import { PseudonymController } from './pseudonym.controller';

@Module({
  controllers: [PseudonymController],
  providers: [PseudonymService],
})
export class PseudonymModule {}
