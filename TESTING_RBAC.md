# Testing RBAC Implementation

## Quick Test Steps

### 1. Start the server
```bash
npm run start:dev
```

### 2. Test with cURL or Postman

#### Setup: Create test data first
```bash
# Get auth token (login as admin user)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}'

# Save the accessToken from response
export TOKEN="your_access_token_here"
export ROOM_ID="your_room_id"
export USER_ID="user_to_manage_id"
```

### 3. Test Each Feature

#### A. Set User Role
```bash
curl -X POST http://localhost:3000/rooms/$ROOM_ID/roles/set-role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"'$USER_ID'",
    "role":"MODERATOR"
  }'

# Expected: 200 OK with updated member object
```

#### B. Ban User
```bash
curl -X POST http://localhost:3000/rooms/$ROOM_ID/roles/ban \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"'$USER_ID'",
    "reason":"Spam behavior",
    "expiresAt":"2026-02-26T00:00:00Z"
  }'

# Expected: 200 OK with ban record
```

#### C. Check Ban Status
```bash
curl -X GET http://localhost:3000/rooms/$ROOM_ID/roles/ban/$USER_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"isBanned":true}
```

#### D. Unban User
```bash
curl -X DELETE http://localhost:3000/rooms/$ROOM_ID/roles/ban/$USER_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with success message
```

#### E. Add to Whitelist
```bash
curl -X POST http://localhost:3000/rooms/$ROOM_ID/roles/whitelist \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"'$USER_ID'",
    "notes":"VIP member"
  }'

# Expected: 201 CREATED with whitelist record
```

#### F. Check Whitelist Status
```bash
curl -X GET http://localhost:3000/rooms/$ROOM_ID/roles/whitelist/$USER_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"isWhitelisted":true}
```

#### G. Pause Room (Emergency)
```bash
curl -X POST http://localhost:3000/rooms/$ROOM_ID/roles/pause \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason":"SPAM",
    "description":"Spam attack detected"
  }'

# Expected: 200 OK with pause record
```

#### H. Check Pause Status
```bash
curl -X GET http://localhost:3000/rooms/$ROOM_ID/roles/pause-status \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"isPaused":true}
```

#### I. Resume Room
```bash
curl -X POST http://localhost:3000/rooms/$ROOM_ID/roles/resume \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with resume confirmation
```

#### J. Verify Room Access
```bash
curl -X GET http://localhost:3000/rooms/$ROOM_ID/roles/access/$USER_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"canAccess":true} or {"canAccess":false,"reason":"..."}
```

#### K. Get User Role
```bash
curl -X GET http://localhost:3000/rooms/$ROOM_ID/roles/user-role/$USER_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"role":"MODERATOR"}
```

## Run Unit Tests
```bash
npm run test -- src/room/room-role.service.spec.ts
```

## Test Scenarios

### Scenario 1: Permission Denied
Try to ban user as MEMBER (should fail):
```bash
# Login as member user
curl -X POST http://localhost:3000/rooms/$ROOM_ID/roles/ban \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"'$USER_ID'","reason":"Test"}'

# Expected: 403 Forbidden - "You do not have permission to perform this action"
```

### Scenario 2: Ban Prevents Access
```bash
# 1. Ban user
curl -X POST http://localhost:3000/rooms/$ROOM_ID/roles/ban \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"'$USER_ID'","reason":"Test"}'

# 2. Try to access room (should fail)
curl -X GET http://localhost:3000/rooms/$ROOM_ID/roles/access/$USER_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"canAccess":false,"reason":"User is banned from this room"}
```

### Scenario 3: Pause Prevents Access
```bash
# 1. Pause room
curl -X POST http://localhost:3000/rooms/$ROOM_ID/roles/pause \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"MAINTENANCE"}'

# 2. Try to access room (should fail)
curl -X GET http://localhost:3000/rooms/$ROOM_ID/roles/access/$USER_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"canAccess":false,"reason":"Room is currently paused"}

# 3. Resume room
curl -X POST http://localhost:3000/rooms/$ROOM_ID/roles/resume \
  -H "Authorization: Bearer $TOKEN"

# 4. Try to access again (should succeed)
curl -X GET http://localhost:3000/rooms/$ROOM_ID/roles/access/$USER_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"canAccess":true}
```

### Scenario 4: Whitelist for Private Rooms
```bash
# 1. Add user to whitelist
curl -X POST http://localhost:3000/rooms/$ROOM_ID/roles/whitelist \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"'$USER_ID'"}'

# 2. Verify access (should succeed if room is private)
curl -X GET http://localhost:3000/rooms/$ROOM_ID/roles/access/$USER_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"canAccess":true}
```

## Database Verification

Check if tables were created:
```bash
# Connect to your database
psql -U postgres -d your_db_name

# List tables
\dt room_*

# Should show:
# - room_bans
# - room_whitelists
# - room_emergency_pauses

# Check data
SELECT * FROM room_bans;
SELECT * FROM room_whitelists;
SELECT * FROM room_emergency_pauses;
```

## Expected Responses

### Success (200/201)
```json
{
  "id": "uuid",
  "roomId": "uuid",
  "userId": "uuid",
  "role": "MODERATOR",
  "permissions": ["SEND_MESSAGE", "EDIT_MESSAGE", ...],
  "updatedAt": "2026-01-26T..."
}
```

### Error (403)
```json
{
  "statusCode": 403,
  "message": "You do not have permission to perform this action",
  "error": "Forbidden"
}
```

### Error (404)
```json
{
  "statusCode": 404,
  "message": "User is not a member of this room",
  "error": "Not Found"
}
```

## Troubleshooting

1. **"User is not a member of this room"**
   - Make sure user is added to room first

2. **"You do not have permission to perform this action"**
   - Check user's role in room (must be ADMIN or MODERATOR for most actions)

3. **"Room is not paused"**
   - Try to resume a room that's not paused

4. **Cache issues**
   - Redis must be running for caching to work
   - Check Redis connection in logs
