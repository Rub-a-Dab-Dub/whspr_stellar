import QRCode from "qrcode";
import Redis from "ioredis";
import { parseDeepLink } from "../utils/deep-link";

const redis = new Redis();

export class QRCodeService {
  async generateWalletQR(address: string, size = 256): Promise<string> {
    const url = `gasless://wallet/${address}`;
    return this.generateCachedQR(url, size);
  }

  async generateProfileQR(username: string, size = 256): Promise<string> {
    const url = `gasless://profile/${username}`;
    return this.generateCachedQR(url, size);
  }

  async generateGroupQR(groupId: string, size = 256): Promise<string> {
    const url = `gasless://group/join/${groupId}`;
    return this.generateCachedQR(url, size);
  }

  async generateTransferQR(to: string, amount: string, token: string, size = 256): Promise<string> {
    const url = `gasless://pay?to=${to}&amount=${amount}&token=${token}`;
    return this.generateCachedQR(url, size);
  }

  async generateCachedQR(url: string, size: number): Promise<string> {
    const cached = await redis.get(url);
    if (cached) return cached;

    const qr = await QRCode.toDataURL(url, { width: size });
    await redis.set(url, qr, "EX", 60 * 60); // 1h TTL
    return qr;
  }

  async parseDeepLink(link: string) {
    return parseDeepLink(link);
  }
}
