# ZPlay Documentation Plan

## Objective

Create clear, maintainable documentation so a new developer can understand the architecture, run the project locally, make code changes safely, test them, and deploy them.

## Documentation Structure

```text
README.md
docs/
  architecture.md
  technology-stack.md
  local-development.md
  authentication.md
  api-reference.md
  data-model.md
  frontend-guide.md
  backend-guide.md
  deployment.md
  testing.md
  troubleshooting.md
  known-issues.md
  decisions/
```

## Documentation Deliverables

### 1. Project Overview

Document:

- Project purpose and current functionality.
- Main frontend and backend components.
- Current project status.
- Known limitations.
- Links to all detailed documentation.

### 2. Architecture

Describe:

- Browser frontend.
- Microsoft Entra ID authentication.
- Azure Static Web Apps hosting.
- Azure Functions API.
- Azure Table Storage.
- Optional Microsoft Graph integration.
- Timer-triggered cleanup.
- GitHub Actions deployment.

Include a request-flow diagram covering sign-in, API authentication, messaging, presence, and storage.

### 3. Technology Stack

Document:

- HTML, CSS, and JavaScript frontend.
- MSAL Browser.
- Microsoft Entra ID.
- Azure Static Web Apps.
- Azure Functions for Node.js.
- Azure Table Storage.
- Azurite for local development.
- `jose` for JWT validation.
- Microsoft Graph for directory lookup.
- GitHub Actions for deployment.

### 4. Local Development

Document:

- Required tools and Node.js version.
- Azure Functions Core Tools.
- Azure Static Web Apps CLI.
- Azurite.
- Dependency installation.
- Local configuration.
- Startup commands and local URLs.
- How to restart the Functions host.
- How to stop local services.

Never document real secrets. Use a redacted configuration template.

### 5. Authentication and Authorization

Explain:

- How MSAL signs users in.
- How the browser requests the API access token.
- The required `access_as_user` scope.
- JWT validation performed by the API.
- Issuer and audience validation.
- Use of the Entra `oid` claim as the user ID.
- Allowed-group authorization.
- Bearer-token headers.
- Why client secrets must never be placed in frontend code.

### 6. API Reference

Document these endpoints:

| Endpoint | Purpose |
|---|---|
| `POST /api/heartbeat` | Record presence and return active users |
| `GET /api/users` | Search known directory users |
| `GET /api/conversations` | Return recent conversation partners |
| `GET /api/messages?userId=...` | Read a conversation |
| `POST /api/messages` | Store a message |
| `cleanupStorage` | Remove expired presence and messages |

For each endpoint document authentication, inputs, outputs, validation, errors, and storage effects.

### 7. Data Model

Document the Azure Tables:

- `OnlineUsers`: temporary presence records.
- `Users`: cached directory users.
- `Messages`: persisted chat messages.

Explain:

- Partition keys.
- Row keys.
- Conversation ID generation.
- Message retention.
- Why Entra object IDs are used instead of display names.

### 8. Frontend Guide

Document:

- Authentication flow in `main.js`.
- Presence handling in `presence.js`.
- User directory merging.
- Chat selection.
- Message polling.
- Message rendering.
- Error handling.
- Active code versus legacy prototype code in `script.js`.

### 9. Backend Guide

Document:

- Azure Function registration.
- Shared libraries under `api/src/lib`.
- Authentication middleware.
- Group authorization.
- Input validation.
- Azure Table access.
- Error handling.
- Timer-triggered cleanup.

### 10. Deployment Guide

Document:

- GitHub Actions workflow triggers.
- Pull request deployment behavior.
- Main-branch deployment.
- Static Web Apps configuration.
- API deployment configuration.
- Required GitHub secrets.
- Azure authentication.
- Bicep deployment, if infrastructure as code is added.
- Rollback procedure.

Use OIDC instead of long-lived Azure client secrets where possible.

### 11. Testing Guide

Include tests for:

- Unauthenticated requests.
- Invalid and expired tokens.
- Wrong tenant or audience.
- Missing API scope.
- Unauthorized group membership.
- Message persistence.
- Conversation participant access.
- Invalid recipients.
- Empty or oversized messages.
- Presence expiry.
- Message cleanup.
- Graph directory failures.

Use at least three test accounts for authorization testing.

### 12. Troubleshooting Guide

Document solutions for:

- `401` authentication errors.
- `403` authorization errors.
- Incorrect token audience.
- Missing API scope.
- Azurite connection failures.
- Function host startup failures.
- Static Web Apps proxy failures.
- Graph permission failures.
- Deployment failures.
- Stale browser tokens.

### 13. Known Issues and Improvements

Track:

- Rotate any exposed client secret immediately.
- Remove secrets from local settings and Git history.
- Add automated API and authorization tests.
- Clarify or remove legacy `script.js`.
- Consider renaming `heratbit.js` to `heartbeat.js`.
- Add dependency and secret scanning.
- Add pagination for users and messages.
- Improve conversation query performance.
- Add monitoring and Application Insights.
- Consider real-time messaging if polling becomes insufficient.
- Add infrastructure as code and deployment validation.

## Documentation Review Checklist

A new developer must be able to:

- Explain the system architecture.
- Start the application locally.
- Sign in with a test account.
- Send and retrieve a message.
- Find the relevant frontend and backend code.
- Understand the table schema.
- Make a validation change safely.
- Run the test suite.
- Diagnose common `401`, `403`, storage, and deployment errors.
- Deploy without requesting another developer's secret.

## Maintenance Rule

Update the documentation whenever an API endpoint, data model, authentication flow, deployment process, or major architectural decision changes.

## Immediate Security Action

The local configuration previously shown contains a client secret. Rotate that secret before sharing the repository or documentation, remove it from source control, and replace local settings with a redacted example file.