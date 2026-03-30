import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import { FEATURE_FLAG_CHANGED_EVENT } from './constants';

export interface FeatureFlagChangedPayload {
  key: string;
}

@Injectable()
export class FeatureFlagsEvents implements OnModuleDestroy {
  private readonly emitter = new EventEmitter();

  emitChanged(payload: FeatureFlagChangedPayload): void {
    this.emitter.emit(FEATURE_FLAG_CHANGED_EVENT, payload);
  }

  onChanged(listener: (payload: FeatureFlagChangedPayload) => void): void {
    this.emitter.on(FEATURE_FLAG_CHANGED_EVENT, listener);
  }

  offChanged(listener: (payload: FeatureFlagChangedPayload) => void): void {
    this.emitter.off(FEATURE_FLAG_CHANGED_EVENT, listener);
  }

  onModuleDestroy(): void {
    this.emitter.removeAllListeners();
  }
}
