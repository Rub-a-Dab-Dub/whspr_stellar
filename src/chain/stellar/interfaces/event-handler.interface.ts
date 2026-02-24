import { StellarBlockchainEvent } from '../entities/stellar-event.entity';

export interface IStellarEventHandler {
    handle(event: StellarBlockchainEvent): Promise<void>;
}
