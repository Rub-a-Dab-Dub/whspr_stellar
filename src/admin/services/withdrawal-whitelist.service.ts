import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WithdrawalWhitelist,
  Chain,
} from '../entities/withdrawal-whitelist.entity';
import { User } from 'src/user/entities/user.entity';
import { isAddress } from 'ethers/lib/utils';

@Injectable()
export class WithdrawalWhitelistService {
  constructor(
    @InjectRepository(WithdrawalWhitelist)
    private readonly repo: Repository<WithdrawalWhitelist>,
  ) {}

  async list() {
    return this.repo.find({
      relations: ['addedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async add(
    admin: User,
    data: {
      address: string;
      label: string;
      chain: Chain;
      confirmAddress: string;
    },
  ) {
    if (admin.role !== 'super_admin') throw new ForbiddenException();

    // Confirm address match
    if (data.address !== data.confirmAddress)
      throw new BadRequestException('confirmAddress does not match address');

    // Validate EVM address if chain is EVM
    if (['eth', 'bsc', 'polygon'].includes(data.chain)) {
      if (!isAddress(data.address))
        throw new BadRequestException('Invalid EVM address');
    }

    const exists = await this.repo.findOne({
      where: { address: data.address },
    });
    if (exists) throw new ConflictException('Address already whitelisted');

    const whitelist = this.repo.create({
      address: data.address,
      label: data.label,
      chain: data.chain,
      addedBy: user,
    });

    return this.repo.save(whitelist);
  }

  async updateLabel(id: string, label: string, admin: User) {
    if (admin.role !== 'super_admin') throw new ForbiddenException();

    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException();

    record.label = label;
    return this.repo.save(record);
  }

  async remove(
    id: string,
    reason: string,
    admin: User,
    checkPendingWithdrawal: (address: string) => Promise<boolean>,
  ) {
    if (admin.role !== 'super_admin') throw new ForbiddenException();

    const record = await this.repo.findOne({
      where: { id },
      relations: ['addedBy'],
    });
    if (!record) throw new NotFoundException();

    // Check pending withdrawals
    const hasPending = await checkPendingWithdrawal(record.address);
    if (hasPending)
      throw new ConflictException(
        'Cannot delete address with pending withdrawal',
      );

    // Log audit here: record.address, admin.id, reason

    return this.repo.remove(record);
  }
}
