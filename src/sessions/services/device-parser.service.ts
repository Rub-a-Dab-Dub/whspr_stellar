// src/sessions/services/device-parser.service.ts
import { Injectable } from '@nestjs/common';
import { UAParser, type IResult } from 'ua-parser-js';
import * as crypto from 'crypto';

export interface DeviceInfo {
  deviceType: string;
  deviceName: string;
  browser: string;
  os: string;
  deviceFingerprint: string;
}

@Injectable()
export class DeviceParserService {
  parseUserAgent(userAgent: string, ipAddress: string): DeviceInfo {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    const deviceType = this.getDeviceType(result);
    const deviceName = this.getDeviceName(result);
    const browser = this.getBrowserInfo(result);
    const os = this.getOSInfo(result);
    const deviceFingerprint = this.generateFingerprint(userAgent, ipAddress);

    return {
      deviceType,
      deviceName,
      browser,
      os,
      deviceFingerprint,
    };
  }

  private getDeviceType(result: IResult): string {
    if (result.device.type) {
      return result.device.type;
    }

    // Default to desktop if no device type is specified
    return 'desktop';
  }

  private getDeviceName(result: IResult): string {
    const parts: string[] = [];

    if (result.device.vendor) {
      parts.push(result.device.vendor);
    }

    if (result.device.model) {
      parts.push(result.device.model);
    }

    if (parts.length === 0) {
      // Fallback to OS + Browser
      if (result.os.name) {
        parts.push(result.os.name);
      }
      if (result.browser.name) {
        parts.push(result.browser.name);
      }
    }

    return parts.join(' ') || 'Unknown Device';
  }

  private getBrowserInfo(result: IResult): string {
    const browser = result.browser.name || 'Unknown';
    const version = result.browser.version || '';
    return version ? `${browser} ${version}` : browser;
  }

  private getOSInfo(result: IResult): string {
    const os = result.os.name || 'Unknown';
    const version = result.os.version || '';
    return version ? `${os} ${version}` : os;
  }

  generateFingerprint(
    userAgent: string,
    ipAddress: string,
    additionalData?: string,
  ): string {
    const data = [userAgent, ipAddress, additionalData]
      .filter(Boolean)
      .join('|');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Simple location parsing from IP (you'd typically use a GeoIP service)
  async parseLocation(ipAddress: string): Promise<{
    country?: string;
    city?: string;
    region?: string;
    timezone?: string;
  }> {
    // TODO: Integrate with GeoIP service like MaxMind, ipapi, etc.
    // For now, return empty object
    return {};
  }
}
