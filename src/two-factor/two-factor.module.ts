import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { TwoFactorSecret } from './entities/two-factor-secret.entity';
import { TwoFactorAuthGuard } from './guards/two-factor-auth.guard';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TwoFactorSecret]),
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [TwoFactorController],
  providers: [TwoFactorService, TwoFactorAuthGuard],
  exports: [TwoFactorService, TwoFactorAuthGuard],
})
export class TwoFactorModule {}
