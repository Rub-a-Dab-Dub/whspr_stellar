import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-twitter';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
  constructor(configService: ConfigService) {
    super({
      consumerKey: configService.get<string>('TWITTER_CONSUMER_KEY') || 'dummy',
      consumerSecret: configService.get<string>('TWITTER_CONSUMER_SECRET') || 'dummy',
      callbackURL: configService.get<string>('TWITTER_CALLBACK_URL') || 'http://localhost:3000/auth/social/twitter/callback',
      includeEmail: true,
    });
  }

  async validate(token: string, tokenSecret: string, profile: Profile, done: (err: any, user: any, info?: any) => void) {
    // Twitter uses token and tokenSecret for OAuth 1.0a
    // We will save tokenSecret as the refreshToken in our SocialAccount entity
    done(null, profile, { accessToken: token, refreshToken: tokenSecret });
  }
}
