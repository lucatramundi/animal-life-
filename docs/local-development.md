# Local Development

## Required Tools

Install:

- Node.js and npm
- Azure Functions Core Tools
- Azure Static Web Apps CLI
- Azurite

## API Dependencies

```powershell
Set-Location .\api\src
npm install
```

## Local Settings

Create `api/src/local.settings.json` locally. Do not commit it. Use placeholders for tenant IDs and credentials, and keep secrets out of frontend files.

Required values include:

```text
StorageConnection=UseDevelopmentStorage=true
AzureWebJobsStorage=UseDevelopmentStorage=true
FUNCTIONS_WORKER_RUNTIME=node
AZURE_TENANT_ID=<tenant-id>
ENTRA_API_AUDIENCE=<api-audience>
ENTRA_ALLOWED_GROUP_ID=<allowed-group-id>
```

Graph settings are required only when server-side directory lookup is enabled. Use a secure local secret store or environment injection for client secrets.

## Start Local Services

Start Azurite:

```powershell
azurite --location .azurite --debug .azurite\debug.log
```

Start the Functions host on port `7072`:

```powershell
Set-Location .\api\src
func start --port 7072
```

Start the Static Web Apps emulator:

```powershell
Set-Location .
npx swa start . --api-location ./api --api-port 7072
```

Run each command in a separate terminal.

## Local Validation

1. Open the URL printed by the Static Web Apps CLI.
2. Sign in with an approved Entra test account.
3. Confirm the browser can send a heartbeat.
4. Confirm `OnlineUsers`, `Users`, and `Messages` tables are created in Azurite as features are used.
5. Test directory search and messaging.

## Restart Rules

Restart the Functions host after changing `local.settings.json`, authentication code, shared API libraries, or function registration. Sign out and sign in again when a stale browser token may be involved.

## Common Local Problems

- API connection errors usually indicate the Functions host is not running on port `7072`.
- Storage errors usually indicate Azurite is stopped or the connection setting is incorrect.
- Authentication errors usually indicate a tenant, audience, scope, redirect URI, or group mismatch.
