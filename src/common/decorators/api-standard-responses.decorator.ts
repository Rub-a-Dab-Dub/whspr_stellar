import { applyDecorators } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../dtos/api-error-response.dto';

export function ApiStandardResponses(successDto: any) {
  return applyDecorators(
    ApiOkResponse({
      type: successDto,
    }),
    ApiBadRequestResponse({
      type: ApiErrorResponseDto,
    }),
    ApiInternalServerErrorResponse({
      type: ApiErrorResponseDto,
    }),
  );
}
