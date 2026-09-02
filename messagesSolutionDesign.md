# Recorded Messaging Solution Design

## Goal

Allow signed-in ZPlay users to send messages to one another, retain the messages in Azure Table Storage, and keep the service inexpensive for a small Azure Static Web Apps application.

## Security Requirement

The current `heartbeat` Function is anonymous and accepts a client-supplied name. That is acceptable for a prototype presence list but must not be used for recorded messages: a caller could impersonate another user or read conversations they do not own.

MSAL.js signs the user in on the client, but Azure Functions must validate an Entra access token before it trusts an identity or reads/writes a message.

- Expose a delegated API scope in the Microsoft Entra app registration, such as `access_as_user`.
- Have MSAL acquire an access token for that scope after login.
- Send that token in `Authorization: Bearer <token>` on presence and messaging requests.
- Validate the token in Azure Functions and use its `oid` claim as the stable user ID.
- Use `name` only as a display field, not as an identity or storage key.

## Presence Changes

Update `POST /api/heartbeat` to require the authenticated user.

- Store the user under their Entra object ID (`oid`) rather than their real/display name.
- Store display name and avatar as descriptive fields.
- Return active users as `{ id, name, avatar }`.
- Exclude the signed-in user from their own player list.
- Continue treating presence as short lived; delete or ignore stale rows.

## Azure Table Design

Create a `Messages` table.

Each message has:

| Field | Purpose |
| --- | --- |
| `PartitionKey` | Deterministic conversation ID made from the two sorted Entra user IDs. Both participants therefore use the same partition. |
| `RowKey` | Sortable unique message ID, such as a timestamp plus UUID. |
| `SenderId` | Authenticated Entra object ID of the sender. |
| `RecipientId` | Entra object ID of the recipient. |
| `Body` | Validated message content. |
| `CreatedAt` | UTC creation timestamp. |
| `ReadAt` | Optional UTC read timestamp. |

Use Entra object IDs, not names, as keys because names are mutable and not guaranteed to be unique.

## Function Endpoints

### `POST /api/messages`

Request body:

```json
{
  "recipientId": "recipient-entra-object-id",
  "body": "Hello from ZPlay"
}
```

The Function gets the sender from the validated token, validates the recipient ID, trims the body, enforces a size limit such as 1,000 characters, then stores and returns the new message.

### `GET /api/messages?userId=<id>&after=<timestamp>`

The Function validates that the caller is one of the two conversation participants. It returns only messages for that conversation, oldest first. The optional `after` value lets the client fetch only messages newer than its last refresh.

### Optional: `POST /api/messages/read`

This records a `ReadAt` timestamp for received messages.

## Frontend Flow

1. On sign-in, acquire an Entra access token for the API scope.
2. Include the bearer token in every heartbeat and chat request.
3. Populate the online-player list with the secure presence endpoint.
4. When the player selects a user, request that conversation with `GET /api/messages`.
5. Replace the current in-browser-only send behavior with `POST /api/messages`.
6. Render messages as incoming or outgoing by comparing `SenderId` with the current user's Entra object ID.
7. Poll the selected conversation every few seconds initially. This keeps the implementation simple and inexpensive for a small app.

## Cost and Retention

Azure Table Storage is an appropriate low-cost store for a small chat application. Cost is mainly storage transactions and retained data; both should remain modest at low volume.

- Add a timer-triggered cleanup Function to delete messages older than a selected retention period, such as 30 or 90 days.
- Periodically remove stale presence rows.
- Do not add Azure SignalR Service initially. Polling is enough for the first version and avoids additional service cost and complexity.

## Production Configuration

- Configure `StorageConnection` as an Azure Function App application setting, never in source control.
- Keep the client secret-free. A single-page app should never contain a client secret.
- Restrict the deployed Content Security Policy to the necessary Entra, Graph if used, and same-origin API connections.
- Keep redirect URIs in the Entra app registration aligned with the MSAL `redirectUri` value.

## Test Plan

Test with three separate Entra accounts:

1. User A sends a message to user B.
2. User B can retrieve the conversation and see the message.
3. User C cannot retrieve user A and B's conversation.
4. Messages survive a browser refresh and are still returned from Table Storage.
5. Old messages and stale presence rows are removed according to the retention policy.

## Recommended Implementation Order

1. Add the Entra delegated API scope and Azure Function token validation.
2. Secure the heartbeat endpoint and use token-derived identity.
3. Add the `Messages` table plus authenticated `POST` and `GET` endpoints.
4. Connect the existing player list and chat panel to those endpoints.
5. Add cleanup, retention configuration, and multi-account security tests.
