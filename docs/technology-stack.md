# Technology Stack

| Area | Technology | Role |
|---|---|---|
| Frontend | HTML, CSS, browser JavaScript | UI, authentication interaction, presence, and chat |
| Authentication | MSAL Browser | Microsoft Entra sign-in and access-token acquisition |
| Identity | Microsoft Entra ID | User identity, API scope, tenant, and group access |
| Hosting | Azure Static Web Apps | Static frontend hosting and API routing |
| Backend | Azure Functions for Node.js | HTTP APIs and timer-triggered cleanup |
| Storage | Azure Table Storage | Presence, user cache, and messages |
| Local storage | Azurite | Local Azure Storage emulator |
| JWT validation | `jose` | Access-token signature and claim validation |
| Directory | Microsoft Graph | Optional user search and group filtering |
| CI/CD | GitHub Actions | Build and deploy frontend and API |
| API packages | `@azure/functions`, `@azure/data-tables` | Function runtime and Table Storage access |

## Dependency Source

The API dependency versions are defined in `api/src/package.json` and installed from the API directory.

## Hosting Model

The frontend is deployed from the repository root. The API source is under `api/src`. Static Web Apps routes `/api/*` to the deployed Functions API.

## External Services

- Microsoft Entra ID is required for authenticated operation.
- Azure Table Storage is required for presence and messaging.
- Microsoft Graph is optional and requires application configuration and consent.
- DiceBear is used by the frontend for generated avatar URLs.

## Configuration Principles

- Keep browser configuration free of client secrets.
- Store production secrets in Azure application settings or a secret manager.
- Keep local settings out of source control.
- Pin or regularly review third-party action and package versions.
