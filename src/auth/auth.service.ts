import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ethers } from 'ethers';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Redis TTL for nonces: 5 minutes (in milliseconds for cache-manager v5+) */
const NONCE_TTL_MS = 5 * 60 * 1000;

/** Redis TTL for refresh tokens: 7 days */
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const NONCE_PREFIX = 'auth:nonce:';
const REFRESH_PREFIX = 'auth:refresh:';

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // ─── Nonce ──────────────────────────────────────────────────────────────────

  /**
   * Generate a cryptographically random one-time nonce for a given wallet
   * address and store it in Redis with a 5-minute TTL.
   *
   * The signed message format is deterministic so the frontend knows exactly
   * what to pass to eth_sign / personal_sign.
   */
  async generateNonce(
    walletAddress: string,
  ): Promise<{ nonce: string; message: string }> {
    const normalized = walletAddress.toLowerCase();
    const nonce = crypto.randomBytes(32).toString('hex');
    const message = this.buildSignMessage(normalized, nonce);

    await this.cacheManager.set(
      `${NONCE_PREFIX}${normalized}`,
      nonce,
      NONCE_TTL_MS,
    );

    this.logger.debug(`Nonce generated for ${normalized}`);

    return { nonce, message };
  }

  // ─── Verify ─────────────────────────────────────────────────────────────────

  /**
   * Verify the EIP-191 signed message against the stored nonce.
   * On success: consume nonce, upsert user, issue access + refresh tokens.
   */
  async verifySignature(
    walletAddress: string,
    signature: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const normalized = walletAddress.toLowerCase();
    const key = `${NONCE_PREFIX}${normalized}`;

    // 1. Retrieve nonce from Redis
    const storedNonce = await this.cacheManager.get<string>(key);
    if (!storedNonce) {
      throw new UnauthorizedException(
        'Nonce expired or not found. Request a new nonce via POST /auth/nonce.',
      );
    }

    // 2. Reconstruct the exact message that should have been signed
    const message = this.buildSignMessage(normalized, storedNonce);

    // 3. Recover signer address using ethers v6
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch {
      throw new UnauthorizedException('Signature parsing failed. Ensure the signature is a valid EIP-191 hex string.');
    }

    // 4. Compare recovered address (case-insensitive)
    if (recoveredAddress.toLowerCase() !== normalized) {
      throw new UnauthorizedException(
        'Signature does not match the provided wallet address.',
      );
    }

    // 5. Consume nonce immediately — prevent replay attacks
    await this.cacheManager.del(key);

    // 6. Upsert user record
    const user = await this.usersService.findOrCreate(normalized);

    // 7. Issue tokens
    const { accessToken, refreshToken } = await this.issueTokenPair(user.id, user.walletAddress, user.role);

    this.logger.log(`Authenticated: userId=${user.id} wallet=${normalized}`);

    return { accessToken, refreshToken };
  }

  // ─── Refresh ────────────────────────────────────────────────────────────────

  /**
   * Validate a refresh token stored in Redis and issue a new access + refresh
   * token pair (rotation). The old refresh token is invalidated on use.
   */
  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // 1. Verify JWT structure and signature
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    // 2. Check Redis allowlist — token must still be live
    const storedToken = await this.cacheManager.get<string>(
      `${REFRESH_PREFIX}${payload.sub}`,
    );
    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedException(
        'Refresh token has been revoked or already used.',
      );
    }

    // 3. Load user
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive.');
    }

    // 4. Rotate — invalidate old token, issue fresh pair
    await this.cacheManager.del(`${REFRESH_PREFIX}${payload.sub}`);
    const tokens = await this.issueTokenPair(user.id, user.walletAddress, user.role);

    this.logger.debug(`Token rotated for userId=${user.id}`);

    return tokens;
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────

  /**
   * Invalidate the refresh token for the authenticated user.
   * The short-lived access token will expire naturally.
   */
  async logout(userId: string): Promise<void> {
    await this.cacheManager.del(`${REFRESH_PREFIX}${userId}`);
    this.logger.debug(`Logged out userId=${userId}`);
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private buildSignMessage(walletAddress: string, nonce: string): string {
    return (
      `Welcome to Whspr!\n\n` +
      `Sign this message to authenticate your wallet.\n\n` +
      `Wallet: ${walletAddress}\n` +
      `Nonce: ${nonce}\n\n` +
      `This request will not trigger a blockchain transaction or cost any gas.`
    );
  }

  private async issueTokenPair(
    userId: string,
    walletAddress: string,
    role: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = { sub: userId, walletAddress, role: role as any };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // Store refresh token in Redis for revocation
    await this.cacheManager.set(
      `${REFRESH_PREFIX}${userId}`,
      refreshToken,
      REFRESH_TTL_MS,
    );

    return { accessToken, refreshToken };
  }
}