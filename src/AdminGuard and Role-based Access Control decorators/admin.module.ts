import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AdminController } from './admin.controller';
import { AdminGuard } from './guards/admin.guard';
import { AdminRolesGuard } from './guards/admin-roles.guard';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'admin-jwt' }),
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET || 'admin-secret',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AdminController],
  providers: [AdminGuard, AdminRolesGuard, AdminJwtStrategy],
  exports: [AdminGuard, AdminRolesGuard],
})
export class AdminModule {}
