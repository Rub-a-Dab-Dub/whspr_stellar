import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './contacts/entities/contact.entity';
import { ContactImportSession } from './contacts/entities/contact-import-session.entity';
import { UserContactHashIndex } from './contacts/entities/user-contact-hash-index.entity';
import { ContactsModule } from './contacts/contacts.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASS ?? 'postgres',
      database: process.env.DB_NAME ?? 'contacts_db',
      entities: [Contact, ContactImportSession, UserContactHashIndex],
      synchronize: process.env.NODE_ENV !== 'production',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }),
    AuthModule,
    ContactsModule,
  ],
})
export class AppModule {}
