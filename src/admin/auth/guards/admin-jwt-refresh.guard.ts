// src/admin/auth/guards/admin-jwt-refresh.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AdminJwtRefreshGuard extends AuthGuard('admin-jwt-refresh') { }
