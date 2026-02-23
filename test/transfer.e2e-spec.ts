import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { TransferController } from '../src/transfer/transfer.controller';
import { TransferService } from '../src/transfer/transfer.service';
import { TransferReceiptService } from '../src/transfer/services/transfer-receipt.service';
import { TransferAnalyticsService } from '../src/transfer/services/transfer-analytics.service';
import { TransferTemplateService } from '../src/transfer/services/transfer-template.service';
import { TransferLimitService } from '../src/transfer/services/transfer-limit.service';
import { ScheduledTransferService } from '../src/transfer/services/scheduled-transfer.service';
import { TransferDisputeService } from '../src/transfer/services/transfer-dispute.service';
import { Transfer, TransferStatus, TransferType } from '../src/transfer/entities/transfer.entity';
import { BulkTransfer, BulkTransferStatus } from '../src/transfer/entities/bulk-transfer.entity';

const SENDER_ID = '550e8400-e29b-41d4-a716-446655440001';
const RECIPIENT_ID = '550e8400-e29b-41d4-a716-446655440002';
const TRANSFER_ID = '550e8400-e29b-41d4-a716-446655440010';
const BULK_ID = '550e8400-e29b-41d4-a716-446655440020';

const mockTransfer: Transfer = {
    id: TRANSFER_ID,
    senderId: SENDER_ID,
    recipientId: RECIPIENT_ID,
    amount: '50.00000000',
    blockchainNetwork: 'stellar',
    transactionHash: null,
    status: TransferStatus.PENDING,
    type: TransferType.P2P,
    memo: 'test memo',
    note: 'internal note',
    bulkTransferId: null,
    senderBalanceBefore: '1000.00000000',
    senderBalanceAfter: null,
    recipientBalanceBefore: '200.00000000',
    recipientBalanceAfter: null,
    failureReason: null,
    retryCount: 0,
    completedAt: null,
    failedAt: null,
    createdAt: new Date('2026-02-23T10:00:00Z'),
    updatedAt: new Date('2026-02-23T10:00:00Z'),
    sender: { id: SENDER_ID, email: 'sender@example.com' } as any,
    recipient: { id: RECIPIENT_ID, email: 'recipient@example.com' } as any,
} as any;

describe('P2P Transfers - API (e2e)', () => {
    let app: INestApplication;
    let transferService: Partial<jest.Mocked<TransferService>>;

    const mockTransferService: jest.Mocked<Partial<TransferService>> = {
        createTransfer: jest.fn(),
        createBulkTransfer: jest.fn(),
        getTransferHistory: jest.fn(),
        getTransferById: jest.fn(),
        getBulkTransferById: jest.fn(),
        getBulkTransferItems: jest.fn(),
        confirmTransfer: jest.fn(),
    };

    const mockReceiptService = {
        generateReceipt: jest.fn(),
    };

    const mockAnalyticsService = {
        getUserAnalytics: jest.fn(),
    };

    const mockTemplateService = {
        createTemplate: jest.fn(),
        getTemplates: jest.fn(),
        getFavorites: jest.fn(),
        getTemplateById: jest.fn(),
        updateTemplate: jest.fn(),
        deleteTemplate: jest.fn(),
        toggleFavorite: jest.fn(),
        incrementUseCount: jest.fn(),
    };

    const mockLimitService = {
        getLimits: jest.fn(),
        setLimit: jest.fn(),
        removeLimit: jest.fn(),
    };

    const mockScheduledTransferService = {
        createScheduledTransfer: jest.fn(),
        getScheduledTransfers: jest.fn(),
        getScheduledTransferById: jest.fn(),
        cancelScheduledTransfer: jest.fn(),
    };

    const mockDisputeService = {
        createDispute: jest.fn(),
        getDisputes: jest.fn(),
        getDisputeById: jest.fn(),
        addEvidence: jest.fn(),
        getDisputeStatistics: jest.fn(),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [TransferController],
            providers: [
                { provide: TransferService, useValue: mockTransferService },
                { provide: TransferReceiptService, useValue: mockReceiptService },
                { provide: TransferAnalyticsService, useValue: mockAnalyticsService },
                { provide: TransferTemplateService, useValue: mockTemplateService },
                { provide: TransferLimitService, useValue: mockLimitService },
                { provide: ScheduledTransferService, useValue: mockScheduledTransferService },
                { provide: TransferDisputeService, useValue: mockDisputeService },
            ],
        })
            // Bypass JWT: inject a mock user into request
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (ctx: any) => {
                    const req = ctx.switchToHttp().getRequest();
                    req.user = { id: SENDER_ID, sub: SENDER_ID };
                    return true;
                },
            })
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({ whitelist: true, transform: true }),
        );
        await app.init();

        transferService = moduleFixture.get<TransferService>(TransferService) as any;
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ─── POST /transfers ──────────────────────────────────────────────────────

    describe('POST /transfers', () => {
        it('should create a P2P transfer (201)', async () => {
            mockTransferService.createTransfer!.mockResolvedValue(mockTransfer);

            const res = await request(app.getHttpServer())
                .post('/transfers')
                .send({
                    recipientId: RECIPIENT_ID,
                    amount: 50,
                    memo: 'test memo',
                    note: 'internal note',
                    blockchainNetwork: 'stellar',
                })
                .expect(HttpStatus.CREATED);

            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(TRANSFER_ID);
            expect(res.body.data.status).toBe(TransferStatus.PENDING);
            expect(mockTransferService.createTransfer).toHaveBeenCalledWith(
                SENDER_ID,
                expect.objectContaining({ recipientId: RECIPIENT_ID, amount: 50 }),
            );
        });

        it('should reject transfer with invalid amount (400)', async () => {
            await request(app.getHttpServer())
                .post('/transfers')
                .send({ recipientId: RECIPIENT_ID, amount: -10 })
                .expect(HttpStatus.BAD_REQUEST);
        });

        it('should reject transfer with missing recipientId (400)', async () => {
            await request(app.getHttpServer())
                .post('/transfers')
                .send({ amount: 50 })
                .expect(HttpStatus.BAD_REQUEST);
        });

        it('should reject transfer with amount exceeding max (400)', async () => {
            await request(app.getHttpServer())
                .post('/transfers')
                .send({ recipientId: RECIPIENT_ID, amount: 2_000_000_000 })
                .expect(HttpStatus.BAD_REQUEST);
        });

        it('should enforce memo max 28 characters (400)', async () => {
            await request(app.getHttpServer())
                .post('/transfers')
                .send({
                    recipientId: RECIPIENT_ID,
                    amount: 50,
                    memo: 'a'.repeat(29),
                })
                .expect(HttpStatus.BAD_REQUEST);
        });

        it('should accept transfer with no memo/note (201)', async () => {
            mockTransferService.createTransfer!.mockResolvedValue(mockTransfer);

            await request(app.getHttpServer())
                .post('/transfers')
                .send({ recipientId: RECIPIENT_ID, amount: 1.5 })
                .expect(HttpStatus.CREATED);
        });
    });

    // ─── POST /transfers/:id/confirm ──────────────────────────────────────────

    describe('POST /transfers/:id/confirm', () => {
        it('should confirm a pending transfer (200)', async () => {
            mockTransferService.confirmTransfer!.mockResolvedValue(mockTransfer);

            const res = await request(app.getHttpServer())
                .post(`/transfers/${TRANSFER_ID}/confirm`)
                .expect(HttpStatus.OK);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('confirmed');
            expect(res.body.data.id).toBe(TRANSFER_ID);
            expect(mockTransferService.confirmTransfer).toHaveBeenCalledWith(
                TRANSFER_ID,
                SENDER_ID,
            );
        });

        it('should return 404 for non-existent transfer', async () => {
            const { NotFoundException } = require('@nestjs/common');
            mockTransferService.confirmTransfer!.mockRejectedValue(
                new NotFoundException('Transfer not found'),
            );

            await request(app.getHttpServer())
                .post(`/transfers/non-existent-id/confirm`)
                .expect(HttpStatus.NOT_FOUND);
        });
    });

    // ─── GET /transfers/history ───────────────────────────────────────────────

    describe('GET /transfers/history', () => {
        it('should return transfer history (200)', async () => {
            mockTransferService.getTransferHistory!.mockResolvedValue({
                transfers: [mockTransfer],
                total: 1,
            });

            const res = await request(app.getHttpServer())
                .get('/transfers/history')
                .expect(HttpStatus.OK);

            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.pagination.total).toBe(1);
        });

        it('should pass query filters (status, type) to service', async () => {
            mockTransferService.getTransferHistory!.mockResolvedValue({
                transfers: [],
                total: 0,
            });

            await request(app.getHttpServer())
                .get('/transfers/history?status=completed&type=p2p&limit=10&offset=0')
                .expect(HttpStatus.OK);

            expect(mockTransferService.getTransferHistory).toHaveBeenCalledWith(
                SENDER_ID,
                expect.objectContaining({ status: 'completed', type: 'p2p', limit: '10', offset: '0' }),
            );
        });
    });

    // ─── GET /transfers/:id ───────────────────────────────────────────────────

    describe('GET /transfers/:id', () => {
        it('should return a single transfer for an authorised user (200)', async () => {
            mockTransferService.getTransferById!.mockResolvedValue(mockTransfer);

            const res = await request(app.getHttpServer())
                .get(`/transfers/${TRANSFER_ID}`)
                .expect(HttpStatus.OK);

            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(TRANSFER_ID);
        });
    });

    // ─── GET /transfers/:id/receipt ───────────────────────────────────────────

    describe('GET /transfers/:id/receipt', () => {
        it('should generate and return a receipt (200)', async () => {
            const mockReceipt = {
                transferId: TRANSFER_ID,
                transactionHash: 'abc123',
                sender: { id: SENDER_ID, email: 'sender@example.com' },
                recipient: { id: RECIPIENT_ID, email: 'recipient@example.com' },
                amount: '50.00000000',
                memo: 'test memo',
                note: 'internal note',
                status: TransferStatus.COMPLETED,
                blockchainNetwork: 'stellar',
                timestamp: new Date(),
                balanceChanges: {
                    senderBefore: '1000.00000000',
                    senderAfter: '950.00000000',
                    recipientBefore: '200.00000000',
                    recipientAfter: '250.00000000',
                },
            };

            mockReceiptService.generateReceipt.mockResolvedValue(mockReceipt);

            const res = await request(app.getHttpServer())
                .get(`/transfers/${TRANSFER_ID}/receipt`)
                .expect(HttpStatus.OK);

            expect(res.body.success).toBe(true);
            expect(res.body.data.transferId).toBe(TRANSFER_ID);
            expect(res.body.data.balanceChanges).toBeDefined();
        });
    });

    // ─── GET /transfers/analytics ─────────────────────────────────────────────

    describe('GET /transfers/analytics', () => {
        it('should return analytics for the authenticated user (200)', async () => {
            const mockAnalytics = {
                totalTransfers: 42,
                totalVolume: '5000.00000000',
                successRate: 97.62,
                averageAmount: '119.04761904',
                topRecipients: [],
                dailyVolume: [],
            };

            mockAnalyticsService.getUserAnalytics.mockResolvedValue(mockAnalytics);

            const res = await request(app.getHttpServer())
                .get('/transfers/analytics?days=30')
                .expect(HttpStatus.OK);

            expect(res.body.success).toBe(true);
            expect(res.body.data.totalTransfers).toBe(42);
            expect(res.body.data.successRate).toBe(97.62);
        });
    });

    // ─── POST /transfers/bulk ─────────────────────────────────────────────────

    describe('POST /transfers/bulk', () => {
        it('should create a bulk transfer (201)', async () => {
            const mockBulkTransfer = {
                id: BULK_ID,
                senderId: SENDER_ID,
                totalRecipients: 2,
                totalAmount: '150.00000000',
                status: BulkTransferStatus.PENDING,
                memo: 'team payments',
                blockchainNetwork: 'stellar',
                createdAt: new Date(),
            };

            mockTransferService.createBulkTransfer!.mockResolvedValue(mockBulkTransfer as any);

            const res = await request(app.getHttpServer())
                .post('/transfers/bulk')
                .send({
                    recipients: [
                        { recipientId: RECIPIENT_ID, amount: 100 },
                        { recipientId: '550e8400-e29b-41d4-a716-446655440003', amount: 50 },
                    ],
                    memo: 'team payments',
                    blockchainNetwork: 'stellar',
                })
                .expect(HttpStatus.CREATED);

            expect(res.body.success).toBe(true);
            expect(res.body.data.totalRecipients).toBe(2);
        });
    });

    // ─── Zero platform fee ────────────────────────────────────────────────────

    describe('Zero platform fee', () => {
        it('transfer entity should have no platform fee fields', () => {
            // Transfer entity has no feeAmount / platformFee / serviceFee columns
            const transfer = new Transfer();
            expect((transfer as any).feeAmount).toBeUndefined();
            expect((transfer as any).platformFee).toBeUndefined();
            expect((transfer as any).serviceFee).toBeUndefined();
        });

        it('transfer response should not include any fee', async () => {
            mockTransferService.createTransfer!.mockResolvedValue(mockTransfer);

            const res = await request(app.getHttpServer())
                .post('/transfers')
                .send({ recipientId: RECIPIENT_ID, amount: 50 })
                .expect(HttpStatus.CREATED);

            expect(res.body.data.feeAmount).toBeUndefined();
            expect(res.body.data.platformFee).toBeUndefined();
        });
    });
});
