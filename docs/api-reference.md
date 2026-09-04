# API Reference

All endpoints require a valid Microsoft Entra access token. Azure Functions are configured with anonymous platform auth so the application can perform its own JWT validation.

## `POST /api/heartbeat`

Records the authenticated user as online and returns other active users.

Request body:

```json
{
  "avatar": "https://example.invalid/avatar.svg"
}
```

The user ID and display name are derived from the validated token. Presence is short-lived.

## `GET /api/users`

Returns known directory users, excluding the caller.

Optional query parameter:

```text
search=<text>
```

The API reads cached users and may query Microsoft Graph when configured. Results are filtered by the allowed group.

## `GET /api/conversations`

Returns recent conversation partners for the authenticated caller, ordered by latest message.

Only conversations in which the caller is a sender or recipient are returned.

## `GET /api/messages?userId=<id>`

Returns messages for the conversation between the authenticated caller and `userId`.

Optional query parameter:

```text
after=<unix-milliseconds>
```

Messages are returned oldest first. The API validates that the caller participates in the conversation.

Each returned message includes:

- `id`
- `senderId`
- `recipientId`
- `body`
- `createdAt`
- `updatedAt`
- `deletedAt`
- `readAt`
- `isEdited`
- `isDeleted`
- `canEdit`
- `canDelete`

## `POST /api/messages`

Stores a message for the authenticated caller.

Request body:

```json
{
  "recipientId": "recipient-object-id",
  "recipientName": "Recipient",
  "body": "Hello"
}
```

Validation includes:

- Valid recipient object ID.
- Recipient is not the caller.
- Recipient belongs to the required group.
- Body is trimmed and non-empty.
- Body does not exceed the configured maximum length.

The response contains the stored message ID, sender, recipient, body, creation time, and message lifecycle flags.

## `POST /api/messages/read`

Marks unread messages in a conversation as read by the authenticated user.

Request body:

```json
{
  "userId": "conversation-partner-object-id"
}
```

The endpoint only updates messages addressed to the authenticated user. It returns `204` when the read receipt update succeeds.

## `PATCH /api/messages`

Edits a delivered message previously sent by the authenticated caller.

Request body:

```json
{
  "userId": "conversation-partner-object-id",
  "messageId": "1756991234567-550e8400-e29b-41d4-a716-446655440000",
  "body": "Updated text"
}
```

Rules:

- Only the original sender can edit a message.
- The message must belong to the selected conversation.
- Deleted messages cannot be edited.
- The edited body is trimmed, required, and must remain within the configured length limit.

## `DELETE /api/messages`

Deletes a delivered message previously sent by the authenticated caller.

Request body:

```json
{
  "userId": "conversation-partner-object-id",
  "messageId": "1756991234567-550e8400-e29b-41d4-a716-446655440000"
}
```

Rules:

- Only the original sender can delete a message.
- The message remains visible in the conversation as a deleted placeholder for both participants.
- Deleted messages are no longer editable or deletable from the UI.

## Timer: `cleanupStorage`

Runs on the configured schedule and removes:

- Presence rows older than `PRESENCE_RETENTION_SECONDS`.
- Messages older than `MESSAGE_RETENTION_DAYS`.

## Error Responses

Typical statuses:

- `400`: Invalid input.
- `401`: Missing, invalid, or expired access token.
- `403`: Missing scope or disallowed group membership.
- `500`: Unexpected server or storage error.

Do not expose internal exception details to API callers.
