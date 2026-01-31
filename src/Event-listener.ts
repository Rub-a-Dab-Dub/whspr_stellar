
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

@InjectableDecorator()
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
          delay: 2000,
        },
      });

      this.logger.log(`Event saved and queued: ${blockchainEvent.id}`);
    } catch (error) {
      this.logger.error('Error processing event:', error);
    }
  }

  /**
   * Update confirmations for pending events
   */
  private async updateConfirmations(currentBlock: number): Promise<void> {
    try {
      const pendingEvents = await this.eventRepo.find({
        where: {
          status: EventStatus.PENDING,
        },
      });

      for (const event of pendingEvents) {
        const confirmations = currentBlock - Number(event.blockNumber);
        event.confirmations = confirmations;

        if (confirmations >= event.requiredConfirmations) {
          event.status = EventStatus.CONFIRMED;
          this.logger.log(
            `Event confirmed: ${event.id} (${confirmations} confirmations)`
          );
        }

        await this.eventRepo.save(event);
      }
    } catch (error) {
      this.logger.error('Error updating confirmations:', error);
    }
  }

  /**
   * Recover missed events
   */
  private async recoverMissedEvents(): Promise<void> {
    this.logger.log('Starting missed event recovery...');

    try {
      const currentBlock = await this.blockchainService.getCurrentBlockNumber();

      for (const [address, contract] of this.contracts) {
        // Get last synced block for each event type
        for (const eventType of Object.values(EventType)) {
          let syncState = await this.syncStateRepo.findOne({
            where: {
              contractAddress: address,
              eventType: eventType as EventType,
            },
          });

          if (!syncState) {
            // Initialize sync state
            const startBlock = this.configService.get<number>('START_BLOCK', currentBlock - 1000);
            syncState = this.syncStateRepo.create({
              contractAddress: address,
              eventType: eventType as EventType,
              lastSyncedBlock: BigInt(startBlock),
              lastSyncedAt: new Date(),
            });
            await this.syncStateRepo.save(syncState);
          }

          const fromBlock = Number(syncState.lastSyncedBlock) + 1;
          const toBlock = currentBlock;

          if (fromBlock <= toBlock) {
            await this.syncHistoricalEvents(
              address,
              contract,
              eventType as EventType,
              fromBlock,
              toBlock
            );

            // Update sync state
            syncState.lastSyncedBlock = BigInt(toBlock);
            syncState.lastSyncedAt = new Date();
            await this.syncStateRepo.save(syncState);
          }
        }
      }

      this.logger.log('✅ Missed event recovery completed');
    } catch (error) {
      this.logger.error('Error recovering missed events:', error);
    }
  }

  /**
   * Sync historical events
   */
  private async syncHistoricalEvents(
    contractAddress: string,
    contract: ethers.Contract,
    eventType: EventType,
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    try {
      this.logger.log(
        `Syncing ${eventType} events from block ${fromBlock} to ${toBlock}`
      );

      // Fetch events in chunks to avoid rate limits
      const chunkSize = 5000;
      let currentFrom = fromBlock;

      while (currentFrom <= toBlock) {
        const currentTo = Math.min(currentFrom + chunkSize - 1, toBlock);

        const filter = contract.filters[eventType]();
        const events = await contract.queryFilter(filter, currentFrom, currentTo);

        this.logger.log(
          `Found ${events.length} ${eventType} events in blocks ${currentFrom}-${currentTo}`
        );

        for (const event of events) {
          await this.processHistoricalEvent(
            contractAddress,
            eventType,
            event as ethers.EventLog
          );
        }

        currentFrom = currentTo + 1;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      this.logger.error(`Error syncing historical ${eventType} events:`, error);
      throw error;
    }
  }

  /**
   * Process historical event
   */
  private async processHistoricalEvent(
    contractAddress: string,
    eventType: EventType,
    event: ethers.EventLog
  ): Promise<void> {
    try {
      // Parse event data based on type
      let eventData: any;

      switch (eventType) {
        case EventType.TRANSFER:
          eventData = {
            from: event.args[0],
            to: event.args[1],
            amount: event.args[2].toString(),
          };
          break;
        case EventType.TIP:
          eventData = {
            from: event.args[0],
            to: event.args[1],
            amount: event.args[2].toString(),
            roomId: event.args[3],
          };
          break;
        case EventType.ROOM_ENTRY:
          eventData = {
            userId: event.args[0],
            roomId: event.args[1],
            entryFee: event.args[2].toString(),
          };
          break;
        default:
          eventData = {};
      }

      await this.processEvent(contractAddress, eventType, event, eventData);
    } catch (error) {
      this.logger.error('Error processing historical event:', error);
    }
  }

  /**
   * Get contract ABI
   */
  private getContractABI(contractName: string): any[] {
    // In production, load from files or environment
    // This is a simplified example
    const abis = {
      main: [
        'event Transfer(address indexed from, address indexed to, uint256 amount)',
        'event Tip(address indexed from, address indexed to, uint256 amount, uint256 indexed roomId)',
        'event RoomEntry(address indexed userId, uint256 indexed roomId, uint256 entryFee)',
        'event RoomCreated(uint256 indexed roomId, address indexed creator, uint256 entryFee)',
        'event RewardClaimed(address indexed user, uint256 amount)',
      ],
    };

    return abis[contractName] || [];
  }
}

// ============================================================================
// EVENT PROCESSING SERVICE (Bull Queue Processor)
// ============================================================================

import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('event-processing')
export class EventProcessingService {
  private readonly logger = new Logger(EventProcessingService.name);

  constructor(
    @InjectRepository(BlockchainEvent)
    private eventRepo: Repository<BlockchainEvent>,
    private webhookService: WebhookService,
    private databaseSyncService: DatabaseSyncService,
  ) {}

  @Process('process-event')
  async processEvent(job: Job): Promise<void> {
    const { eventId } = job.data;

    try {
      const event = await this.eventRepo.findOne({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error(`Event not found: ${eventId}`);
      }

      // Update status
      event.status = EventStatus.PROCESSING;
      await this.eventRepo.save(event);

      // Sync with database
      await this.databaseSyncService.syncEvent(event);

      // Mark as synced
      event.synced = true;
      event.syncedAt = new Date();
      await this.eventRepo.save(event);

      // Trigger webhooks
      await this.webhookService.triggerWebhooks(event);

      this.logger.log(`✅ Event processed successfully: ${eventId}`);
    } catch (error) {
      this.logger.error(`❌ Error processing event ${eventId}:`, error);

      // Update event with error
      const event = await this.eventRepo.findOne({
        where: { id: eventId },
      });

      if (event) {
        event.status = EventStatus.FAILED;
        event.errorMessage = error.message;
        event.retryCount += 1;
        event.lastRetryAt = new Date();
        await this.eventRepo.save(event);
      }

      throw error; // Re-throw for Bull to handle retry
    }
  }
}

// ============================================================================
// DATABASE SYNC SERVICE
// ============================================================================

@InjectableDecorator()
export class DatabaseSyncService {
  private readonly logger = new Logger(DatabaseSyncService.name);

  constructor(
    // Inject your repositories here (User, Transaction, Room, etc.)
  ) {}

  /**
   * Sync event with database
   */
  async syncEvent(event: BlockchainEvent): Promise<void> {
    switch (event.eventType) {
      case EventType.TRANSFER:
        await this.syncTransfer(event);
        break;
      case EventType.TIP:
        await this.syncTip(event);
        break;
      case EventType.ROOM_ENTRY:
        await this.syncRoomEntry(event);
        break;
      default:
        this.logger.warn(`Unknown event type: ${event.eventType}`);
    }
  }

  /**
   * Sync Transfer event
   */
  private async syncTransfer(event: BlockchainEvent): Promise<void> {
    const { from, to, amount } = event.eventData;

    this.logger.log(
      `Syncing Transfer: ${from} -> ${to}, ${ethers.formatEther(amount)} tokens`
    );

    // Update user balances, create transaction records, etc.
    // Example:
    // await this.userRepo.update({ address: from }, { balance: ... });
    // await this.userRepo.update({ address: to }, { balance: ... });
    // await this.transactionRepo.save({ ... });
  }

  /**
   * Sync Tip event
   */
  private async syncTip(event: BlockchainEvent): Promise<void> {
    const { from, to, amount, roomId } = event.eventData;

    this.logger.log(
      `Syncing Tip: ${from} -> ${to}, ${ethers.formatEther(amount)} tokens in room ${roomId}`
    );

    // Update tip records, user balances, room statistics, etc.
    // Example:
    // await this.tipRepo.save({ ... });
    // await this.roomRepo.update({ id: roomId }, { totalTips: ... });
  }

  /**
   * Sync RoomEntry event
   */
  private async syncRoomEntry(event: BlockchainEvent): Promise<void> {
    const { userId, roomId, entryFee } = event.eventData;

    this.logger.log(
      `Syncing RoomEntry: User ${userId} entered room ${roomId} with fee ${ethers.formatEther(entryFee)}`
    );

    // Update room participants, user room history, etc.
    // Example:
    // await this.roomParticipantRepo.save({ userId, roomId, ... });
  }
}

// ============================================================================
// WEBHOOK SERVICE
// ============================================================================

@InjectableDecorator()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(EventWebhook)
    private webhookRepo: Repository<EventWebhook>,
    @InjectRepository(WebhookDelivery)
    private deliveryRepo: Repository<WebhookDelivery>,
    @InjectQueue('webhook-delivery')
    private webhookQueue: Queue,
  ) {}

  /**
   * Trigger webhooks for an event
   */
  async triggerWebhooks(event: BlockchainEvent): Promise<void> {
    const webhooks = await this.webhookRepo.find({
      where: {
        isActive: true,
      },
    });

    for (const webhook of webhooks) {
      // Check if event matches webhook filters
      if (!this.matchesFilters(event, webhook)) {
        continue;
      }

      // Create delivery record
      const delivery = this.deliveryRepo.create({
        webhookId: webhook.id,
        eventId: event.id,
        payload: this.buildWebhookPayload(event),
        status: WebhookStatus.PENDING,
      });

      await this.deliveryRepo.save(delivery);

      // Queue for delivery
      await this.webhookQueue.add('send-webhook', {
        deliveryId: delivery.id,
        webhookId: webhook.id,
      }, {
        attempts: webhook.maxRetries,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        timeout: webhook.timeoutMs,
      });
    }
  }

  /**
   * Check if event matches webhook filters
   */
  private matchesFilters(
    event: BlockchainEvent,
    webhook: EventWebhook
  ): boolean {
    // Check event type
    if (!webhook.eventTypes.includes(event.eventType)) {
      return false;
    }

    // Check contract address filter
    if (
      webhook.filters?.contractAddresses &&
      !webhook.filters.contractAddresses.includes(event.contractAddress)
    ) {
      return false;
    }

    // Check minimum amount filter (for transfer/tip events)
    if (webhook.filters?.minAmount && event.eventData.amount) {
      const minAmount = BigInt(webhook.filters.minAmount);
      const eventAmount = BigInt(event.eventData.amount);
      if (eventAmount < minAmount) {
        return false;
      }
    }

    return true;
  }

  /**
   * Build webhook payload
   */
  private buildWebhookPayload(event: BlockchainEvent): any {
    return {
      id: event.id,
      type: event.eventType,
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      contractAddress: event.contractAddress,
      data: event.eventData,
      confirmations: event.confirmations,
      timestamp: event.createdAt.toISOString(),
    };
  }
}

// ============================================================================
// WEBHOOK DELIVERY PROCESSOR
// ============================================================================

import axios from 'axios';
import * as crypto from 'crypto';

@Processor('webhook-delivery')
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    @InjectRepository(EventWebhook)
    private webhookRepo: Repository<EventWebhook>,
    @InjectRepository(WebhookDelivery)
    private deliveryRepo: Repository<WebhookDelivery>,
  ) {}

  @Process('send-webhook')
  async sendWebhook(job: Job): Promise<void> {
    const { deliveryId, webhookId } = job.data;

    try {
      const [delivery, webhook] = await Promise.all([
        this.deliveryRepo.findOne({ where: { id: deliveryId } }),
        this.webhookRepo.findOne({ where: { id: webhookId } }),
      ]);

      if (!delivery || !webhook) {
        throw new Error('Delivery or webhook not found');
      }

      // Generate signature if secret is provided
      const headers: any = {
        'Content-Type': 'application/json',
        'X-Webhook-ID': webhook.id,
        'X-Delivery-ID': delivery.id,
      };

      if (webhook.secret) {
        const signature = this.generateSignature(
          delivery.payload,
          webhook.secret
        );
        headers['X-Webhook-Signature'] = signature;
      }

      // Send webhook
      const response = await axios.post(webhook.url, delivery.payload, {
        headers,
        timeout: webhook.timeoutMs,
      });

      // Update delivery as successful
      delivery.status = WebhookStatus.SENT;
      delivery.responseStatusCode = response.status;
      delivery.responseBody = JSON.stringify(response.data);
      delivery.sentAt = new Date();

      await this.deliveryRepo.save(delivery);

      this.logger.log(`✅ Webhook delivered: ${deliveryId}`);
    } catch (error) {
      this.logger.error(`❌ Webhook delivery failed: ${deliveryId}`, error);

      // Update delivery with error
      const delivery = await this.deliveryRepo.findOne({
        where: { id: deliveryId },
      });

      if (delivery) {
        delivery.status = WebhookStatus.FAILED;
        delivery.errorMessage = error.message;
        delivery.retryCount += 1;
        delivery.responseStatusCode = error.response?.status;
        delivery.responseBody = error.response?.data
          ? JSON.stringify(error.response.data)
          : null;

        await this.deliveryRepo.save(delivery);
      }

      throw error;
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }
}

// ============================================================================
// ANALYTICS SERVICE
// ============================================================================

@InjectableDecorator()
export class EventAnalyticsService {
  private readonly logger = new Logger(EventAnalyticsService.name);

  constructor(
    @InjectRepository(BlockchainEvent)
    private eventRepo: Repository<BlockchainEvent>,
    @InjectRepository(EventAnalytics)
    private analyticsRepo: Repository<EventAnalytics>,
  ) {}

  /**
   * Generate daily analytics
   */
  async generateDailyAnalytics(date: Date): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get unique contract addresses and event types
    const events = await this.eventRepo.find({
      where: {
        createdAt: Between(startOfDay, endOfDay),
      },
    });

    const combinations = new Map<string, BlockchainEvent[]>();

    for (const event of events) {
      const key = `${event.contractAddress}:${event.eventType}`;
      if (!combinations.has(key)) {
        combinations.set(key, []);
      }
      combinations.get(key).push(event);
    }

    // Generate analytics for each combination
    for (const [key, eventList] of combinations) {
      const [contractAddress, eventType] = key.split(':');

      const confirmedEvents = eventList.filter(
        e => e.status === EventStatus.CONFIRMED
      );
      const failedEvents = eventList.filter(
        e => e.status === EventStatus.FAILED
      );

      // Calculate average confirmation time
      const confirmationTimes = confirmedEvents
        .filter(e => e.syncedAt)
        .map(e => 
          Math.floor((e.syncedAt.getTime() - e.createdAt.getTime()) / 1000)
        );

      const avgConfirmationTime = confirmationTimes.length > 0
        ? Math.floor(
            confirmationTimes.reduce((a, b) => a + b, 0) / confirmationTimes.length
          )
        : 0;

      // Calculate total volume (for transfer/tip events)
      let totalVolume = '0';
      if ([EventType.TRANSFER, EventType.TIP].includes(eventType as EventType)) {
        totalVolume = eventList
          .reduce((sum, e) => {
            return sum + (BigInt(e.eventData.amount || '0'));
          }, BigInt(0))
          .toString();
      }

      // Save analytics
      const analytics = this.analyticsRepo.create({
        date: startOfDay,
        eventType: eventType as EventType,
        contractAddress,
        totalEvents: eventList.length,
        confirmedEvents: confirmedEvents.length,
        failedEvents: failedEvents.length,
        averageConfirmationTime: avgConfirmationTime,
        totalVolume,
      });

      await this.analyticsRepo.save(analytics);

      this.logger.log(
        `Analytics generated for ${eventType} on ${contractAddress}`
      );
    }
  }
}

// ============================================================================
// MONITORING CONTROLLER
// ============================================================================

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Blockchain Events')
@Controller('events')
export class EventsController {
  constructor(
    @InjectRepository(BlockchainEvent)
    private eventRepo: Repository<BlockchainEvent>,
    @InjectRepository(EventSyncState)
    private syncStateRepo: Repository<EventSyncState>,
    private blockchainService: BlockchainConnectionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get blockchain events' })
  async getEvents(@Query() dto: EventFilterDto) {
    const queryBuilder = this.eventRepo.createQueryBuilder('event');

    if (dto.eventType && dto.eventType.length > 0) {
      queryBuilder.andWhere('event.eventType IN (:...types)', {
        types: dto.eventType,
      });
    }

    if (dto.contractAddress && dto.contractAddress.length > 0) {
      queryBuilder.andWhere('event.contractAddress IN (:...addresses)', {
        addresses: dto.contractAddress,
      });
    }

    if (dto.status && dto.status.length > 0) {
      queryBuilder.andWhere('event.status IN (:...statuses)', {
        statuses: dto.status,
      });
    }

    if (dto.fromBlock) {
      queryBuilder.andWhere('event.blockNumber >= :fromBlock', {
        fromBlock: dto.fromBlock,
      });
    }

    if (dto.toBlock) {
      queryBuilder.andWhere('event.blockNumber <= :toBlock', {
        toBlock: dto.toBlock,
      });
    }

    if (dto.minConfirmations) {
      queryBuilder.andWhere('event.confirmations >= :minConfirmations', {
        minConfirmations: dto.minConfirmations,
      });
    }

    const skip = (dto.page - 1) * dto.limit;
    queryBuilder.skip(skip).take(dto.limit);
    queryBuilder.orderBy('event.blockNumber', 'DESC');

    const [events, total] = await queryBuilder.getManyAndCount();

    return {
      events,
      pagination: {
        page: dto.page,
        limit: dto.limit,
        total,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStats(): Promise<DashboardStatsDto> {
    const [
      totalEvents,
      pendingEvents,
      confirmedEvents,
      failedEvents,
      currentBlockNumber,
      syncStates,
    ] = await Promise.all([
      this.eventRepo.count(),
      this.eventRepo.count({ where: { status: EventStatus.PENDING } }),
      this.eventRepo.count({ where: { status: EventStatus.CONFIRMED } }),
      this.eventRepo.count({ where: { status: EventStatus.FAILED } }),
      this.blockchainService.getCurrentBlockNumber(),
      this.syncStateRepo.find(),
    ]);

    // Get events from last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const eventsLast24h = await this.eventRepo.count({
      where: {
        createdAt: MoreThanOrEqual(oneDayAgo),
      },
    });

    // Calculate average confirmation time
    const recentConfirmed = await this.eventRepo.find({
      where: {
        status: EventStatus.CONFIRMED,
      },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    const avgConfirmationTime = recentConfirmed.length > 0
      ? Math.floor(
          recentConfirmed
            .filter(e => e.syncedAt)
            .map(e => (e.syncedAt.getTime() - e.createdAt.getTime()) / 1000)
            .reduce((a, b) => a + b, 0) / recentConfirmed.length
        )
      : 0;

    const syncStatus = {};
    for (const state of syncStates) {
      syncStatus[state.contractAddress] = {
        lastSyncedBlock: Number(state.lastSyncedBlock),
        isActive: state.isActive,
      };
    }

    return {
      totalEvents,
      pendingEvents,
      confirmedEvents,
      failedEvents,
      averageConfirmationTime: avgConfirmationTime,
      eventsLast24h,
      currentBlockNumber,
      syncStatus,
    };
  }
}

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    @InjectRepository(EventWebhook)
    private webhookRepo: Repository<EventWebhook>,
    @InjectRepository(WebhookDelivery)
    private deliveryRepo: Repository<WebhookDelivery>,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create webhook' })
  async createWebhook(@Body() dto: CreateWebhookDto) {
    const webhook = this.webhookRepo.create(dto);
    return await this.webhookRepo.save(webhook);
  }

  @Get()
  @ApiOperation({ summary: 'List webhooks' })
  async listWebhooks() {
    return await this.webhookRepo.find();
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Get webhook deliveries' })
  async getDeliveries(
    @Param('id') webhookId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50
  ) {
    const skip = (page - 1) * limit;

    const [deliveries, total] = await this.deliveryRepo.findAndCount({
      where: { webhookId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      deliveries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update webhook' })
  async updateWebhook(
    @Param('id') id: string,
    @Body() updates: Partial<CreateWebhookDto>
  ) {
    await this.webhookRepo.update(id, updates);
    return await this.webhookRepo.findOne({ where: { id } });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete webhook' })
  async deleteWebhook(@Param('id') id: string) {
    await this.webhookRepo.delete(id);
    return { success: true };
  }
}

// ============================================================================
// MODULE
// ============================================================================

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MoreThanOrEqual, Between } from 'typeorm';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([
      BlockchainEvent,
      EventSyncState,
      EventWebhook,
      WebhookDelivery,
      EventAnalytics,
    ]),
    BullModule.registerQueue(
      {
        name: 'event-processing',
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
      {
        name: 'webhook-delivery',
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
        },
      }
    ),
    ScheduleModule.forRoot(),
  ],
  controllers: [EventsController, WebhooksController],
  providers: [
    BlockchainConnectionService,
    EventListenerService,
    EventProcessingService,
    DatabaseSyncService,
    WebhookService,
    WebhookDeliveryService,
    EventAnalyticsService,
  ],
  exports: [EventListenerService, DatabaseSyncService],
})
export class BlockchainEventsModule {}
