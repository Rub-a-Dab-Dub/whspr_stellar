export type ResolutionSource = 'sns' | 'federation' | 'native';

export interface ResolutionResult {
  /** Original query string (trimmed). */
  name: string;
  type: ResolutionSource;
  stellarAddress: string;
  memoType?: string;
  memo?: string;
}

export const CACHE_MISS_MARKER = { __nameResolveMiss: true } as const;

export function isCacheMissMarker(v: unknown): v is typeof CACHE_MISS_MARKER {
  return (
    typeof v === 'object' &&
    v !== null &&
    '__nameResolveMiss' in v &&
    (v as { __nameResolveMiss?: boolean }).__nameResolveMiss === true
  );
}
