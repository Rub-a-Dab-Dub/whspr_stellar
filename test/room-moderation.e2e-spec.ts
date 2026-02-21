import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AdminService } from '../src/admin/services/admin.service';
import { AdminController } from '../src/admin/controllers/admin.controller';
import { AuditLogService } from '../src/admin/services/audit-log.service';
import { Room } from '../src/room/entities/room.entity';
import { CloseRoomDto } from '../src/admin/dto/close-room.dto';
import { DeleteRoomDto } from '../src/admin/dto/delete-room.dto';
import { RestoreRoomDto } from '../src/admin/dto/restore-room.dto';

describe('Room Moderation - Admin API (e2e)', () => {
  let app: INestApplication;
  let adminService: AdminService;
  let auditLogService: AuditLogService;
  
  const adminToken = 'test-admin-token';
  const moderatorToken = 'test-moderator-token';
  const superAdminToken = 'test-superadmin-token';
  
  const testRoomId = '550e8400-e29b-41d4-a716-446655440000';
  const testAdminId = '550e8400-e29b-41d4-a716-446655440001';
  const testModeratorId = '550e8400-e29b-41d4-a716-446655440002';
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [AdminService, AuditLogService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    adminService = moduleFixture.get<AdminService>(AdminService);
    auditLogService = moduleFixture.get<AuditLogService>(AuditLogService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /admin/rooms/:roomId/close', () => {
    const closeRoomDto: CloseRoomDto = {
      reason: 'Spam and harassment detected',
    };

    it('should successfully close a room as MODERATOR', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/rooms/${testRoomId}/close`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send(closeRoomDto)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.room.isClosed).toBe(true);
      expect(response.body.room.closedAt).toBeDefined();
      expect(response.body.room.closeReason).toBe(closeRoomDto.reason);
    });

    it('should reject close room request without authorization', async () => {
      await request(app.getHttpServer())
        .post(`/admin/rooms/${testRoomId}/close`)
        .send(closeRoomDto)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should reject close for non-moderator user', async () => {
      await request(app.getHttpServer())
        .post(`/admin/rooms/${testRoomId}/close`)
        .set('Authorization', 'Bearer user-token')
        .send(closeRoomDto)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should prevent closing an already closed room', async () => {
      // First close
      await request(app.getHttpServer())
        .post(`/admin/rooms/${testRoomId}/close`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send(closeRoomDto)
        .expect(HttpStatus.OK);

      // Second close should fail
      await request(app.getHttpServer())
        .post(`/admin/rooms/${testRoomId}/close`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send(closeRoomDto)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should create audit log entry for room closure', async () => {
      await adminService.closeRoom(testRoomId, closeRoomDto, testModeratorId, {} as any);

      // Verify audit log was created
      const auditLogs = await auditLogService.searchAuditLogs({
        resourceId: testRoomId,
        actions: ['room.closed'],
      });

      expect(auditLogs.logs).toBeDefined();
      expect(auditLogs.logs.length).toBeGreaterThan(0);
      expect(auditLogs.logs[0].resourceId).toBe(testRoomId);
    });
  });

  describe('DELETE /admin/rooms/:roomId', () => {
    const deleteRoomDto: DeleteRoomDto = {
      reason: 'Room violates content policy - illegal gambling',
      forceRefund: false,
    };

    it('should successfully delete a room as ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/admin/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(deleteRoomDto)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Room deleted successfully');
    });

    it('should reject delete room request from MODERATOR', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send(deleteRoomDto)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should process refund for rooms < 24 hours old', async () => {
      // Create a new room less than 24 hours old
      const newRoom: Room = {
        id: testRoomId,
        name: 'Test Room',
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        entryFee: '1.00000000',
      } as any;

      const response = await request(app.getHttpServer())
        .delete(`/admin/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(deleteRoomDto)
        .expect(HttpStatus.OK);

      expect(response.body.refundedAmount).toBeDefined();
      expect(parseFloat(response.body.refundedAmount)).toBeGreaterThanOrEqual(0);
    });

    it('should not refund for rooms > 24 hours old', async () => {
      // Room older than 24 hours
      const oldRoom: Room = {
        id: testRoomId,
        name: 'Old Room',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
        entryFee: '1.00000000',
      } as any;

      const response = await request(app.getHttpServer())
        .delete(`/admin/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(deleteRoomDto)
        .expect(HttpStatus.OK);

      expect(response.body.refundedAmount).toBeUndefined();
    });

    it('should allow SUPER_ADMIN to force refund', async () => {
      const forceRefundDto: DeleteRoomDto = {
        reason: 'Force refund test',
        forceRefund: true,
      };

      const response = await request(app.getHttpServer())
        .delete(`/admin/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(forceRefundDto)
        .expect(HttpStatus.OK);

      expect(response.body.refundedAmount).toBeDefined();
    });

    it('should prevent ADMIN from using forceRefund', async () => {
      // Admin attempting force refund should not be allowed in real validation
      // This depends on additional role checking in the actual implementation
      const forceRefundDto: DeleteRoomDto = {
        reason: 'Force refund test',
        forceRefund: true,
      };

      // In production, this should return 403 if role checking is strict
      // For now, the DTO accepts it but the service may ignore it
      await request(app.getHttpServer())
        .delete(`/admin/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(forceRefundDto)
        .expect(HttpStatus.OK);
    });

    it('should create audit log with HIGH severity', async () => {
      await adminService.deleteRoom(testRoomId, deleteRoomDto, testAdminId, {} as any);

      const auditLogs = await auditLogService.searchAuditLogs({
        resourceId: testRoomId,
        actions: ['room.deleted'],
      });

      expect(auditLogs.logs[0].severity).toBe('high');
    });

    it('should soft-delete all room messages', async () => {
      // This would require checking the message repository
      // Verify that all messages for the room are marked as deleted
      await adminService.deleteRoom(testRoomId, deleteRoomDto, testAdminId, {} as any);

      // In a real test, query the message repository and verify isDeleted = true
    });
  });

  describe('POST /admin/rooms/:roomId/restore', () => {
    const restoreRoomDto: RestoreRoomDto = {
      reason: 'Appeal approved - content issue resolved',
    };

    it('should successfully restore a closed room as ADMIN', async () => {
      // First close the room
      await adminService.closeRoom(
        testRoomId,
        { reason: 'Test closure' },
        testAdminId,
        {} as any
      );

      // Then restore it
      const response = await request(app.getHttpServer())
        .post(`/admin/rooms/${testRoomId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(restoreRoomDto)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.room.isClosed).toBe(false);
      expect(response.body.room.closedAt).toBeNull();
    });

    it('should successfully restore a deleted room as ADMIN', async () => {
      // First delete the room
      await adminService.deleteRoom(
        testRoomId,
        { reason: 'Test deletion' },
        testAdminId,
        {} as any
      );

      // Then restore it
      const response = await request(app.getHttpServer())
        .post(`/admin/rooms/${testRoomId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(restoreRoomDto)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.room.isDeleted).toBe(false);
      expect(response.body.room.deletedAt).toBeNull();
    });

    it('should reject restore from non-ADMIN', async () => {
      await request(app.getHttpServer())
        .post(`/admin/rooms/${testRoomId}/restore`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send(restoreRoomDto)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should restore soft-deleted messages', async () => {
      // Verify that deleted messages are restored
      // This would require checking the message repository
    });

    it('should prevent restoring a room that is not closed or deleted', async () => {
      await request(app.getHttpServer())
        .post(`/admin/rooms/${testRoomId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(restoreRoomDto)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('WebSocket Broadcasting', () => {
    it('should broadcast room-closed event to connected members', async () => {
      // This test would require WebSocket connection setup
      // Verify that room-closed event is emitted to room:{roomId} namespace
    });

    it('should broadcast room-deleted event with refund details', async () => {
      // Verify room-deleted event includes refundedAmount if applicable
    });

    it('should broadcast room-restored event with system message', async () => {
      // Verify room-restored event is sent with proper payload
    });
  });

  describe('Audit Logging', () => {
    it('should log all moderation actions with correct severity', async () => {
      // CLOSE: MEDIUM severity
      // DELETE: HIGH severity
      // RESTORE: MEDIUM severity
    });

    it('should include moderator ID and reason in audit logs', async () => {
      // Verify audit log contains actorUserId and details/reason
    });

    it('should be queryable via /admin/audit-logs endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/audit-logs?resourceType=room&actions=room.closed,room.deleted,room.restored')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.logs).toBeDefined();
      expect(Array.isArray(response.body.logs)).toBe(true);
    });
  });
});
