import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { TranslationService } from '../services/translation.service';

@Injectable()
export class LocalizedValidationPipe implements PipeTransform {
  private readonly validationPipe: ValidationPipe;

  constructor(private readonly translationService: TranslationService) {
    this.validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException(this.formatValidationErrors(errors)),
    });
  }

  transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    return this.validationPipe.transform(value, metadata);
  }

  private formatValidationErrors(errors: ValidationError[]): string[] {
    return errors.flatMap((error) => [
      ...this.formatConstraints(error),
      ...this.formatValidationErrors(error.children ?? []),
    ]);
  }

  private formatConstraints(error: ValidationError): string[] {
    if (!error.constraints) {
      return [];
    }

    return Object.entries(error.constraints).map(([constraintName, rawMessage]) =>
      this.translateConstraint(error, constraintName, rawMessage),
    );
  }

  private translateConstraint(
    error: ValidationError,
    constraintName: string,
    rawMessage: string,
  ): string {
    if (constraintName === 'whitelistValidation') {
      return this.translationService.translate('validation.whitelist', {
        args: {
          property: error.property,
        },
      });
    }

    const { key, args } = this.parseMessage(rawMessage);
    if (!key) {
      return rawMessage;
    }

    return this.translationService.translate(key, {
      args: {
        property: error.property,
        value: error.value,
        ...args,
      },
    });
  }

  private parseMessage(
    rawMessage: string,
  ): { key: string | null; args: Record<string, unknown> } {
    const separatorIndex = rawMessage.indexOf('|');

    if (separatorIndex === -1) {
      return this.translationService.looksLikeTranslationKey(rawMessage)
        ? { key: rawMessage, args: {} }
        : { key: null, args: {} };
    }

    const key = rawMessage.slice(0, separatorIndex);
    const argsString = rawMessage.slice(separatorIndex + 1);

    try {
      return {
        key,
        args: JSON.parse(argsString),
      };
    } catch (error) {
      return {
        key,
        args: {},
      };
    }
  }
}
