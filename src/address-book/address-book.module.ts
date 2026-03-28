import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedAddressesController } from './saved-addresses.controller';
import { SavedAddressesRepository } from './saved-addresses.repository';
import { SavedAddressesService } from './saved-addresses.service';
import { SavedAddress } from './entities/saved-address.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SavedAddress])],
  controllers: [SavedAddressesController],
  providers: [SavedAddressesService, SavedAddressesRepository],
  exports: [SavedAddressesService],
})
export class AddressBookModule {}
