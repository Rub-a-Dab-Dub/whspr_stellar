import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AuthGuard } = require('@nestjs/passport');

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
