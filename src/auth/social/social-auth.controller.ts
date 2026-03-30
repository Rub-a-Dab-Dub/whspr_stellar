import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SocialAuthService } from './services/social-auth.service';
import { SocialProvider } from './entities/social-account.entity';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { Public } from '../../decorators/public.decorator';

@Controller('auth/social')
export class SocialAuthController {
  constructor(private readonly socialAuthService: SocialAuthService) {}

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: any, @Res() res: any) {
    const { user, authInfo } = req;
    const tokens = await this.socialAuthService.loginWithSocial(
      SocialProvider.GOOGLE,
      user,
      authInfo as any,
      req,
    );
    // Ideally this redirects to frontend with tokens in URL or sets cookies
    return res.json(tokens);
  }

  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  async githubAuth() {
    // Initiates GitHub OAuth flow
  }

  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubAuthCallback(@Req() req: any, @Res() res: any) {
    const { user, authInfo } = req;
    const tokens = await this.socialAuthService.loginWithSocial(
      SocialProvider.GITHUB,
      user,
      authInfo as any,
      req,
    );
    return res.json(tokens);
  }

  @Public()
  @Get('twitter')
  @UseGuards(AuthGuard('twitter'))
  async twitterAuth() {
    // Initiates Twitter OAuth flow
  }

  @Public()
  @Get('twitter/callback')
  @UseGuards(AuthGuard('twitter'))
  async twitterAuthCallback(@Req() req: any, @Res() res: any) {
    const { user, authInfo } = req;
    const tokens = await this.socialAuthService.loginWithSocial(
      SocialProvider.TWITTER,
      user,
      authInfo as any,
      req,
    );
    return res.json(tokens);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':provider/link')
  linkAccount(@Req() req: any, @Param('provider') provider: string) {
    // Typically, linking requires going through OAuth flow again.
    // So this endpoint might trigger passport flow but pass state=link
    // However, simplest way is custom flow or frontend sends tokens directly.
    throw new Error('Endpoint /link must be implemented with Passport if redirecting');
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':provider/unlink')
  async unlinkAccount(@Req() req: any, @Param('provider') provider: SocialProvider) {
    return this.socialAuthService.unlinkAccount(req.user.id, provider);
  }

  @UseGuards(JwtAuthGuard)
  @Get('accounts')
  async getAccounts(@Req() req: any) {
    return this.socialAuthService.getSocialAccounts(req.user.id);
  }
}
