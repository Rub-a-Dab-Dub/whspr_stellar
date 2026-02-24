export interface ErrorResponseDto {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string | string[];
  timestamp: string;
  path: string;
  errors?: Record<string, any>;
  stack?: string;
}
