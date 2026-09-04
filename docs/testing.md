# Testing

## Required Test Areas

### Authentication

- Missing bearer token returns `401`.
- Invalid or expired token returns `401`.
- Wrong tenant or audience returns `401`.
- Missing `access_as_user` scope returns `403`.
- User outside the allowed group is rejected.

### Messaging

- User A can send to User B.
- User B can read the A/B conversation.
- User C cannot read the A/B conversation.
- Messages survive a page refresh.
- Senders can edit their own delivered messages.
- Senders can delete their own delivered messages and both participants see a deleted placeholder.
- Recipients cannot edit or delete messages they did not send.
- Empty messages are rejected.
- Oversized messages are rejected.
- Self-messaging is rejected.
- Invalid recipient IDs are rejected.

### Presence and Directory

- Authenticated heartbeat updates presence.
- The current user is excluded from their own online list.
- Stale presence expires.
- Cached users are returned when Graph is unavailable.
- Group filtering excludes unauthorized users.

### Retention

- Old messages are deleted according to `MESSAGE_RETENTION_DAYS`.
- Old presence rows are deleted according to `PRESENCE_RETENTION_SECONDS`.

## Manual Multi-Account Test

Use three separate approved Entra accounts:

1. User A sends a message to User B.
2. User B reads the conversation.
3. User C attempts to read the A/B conversation and is denied.
4. Refresh the browser and verify persistence.

## CI Checks

The deployment pipeline should run dependency installation, tests, security scanning, and any Bicep validation before deployment. Failed required checks must block merging to `main`.
