import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('OAUTH_ENCRYPTION_KEY') || 'default_32_byte_secret_key_for_dev_only';
    this.encryptionKey = crypto.scryptSync(key, 'salt', 32);
  }

  /**
   * Generate a random nonce for authentication challenge
   */
  generateNonce(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create the message to be signed
   */
  createSignMessage(nonce: string): string {
    return `Sign this message to authenticate with Gasless Gossip:\n\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any fees.`;
  }

  /**
   * Verify Stellar signature using ed25519
   * @param walletAddress - Stellar public key (G...)
   * @param message - Original message that was signed
   * @param signature - Base64 encoded signature
   * @returns true if signature is valid
   */
  verifyStellarSignature(walletAddress: string, message: string, signature: string): boolean {
    try {
      // Validate Stellar address format
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(walletAddress)) {
        this.logger.warn(`Invalid Stellar address format: ${walletAddress}`);
        return false;
      }

      // Decode the public key
      const publicKey = StellarSdk.Keypair.fromPublicKey(walletAddress);

      // Convert message to buffer
      const messageBuffer = Buffer.from(message, 'utf8');

      // Decode signature from base64
      let signatureBuffer: Buffer;
      try {
        signatureBuffer = Buffer.from(signature, 'base64');
      } catch (error) {
        this.logger.warn('Invalid signature encoding');
        return false;
      }

      // Verify signature
      const isValid = publicKey.verify(messageBuffer, signatureBuffer);

      if (!isValid) {
        this.logger.warn(`Signature verification failed for wallet: ${walletAddress}`);
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying Stellar signature:', error);
      return false;
    }
  }

  /**
   * Hash a token for secure storage
   */
  async hashToken(token: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(token, saltRounds);
  }

  /**
   * Compare a token with its hash
   */
  async compareToken(token: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(token, hash);
    } catch (error) {
      this.logger.error('Error comparing token:', error);
      return false;
    }
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Encrypt sensitive data (like OAuth tokens) using AES-256
   */
  encryptSymmetric(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt data encrypted by encryptSymmetric
   */
  decryptSymmetric(encryptedText: string): string {
    try {
      const [ivHex, hexText] = encryptedText.split(':');
      if (!ivHex || !hexText) {
        throw new Error('Invalid format');
      }
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      let decrypted = decipher.update(hexText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      this.logger.error('Error decrypting token:', err);
      // Return the string back if it fails, maybe it wasn't encrypted (legacy support)
      // Throwing might be safer, but we can just throw
      throw new Error('Failed to decrypt data');
    }
  }
}
