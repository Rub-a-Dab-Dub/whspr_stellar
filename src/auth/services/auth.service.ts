import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { AuthChallenge } from '../entities/auth-challenge.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { AuthAttempt } from '../entities/auth-attempt.entity';
import { UsersService } from '../../users/users.service';
import { CryptoService } from './crypto.service';
import { ChallengeResponseDto } from '../dto/challenge-response.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export interface JwtPayload {
  sub: string;
  walletAddress: string;
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
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(AuthAttempt)
    private readonly attemptRepository: Repository<AuthAttempt>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Generate authentication challenge for wallet
   */
  async generateChallenge(walletAddress: string): Promise<ChallengeResponseDto> {
    // Clean up expired challenges
    await this.cleanupExpiredChallenges();

    // Generate nonce
    const nonce = this.cryptoService.generateNonce();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.CHALLENGE_EXPIRY_MINUTES);

    // Delete any existing challenges for this wallet
    await this.challengeRepository.delete({ walletAddress });

    // Create new challenge
    const challenge = this.challengeRepository.create({
      walletAddress,
      nonce,
      expiresAt,
    });

    await this.challengeRepository.save(challenge);

    const message = this.cryptoService.createSignMessage(nonce);

    this.logger.log(`Challenge generated for wallet: ${walletAddress}`);

    return {
      nonce,
      expiresAt,
      message,
    };
  }

  /**
   * Verify signed challenge and issue JWT tokens
   */
  async verifyChallenge(
    walletAddress: string,
    signature: string,
    ipAddress: string,
  ): Promise<AuthResponseDto> {
    // Check brute force protection
    await this.checkBruteForce(walletAddress, ipAddress);

    // Find challenge
    const challenge = await this.challengeRepository.findOne({
      where: {
        walletAddress,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!challenge) {
      await this.recordFailedAttempt(walletAddress, ipAddress);
      throw new UnauthorizedException('Challenge not found or expired');
    }

    // Verify signature
    const message = this.cryptoService.createSignMessage(challenge.nonce);
    const isValid = this.cryptoService.verifyStellarSignature(walletAddress, message, signature);

    if (!isValid) {
      await this.recordFailedAttempt(walletAddress, ipAddress);
      throw new UnauthorizedException('Invalid signature');
    }

    // Delete used challenge
    await this.challengeRepository.delete({ id: challenge.id });

    // Record successful attempt
    await this.recordSuccessfulAttempt(walletAddress, ipAddress);

    // Find or create user
    let user: UserResponseDto;
    try {
      user = await this.usersService.findByWalletAddress(walletAddress);
    } catch (error) {
      if (error instanceof NotFoundException) {
        // Create new user
        user = await this.usersService.create({ walletAddress });
        this.logger.log(`New user created: ${user.id}`);
      } else {
        throw error;
      }
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user, ipAddress);

    this.logger.log(`User authenticated: ${user.id}`);

    return {
      ...tokens,
      user,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshTokenString: string,
    ipAddress: string,
  ): Promise<AuthResponseDto> {
    // Verify refresh token JWT
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(refreshTokenString, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Find refresh token in database
    const storedToken = await this.refreshTokenRepository.findOne({
      where: {
        userId: payload.sub,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token not found or expired');
    }

    // Verify token hash matches (single-use)
    const isValid = await this.cryptoService.compareToken(
      refreshTokenString,
      storedToken.tokenHash,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke old refresh token (single-use)
    storedToken.isRevoked = true;
    await this.refreshTokenRepository.save(storedToken);

    // Get user
    const user = await this.usersService.findById(payload.sub);

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(user, ipAddress);

    this.logger.log(`Tokens refreshed for user: ${user.id}`);

    return {
      ...tokens,
      user,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  }

  /**
   * Logout user by revoking refresh token
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async logout(userId: string, refreshTokenString: string): Promise<void> {
    const token = await this.refreshTokenRepository.findOne({
      where: {
        userId,
        isRevoked: false,
      },
    });

    if (token) {
      token.isRevoked = true;
      await this.refreshTokenRepository.save(token);
      this.logger.log(`User logged out: ${userId}`);
    }
  }

  /**
   * Validate JWT payload and return user
   */
  async validateUser(payload: JwtPayload): Promise<UserResponseDto> {
    const user = await this.usersService.findById(payload.sub);

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    return user;
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    user: UserResponseDto,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      walletAddress: user.walletAddress,
    };

    // Generate access token
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    // Generate refresh token
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: `${this.REFRESH_TOKEN_EXPIRY_DAYS}d`,
    });

    // Store refresh token
    const tokenHash = await this.cryptoService.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent: userAgent || null,
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);

    return { accessToken, refreshToken };
  }

  /**
   * Check for brute force attempts
   */
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
        'Too many failed attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Record failed authentication attempt
   */
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

  /**
   * Clean up expired challenges
   */
  private async cleanupExpiredChallenges(): Promise<void> {
    await this.challengeRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  /**
   * Clean up expired refresh tokens (should be run periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    const result = await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    if (result.affected && result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} expired refresh tokens`);
    }
  }
}
