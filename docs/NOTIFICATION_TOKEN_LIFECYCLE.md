# Notification Token Management Lifecycle

## Overview

This document describes the complete lifecycle of Firebase Cloud Messaging (FCM) notification tokens in the Baztille backend, from registration to cleanup.

## Architecture

The notification token system is designed with:

- **Reverse indexing**: Tokens are indexed separately for efficient lookup
- **Automatic cleanup**: Invalid tokens are automatically detected and removed
- **Error tracking**: Token delivery failures are recorded for monitoring
- **Matrix Push Gateway API compliance**: Rejected tokens are reported back to Matrix

## Components

### Core Services

1. **DeviceTokenService** (`src/profile/user/device-token.service.ts`)

   - Manages the `device_tokens` collection (reverse index)
   - Handles token CRUD operations
   - Tracks token validity and error history

2. **ChatNotificationService** (`src/chat/notification/chat-notification.service.ts`)

   - Processes Matrix push notifications
   - Validates tokens before sending
   - Handles FCM responses and token invalidation
   - Returns rejected tokens to Matrix

3. **FirebaseService** (`src/common/firebase/firebase.service.ts`)

   - Pure utility for FCM communication
   - Classifies FCM errors (permanent vs transient)
   - Returns structured error information

4. **UserService** (`src/profile/user/user.service.ts`)
   - Handles device registration
   - Triggers token upserts when devices update

## Token Lifecycle

### 1. Token Registration

**Entry Point**: `POST /user/device/:userId`

**Flow**:

```
Mobile App → UserService.updateDevice()
          → DeviceTokenService.upsertToken()
          → MongoDB: device_tokens collection
          → MongoDB: users.devices.<deviceId>.notifToken
```

Note : when created, token is also directly send by the app to Matrix/Synapse server.

**Details**:

- User provides FCM registration token via device update endpoint
- Token is stored in two places:
  1. `users.devices.<deviceId>.notifToken` - Primary storage with device metadata
  2. `device_tokens` collection - Reverse index for fast lookups

**Schema** (`device_tokens` collection):

```typescript
{
  token: string,           // FCM registration token (indexed, unique)
  userId: ObjectId,        // User who owns this token
  deviceId: string,        // Device UUID
  createdAt: Date,         // First registration
  updatedAt: Date,         // Last update
  invalidAt: Date | null,  // When token was invalidated
  invalidReason: string,   // FCM error code that caused invalidation
  lastSuccessAt: Date,     // Last successful notification
  lastErrorAt: Date,       // Last error
  lastErrorMessage: string // Last error message
}
```

**Indexes**:

- `{ token: 1 }` - Unique index for reverse lookup
- `{ userId: 1, deviceId: 1 }` - Compound index for user queries
- `{ invalidAt: 1 }` - Sparse index for cleanup queries

### 2. Token Usage - Notification Delivery

**Entry Point**: `POST /_matrix/push/v1/notify`

**Flow**:

```
Matrix Server → MatrixNotifierController.matrixNotify()
             → ChatNotificationService.processMatrixNotification()
             → For each device:
                 → DeviceTokenService.findByToken() [pre-check]
                 → FirebaseService.sendNotification()
                 → Handle result:
                    SUCCESS → DeviceTokenService.recordSuccess()
                    ERROR → DeviceTokenService.recordError()
                    PERMANENT_ERROR → DeviceTokenService.invalidateToken()
             → Return { rejected: string[] } to Matrix
```

**Pre-Send Validation**:

- Before sending, check if token is already marked invalid
- Skip sending if `invalidAt` is set
- Add to rejected list immediately

**FCM Error Classification**:

**Permanent Errors** (token should be invalidated):

- `messaging/invalid-registration-token`
- `messaging/registration-token-not-registered`
- `messaging/mismatched-credential`
- `messaging/invalid-argument`

**Transient Errors** (retry later, don't invalidate):

- `messaging/server-unavailable`
- `messaging/internal-error`
- `messaging/quota-exceeded`
- `messaging/unavailable`
- `messaging/third-party-auth-error`

### 3. Token Invalidation

**Triggers**:

1. **FCM Permanent Error**: Token rejected by Firebase
2. **Manual Cleanup**: Admin action or maintenance
3. **Account Removal**: User deletes account

**Process** (`DeviceTokenService.invalidateToken()`):

```typescript
1. Mark token as invalid in device_tokens:
   - Set invalidAt = current timestamp
   - Set invalidReason = error code

2. Clear token from user document:
   - Remove users.devices.<deviceId>.notifToken
   - Keep other device metadata (OS, version, etc.)
```

**Cascading Effects**:

- Token appears in `rejected` array returned to Matrix
- Matrix removes pushkey from its registry
- Future notifications skip this token
- User must re-register device to receive notifications again

### 4. Token Cleanup on Account Removal

**Entry Point**: User requests account deletion

**Flow**:

```
UserService.removeUserAccount()
→ DeviceTokenService.invalidateAllTokensForUser()
   → Find all tokens for user
   → Mark all as invalid (reason: "account_removed")
   → Clear notifToken fields from user document
   → Keep device metadata for analytics
```

## Data Flow Diagrams

### Token Registration

```
┌─────────────┐
│ Mobile App  │
└──────┬──────┘
       │ POST /user/device/:userId
       │ { uuid, notifToken, ... }
       ▼
┌─────────────────────┐
│   UserService       │
│  updateDevice()     │
└──────┬──────────────┘
       │
       ├──────────────────────┐
       │                      │
       ▼                      ▼
┌─────────────────┐   ┌──────────────────────┐
│ UserMongo       │   │ DeviceTokenService   │
│ users.devices   │   │  upsertToken()       │
│  .notifToken    │   └──────┬───────────────┘
└─────────────────┘          │
                             ▼
                    ┌────────────────────┐
                    │ device_tokens      │
                    │ (reverse index)    │
                    └────────────────────┘
```

### Notification Flow

```
┌──────────────┐
│ Matrix Push  │
│   Gateway    │
└──────┬───────┘
       │ POST /_matrix/push/v1/notify
       ▼
┌────────────────────────┐
│ ChatNotificationService│
│ processMatrixNotification()
└──────┬─────────────────┘
       │ For each device
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌─────────────────┐
│ Pre-validate │  │ FirebaseService │
│ token status │  │ sendNotification()
└──────┬───────┘  └────────┬────────┘
       │                   │
       │ ┌─────────────────┤
       │ │ Success         │ Permanent Error
       │ │                 │
       ▼ ▼                 ▼
┌──────────────┐  ┌─────────────────┐
│ recordSuccess│  │ invalidateToken │
└──────────────┘  │ + clear from    │
                  │ user document   │
                  └────────┬────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │ Add to rejected│
                  │ tokens list    │
                  └────────┬───────┘
                           │
       ┌───────────────────┘
       │
       ▼
┌──────────────────┐
│ Return rejected  │
│ to Matrix        │
└──────────────────┘
```

## Database Schema

### Collection: `device_tokens`

```javascript
{
  _id: ObjectId,
  token: "fcm_token_string",           // Unique, indexed
  userId: ObjectId("user_id"),         // Indexed
  deviceId: "device_uuid",             // Indexed with userId
  createdAt: ISODate("2026-02-04"),
  updatedAt: ISODate("2026-02-04"),
  invalidAt: null,                     // or ISODate when invalidated
  invalidReason: null,                 // or error code string
  lastSuccessAt: ISODate("2026-02-04"),
  lastErrorAt: null,
  lastErrorMessage: null
}
```

### User Document: `users.devices`

```javascript
{
  _id: ObjectId("user_id"),
  devices: {
    "device_uuid_1": {
      uuid: "device_uuid_1",
      notifToken: "fcm_token_string",  // Can be null if invalidated
      os: "android",
      osVersion: "14",
      appVersion: "1.2.3",
      lastSession: 1738699200000
    }
  }
}
```

## API Endpoints

### User Device Registration

```
POST /user/device/:userId
Body: {
  uuid: string,
  notifToken: string,
  os: string,
  osVersion: string,
  appVersion: string
}
```

### Matrix Push Gateway (Internal)

```
POST /_matrix/push/v1/notify
Body: {
  notification: {
    type: "m.room.message",
    devices: [
      { pushkey: "fcm_token_string", app_id: "com.baztille" }
    ],
    room_id: "!room:server",
    content: { body: "message" }
  }
}

Response: {
  rejected: ["fcm_token_1", "fcm_token_2"]  // Invalid tokens
}
```

## Error Handling Strategy

### Permanent Errors

- **Action**: Invalidate token immediately
- **Reason**: Token will never work again
- **Examples**: Unregistered, invalid format, app uninstalled

### Transient Errors

- **Action**: Record error but keep token valid
- **Reason**: Temporary issue, may work later
- **Examples**: Server unavailable, rate limit

### Unknown Errors

- **Action**: Record error, keep token valid (conservative)
- **Reason**: Better to retry than lose valid token

## Monitoring & Maintenance

### Key Metrics to Monitor

1. Token invalidation rate (per day)
2. Notification success rate
3. Average token age before invalidation
4. Number of active tokens per user

### Cleanup Tasks

1. **Remove old invalid tokens**: Delete tokens invalid >90 days
2. **Audit orphaned tokens**: Find tokens for deleted users
3. **Check duplicate tokens**: Ensure one token per device

## Security Considerations

1. **Token Privacy**: FCM tokens are sensitive, treat as PII
2. **Access Control**: Only user can register their own tokens
3. **Cleanup on Delete**: Tokens removed when account deleted
4. **Audit Trail**: All invalidations logged with reason

## Performance Considerations

1. **Indexes**: Ensure all lookups use indexes
2. **Batch Operations**: Process multiple devices efficiently
3. **Async Cleanup**: Don't block notification delivery
4. **Pre-validation**: Check invalidAt before FCM call

## Future Improvements

1. **Token Rotation**: Implement automatic token refresh
2. **Multi-device Priority**: Send to most recent device first
3. **Delivery Receipts**: Track actual notification delivery
4. **Analytics Dashboard**: Visualize token health metrics
5. **Automated Cleanup**: Scheduled job to remove old invalid tokens

## References

- Firebase Cloud Messaging Error Codes: https://firebase.google.com/docs/cloud-messaging/send-message#admin_sdk_error_reference
- Matrix Push Gateway API: https://spec.matrix.org/v1.2/push-gateway-api/

## Related Files

- `src/profile/user/device-token.service.ts` - Token management
- `src/profile/user/device-token.schema.ts` - MongoDB schema
- `src/profile/user/device-token.module.ts` - Module definition
- `src/chat/notification/chat-notification.service.ts` - Notification processing
- `src/common/firebase/firebase.service.ts` - FCM communication
