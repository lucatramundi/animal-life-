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

The response contains the stored message ID, sender, recipient, body, and creation time.

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
