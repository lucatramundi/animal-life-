# ZPlay

ZPlay is a browser-based social game prototype with Microsoft Entra ID sign-in, online presence, directory search, and direct messaging.

## Quick Links

- [Architecture](docs/architecture.md)
- [Technology stack](docs/technology-stack.md)
- [Local development](docs/local-development.md)
- [Authentication](docs/authentication.md)
- [API reference](docs/api-reference.md)
- [Data model](docs/data-model.md)
- [Frontend guide](docs/frontend-guide.md)
- [Backend guide](docs/backend-guide.md)
- [Deployment](docs/deployment.md)
- [Testing](docs/testing.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Known issues and improvements](docs/known-issues.md)
- [Documentation plan](docs/documentation-plan.md)

## Current Architecture

The application uses static browser files hosted by Azure Static Web Apps and an Azure Functions Node.js API. Microsoft Entra ID authenticates users. Azure Table Storage stores presence, known users, and messages. Microsoft Graph is optional for directory search.

The active authenticated frontend path is `main.js` and `presence.js`. `script.js` contains an older anonymous prototype flow and should not be used for new authenticated features.

## Prerequisites

- Node.js and npm
- Azure Functions Core Tools
- Azure Static Web Apps CLI
- Azurite
- Access to the configured Microsoft Entra tenant and test accounts

## Local Start

From PowerShell, start the services in separate terminals:

```powershell
azurite --location .azurite --debug .azurite\debug.log
```

```powershell
Set-Location .\api\src
npm install
func start --port 7072
```

```powershell
npx swa start . --api-location ./api --api-port 7072
```

Use the local URL printed by the Static Web Apps CLI. See [local development](docs/local-development.md) for configuration details.

## Security Notice

Never commit `local.settings.json`, client secrets, access tokens, or other credentials. Use placeholders in documentation and rotate any credential that has been exposed.

## Deployment

The GitHub Actions workflow under `.github/workflows/` deploys the frontend and API to Azure Static Web Apps when changes are pushed to `main` or when configured pull request events occur. See [deployment](docs/deployment.md).
