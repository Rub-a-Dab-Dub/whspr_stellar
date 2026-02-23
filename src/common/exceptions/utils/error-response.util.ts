import { ErrorResponseDto } from '../dtos/error-response.dto';

export function formatErrorResponse(params: {
  statusCode: number;
  errorCode: string;
  message: string | string[];
  path: string;
  errors?: any;
  stack?: string;
}): ErrorResponseDto {
  return {
    success: false,
    statusCode: params.statusCode,
    errorCode: params.errorCode,
    message: params.message,
    timestamp: new Date().toISOString(),
    path: params.path,
    errors: params.errors,
    stack: process.env.NODE_ENV === 'production' ? undefined : params.stack,
  };
}
