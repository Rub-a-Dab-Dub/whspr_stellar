import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../dtos/api-error-response.dto';

export function ApiAuth() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiUnauthorizedResponse({
      description: 'Unauthorized',
      type: ApiErrorResponseDto,
    }),
  );
}
