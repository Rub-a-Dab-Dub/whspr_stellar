import { AsyncLocalStorage } from 'async_hooks';

type RequestContextStore = {
  requestId: string;
};

const asyncLocalStorage = new AsyncLocalStorage<RequestContextStore>();

export class RequestContext {
  static run(store: RequestContextStore, callback: () => void): void {
    asyncLocalStorage.run(store, callback);
  }

  static getRequestId(): string | undefined {
    return asyncLocalStorage.getStore()?.requestId;
  }
}
