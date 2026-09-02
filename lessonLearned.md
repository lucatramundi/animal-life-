# Lessons Learned

## 1. Validate identity on the server

MSAL login in the browser does not by itself secure an Azure Function. The browser must acquire an Entra access token and send it as:

```text
Authorization: Bearer <access-token>
```

The Function must validate the token signature, issuer, audience, required scope, and object ID before trusting the caller. The sender identity must come from the validated token, never from a request field supplied by the browser.

## 2. Use the Entra object ID as the user identity

Display names are not reliable identifiers because they can change and multiple users can have the same name. Use the Entra `oid` claim as the stable user ID and storage key.

Display names and avatar URLs are descriptive fields only. The UI can display the name, but API requests and database keys should use the object ID.

## 3. Use one deterministic conversation key

A conversation between two users must produce the same key regardless of who sends or reads the message. Sorting both user IDs before joining them creates one shared Azure Table partition:

```text
smaller-user-id|larger-user-id
```

This allows both participants to query the same conversation efficiently.

## 4. Store messages in a separate table

Presence and messaging have different lifetimes and purposes. Presence belongs in `OnlineUsers`; recorded chat messages belong in `Messages`.

Each message stores:

- `PartitionKey`: deterministic conversation ID
- `RowKey`: timestamp plus a unique ID for ordering and uniqueness
- `SenderId`: authenticated sender object ID
- `RecipientId`: recipient object ID
- `Body`: trimmed and length-limited message text
- `CreatedAt`: UTC timestamp

## 5. Validate input at the API boundary

The API must validate `recipientId` and message content even when the browser already validates them. Client-side validation improves the experience, but it cannot provide security because requests can be sent directly to the API.

The message body should be trimmed, must not be empty, and should have a maximum length. User IDs should be restricted before they are used in Azure Table keys or OData filters.

## 6. Match Entra token claims to the validator

Token validation errors identify different configuration problems:

- `unexpected "iss" claim value`: the token issuer did not match the configured tenant issuer.
- `unexpected "aud" claim value`: the token was issued for a different audience than the API expected.

For this project, the validator accepts the two issuer formats associated with the configured tenant:

```text
https://login.microsoftonline.com/<tenant-id>/v2.0
https://sts.windows.net/<tenant-id>/
```

It accepts the app's bare client ID and its `api://` form as audiences. The client scope must target the same app registration:

```text
api://<client-id>/access_as_user
```

If the audience is unrelated, such as Microsoft Graph, the client is requesting the wrong token.

## 7. Restart the local Function host after changes

Azure Functions loads environment variables and modules when the host starts. After changing `local.settings.json` or authentication code, stop and restart the Function host. Sign out and sign in again in the browser when necessary so MSAL obtains a fresh access token.

A local setup uses Azurite for Table Storage and the Functions host for the API. The Static Web Apps proxy must point to the same Function port.

## 8. Persist first, then render success

The chat UI should not treat a message as successfully sent merely because it was typed. The flow should be:

```text
validate -> acquire token -> POST message -> store in Azure Table -> render response
```

If storage fails, show an error instead of displaying a message that was never recorded.

## 9. Polling is sufficient for the first version

Polling the selected conversation every few seconds is simple and inexpensive for a small application. Azure SignalR or another real-time service can be considered later if the application needs lower latency or higher scale.

## 10. Security testing must use multiple accounts

At minimum, test with three separate Entra accounts:

1. User A sends a message to User B.
2. User B reads the conversation.
3. The message remains available after a browser refresh.
4. User C cannot read the A/B conversation.
5. Empty, oversized, unauthenticated, and incorrectly targeted requests are rejected.
