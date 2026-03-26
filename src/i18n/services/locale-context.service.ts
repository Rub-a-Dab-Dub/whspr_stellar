import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class LocaleContextService {
  private readonly storage = new AsyncLocalStorage<string>();

  setLocale(locale: string): void {
    this.storage.enterWith(locale);
  }

  getLocale(): string | undefined {
    return this.storage.getStore();
  }

  runWithLocale<T>(locale: string, callback: () => T): T {
    return this.storage.run(locale, callback);
  }
}
