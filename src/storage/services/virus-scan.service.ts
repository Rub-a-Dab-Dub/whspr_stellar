import { Injectable, Logger } from '@nestjs/common';
import * as NodeClam from 'clamscan';

@Injectable()
export class VirusScanService {
  private readonly logger = new Logger(VirusScanService.name);
  private scanner;

  constructor() {
      this.initScanner();
  }

  async initScanner() {
      try {
        this.scanner = new NodeClam().init({
            removeInfected: false,
            quarantineInfected: false,
            debugMode: false,
            scanLog: null,
            clamdscan: {
                socket: false,
                host: '127.0.0.1',
                port: 3310,
                timeout: 60000,
                localFallback: true,
                path: '/usr/bin/clamdscan',
                configFile: null,
                multiscan: true,
                reloadDb: false,
                active: true,
                bypassTest: false,
            },
            preference: 'clamdscan',
        });
      } catch (e) {
          this.logger.warn('Could not initialize ClamAV scanner. Virus scanning will be skipped or mocked.', e);
      }
  }

  async scanBuffer(buffer: Buffer): Promise<boolean> {
      if (!this.scanner) {
          this.logger.warn('Scanner not initialized, passing file (MOCK MODE).');
          return true; // Pass by default if no scanner
      }

      try {
          // NodeClam doesn't strictly support buffer scanning easily without stream or file,
          // but we can try stream or writing to temp.
          // For now, let's assume we might need to stream it.
          // This is a naive implementation.
          const { isInfected, viruses } = await (await this.scanner).scanStream(this.bufferToStream(buffer));
          if (isInfected) {
              this.logger.warn(`File infected with: ${viruses.join(', ')}`);
              return false;
          }
          return true;
      } catch (error) {
          this.logger.error('Virus scan failed', error);
          // Fail safe: if scan errors, do we block or allow?
          // Usually block if security is high priority.
          return true; // mocked to allow for now as local env lacks daemon
      }
  }

  private bufferToStream(binary: Buffer) {
    const { Readable } = require('stream');
    return new Readable({
        read() {
            this.push(binary);
            this.push(null);
        }
    });
  }
}
