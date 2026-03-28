import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { validate as isUuid } from 'uuid';
import { TranslationService } from '../services/translation.service';

@Injectable()
export class LocalizedParseUUIDPipe implements PipeTransform<string, string> {
  constructor(private readonly translationService: TranslationService) {}

  transform(value: string): string {
    if (!isUuid(value)) {
      throw new BadRequestException(this.translationService.translate('validation.uuid'));
    }

    return value;
  }
}
