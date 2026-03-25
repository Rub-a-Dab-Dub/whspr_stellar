import { Test, TestingModule } from '@nestjs/testing';
import { UserSettingsService } from './user-settings.service';
import { UserSettingsRepository } from '../repositories/user-settings.repository';
import { UserSettings, VisibilityType } from '../entities/user-settings.entity';
import { BadRequestException } from '@nestjs/common';

// Mocking authenticator to avoid dependency issues if not installed
jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: jest.fn().mockReturnValue('SECRET123'),
    keyuri: jest.fn().mockReturnValue('otpauth://...'),
    check: jest.fn().mockReturnValue(true),
  },
}));

import { authenticator } from 'otplib';

describe('UserSettingsService', () => {
  let service: UserSettingsService;
  let repository: Partial<UserSettingsRepository>;

  beforeEach(async () => {
    repository = {
      findByUserId: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      deleteByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSettingsService,
        { provide: UserSettingsRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<UserSettingsService>(UserSettingsService);
  });

  describe('getSettings', () => {
    it('should return existing settings', async () => {
      const settings = { userId: 'u1', theme: 'light' };
      (repository.findByUserId as jest.Mock).mockResolvedValue(settings);
      
      const result = await service.getSettings('u1');
      expect(result).toBe(settings);
    });

    it('should auto-create settings if not found', async () => {
      (repository.findByUserId as jest.Mock).mockResolvedValue(null);
      (repository.create as jest.Mock).mockImplementation((s) => s);
      
      const result = await service.getSettings('u1');
      expect(result.userId).toBe('u1');
      expect(repository.create).toHaveBeenCalled();
    });
  });

  describe('resetSettings', () => {
    it('should delete existing settings and create new defaults', async () => {
      (repository.create as jest.Mock).mockImplementation((s) => s);
      await service.resetSettings('u1');
      expect(repository.deleteByUserId).toHaveBeenCalledWith('u1');
      expect(repository.create).toHaveBeenCalled();
    });
  });

  describe('2FA flows', () => {
    it('should initiate 2FA enable', async () => {
      const settings = { userId: 'u1', twoFactorEnabled: false };
      (repository.findByUserId as jest.Mock).mockResolvedValue(settings);
      
      const result = await service.enable2FA('u1');
      expect(result.secret).toBe('SECRET123');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should confirm 2FA setup', async () => {
      const settings = { userId: 'u1', twoFactorSecret: 'SECRET123', twoFactorEnabled: false };
      (repository.findByUserId as jest.Mock).mockResolvedValue(settings);
      (authenticator.check as jest.Mock).mockReturnValue(true);
      
      await service.confirm2FA('u1', '123456');
      expect(settings.twoFactorEnabled).toBe(true);
    });

    it('should throw on invalid token during confirm', async () => {
      const settings = { userId: 'u1', twoFactorSecret: 'SECRET123', twoFactorEnabled: false };
      (repository.findByUserId as jest.Mock).mockResolvedValue(settings);
      (authenticator.check as jest.Mock).mockReturnValue(false);
      
      await expect(service.confirm2FA('u1', '000000')).rejects.toThrow(BadRequestException);
    });
  });
});
