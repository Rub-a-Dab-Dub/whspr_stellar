import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QrCodeModule } from '../qr-code/qr-code.module';
import { DiscoveryUserBlock } from './entities/discovery-user-block.entity';
import { UsernameDiscoveryController } from './username-discovery.controller';
import { UsernameDiscoveryService } from './username-discovery.service';

@Module({
  imports: [TypeOrmModule.forFeature([DiscoveryUserBlock]), QrCodeModule],
  controllers: [UsernameDiscoveryController],
  providers: [UsernameDiscoveryService],
  exports: [UsernameDiscoveryService],
})
export class UsernameDiscoveryModule {}
