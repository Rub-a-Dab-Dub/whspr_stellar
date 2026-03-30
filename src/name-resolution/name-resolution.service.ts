import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { StrKey } from '@stellar/stellar-sdk';
import { CacheService } from '../cache/cache.service';
import { UsersRepository } from '../users/users.repository';
import { UserRegistryContractService } from '../soroban/services/user-registry-contract/user-registry-contract.service';
import { parseFederationServerUrl } from './federation-toml.util';
import {
  CACHE_MISS_MARKER,
  isCacheMissMarker,
  ResolutionResult,
} from './name-resolution.types';

const CACHE_PREFIX = 'name-resolve:v1';
const TTL_SUCCESS_SEC = 300;
const TTL_FAILURE_SEC = 30;

@Injectable()
export class NameResolutionService {
  private readonly logger = new Logger(NameResolutionService.name);

  constructor(
    private readonly http: HttpService,
    private readonly cache: CacheService,
    private readonly users: UsersRepository,
    private readonly userRegistry: UserRegistryContractService,
    private readonly config: ConfigService,
  ) {}

  private fwdKey(name: string): string {
    return `${CACHE_PREFIX}:fwd:${this.normalize(name)}`;
  }

  private revKey(address: string): string {
    return `${CACHE_PREFIX}:rev:${address.trim().toLowerCase()}`;
  }

  normalize(name: string): string {
    return name.trim().toLowerCase();
  }

  /**
   * Populate Redis: success → 5 min TTL; failure → 30 s TTL (anti-hammer).
   */
  async cacheResolution(name: string, result: ResolutionResult | null): Promise<void> {
    const key = this.fwdKey(name);
    if (result) {
      await this.cache.set(key, result, TTL_SUCCESS_SEC);
    } else {
      await this.cache.set(key, CACHE_MISS_MARKER, TTL_FAILURE_SEC);
    }
  }

  async invalidateCache(name?: string): Promise<void> {
    if (name !== undefined && name !== null) {
      await this.cache.del(this.fwdKey(name));
      return;
    }
    await this.cache.invalidatePattern(`${CACHE_PREFIX}:*`);
  }

  private async readForwardCache(name: string): Promise<ResolutionResult | null | undefined> {
    const key = this.fwdKey(name);
    const raw = await this.cache.get<ResolutionResult | typeof CACHE_MISS_MARKER>(key);
    if (raw === null) return undefined;
    if (isCacheMissMarker(raw)) return null;
    return raw;
  }

  private async readReverseCache(address: string): Promise<string | null | undefined> {
    const raw = await this.cache.get<string | typeof CACHE_MISS_MARKER>(this.revKey(address));
    if (raw === null) return undefined;
    if (isCacheMissMarker(raw)) return null;
    return raw;
  }

  async resolveSNS(fullName: string): Promise<ResolutionResult | null> {
    const trimmed = fullName.trim();
    if (!trimmed.toLowerCase().endsWith('.xlm')) {
      return null;
    }
    const base = this.config.get<string>('SNS_RESOLVER_BASE_URL', '').trim();
    if (!base) {
      this.logger.debug('SNS_RESOLVER_BASE_URL not set; skipping SNS resolution');
      return null;
    }
    try {
      const url = `${base.replace(/\/$/u, '')}/resolve`;
      const { data } = await firstValueFrom(
        this.http.get<Record<string, unknown>>(url, {
          params: { name: trimmed },
          timeout: 12_000,
        }),
      );
      const addr =
        (typeof data?.stellar_address === 'string' && data.stellar_address) ||
        (typeof data?.address === 'string' && data.address) ||
        (typeof data?.account_id === 'string' && data.account_id) ||
        null;
      if (addr && StrKey.isValidEd25519PublicKey(addr)) {
        return {
          name: trimmed,
          type: 'sns',
          stellarAddress: addr,
          memoType: typeof data.memo_type === 'string' ? data.memo_type : undefined,
          memo: typeof data.memo === 'string' ? data.memo : undefined,
        };
      }
    } catch (e) {
      this.logger.warn(`resolveSNS failed for ${trimmed}: ${(e as Error).message}`);
    }
    return null;
  }

  /**
   * SEP-0002: fetch domain stellar.toml, then query FEDERATION_SERVER with type=name.
   */
  async resolveFederation(federationName: string): Promise<ResolutionResult | null> {
    const q = federationName.trim();
    const star = q.indexOf('*');
    if (star <= 0 || star === q.length - 1) {
      return null;
    }
    const domain = q.slice(star + 1).trim().toLowerCase();
    if (!domain || domain.includes('*')) {
      return null;
    }
    const tomlUrl = `https://${domain}/.well-known/stellar.toml`;
    try {
      const { data: tomlText } = await firstValueFrom(
        this.http.get<string>(tomlUrl, {
          responseType: 'text',
          timeout: 12_000,
        }),
      );
      const fedBase = parseFederationServerUrl(tomlText);
      if (!fedBase) {
        this.logger.debug(`No FEDERATION_SERVER in stellar.toml for ${domain}`);
        return null;
      }
      const fedUrl = new URL(fedBase.includes('://') ? fedBase : `https://${fedBase}`);
      fedUrl.searchParams.set('type', 'name');
      fedUrl.searchParams.set('q', q);
      const { data } = await firstValueFrom(
        this.http.get<Record<string, unknown>>(fedUrl.toString(), { timeout: 12_000 }),
      );
      const addr =
        (typeof data?.stellar_address === 'string' && data.stellar_address) ||
        (typeof data?.account_id === 'string' && data.account_id) ||
        null;
      if (addr && StrKey.isValidEd25519PublicKey(addr)) {
        return {
          name: q,
          type: 'federation',
          stellarAddress: addr,
          memoType: typeof data.memo_type === 'string' ? data.memo_type : undefined,
          memo: typeof data.memo === 'string' ? data.memo : undefined,
        };
      }
    } catch (e) {
      this.logger.warn(`resolveFederation failed for ${q}: ${(e as Error).message}`);
    }
    return null;
  }

  async resolveUsername(handle: string): Promise<ResolutionResult | null> {
    const raw = handle.trim();
    const withoutAt = raw.startsWith('@') ? raw.slice(1).trim() : raw;
    if (!withoutAt) return null;

    const user = await this.users.findByUsernameCaseInsensitive(withoutAt);
    const stellar = user ? this.pickStellarAddress(user.walletAddress) : null;
    if (stellar) {
      return {
        name: `@${withoutAt}`,
        type: 'native',
        stellarAddress: stellar,
      };
    }

    const onChain = await this.userRegistry.getWalletAddressForUsername(withoutAt);
    if (onChain && StrKey.isValidEd25519PublicKey(onChain)) {
      return {
        name: `@${withoutAt}`,
        type: 'native',
        stellarAddress: onChain,
      };
    }

    return null;
  }

  async resolveAny(name: string): Promise<ResolutionResult | null> {
    const trimmed = name?.trim() ?? '';
    if (!trimmed) return null;

    const cached = await this.readForwardCache(trimmed);
    if (cached !== undefined) {
      return cached;
    }

    let result: ResolutionResult | null = null;

    if (StrKey.isValidEd25519PublicKey(trimmed)) {
      result = { name: trimmed, type: 'native', stellarAddress: trimmed };
    } else if (trimmed.startsWith('@')) {
      result = await this.resolveUsername(trimmed);
    } else if (trimmed.toLowerCase().endsWith('.xlm')) {
      result = await this.resolveSNS(trimmed);
    } else if (trimmed.includes('*')) {
      result = await this.resolveFederation(trimmed);
    } else {
      result = await this.resolveUsername(trimmed);
    }

    await this.cacheResolution(trimmed, result);
    return result;
  }

  async reverseResolve(address: string): Promise<string | null> {
    const trimmed = address?.trim() ?? '';
    if (!trimmed || !StrKey.isValidEd25519PublicKey(trimmed)) {
      return null;
    }

    const cached = await this.readReverseCache(trimmed);
    if (cached !== undefined) {
      return cached;
    }

    const user = await this.users.findByWalletCaseInsensitive(trimmed);
    let primary: string | null = null;
    if (user?.username) {
      primary = `@${user.username}`;
    }

    if (primary) {
      await this.cache.set(this.revKey(trimmed), primary, TTL_SUCCESS_SEC);
    } else {
      await this.cache.set(this.revKey(trimmed), CACHE_MISS_MARKER, TTL_FAILURE_SEC);
    }
    return primary;
  }

  async resolveBatch(names: string[]): Promise<(ResolutionResult | null)[]> {
    const slice = names.slice(0, 50);
    return Promise.all(slice.map((n) => this.resolveAny(n)));
  }

  private pickStellarAddress(walletAddress: string | null | undefined): string | null {
    if (!walletAddress?.trim()) return null;
    const w = walletAddress.trim();
    if (StrKey.isValidEd25519PublicKey(w)) return w;
    const upper = w.toUpperCase();
    if (StrKey.isValidEd25519PublicKey(upper)) return upper;
    return null;
  }
}
