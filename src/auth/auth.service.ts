// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../user/user.service';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
    private mailerService: MailerService,
  ) {}

  async register(email: string, password: string) {
    const user = await this.usersService.create(email, password);

    // Generate email verification token
    const verificationToken = randomBytes(32).toString('hex');
    await this.usersService.setEmailVerificationToken(
      user.id || '',
      verificationToken,
    );

    // Send verification email
    await this.sendVerificationEmail(email, verificationToken);

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isLocked) {
      const lockoutRemaining = Math.ceil(
        (user.lockoutUntil.getTime() - Date.now()) / 1000 / 60,
      );
      throw new UnauthorizedException(
        `Account is locked. Try again in ${lockoutRemaining} minutes.`,
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await this.usersService.incrementLoginAttempts(user.id || "");
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset login attempts on successful login
    await this.usersService.resetLoginAttempts(user.id || "");

    // Generate tokens
    const tokens = await this.generateTokens(user.id || '', user.email);

    // Save refresh token
    await this.usersService.updateRefreshToken(user.id || '', tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Blacklist old access token if jti exists
      if (payload.jti) {
        const ttl = Math.floor((payload.exp * 1000 - Date.now()) / 1000);
        if (ttl > 0) {
          await this.redisService.set(`blacklist:${payload.jti}`, 'true', ttl);
        }
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id || '', user.email);
      await this.usersService.updateRefreshToken(user.id || '', tokens.refreshToken);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, jti: string) {
    // Clear refresh token from database
    await this.usersService.updateRefreshToken(userId, null);

    // Blacklist access token
    const accessExpiration = this.parseTime(
      this.configService.get('JWT_ACCESS_EXPIRATION'),
    );
    await this.redisService.set(`blacklist:${jti}`, 'true', accessExpiration);

    return { message: 'Logout successful' };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    const resetToken = randomBytes(32).toString('hex');
    await this.usersService.setPasswordResetToken(user.id || '', resetToken);

    await this.sendPasswordResetEmail(email, resetToken);

    return { message: 'If the email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    await this.usersService.resetPassword(token, newPassword);
    return { message: 'Password reset successful' };
  }

  async verifyEmail(token: string) {
    await this.usersService.verifyEmail(token);
    return { message: 'Email verified successfully' };
  }

  private async generateTokens(userId: string, email: string) {
    const jti = randomBytes(16).toString('hex');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, jti },
        {
          secret: this.configService.get('JWT_ACCESS_SECRET'),
          expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION'),
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, jti },
        {
          secret: this.configService.get('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async sendVerificationEmail(email: string, token: string) {
    const url = `${this.configService.get('APP_URL')}/auth/verify-email?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Verify Your Email',
      html: `
        <h1>Email Verification</h1>
        <p>Click the link below to verify your email:</p>
        <a href="${url}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `,
    });
  }

  private async sendPasswordResetEmail(email: string, token: string) {
    const url = `${this.configService.get('APP_URL')}/auth/reset-password?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${url}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
      `,
    });
  }

  private parseTime(timeString: string): number {
    const unit = timeString.slice(-1);
    const value = parseInt(timeString.slice(0, -1));

    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] || 1);
  }
}
