# Implementation Plan: Message Moderation

## Overview

This implementation plan breaks down the message moderation feature into incremental coding tasks. The feature adds a DELETE endpoint for moderators to remove inappropriate messages with soft deletion, audit logging, and real-time WebSocket broadcasting. Implementation follows a bottom-up approach: data layer first, then business logic, API layer, and finally integration.

## Tasks

- [x] 1. Set up database schema and entities
  - [x] 1.1 Create ModerationAuditLog entity with TypeORM decorators
    - Define entity class with all fields: id, roomId, messageId, contentHash, reason, moderatorId, createdAt
    - Add indexes on messageId, moderatorId, and createdAt
    - Add relations to Message and User entities
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [x] 1.2 Create database migration for moderation_audit_logs table
    - Generate migration file using TypeORM CLI
    - Verify migration creates table with correct schema and indexes
    - _Requirements: 5.1_
  
  - [ ]* 1.3 Write unit tests for ModerationAuditLog entity
    - Test entity instantiation and field validation
    - Test relations to Message and User entities
    - _Requirements: 7.3_

- [x] 2. Implement DTO and validation
  - [x] 2.1 Create DeleteMessageDto class with validation decorators
    - Add reason field with @IsString, @IsNotEmpty, @MinLength(1), @MaxLength(1000)
    - _Requirements: 1.2, 1.3_
  
  - [ ]* 2.2 Write property test for DeleteMessageDto validation
    - **Property 1: Request validation rejects invalid inputs**
    - **Validates: Requirements 1.2, 1.3**
    - Generate random invalid inputs (empty strings, too long strings, non-strings)
    - Verify all invalid inputs are rejected by class-validator

- [x] 3. Implement ModerationService core logic
  - [x] 3.1 Create ModerationService class with dependencies
    - Inject MessageRepository, ModerationAuditLogRepository, MessagesGateway
    - Set up constructor and basic service structure
    - _Requirements: 2.1, 5.1_
  
  - [x] 3.2 Implement computeContentHash private method
    - Use Node.js crypto module to compute SHA-256 hash
    - Return hex-encoded 64-character string
    - _Requirements: 6.1_
  
  - [ ]* 3.3 Write property test for SHA-256 hash correctness
    - **Property 6: SHA-256 hash correctness**
    - **Validates: Requirements 6.1**
    - Generate random message content
    - Verify hash is 64-character hex string
    - Verify hashing same content twice produces identical hashes
  
  - [x] 3.4 Implement createAuditLog private method
    - Accept message, moderatorId, and reason parameters
    - Compute content hash of original message content
    - Create and save ModerationAuditLog entity
    - Return saved audit log
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2_
  
  - [ ]* 3.5 Write property test for audit log privacy
    - **Property 7: Audit log privacy**
    - **Validates: Requirements 6.2**
    - Generate random message deletions
    - Verify audit log contains only hash, never original content
  
  - [x] 3.6 Implement deleteMessage public method
    - Validate roomId and messageId parameters
    - Retrieve message from database and verify it exists
    - Verify message belongs to specified room
    - Create audit log entry before modification
    - Update message: set content to "[removed by moderator]", deletedAt to current timestamp, deletedBy to moderatorId
    - Save updated message to database
    - Return ModerationResult with success, message data, and auditLogId
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.4, 5.1_
  
  - [ ]* 3.7 Write property test for soft deletion state consistency
    - **Property 2: Soft deletion state consistency**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
    - Generate random messages and moderators
    - Perform deletion
    - Verify content replaced, deletedAt set, deletedBy set, record still exists
  
  - [ ]* 3.8 Write property test for audit log completeness
    - **Property 5: Audit log completeness**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**
    - Generate random deletions
    - Verify audit log contains all required fields within time bounds
  
  - [x] 3.9 Implement broadcastDeletion private method
    - Call messagesGateway.broadcastToRoom with roomId and 'message-deleted' event
    - Include messageId, roomId, content, deletedAt, deletedBy in payload
    - Add error handling and logging for broadcast failures
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 3.10 Integrate broadcastDeletion into deleteMessage method
    - Call broadcastDeletion after successful message update
    - Ensure broadcast happens within same transaction context
    - _Requirements: 3.1_
  
  - [ ]* 3.11 Write unit tests for ModerationService error handling
    - Test message not found scenario
    - Test message from different room scenario
    - Test database transaction rollback on audit log failure
    - _Requirements: 7.1, 7.3_

- [x] 4. Checkpoint - Ensure service layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement authorization guards
  - [x] 5.1 Create or verify RoleGuard implementation
    - Implement canActivate method to check user roles
    - Extract roles from JWT token
    - Verify user has required role (MODERATOR or ADMIN)
    - _Requirements: 4.1, 4.2_
  
  - [ ]* 5.2 Write unit tests for RoleGuard
    - Test MODERATOR role allows access
    - Test ADMIN role allows access
    - Test USER role denies access
    - Test missing role denies access
    - _Requirements: 4.1, 4.2, 7.2_
  
  - [ ]* 5.3 Write property test for authorization enforcement
    - **Property 4: Authorization enforcement**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Generate random users without MODERATOR role
    - Verify all deletion attempts fail with 403
    - Verify target message remains unchanged

- [x] 6. Implement Admin Moderation Controller
  - [x] 6.1 Create AdminModerationController class
    - Add @Controller('admin') decorator
    - Apply @UseGuards(JwtAuthGuard, RoleGuard) to controller
    - Set up constructor with ModerationService injection
    - _Requirements: 1.1, 4.1_
  
  - [x] 6.2 Implement DELETE endpoint handler
    - Add @Delete('rooms/:roomId/messages/:messageId') decorator
    - Add @Roles(RoleType.MODERATOR, RoleType.ADMIN) decorator
    - Extract roomId and messageId from path parameters
    - Extract reason from request body using DeleteMessageDto
    - Extract moderatorId from authenticated user
    - Call moderationService.deleteMessage
    - Return formatted response with success, message data, and auditLogId
    - _Requirements: 1.1, 1.2, 1.3, 4.1_
  
  - [x] 6.3 Add error handling and HTTP exception mapping
    - Map service errors to appropriate HTTP status codes (400, 403, 404)
    - Return consistent error response format
    - _Requirements: 1.1_
  
  - [ ]* 6.4 Write unit tests for AdminModerationController
    - Test request parameter extraction
    - Test DTO validation
    - Test response formatting
    - Test error response structure
    - Mock ModerationService
    - _Requirements: 7.1_

- [x] 7. Implement WebSocket event broadcasting
  - [x] 7.1 Add message-deleted event handler to MessagesGateway
    - Create broadcastToRoom method if not exists
    - Implement room-based event emission using Socket.io
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ]* 7.2 Write property test for WebSocket event completeness
    - **Property 3: WebSocket event completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Generate random deletions
    - Verify all room members receive event with all required fields
  
  - [ ]* 7.3 Write integration tests for WebSocket broadcasting
    - Test multiple clients connected to room receive event
    - Test event payload structure
    - Test client disconnection handling
    - _Requirements: 7.5_

- [x] 8. Checkpoint - Ensure integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement end-to-end tests
  - [ ]* 9.1 Write E2E test for complete deletion workflow
    - Create test room and message
    - Authenticate as moderator
    - Send DELETE request
    - Verify response structure
    - Query database to confirm soft deletion
    - Query database to confirm audit log created
    - Verify WebSocket event received
    - _Requirements: 7.4, 7.5_
  
  - [ ]* 9.2 Write E2E test for authorization flow
    - Authenticate as regular user (no MODERATOR role)
    - Attempt deletion
    - Verify 403 Forbidden response
    - Verify message unchanged in database
    - _Requirements: 7.6_
  
  - [ ]* 9.3 Write E2E test for error scenarios
    - Test invalid message ID returns 404
    - Test invalid room ID returns 404
    - Test missing reason returns 400
    - Test message from different room returns 400
    - _Requirements: 7.4_

- [x] 10. Wire components together and register in module
  - [x] 10.1 Register ModerationService in module providers
    - Add ModerationService to providers array
    - Ensure MessageRepository and ModerationAuditLogRepository are available
    - _Requirements: 1.1_
  
  - [x] 10.2 Register AdminModerationController in module controllers
    - Add AdminModerationController to controllers array
    - Verify RoleGuard is registered globally or in module
    - _Requirements: 1.1_
  
  - [x] 10.3 Register ModerationAuditLog entity in TypeORM configuration
    - Add entity to entities array in TypeORM config
    - Run migration to create table
    - _Requirements: 5.1_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Run full test suite (unit, property-based, integration, E2E)
  - Verify no regressions in existing functionality
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use fast-check library with minimum 100 iterations
- E2E tests use Supertest with separate test database
- All database operations should use transactions for consistency
- WebSocket broadcast failures should be logged but not block deletion
- SHA-256 hashing uses Node.js built-in crypto module
