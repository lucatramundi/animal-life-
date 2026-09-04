# Authentication and Authorization

## Browser Flow

The browser uses MSAL Browser to sign in to Microsoft Entra ID. It requests the API delegated scope:

```text
api://<client-id>/access_as_user
```

The access token is sent to API endpoints in the `X-ZPlay-Authorization` header. The API also accepts the standard `Authorization` header.

## Server Validation

`api/src/lib/authenticate.js` validates:

- Bearer-token presence.
- RSA signing algorithm.
- Token signature against Microsoft Entra keys.
- Issuer for the configured tenant.
- Audience for the configured API.
- Required `access_as_user` scope.
- Entra object ID (`oid`).
- Allowed group membership.

The server derives the caller identity from the validated token. Request fields must never be trusted as the sender identity.

## Identity Rules

Use the Entra `oid` claim as the stable user ID. Display names and usernames are descriptive fields only because they can change or collide.

## Group Access

When `ENTRA_ALLOWED_GROUP_ID` is configured, the authentication and group-access helpers restrict access to members of the configured group. Users outside the group should receive an authorization error.

## Configuration

Required server-side settings include:

```text
AZURE_TENANT_ID=<tenant-id>
ENTRA_API_AUDIENCE=<api-client-id-or-api-audience>
ENTRA_ALLOWED_GROUP_ID=<group-id>
```

The client must contain only public application configuration. Never place a client secret in `main.js`, HTML, CSS, or any other browser-delivered file.

## Troubleshooting Tokens

- Wrong issuer: verify the tenant and authority.
- Wrong audience: verify that the client requests the API scope, not a Microsoft Graph scope.
- Missing scope: verify the API exposes `access_as_user` and the client requests it.
- Stale token: sign out, sign in again, and restart the local host after configuration changes.
