

// ============================================================================
// ENTITIES
// ============================================================================

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { Between, MoreThanOrEqual } from 'typeorm';
export enum EventType {
  TRANSFER = 'Transfer',
  TIP = 'Tip',
  ROOM_ENTRY = 'RoomEntry',
  ROOM_CREATED = 'RoomCreated',
  REWARD_CLAIMED = 'RewardClaimed',
}

export enum EventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

export enum WebhookStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  DISABLED = 'disabled',
}

@Entity('blockchain_events')
@Index(['eventType', 'status', 'blockNumber'])
@Index(['transactionHash', 'logIndex'], { unique: true })
@Index(['contractAddress', 'eventType'])
@Index(['blockNumber'])
export class BlockchainEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 66 })
  transactionHash: string;

  @Column({ type: 'integer' })
  logIndex: number;

  @Column({ type: 'bigint' })
  blockNumber: number;

  @Column({ type: 'varchar', length: 66 })
  blockHash: string;

  @Column({ type: 'varchar', length: 42 })
  contractAddress: string;

  @Column({ type: 'enum', enum: EventType })
  eventType: EventType;

  @Column({ type: 'jsonb' })
  eventData: {
    from?: string;
    to?: string;
    amount?: string;
    tokenId?: string;
    roomId?: string;
    userId?: string;
    [key: string]: any;
  };

  @Column({ type: 'jsonb' })
  rawLog: {
    address: string;
    topics: string[];
    data: string;
  };

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.PENDING })
  status: EventStatus;

  @Column({ type: 'integer', default: 0 })
  confirmations: number;

  @Column({ type: 'integer', default: 12 })
  requiredConfirmations: number;

  @Column({ type: 'boolean', default: false })
  synced: boolean;

  @Column({ type: 'timestamp', nullable: true })
  syncedAt: Date;

  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'timestamp', nullable: true })
  lastRetryAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('event_sync_state')
export class EventSyncState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 42 })
  contractAddress: string;

  @Column({ type: 'enum', enum: EventType })
  eventType: EventType;

  @Column({ type: 'bigint' })
  lastSyncedBlock: number;

  @Column({ type: 'timestamp' })
  lastSyncedAt: Date;

  @Column({ type: 'bigint', default: 0 })
  totalEventsSynced: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('event_webhooks')
@Index(['eventType', 'isActive'])
export class EventWebhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  secret: string; // For signing webhook payloads

  @Column({ type: 'enum', enum: EventType, array: true })
  eventTypes: EventType[];

  @Column({ type: 'jsonb', nullable: true })
  filters: {
    contractAddresses?: string[];
    minAmount?: string;
    [key: string]: any;
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 3 })
  maxRetries: number;

  @Column({ type: 'integer', default: 5000 })
  timeoutMs: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('webhook_deliveries')
@Index(['webhookId', 'status'])
@Index(['eventId'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  webhookId: string;

  @Column({ type: 'uuid' })
  eventId: string;

  @Column({ type: 'enum', enum: WebhookStatus, default: WebhookStatus.PENDING })
  status: WebhookStatus;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ type: 'integer', nullable: true })
  responseStatusCode: number;

  @Column({ type: 'text', nullable: true })
  responseBody: string;

  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('event_analytics')
export class EventAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'enum', enum: EventType })
  eventType: EventType;

  @Column({ type: 'varchar', length: 42 })
  contractAddress: string;

  @Column({ type: 'integer', default: 0 })
  totalEvents: number;

  @Column({ type: 'integer', default: 0 })
  confirmedEvents: number;

  @Column({ type: 'integer', default: 0 })
  failedEvents: number;

  @Column({ type: 'integer', default: 0 })
  averageConfirmationTime: number; // in seconds

  @Column({ type: 'decimal', precision: 20, scale: 0, nullable: true })
  totalVolume: string; // For transfer/tip events

  @CreateDateColumn()
  createdAt: Date;
}

// ============================================================================
// DTOs
// ============================================================================

export class EventFilterDto {
  eventType?: EventType[];
  contractAddress?: string[];
  status?: EventStatus[];
  fromBlock?: number;
  toBlock?: number;
  minConfirmations?: number;
  page?: number = 1;
  limit?: number = 50;
}

export class CreateWebhookDto {
  name: string;
  url: string;
  secret?: string;
  eventTypes: EventType[];
  filters?: {
    contractAddresses?: string[];
    minAmount?: string;
  };
  maxRetries?: number = 3;
  timeoutMs?: number = 5000;
}

export class EventDto {
  id: string;
  transactionHash: string;
  blockNumber: number;
  eventType: EventType;
  eventData: any;
  status: EventStatus;
  confirmations: number;
  synced: boolean;
  createdAt: Date;
}

export class DashboardStatsDto {
  totalEvents: number;
  pendingEvents: number;
  confirmedEvents: number;
  failedEvents: number;
  averageConfirmationTime: number;
  eventsLast24h: number;
  currentBlockNumber: number;
  syncStatus: {
    [contractAddress: string]: {
      lastSyncedBlock: number;
      isActive: boolean;
    };
  };
}

// ============================================================================
// BLOCKCHAIN CONNECTION SERVICE
// ============================================================================

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BlockchainConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlockchainConnectionService.name);
  private provider: ethers.WebSocketProvider;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Connect to blockchain WebSocket RPC
   */
  private async connect(): Promise<void> {
    try {
      const wsUrl = this.configService.get<string>('BLOCKCHAIN_WS_URL');
      
      this.provider = new ethers.WebSocketProvider(wsUrl);

      // Set up event listeners for connection
      this.provider.websocket.on('open', () => {
        this.logger.log('✅ WebSocket connection established');
        this.reconnectAttempts = 0;
      });

      this.provider.websocket.on('close', async () => {
        this.logger.warn('⚠️ WebSocket connection closed');
        await this.handleReconnect();
      });

      this.provider.websocket.on('error', (error) => {
        this.logger.error('❌ WebSocket error:', error);
      });

      // Verify connection
      const network = await this.provider.getNetwork();
      this.logger.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);

    } catch (error) {
      this.logger.error('Failed to connect to blockchain:', error);
      await this.handleReconnect();
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached. Manual intervention required.');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.logger.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    await new Promise(resolve => setTimeout(resolve, delay));
    await this.connect();
  }

  /**
   * Disconnect from blockchain
   */
  private async disconnect(): Promise<void> {
    if (this.provider) {
      await this.provider.destroy();
      this.logger.log('Disconnected from blockchain');
    }
  }

  /**
   * Get provider instance
   */
  getProvider(): ethers.WebSocketProvider {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    return this.provider;
  }

  /**
   * Get current block number
   */
  async getCurrentBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  /**
   * Get contract instance
   */
  getContract(address: string, abi: any[]): ethers.Contract {
    return new ethers.Contract(address, abi, this.provider);
  }
}

// ============================================================================
// EVENT LISTENER SERVICE
// ============================================================================

import { Injectable as InjectableDecorator } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class EventListenerService implements OnModuleInit {
  private readonly logger = new Logger(EventListenerService.name);
  private contracts: Map<string, ethers.Contract> = new Map();
  private eventFilters: Map<string, ethers.EventLog> = new Map();

  constructor(
    private blockchainService: BlockchainConnectionService,
    @InjectRepository(BlockchainEvent)
    private eventRepo: Repository<BlockchainEvent>,
    @InjectRepository(EventSyncState)
    private syncStateRepo: Repository<EventSyncState>,
    @InjectQueue('event-processing')
    private eventQueue: Queue,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initializeContracts();
    await this.startListening();
    await this.recoverMissedEvents();
  }

  /**
   * Initialize smart contracts
   */
  private async initializeContracts(): Promise<void> {
    // Load contract configurations from environment
    const contractConfigs = [
      {
        name: 'MainContract',
        address: this.configService.get<string>('MAIN_CONTRACT_ADDRESS'),
        abi: this.getContractABI('main'),
      },
      // Add more contracts as needed
    ];

    for (const config of contractConfigs) {
      const contract = this.blockchainService.getContract(
        config.address,
        config.abi
      );
      this.contracts.set(config.address, contract);
      this.logger.log(`Initialized contract: ${config.name} at ${config.address}`);
    }
  }

  /**
   * Start listening to events
   */
  private async startListening(): Promise<void> {
    for (const [address, contract] of this.contracts) {
      // Listen to Transfer events
      contract.on('Transfer', async (...args) => {
        await this.handleTransferEvent(address, args);
      });

      // Listen to Tip events
      contract.on('Tip', async (...args) => {
        await this.handleTipEvent(address, args);
      });

      // Listen to RoomEntry events
      contract.on('RoomEntry', async (...args) => {
        await this.handleRoomEntryEvent(address, args);
      });

      this.logger.log(`Started listening to events for contract: ${address}`);
    }

    // Listen to new blocks for confirmation tracking
    const provider = this.blockchainService.getProvider();
    provider.on('block', async (blockNumber) => {
      await this.updateConfirmations(blockNumber);
    });
  }

  /**
   * Handle Transfer event
   */
  private async handleTransferEvent(
    contractAddress: string,
    args: any[]
  ): Promise<void> {
    try {
      const event = args[args.length - 1]; // Last arg is the event object
      const [from, to, amount] = args;

      const eventData = {
        from: from,
        to: to,
        amount: amount.toString(),
      };

      await this.processEvent(
        contractAddress,
        EventType.TRANSFER,
        event,
        eventData
      );

      this.logger.log(
        `Transfer event detected: ${from} -> ${to}, Amount: ${ethers.formatEther(amount)}`
      );
    } catch (error) {
      this.logger.error('Error handling Transfer event:', error);
    }
  }

  /**
   * Handle Tip event
   */
  private async handleTipEvent(
    contractAddress: string,
    args: any[]
  ): Promise<void> {
    try {
      const event = args[args.length - 1];
      const [from, to, amount, roomId] = args;

      const eventData = {
        from: from,
        to: to,
        amount: amount.toString(),
        roomId: roomId,
      };

      await this.processEvent(
        contractAddress,
        EventType.TIP,
        event,
        eventData
      );

      this.logger.log(
        `Tip event detected: ${from} -> ${to}, Amount: ${ethers.formatEther(amount)}, Room: ${roomId}`
      );
    } catch (error) {
      this.logger.error('Error handling Tip event:', error);
    }
  }

  /**
   * Handle RoomEntry event
   */
  private async handleRoomEntryEvent(
    contractAddress: string,
    args: any[]
  ): Promise<void> {
    try {
      const event = args[args.length - 1];
      const [userId, roomId, entryFee] = args;

      const eventData = {
        userId: userId,
        roomId: roomId,
        entryFee: entryFee.toString(),
      };

      await this.processEvent(
        contractAddress,
        EventType.ROOM_ENTRY,
        event,
        eventData
      );

      this.logger.log(
        `RoomEntry event detected: User ${userId} entered room ${roomId}`
      );
    } catch (error) {
      this.logger.error('Error handling RoomEntry event:', error);
    }
  }

  /**
   * Process and save event
   */
  private async processEvent(
    contractAddress: string,
    eventType: EventType,
    event: any,
    eventData: any
  ): Promise<void> {
    try {
      // Check if event already exists
      const existing = await this.eventRepo.findOne({
        where: {
          transactionHash: event.transactionHash,
          logIndex: event.logIndex,
        },
      });

      if (existing) {
        this.logger.debug(`Event already processed: ${event.transactionHash}`);
        return;
      }

      // Create event record
      const blockchainEvent = this.eventRepo.create({
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        blockNumber: Number(event.blockNumber),
        blockHash: event.blockHash,
        contractAddress,
        eventType,
        eventData,
        rawLog: {
          address: event.address,
          topics: event.topics,
          data: event.data,
        },
        status: EventStatus.PENDING,
        confirmations: 0,
      });

      await this.eventRepo.save(blockchainEvent);

      // Add to processing queue
      await this.eventQueue.add('process-event', {
        eventId: blockchainEvent.id,
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',