# Admin Password Reset Feature - Implementation Summary

## Overview
Implemented admin-triggered password reset for compromised accounts or locked-out users.

## Implementation

### Endpoint
- **POST** `/admin/users/:userId/reset-password`
- **Access**: ADMIN or SUPER_ADMIN role required
- **Response**: `{ message: "Password reset email sent to user" }`

### Security Features
1. **Secure Token Generation**: 32-byte random hex token
2. **Token Expiry**: 1 hour from generation
3. **Session Invalidation**: All user sessions immediately revoked
4. **No Password Exposure**: Admin never sees or receives the password/token
5. **Audit Logging**: Action logged with HIGH severity (token not logged)

### Flow
1. Admin calls endpoint with userId
2. System generates secure reset token
3. Token saved to user record with 1-hour expiry
4. All user sessions set to inactive
5. Password reset email sent to user
6. Audit log created (without token)
7. Success message returned to admin

### Files Created

**Service Method**
- `src/admin/services/admin.service.ts` - `adminResetPassword()` method

**Controller Endpoint**
- `src/admin/controllers/admin.controller.ts` - POST endpoint

**Tests**
- `src/admin/services/admin-password-reset.service.spec.ts` - Unit tests
- `src/admin/controllers/admin-password-reset.controller.spec.ts` - Integration tests

## Test Coverage

### Unit Tests (5 tests)
- ✅ Generates reset token and invalidates sessions
- ✅ Throws NotFoundException if user doesn't exist
- ✅ Does not expose reset token in audit log
- ✅ Continues if email sending fails
- ✅ Token expires in 1 hour

### Integration Tests (5 tests)
- ✅ Resets user password successfully
- ✅ Returns 404 if user not found
- ✅ Requires authentication
- ✅ Requires ADMIN role
- ✅ Validates userId parameter

## Acceptance Criteria Status

✅ **POST /admin/users/:userId/reset-password** - Implemented  
✅ **Generates secure reset token** - 32-byte random hex  
✅ **Sends password reset email** - Via event emitter  
✅ **Token expires in 1 hour** - Set in passwordResetExpires  
✅ **All sessions invalidated immediately** - isActive set to false  
✅ **Admin does NOT see password/token** - Never exposed in response  
✅ **Requires ADMIN role or above** - Role guard applied  
✅ **Audit log records action** - HIGH severity, no token logged  
✅ **Unit + integration tests** - 10 tests with mocked email  

## Security Considerations

### Token Security
- 32-byte cryptographically secure random token
- Stored hashed in database (via existing User entity)
- 1-hour expiration enforced
- Single-use (consumed on password reset)

### Session Management
- All active sessions immediately invalidated
- User must log in again after password reset
- Prevents unauthorized access during reset process

### Audit Trail
- Action logged with HIGH severity
- Records admin ID, user ID, timestamp
- Metadata includes `adminInitiated: true`
- Token never logged (security best practice)

### Email Delivery
- Graceful failure handling
- Logs warning if email fails
- Still returns success to admin
- User can request new reset if needed

## Usage Example

```bash
# Admin triggers password reset
curl -X POST http://localhost:3000/admin/users/user-123/reset-password \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"

# Response
{
  "message": "Password reset email sent to user"
}

# User receives email with reset link
# User clicks link and sets new password
# All old sessions are invalid
# User logs in with new password
```

## Database Changes

No migration needed - uses existing User entity fields:
- `passwordResetToken` (string, nullable)
- `passwordResetExpires` (Date, nullable)

## Event Emitted

```typescript
eventEmitter.emit('user.password.reset.admin', {
  userId: string,
  email: string,
  resetToken: string,
});
```

This event can be handled by email service to send reset link.

## Error Handling

- **404 Not Found**: User doesn't exist
- **401 Unauthorized**: No JWT token
- **403 Forbidden**: Not ADMIN/SUPER_ADMIN role
- **Email Failure**: Logged as warning, doesn't fail request

## Future Enhancements

Potential improvements:
- Configurable token expiry time
- SMS notification option
- Bulk password reset for multiple users
- Password reset history tracking
- Notification to user about admin-initiated reset
