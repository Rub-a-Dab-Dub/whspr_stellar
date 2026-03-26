import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TranslationService } from '../../i18n/services/translation.service';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error?: string;
  stack?: string;
}

const RAW_ERROR_TRANSLATION_KEYS: Record<string, string> = {
  'Invalid credentials': 'errors.auth.invalidCredentials',
  'Invalid refresh token': 'errors.auth.invalidRefreshToken',
  'Refresh token mismatch': 'errors.auth.refreshTokenMismatch',
  'Token has been revoked': 'errors.auth.tokenRevoked',
  'User not found': 'errors.users.notFound',
  'Account is locked': 'errors.auth.accountLocked',
  'Account is banned': 'errors.auth.accountBanned',
  'Account is suspended': 'errors.auth.accountSuspended',
  'Email already exists': 'errors.users.emailAlreadyExists',
  'Invalid or expired verification token':
    'errors.auth.invalidOrExpiredVerificationToken',
  'Invalid or expired reset token': 'errors.auth.invalidOrExpiredResetToken',
  'Notification not found': 'errors.notifications.notFound',
  'Notification not found or already read':
    'errors.notifications.notFoundOrAlreadyRead',
  'New user registrations are currently disabled.':
    'errors.auth.registrationDisabled',
};

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly translationService: TranslationService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: this.getErrorMessage(exception),
    };

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse &&
        'error' in exceptionResponse
      ) {
        errorResponse.error = (exceptionResponse as { error?: string }).error;
      }
    } else {
      errorResponse.error = this.translationService.translate(
        'errors.common.internalServerError',
      );
    }

    if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
      errorResponse.stack = exception.stack;
    }

    response.status(status).json(errorResponse);
  }

  private getErrorMessage(exception: unknown): string | string[] {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return this.translateMaybeKey(response);
      }
      if (typeof response === 'object' && response && 'message' in response) {
        const message = (response as { message: string | string[] }).message;
        return Array.isArray(message)
          ? message.map((entry) => this.translateMaybeKey(entry))
          : this.translateMaybeKey(message);
      }
    }

    return this.translationService.translate(
      'errors.common.internalServerError',
    );
  }

  private translateMaybeKey(value: string): string {
    if (this.translationService.looksLikeTranslationKey(value)) {
      return this.translationService.translate(value);
    }

    const key = RAW_ERROR_TRANSLATION_KEYS[value];
    return key ? this.translationService.translate(key) : value;
  }
}
