import {
  Injectable,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ethers } from 'ethers';
import * as crypto from 'crypto';
import { UsersService } from '../user/user.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EventType } from '../analytics/entities/analytics-event.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UserRole } from 'src/user/entities/user.entity';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Redis TTL for nonces: 5 minutes */
const NONCE_TTL_MS = 5 * 60 * 1000;

/** Redis TTL for refresh token families: 7 days */
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Redis TTL for access token revocation: 15 minutes (matches JWT_EXPIRES_IN default) */
const ACCESS_REVOKE_TTL_MS = 15 * 60 * 1000;

const NONCE_PREFIX = 'auth:nonce:';

/**
 * Stores the current valid jti for each token family.
 * Key: auth:family:{familyId}  →  value: current valid jti
 */
const FAMILY_PREFIX = 'auth:family:';

/**
 * Revocation list for both access and refresh tokens.
 * Key: auth:revoked:{jti}  →  value: '1'
 */
const REVOKED_PREFIX = 'auth:revoked:';

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // ─── Nonce ──────────────────────────────────────────────────────────────────

  /**
   * Generate a cryptographically random one-time nonce for a given wallet
   * address and store it in Redis with a 5-minute TTL.
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
   * A new token family is created for every fresh login.
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
      throw new UnauthorizedException(
        'Signature parsing failed. Ensure the signature is a valid EIP-191 hex string.',
      );
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

    // 7. Issue tokens with a fresh family
    const familyId = crypto.randomUUID();
    const tokens = await this.issueTokenPair(
      user.id,
      user.walletAddress,
      user.role,
      familyId,
    );

    this.logger.log(
      `Authenticated: userId=${user.id} wallet=${normalized} family=${familyId}`,
    );

    // Track login event
    await this.analyticsService.track(user.id, EventType.USER_LOGIN, {
      walletAddress: normalized,
      familyId,
    });

    return tokens;
  }

  // ─── Refresh ────────────────────────────────────────────────────────────────

  /**
   * Validate a refresh token and issue a new access + refresh token pair
   * (rotation). The old refresh token is single-use — each use generates a
   * new jti and invalidates the old one.
   *
   * Reuse detection: if the presented jti does NOT match the current family
   * head, the entire family is revoked immediately (compromise detected).
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

    const { sub: userId, familyId, jti } = payload;

    if (!familyId || !jti) {
      throw new UnauthorizedException('Malformed refresh token.');
    }

    // 2. Check revocation list — explicit revocations (logout / compromise)
    const isRevoked = await this.cacheManager.get<string>(
      `${REVOKED_PREFIX}${jti}`,
    );
    if (isRevoked) {
      throw new UnauthorizedException('Refresh token has been revoked.');
    }

    // 3. Check family head — detect reuse of an old (already-rotated) token
    const currentJti = await this.cacheManager.get<string>(
      `${FAMILY_PREFIX}${familyId}`,
    );

    if (!currentJti) {
      // Family has been fully revoked (e.g., after logout or compromise)
      throw new UnauthorizedException(
        'Token family is no longer valid. Please re-authenticate.',
      );
    }

    if (currentJti !== jti) {
      // Token reuse detected — revoke entire family immediately
      this.logger.warn(
        `Token reuse detected for userId=${userId} family=${familyId}. Revoking family.`,
      );
      await this.revokeFamilyAndToken(familyId, jti);
      throw new UnauthorizedException(
        'Token reuse detected. All sessions have been invalidated for security.',
      );
    }

    // 4. Load user
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive.');
    }

    // 5. Rotate — add old jti to revocation list, issue fresh pair in same family
    await this.revokeJti(jti, REFRESH_TTL_MS);

    const tokens = await this.issueTokenPair(
      user.id,
      user.walletAddress,
      user.role,
      familyId,
    );

    this.logger.debug(`Token rotated for userId=${userId} family=${familyId}`);

    return tokens;
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────

  /**
   * POST /auth/logout
   * Invalidate the current refresh token family and add the access token jti
   * to the revocation list so it cannot be used for its remaining TTL.
   */
  async logout(
    userId: string,
    accessTokenJti: string,
    refreshToken?: string,
  ): Promise<void> {
    // Revoke access token immediately (short TTL matching JWT_EXPIRES_IN)
    await this.revokeJti(accessTokenJti, ACCESS_REVOKE_TTL_MS);

    if (refreshToken) {
      try {
        const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        });
        if (payload.familyId) {
          await this.revokeFamilyAndToken(payload.familyId, payload.jti);
        }
      } catch {
        // Refresh token already expired or invalid — family may already be gone
        this.logger.debug(
          `Could not decode refresh token during logout for userId=${userId}`,
        );
      }
    }

    this.logger.debug(`Logged out userId=${userId}`);
  }

  // ─── Token Checks ───────────────────────────────────────────────────────────

  /**
   * Check whether a given jti is on the revocation list.
   * Used by the JWT guard to reject access tokens after logout.
   */
  async isRevoked(jti: string): Promise<boolean> {
    const value = await this.cacheManager.get<string>(
      `${REVOKED_PREFIX}${jti}`,
    );
    return !!value;
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
    familyId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessJti = crypto.randomUUID();
    const refreshJti = crypto.randomUUID();

    const basePayload: Omit<JwtPayload, 'jti'> = {
      sub: userId,
      walletAddress,
      role: role as UserRole,
      familyId,
    };

    const accessToken = this.jwtService.sign(
      { ...basePayload, jti: accessJti },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
      },
    );

    const refreshToken = this.jwtService.sign(
      { ...basePayload, jti: refreshJti },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ),
      },
    );

    // Update family head to the new refresh jti
    await this.cacheManager.set(
      `${FAMILY_PREFIX}${familyId}`,
      refreshJti,
      REFRESH_TTL_MS,
    );

    return { accessToken, refreshToken };
  }

  /**
   * Add a jti to the revocation list with the given TTL.
   */
  private async revokeJti(jti: string, ttlMs: number): Promise<void> {
    await this.cacheManager.set(`${REVOKED_PREFIX}${jti}`, '1', ttlMs);
  }

  /**
   * Revoke an entire token family (delete the family head) and optionally
   * add a specific jti to the revocation list.
   */
  private async revokeFamilyAndToken(
    familyId: string,
    jti?: string,
  ): Promise<void> {
    await this.cacheManager.del(`${FAMILY_PREFIX}${familyId}`);
    if (jti) {
      await this.revokeJti(jti, REFRESH_TTL_MS);
    }
  }
}
