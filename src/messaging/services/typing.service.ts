import { Injectable } from '@nestjs/common';

@Injectable()
export class TypingService {
  /** Auto-clear typing indicator after this many ms with no refresh */
  private readonly TYPING_TIMEOUT_MS = 3000;

  /** Active debounce timers keyed by `userId::conversationId` */
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Callbacks to invoke when a typing indicator auto-expires */
  private readonly stopCallbacks = new Map<string, () => void>();

  private key(userId: string, conversationId: string): string {
    return `${userId}::${conversationId}`;
  }

  /**
   * Register (or refresh) a typing indicator.
   * `onStop` fires either when the 3 s timer expires OR when clearTyping is
   * called explicitly — whichever comes first.
   */
  setTyping(userId: string, conversationId: string, onStop: () => void): void {
    const k = this.key(userId, conversationId);

    // Reset existing timer (debounce)
    const existing = this.timers.get(k);
    if (existing !== undefined) clearTimeout(existing);

    this.stopCallbacks.set(k, onStop);

    const timer = setTimeout(() => {
      this.timers.delete(k);
      const cb = this.stopCallbacks.get(k);
      this.stopCallbacks.delete(k);
      cb?.();
    }, this.TYPING_TIMEOUT_MS);

    this.timers.set(k, timer);
  }

  /**
   * Immediately clear the typing indicator and fire the stop callback.
   */
  clearTyping(userId: string, conversationId: string): void {
    const k = this.key(userId, conversationId);
    const timer = this.timers.get(k);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(k);
    }
    const cb = this.stopCallbacks.get(k);
    if (cb !== undefined) {
      this.stopCallbacks.delete(k);
      cb();
    }
  }

  isTyping(userId: string, conversationId: string): boolean {
    return this.timers.has(this.key(userId, conversationId));
  }

  /**
   * Clear all typing indicators for a user (e.g. on disconnect).
   */
  clearAllForUser(userId: string): void {
    const prefix = `${userId}::`;
    const keysToDelete = Array.from(this.timers.keys()).filter((k) =>
      k.startsWith(prefix),
    );
    for (const k of keysToDelete) {
      const conversationId = k.slice(prefix.length);
      this.clearTyping(userId, conversationId);
    }
  }
}
