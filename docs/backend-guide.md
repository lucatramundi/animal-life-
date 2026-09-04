# Backend Guide

## Function Organization

HTTP and timer functions are under `api/src/functions/`. Shared behavior is under `api/src/lib/`.

| Area | Location |
|---|---|
| Authentication | `api/src/lib/authenticate.js` |
| Group authorization | `api/src/lib/groupAccess.js` |
| Chat helpers | `api/src/lib/chat.js` |
| Directory lookup | `api/src/lib/graphDirectory.js` |
| User cache | `api/src/lib/users.js` |
| HTTP handlers | `api/src/functions/` |

## Function Registration

Functions are registered with the Azure Functions v4 programming model using the `app` object from `@azure/functions`.

## Security Boundary

Functions use `authLevel: 'anonymous'` at the platform level, but every protected handler calls `authenticateRequest(request)`. New protected endpoints must follow the same pattern.

## Request Handling Rules

- Authenticate before reading or writing protected data.
- Derive the caller from the validated token.
- Validate all request fields at the API boundary.
- Do not use display names as identity keys.
- Authorize conversation access before returning messages.
- Return safe public error messages and log server-side diagnostics.

## Storage Rules

Create the required table before use. Use deterministic partition keys for conversations and stable Entra object IDs for user rows.

## Cleanup

The timer-triggered cleanup function removes expired presence and messages. Retention values are configured through environment variables.

## Adding an Endpoint

1. Define the function route and methods.
2. Authenticate the request.
3. Validate query parameters and body fields.
4. Apply group and resource authorization.
5. Read or write storage.
6. Return a documented response.
7. Add positive and negative tests.
8. Update `docs/api-reference.md`.
