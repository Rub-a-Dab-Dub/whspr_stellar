import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID') || 'dummy',
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET') || 'dummy',
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL') || 'http://localhost:3000/auth/social/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile, done: (err: any, user: any, info?: any) => void) {
    // Return profile and tokens so the controller can pass them to the service
    done(null, profile, { accessToken, refreshToken });
  }
}
