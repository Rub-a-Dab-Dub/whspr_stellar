import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../entities/wallet.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { ethers } from 'ethers';
import * as crypto from 'crypto';

@Injectable()
export class WalletService {
  private readonly encryptionKey: string;

  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private transactionRepository: Repository<WalletTransaction>,
  ) {
    this.encryptionKey = process.env.WALLET_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  }

  async generateWallet(userId: string): Promise<Wallet> {
    const wallet = ethers.Wallet.createRandom();
    const sessionKey = this.generateSessionKey();
    const encryptedPrivateKey = this.encrypt(wallet.privateKey);

    const existingWallets = await this.walletRepository.count({ where: { userId } });

    const newWallet = this.walletRepository.create({
      address: wallet.address,
      encryptedPrivateKey,
      sessionKey,
      userId,
      isPrimary: existingWallets === 0,
      nonce: 0,
    });

    return this.walletRepository.save(newWallet);
  }

  async getWalletsByUser(userId: string): Promise<Wallet[]> {
    return this.walletRepository.find({ where: { userId, isActive: true } });
  }

  async getWalletById(id: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({ where: { id } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getBalance(walletId: string, rpcUrl: string): Promise<string> {
    const wallet = await this.getWalletById(walletId);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balance = await provider.getBalance(wallet.address);
    return ethers.formatEther(balance);
  }

  async exportWallet(walletId: string, userId: string): Promise<{ privateKey: string; address: string }> {
    const wallet = await this.walletRepository.findOne({ where: { id: walletId, userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const privateKey = this.decrypt(wallet.encryptedPrivateKey);
    return { privateKey, address: wallet.address };
  }

  async recoverWallet(privateKey: string, userId: string): Promise<Wallet> {
    const wallet = new ethers.Wallet(privateKey);
    const existing = await this.walletRepository.findOne({ where: { address: wallet.address } });
    
    if (existing) {
      if (existing.userId !== userId) throw new BadRequestException('Wallet belongs to another user');
      return existing;
    }

    const sessionKey = this.generateSessionKey();
    const encryptedPrivateKey = this.encrypt(privateKey);

    const newWallet = this.walletRepository.create({
      address: wallet.address,
      encryptedPrivateKey,
      sessionKey,
      userId,
      isPrimary: false,
      nonce: 0,
    });

    return this.walletRepository.save(newWallet);
  }

  async incrementNonce(walletId: string): Promise<number> {
    const wallet = await this.getWalletById(walletId);
    wallet.nonce += 1;
    await this.walletRepository.save(wallet);
    return wallet.nonce;
  }

  async setPrimaryWallet(walletId: string, userId: string): Promise<void> {
    await this.walletRepository.update({ userId, isPrimary: true }, { isPrimary: false });
    await this.walletRepository.update({ id: walletId, userId }, { isPrimary: true });
  }

  async getTransactionHistory(walletId: string): Promise<WalletTransaction[]> {
    return this.transactionRepository.find({ where: { walletId }, order: { createdAt: 'DESC' } });
  }

  private generateSessionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
