import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { SocialAccount } from './entities/social-account.entity';
import { SocialAuthService } from './services/social-auth.service';
import { SocialAuthController } from './social-auth.controller';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { TwitterStrategy } from './strategies/twitter.strategy';
import { UsersModule } from '../../users/users.module';
import { AuthModule } from '../auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SocialAccount]),
    ConfigModule,
    UsersModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [SocialAuthController],
  providers: [
    SocialAuthService,
    GoogleStrategy,
    GithubStrategy,
    TwitterStrategy,
  ],
  exports: [SocialAuthService],
})
export class SocialAuthModule {}
