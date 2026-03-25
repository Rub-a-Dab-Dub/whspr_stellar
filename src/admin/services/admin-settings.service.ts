import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../entities/system-setting.entity';
import { CreateSystemSettingDto, UpdateSystemSettingDto } from '../dto/system-setting.dto';

@Injectable()
export class AdminSettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly systemSettingRepository: Repository<SystemSetting>,
  ) {}

  async findAll() {
    return this.systemSettingRepository.find({ order: { key: 'ASC' } });
  }

  async findOne(key: string) {
    const setting = await this.systemSettingRepository.findOne({ where: { key } });
    if (!setting) {
      throw new NotFoundException(`Setting with key ${key} not found`);
    }
    return setting;
  }

  async createOrUpdate(createDto: CreateSystemSettingDto) {
    let setting = await this.systemSettingRepository.findOne({ where: { key: createDto.key } });
    if (setting) {
      setting.value = createDto.value;
      if (createDto.description !== undefined) {
        setting.description = createDto.description;
      }
    } else {
      setting = this.systemSettingRepository.create(createDto);
    }
    return this.systemSettingRepository.save(setting);
  }

  async update(key: string, updateDto: UpdateSystemSettingDto) {
    const setting = await this.findOne(key);
    if (updateDto.value !== undefined) setting.value = updateDto.value;
    if (updateDto.description !== undefined) setting.description = updateDto.description;
    return this.systemSettingRepository.save(setting);
  }

  async remove(key: string) {
    const setting = await this.findOne(key);
    await this.systemSettingRepository.remove(setting);
    return { success: true, message: `Setting ${key} removed` };
  }
}
