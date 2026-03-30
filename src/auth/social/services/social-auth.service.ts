import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialAccount, SocialProvider } from '../entities/social-account.entity';
import { UsersService } from '../../../users/users.service';
import { AuthService } from '../../services/auth.service';
import { CryptoService } from '../../services/crypto.service';
import { UserResponseDto } from '../../../users/dto/user-response.dto';
import { AuthResponseDto } from '../../dto/auth-response.dto';

@Injectable()
export class SocialAuthService {
  private readonly logger = new Logger(SocialAuthService.name);

  constructor(
    @InjectRepository(SocialAccount)
    private readonly socialAccountRepository: Repository<SocialAccount>,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Used for social login. Finds existing linked account or registers a new User and links it.
   */
  async loginWithSocial(
    provider: SocialProvider,
    profile: any,
    tokens: { accessToken: string; refreshToken?: string },
    req: any,
  ): Promise<AuthResponseDto> {
    const { id: providerId, emails, displayName, photos } = profile;
    const email = emails?.[0]?.value || null;
    const avatarUrl = photos?.[0]?.value || null;

    let socialAccount = await this.socialAccountRepository.findOne({
      where: { provider, providerId },
      relations: ['user'],
    });

    let user: UserResponseDto | undefined;

    if (socialAccount) {
      user = await this.usersService.findById(socialAccount.userId);
      
      // Update tokens
      socialAccount.accessToken = this.cryptoService.encryptSymmetric(tokens.accessToken);
      if (tokens.refreshToken) {
        socialAccount.refreshToken = this.cryptoService.encryptSymmetric(tokens.refreshToken);
      }
      // Update profile info
      socialAccount.displayName = displayName || socialAccount.displayName;
      socialAccount.avatarUrl = avatarUrl || socialAccount.avatarUrl;
      socialAccount.email = email || socialAccount.email;
      await this.socialAccountRepository.save(socialAccount);
    } else {
      // Find user by email if possible to auto-link, otherwise create new user
      if (email) {
        try {
          user = await this.usersService.findByEmail(email); // Assuming findByEmail exists
        } catch (e) {
          // not found
        }
      }

      if (!user) {
        // Create new user with null walletAddress
        // Pass basic details via createUserDto. It allows optional wallet address due to our changes
        user = await this.usersService.create({
          email: email || undefined,
          displayName: displayName || undefined,
          avatarUrl: avatarUrl || undefined,
          // We don't provide walletAddress, so it becomes null
        });
      }

      socialAccount = this.socialAccountRepository.create({
        userId: user.id,
        provider,
        providerId,
        email,
        displayName,
        avatarUrl,
        accessToken: this.cryptoService.encryptSymmetric(tokens.accessToken),
        refreshToken: tokens.refreshToken ? this.cryptoService.encryptSymmetric(tokens.refreshToken) : null,
      });
      await this.socialAccountRepository.save(socialAccount);
    }

    // Generate JWT via AuthService's generateTokens
    // AuthService generateTokens is private, but it has verifyChallenge which returns tokens.
    // Wait, we need a way to issue JWTs. Let's look at AuthService to see if there's a public method to issue tokens.
    // In auth.service.ts, generateTokens is private. Let's see how else we can issue tokens or modify auth.service.ts.
    // Assuming we'll modify AuthService to expose `issueTokens` or we do it here. 
    // Wait, let's call a method we will add to AuthService: `issueTokensForUser(user: UserResponseDto, ipAddress: string, userAgent?: string)`
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const authTokens = await (this.authService as any).issueTokensForUser(user, ipAddress, userAgent);

    return authTokens;
  }

  /**
   * Used to manually link a social account to an existing logged-in user.
   */
  async linkAccount(
    userId: string,
    provider: SocialProvider,
    profile: any,
    tokens: { accessToken: string; refreshToken?: string },
  ): Promise<SocialAccount> {
    const { id: providerId, emails, displayName, photos } = profile;

    const existingLink = await this.socialAccountRepository.findOne({
      where: { provider, providerId },
    });

    if (existingLink) {
      if (existingLink.userId === userId) {
        throw new ConflictException('Account is already linked to your profile.');
      }
      throw new ConflictException('This social account is linked to another user.');
    }

    const email = emails?.[0]?.value || null;
    const avatarUrl = photos?.[0]?.value || null;

    const newAccount = this.socialAccountRepository.create({
      userId,
      provider,
      providerId,
      email,
      displayName,
      avatarUrl,
      accessToken: this.cryptoService.encryptSymmetric(tokens.accessToken),
      refreshToken: tokens.refreshToken ? this.cryptoService.encryptSymmetric(tokens.refreshToken) : null,
    });

    return this.socialAccountRepository.save(newAccount);
  }

  /**
   * Used to unlink a social account. Requires the user to still have a valid auth method.
   */
  async unlinkAccount(userId: string, provider: SocialProvider): Promise<void> {
    const accounts = await this.getSocialAccounts(userId);
    const targetAccount = accounts.find((acc) => acc.provider === provider);

    if (!targetAccount) {
      throw new NotFoundException(`No linked account found for provider ${provider}`);
    }

    const user = await this.usersService.findById(userId);

    // If the user has no wallet linked, and this is the last social account, prevent unlinking
    if (!user.walletAddress && accounts.length === 1) {
      throw new BadRequestException('Cannot unlink the last authentication method. Please link a Stella wallet first.');
    }

    await this.socialAccountRepository.delete(targetAccount.id);
  }

  async getSocialAccounts(userId: string): Promise<SocialAccount[]> {
    return this.socialAccountRepository.find({ where: { userId } });
  }
}
