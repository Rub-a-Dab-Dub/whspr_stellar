import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaymentsModule } from './payments/payments.module';
import { MessagesModule } from './messages/messages.module';
import { PlatformConfigModule } from './platform-config/platform-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
      username: process.env.DATABASE_USER ?? 'postgres',
      password: process.env.DATABASE_PASS ?? 'postgres',
      database: process.env.DATABASE_NAME ?? 'whspr',
      autoLoadEntities: true,
      synchronize: false,
    }),
    PaymentsModule,
    MessagesModule,
    PlatformConfigModule,
  ],
})
export class AppModule {}
