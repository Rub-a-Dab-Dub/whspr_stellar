import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EmailDelivery } from './entities/email-delivery.entity';
import { EmailUnsubscribe } from './entities/email-unsubscribe.entity';

@Injectable()
export class EmailDeliveriesRepository extends Repository<EmailDelivery> {
  constructor(private readonly dataSource: DataSource) {
    super(EmailDelivery, dataSource.createEntityManager());
  }
}

@Injectable()
export class EmailUnsubscribesRepository extends Repository<EmailUnsubscribe> {
  constructor(private readonly dataSource: DataSource) {
    super(EmailUnsubscribe, dataSource.createEntityManager());
  }

  findByEmail(email: string): Promise<EmailUnsubscribe | null> {
    return this.findOne({ where: { email: email.toLowerCase() } });
  }
}
