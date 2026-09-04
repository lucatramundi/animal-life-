# Data Model

The API uses Azure Table Storage. Tables are created on demand by the relevant functions.

## `OnlineUsers`

| Property | Meaning |
|---|---|
| Partition key | `Presence` |
| Row key | Entra object ID |
| `DisplayName` | Current display name |
| `AvatarUrl` | Avatar URL supplied by the client |
| `LastSeen` | Unix timestamp in milliseconds |

Rows represent temporary presence and are removed after the configured retention period.

## `Users`

| Property | Meaning |
|---|---|
| Partition key | Directory partition selected by the users helper |
| Row key | Entra object ID |
| Display name | Best-known display name |
| Username | Preferred username or sign-in identifier |
| Source | Presence, sign-in, Graph, or cache source |
| Updated time | Last refresh time |

This table is a cache, not the authoritative directory.

## `Messages`

| Property | Meaning |
|---|---|
| Partition key | Deterministic conversation ID |
| Row key | Timestamp plus UUID |
| `SenderId` | Authenticated sender object ID |
| `SenderName` | Sender display name at creation time |
| `RecipientId` | Recipient object ID |
| `RecipientName` | Recipient display name at creation time |
| `Body` | Validated message text |
| `CreatedAt` | UTC ISO timestamp |

## Conversation Keys

The conversation ID is generated from the two user IDs after sorting them. Therefore, both participants use the same partition regardless of who sends or reads the message.

## Retention

The cleanup timer removes stale presence and messages according to:

```text
PRESENCE_RETENTION_SECONDS
MESSAGE_RETENTION_DAYS
```

## Design Rules

- Do not use display names as identity or storage keys.
- Validate identifiers before placing them in Table Storage filters.
- Keep presence and messages in separate tables because their lifetimes differ.
