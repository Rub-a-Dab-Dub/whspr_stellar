import { AuthGuard } from '@nestjs/passport';

export class AdminAuthGuard extends AuthGuard(['jwt', 'admin-api-key']) {}
