import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { UsersService } from '../../users/users.service';
import { SessionsService } from '../../sessions/sessions.service';
import { ChallengeResponseDto } from '../dto/challenge-response.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { TranslationService } from '../../i18n/services/translation.service';
import {
  TWO_FACTOR_LOGIN_PURPOSE,
  TWO_FACTOR_PENDING_TOKEN_TTL,
} from '../../two-factor/constants';
import { TwoFactorPendingJwtPayload } from '../../two-factor/two-factor-pending-jwt.interface';
import { TwoFactorService } from '../../two-factor/two-factor.service';
import { AuthAttempt } from '../entities/auth-attempt.entity';
import { AuthChallenge } from '../entities/auth-challenge.entity';
import { CryptoService } from './crypto.service';
import { FraudDetectionService } from '../../fraud-detection/fraud-detection.service';
import { LoginAction } from '../../fraud-detection/entities/login-attempt.entity';

export interface JwtPayload {
  sub: string;
  walletAddress: string | null;
  sessionId: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly CHALLENGE_EXPIRY_MINUTES = 5;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 30;
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly ATTEMPT_WINDOW_MINUTES = 15;

  constructor(
    @InjectRepository(AuthChallenge)
    private readonly challengeRepository: Repository<AuthChallenge>,
    @InjectRepository(AuthAttempt)
    private readonly attemptRepository: Repository<AuthAttempt>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly cryptoService: CryptoService,
    private readonly translationService: TranslationService,
    private readonly sessionsService: SessionsService,
    @Inject(forwardRef(() => TwoFactorService))
    private readonly twoFactorService: TwoFactorService,
    private readonly fraudDetection: FraudDetectionService,
  ) {}

  async generateChallenge(walletAddress: string): Promise<ChallengeResponseDto> {
    await this.cleanupExpiredChallenges();

    const nonce = this.cryptoService.generateNonce();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.CHALLENGE_EXPIRY_MINUTES);

    await this.challengeRepository.delete({ walletAddress });

    const challenge = this.challengeRepository.create({
      walletAddress,
      nonce,
      expiresAt,
    });

    await this.challengeRepository.save(challenge);

    return {
      nonce,
      expiresAt,
      message: this.cryptoService.createSignMessage(nonce),
    };
  }

  async verifyChallenge(
    walletAddress: string,
    signature: string,
    ipAddress: string,
    userAgent?: string,
    deviceInfo?: string,
  ): Promise<AuthResponseDto> {
    await this.checkBruteForce(walletAddress, ipAddress);

    const challenge = await this.challengeRepository.findOne({
      where: {
        walletAddress,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!challenge) {
      await this.recordFailedAttempt(walletAddress, ipAddress);
      throw new UnauthorizedException(
        this.translationService.translate('errors.auth.challengeNotFoundOrExpired'),
      );
    }

    const message = this.cryptoService.createSignMessage(challenge.nonce);
    const isValid = this.cryptoService.verifyStellarSignature(walletAddress, message, signature);

    if (!isValid) {
      await this.recordFailedAttempt(walletAddress, ipAddress);
      throw new UnauthorizedException(
        this.translationService.translate('errors.auth.invalidSignature'),
      );
    }

    await this.challengeRepository.delete({ id: challenge.id });
    await this.recordSuccessfulAttempt(walletAddress, ipAddress);

    const user = await this.findOrCreateUser(walletAddress);

    if (!user.isActive) {
      throw new UnauthorizedException(this.translationService.translate('errors.auth.userDeactivated'));
    }

    if (await this.twoFactorService.isEnabled(user.id)) {
      const pendingToken = this.jwtService.sign(
        {
          sub: user.id,
          walletAddress: user.walletAddress,
          purpose: TWO_FACTOR_LOGIN_PURPOSE,
        },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: TWO_FACTOR_PENDING_TOKEN_TTL,
        },
      );

      return {
        requiresTwoFactor: true,
        pendingToken,
        user,
        tokenType: 'Bearer',
        expiresIn: 300,
      };
    }

    // Fraud / geo analysis
    const fraud = await this.fraudDetection.analyzeLogin({
      userId: user.id,
      ipAddress,
      twoFaEnabled: false, // extend when 2FA module is added
    });

    if (fraud.action === LoginAction.BLOCKED) {
      throw new HttpException('Login blocked due to suspicious activity', HttpStatus.FORBIDDEN);
    }

    const tokens = await this.generateTokens(user, {
      ipAddress,
      userAgent: userAgent ?? null,
      deviceInfo: this.resolveDeviceInfo(deviceInfo, userAgent),
    });

    this.logger.log(`User authenticated: ${user.id}`);

    return {
      ...tokens,
      user,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  }

  async completeTwoFactorLogin(
    pendingToken: string,
    code: string,
    ipAddress: string,
    userAgent?: string,
    deviceInfo?: string,
  ): Promise<AuthResponseDto> {
    let payload: TwoFactorPendingJwtPayload;
    try {
      payload = this.jwtService.verify<TwoFactorPendingJwtPayload>(pendingToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        this.translationService.translate('errors.auth.invalidToken'),
      );
    }

    if (payload.purpose !== TWO_FACTOR_LOGIN_PURPOSE) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.auth.invalidToken'),
      );
    }

    await this.twoFactorService.assertValidLoginCode(payload.sub, code);

    const user = await this.usersService.findById(payload.sub);
    if (!user.isActive) {
      throw new UnauthorizedException(this.translationService.translate('errors.auth.userDeactivated'));
    }

    if (user.walletAddress !== payload.walletAddress) {
      throw new UnauthorizedException(this.translationService.translate('errors.auth.invalidToken'));
    }

    const tokens = await this.generateTokens(user, {
      ipAddress,
      userAgent: userAgent ?? null,
      deviceInfo: this.resolveDeviceInfo(deviceInfo, userAgent),
    });

    this.logger.log(`User authenticated (2FA): ${user.id}`);

    return {
      ...tokens,
      user,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  }

  async refreshAccessToken(
    refreshTokenString: string,
    ipAddress: string,
    userAgent?: string,
    deviceInfo?: string,
  ): Promise<AuthResponseDto> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshTokenString, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        this.translationService.translate('errors.auth.invalidOrExpiredRefreshToken'),
      );
    }

    const storedSession = await this.sessionsService.validateRefreshSession(
      payload.sub,
      payload.sessionId,
    );

    const isValid = await this.cryptoService.compareToken(
      refreshTokenString,
      storedSession.refreshTokenHash,
    );

    if (!isValid) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.auth.invalidRefreshToken'),
      );
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user.isActive) {
      throw new UnauthorizedException(this.translationService.translate('errors.auth.userDeactivated'));
    }

    const tokens = await this.generateTokens(
      user,
      {
        ipAddress,
        userAgent: userAgent ?? storedSession.userAgent,
        deviceInfo: this.resolveDeviceInfo(deviceInfo, userAgent ?? storedSession.userAgent),
      },
      storedSession.id,
    );

    this.logger.log(`Tokens refreshed for user: ${user.id}`);

    return {
      ...tokens,
      user,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  }

  async issueTokensForUser(
    user: UserResponseDto,
    ipAddress: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const tokens = await this.generateTokens(user, {
      ipAddress,
      userAgent: userAgent ?? null,
      deviceInfo: this.resolveDeviceInfo(undefined, userAgent),
    });

    this.logger.log(`Tokens issued (Social Auth) for user: ${user.id}`);

    return {
      ...tokens,
      user,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  }

  async logout(userId: string, sessionId?: string): Promise<void> {
    if (!sessionId) {
      return;
    }

    await this.sessionsService.revokeSession(userId, sessionId);
    this.logger.log(`User logged out: ${userId}`);
  }

  async validateUser(payload: JwtPayload): Promise<UserResponseDto & { sessionId: string }> {
    const user = await this.usersService.findById(payload.sub);

    if (!user.isActive) {
      throw new UnauthorizedException(this.translationService.translate('errors.auth.userDeactivated'));
    }

    if (!user.walletAddress) {
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - new Date(user.createdAt).getTime() > SEVEN_DAYS_MS) {
        throw new UnauthorizedException('Grace period expired. Please link a Stellar wallet to continue.');
      }
    }

    await this.sessionsService.validateActiveSession(payload.sub, payload.sessionId);
    await this.sessionsService.touchSession(payload.sessionId);

    return {
      ...user,
      sessionId: payload.sessionId,
    };
  }

  private async generateTokens(
    user: UserResponseDto,
    metadata: { ipAddress: string | null; userAgent: string | null; deviceInfo: string },
    rotateFromSessionId?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const nextSessionId = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    const payload: JwtPayload = {
      sub: user.id,
      walletAddress: user.walletAddress,
      sessionId: nextSessionId,
    };

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: `${this.REFRESH_TOKEN_EXPIRY_DAYS}d`,
    });
    const refreshTokenHash = await this.cryptoService.hashToken(refreshToken);

    await (rotateFromSessionId
      ? this.sessionsService.rotateSession({
          userId: user.id,
          currentSessionId: rotateFromSessionId,
          nextSessionId,
          refreshTokenHash,
          expiresAt,
          metadata,
        })
      : this.sessionsService.createSession({
          id: nextSessionId,
          userId: user.id,
          refreshTokenHash,
          expiresAt,
          metadata,
        }));

    return {
      accessToken: this.jwtService.sign(payload, {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
      }),
      refreshToken: this.jwtService.sign(payload, {
        expiresIn: `${this.REFRESH_TOKEN_EXPIRY_DAYS}d`,
      }),
    };
  }

  private async findOrCreateUser(walletAddress: string): Promise<UserResponseDto> {
    try {
      return await this.usersService.findByWalletAddress(walletAddress);
    } catch (error) {
      if (error instanceof NotFoundException) {
        const user = await this.usersService.create({ walletAddress });
        this.logger.log(`New user created: ${user.id}`);
        return user;
      }

      throw error;
    }
  }

  private resolveDeviceInfo(deviceInfo?: string, userAgent?: string | null): string {
    if (deviceInfo?.trim()) {
      return deviceInfo.trim().slice(0, 255);
    }

    if (!userAgent) {
      return 'Unknown device';
    }

    const browser = this.detectBrowser(userAgent);
    const os = this.detectOperatingSystem(userAgent);
    return `${browser} on ${os}`.slice(0, 255);
  }

  private detectBrowser(userAgent: string): string {
    if (userAgent.includes('Edg/')) {
      return 'Edge';
    }
    if (userAgent.includes('Chrome/')) {
      return 'Chrome';
    }
    if (userAgent.includes('Firefox/')) {
      return 'Firefox';
    }
    if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
      return 'Safari';
    }

    return 'Unknown browser';
  }

  private detectOperatingSystem(userAgent: string): string {
    if (userAgent.includes('Windows')) {
      return 'Windows';
    }
    if (userAgent.includes('Mac OS X')) {
      return 'macOS';
    }
    if (userAgent.includes('Android')) {
      return 'Android';
    }
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      return 'iOS';
    }
    if (userAgent.includes('Linux')) {
      return 'Linux';
    }

    return 'Unknown OS';
  }

  private async checkBruteForce(walletAddress: string, ipAddress: string): Promise<void> {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - this.ATTEMPT_WINDOW_MINUTES);

    const recentAttempts = await this.attemptRepository.count({
      where: {
        walletAddress,
        ipAddress,
        success: false,
        createdAt: MoreThan(windowStart),
      },
    });

    if (recentAttempts >= this.MAX_FAILED_ATTEMPTS) {
      this.logger.warn(`Brute force detected for wallet ${walletAddress} from IP ${ipAddress}`);
      throw new HttpException(
        this.translationService.translate('errors.auth.tooManyFailedAttempts'),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordFailedAttempt(walletAddress: string, ipAddress: string): Promise<void> {
    const attempt = this.attemptRepository.create({
      walletAddress,
      ipAddress,
      success: false,
    });
    await this.attemptRepository.save(attempt);
  }

  /**
   * Record successful authentication attempt
   */
  private async recordSuccessfulAttempt(walletAddress: string, ipAddress: string): Promise<void> {
    const attempt = this.attemptRepository.create({
      walletAddress,
      ipAddress,
      success: true,
    });
    await this.attemptRepository.save(attempt);
  }

  private async cleanupExpiredChallenges(): Promise<void> {
    await this.challengeRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }
}
