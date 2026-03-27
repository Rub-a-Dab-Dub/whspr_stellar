import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as QRCode from 'qrcode';
import * as StellarSdk from '@stellar/stellar-sdk';
import { ParsedDeepLink, DeepLinkError } from './interfaces/deep-link.interface';

const QR_CACHE_TTL_MS = 3_600_000; // 1 hour
const QR_SIZE = 300;
const SCHEME = 'gasless';

@Injectable()
export class QrCodeService {
  private readonly logger = new Logger(QrCodeService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async generateWalletQR(address: string, size = QR_SIZE): Promise<Buffer> {
    const url = `${SCHEME}://pay?to=${address}`;
    return this.generateQR(url, size);
  }

  async generateProfileQR(username: string, size = QR_SIZE): Promise<Buffer> {
    const url = `${SCHEME}://profile/${encodeURIComponent(username)}`;
    return this.generateQR(url, size);
  }

  async generateGroupQR(inviteCode: string, size = QR_SIZE): Promise<Buffer> {
    const url = `${SCHEME}://group/join/${encodeURIComponent(inviteCode)}`;
    return this.generateQR(url, size);
  }

  async generateTransferQR(
    to: string,
    amount: string,
    token: string,
    size = QR_SIZE,
  ): Promise<Buffer> {
    const url = `${SCHEME}://pay?to=${to}&amount=${amount}&token=${encodeURIComponent(token)}`;
    return this.generateQR(url, size);
  }

  parseDeepLink(raw: string): ParsedDeepLink | DeepLinkError {
    let url: URL;
    try {
      // URL constructor needs a valid base; replace scheme for parsing
      url = new URL(raw.replace(`${SCHEME}://`, 'https://gasless/'));
    } catch {
      return { error: 'Invalid deep link format', type: 'INVALID_SCHEME' };
    }

    if (!raw.startsWith(`${SCHEME}://`)) {
      return { error: `Expected scheme "${SCHEME}://"`, type: 'INVALID_SCHEME' };
    }

    const path = url.pathname; // e.g. /pay, /group/join/CODE, /profile/NAME

    // gasless://pay?to=&amount=&token=
    if (path === '/pay') {
      const to = url.searchParams.get('to');
      if (!to) return { error: 'Missing "to" parameter', type: 'MISSING_PARAM' };
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(to)) {
        return { error: 'Invalid Stellar address in "to"', type: 'INVALID_PARAM' };
      }
      const result: ParsedDeepLink = { type: 'pay', to };
      const amount = url.searchParams.get('amount');
      const token = url.searchParams.get('token');
      if (amount) result.amount = amount;
      if (token) result.token = token;
      return result;
    }

    // gasless://group/join/:inviteCode
    const groupMatch = path.match(/^\/group\/join\/(.+)$/);
    if (groupMatch) {
      return { type: 'group_join', inviteCode: decodeURIComponent(groupMatch[1]) };
    }

    // gasless://profile/:username
    const profileMatch = path.match(/^\/profile\/(.+)$/);
    if (profileMatch) {
      return { type: 'profile', username: decodeURIComponent(profileMatch[1]) };
    }

    return { error: `Unknown deep link path: ${path}`, type: 'UNKNOWN_PATH' };
  }

  // ── private ──────────────────────────────────────────────────────────────

  private async generateQR(content: string, size: number): Promise<Buffer> {
    const cacheKey = `qr:${content}:${size}`;
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) {
      return Buffer.from(cached, 'base64');
    }

    const buffer = await QRCode.toBuffer(content, {
      type: 'png',
      width: size,
      errorCorrectionLevel: 'M',
    });

    await this.cache.set(cacheKey, buffer.toString('base64'), QR_CACHE_TTL_MS);
    return buffer;
  }
}
