import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateSavedAddressDto,
  SearchSavedAddressesDto,
  UpdateSavedAddressDto,
} from './dto/saved-address.dto';
import { SavedAddress } from './entities/saved-address.entity';
import { SavedAddressesRepository } from './saved-addresses.repository';
import { WalletNetwork } from '../wallets/entities/wallet.entity';

const STELLAR_ADDRESS_REGEX = /^[GC][A-Z2-7]{55}$/;

@Injectable()
export class SavedAddressesService {
  constructor(private readonly savedAddressesRepository: SavedAddressesRepository) {}

  async addAddress(userId: string, dto: CreateSavedAddressDto): Promise<SavedAddress> {
    const normalizedAddress = dto.walletAddress.trim().toUpperCase();
    this.assertValidStellarAddress(normalizedAddress);

    const alias = dto.alias.trim();
    await this.assertAliasUnique(userId, alias);

    const existingAddress = await this.savedAddressesRepository.findByAddressCaseInsensitive(
      userId,
      normalizedAddress,
    );
    if (existingAddress) {
      throw new ConflictException('This wallet address is already saved');
    }

    const entity = this.savedAddressesRepository.create({
      userId,
      walletAddress: normalizedAddress,
      alias,
      avatarUrl: dto.avatarUrl?.trim() || null,
      network: dto.network ?? WalletNetwork.STELLAR_MAINNET,
      tags: this.normalizeTags(dto.tags),
      usageCount: 0,
      lastUsedAt: null,
    });

    return this.savedAddressesRepository.save(entity);
  }

  async updateAddress(userId: string, id: string, dto: UpdateSavedAddressDto): Promise<SavedAddress> {
    const existing = await this.savedAddressesRepository.findByUserAndId(userId, id);
    if (!existing) {
      throw new NotFoundException('Saved address not found');
    }

    if (dto.alias && dto.alias.trim().length > 0) {
      const alias = dto.alias.trim();
      const aliasOwner = await this.savedAddressesRepository.findByAliasCaseInsensitive(userId, alias);
      if (aliasOwner && aliasOwner.id !== id) {
        throw new ConflictException('Alias already exists for this user');
      }
      existing.alias = alias;
    }

    if (dto.avatarUrl !== undefined) {
      existing.avatarUrl = dto.avatarUrl?.trim() || null;
    }

    if (dto.network) {
      existing.network = dto.network;
    }

    if (dto.tags !== undefined) {
      existing.tags = this.normalizeTags(dto.tags);
    }

    return this.savedAddressesRepository.save(existing);
  }

  async deleteAddress(userId: string, id: string): Promise<void> {
    const existing = await this.savedAddressesRepository.findByUserAndId(userId, id);
    if (!existing) {
      throw new NotFoundException('Saved address not found');
    }

    await this.savedAddressesRepository.remove(existing);
  }

  async getAddresses(userId: string): Promise<SavedAddress[]> {
    return this.savedAddressesRepository.findByUserId(userId);
  }

  async searchAddresses(userId: string, query: SearchSavedAddressesDto): Promise<SavedAddress[]> {
    if (query.suggest) {
      return this.savedAddressesRepository.searchForSuggestions(userId, query.q);
    }

    return this.savedAddressesRepository.searchByUser(userId, query.q, query.tag);
  }

  async resolveAlias(userId: string, aliasOrAddress: string): Promise<SavedAddress | null> {
    const value = aliasOrAddress.trim();
    if (!value) {
      return null;
    }

    const byAlias = await this.savedAddressesRepository.findByAliasCaseInsensitive(userId, value);
    if (byAlias) {
      return byAlias;
    }

    return this.savedAddressesRepository.findByAddressCaseInsensitive(userId, value);
  }

  async trackUsage(userId: string, savedAddressId: string): Promise<void> {
    const existing = await this.savedAddressesRepository.findByUserAndId(userId, savedAddressId);
    if (!existing) {
      return;
    }

    existing.usageCount += 1;
    existing.lastUsedAt = new Date();
    await this.savedAddressesRepository.save(existing);
  }

  async trackUsageByWalletAddress(userId: string, walletAddress: string): Promise<void> {
    const existing = await this.savedAddressesRepository.findByAddressCaseInsensitive(
      userId,
      walletAddress.trim(),
    );

    if (!existing) {
      return;
    }

    existing.usageCount += 1;
    existing.lastUsedAt = new Date();
    await this.savedAddressesRepository.save(existing);
  }

  private assertValidStellarAddress(walletAddress: string): void {
    if (!STELLAR_ADDRESS_REGEX.test(walletAddress)) {
      throw new BadRequestException(
        'walletAddress must be a valid 56-char Stellar address starting with G or C',
      );
    }
  }

  private async assertAliasUnique(userId: string, alias: string): Promise<void> {
    const existingAlias = await this.savedAddressesRepository.findByAliasCaseInsensitive(
      userId,
      alias,
    );
    if (existingAlias) {
      throw new ConflictException('Alias already exists for this user');
    }
  }

  private normalizeTags(tags?: string[]): string[] {
    if (!tags || tags.length === 0) {
      return [];
    }

    const normalized = tags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .map((tag) => tag.toLowerCase());

    return Array.from(new Set(normalized));
  }
}
