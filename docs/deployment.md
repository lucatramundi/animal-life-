# Deployment

## Current Deployment

The workflow under `.github/workflows/azure-static-web-apps-purple-island-03aa07403.yml` deploys Azure Static Web Apps.

It currently:

- Runs on pushes to `main`.
- Runs for configured pull request events targeting `main`.
- Uses `Azure/static-web-apps-deploy@v1`.
- Deploys the repository root as the application.
- Deploys `api/src` as the API.
- Installs API production dependencies with `npm install --omit=dev`.
- Closes a preview environment when a pull request is closed.

## Branch Protection

Protect `main` with:

- Pull requests required before merging.
- Required reviews.
- Required successful security and test checks.
- Force-push and deletion restrictions.

## Secrets

The workflow uses a Static Web Apps deployment token stored as a GitHub secret. Do not place tokens in YAML, source files, or documentation.

For Azure resource provisioning through Bicep, prefer GitHub OIDC with:

```text
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID
```

Use least-privilege permissions and environment protection for production.

## Recommended Pipeline Order

```text
Security scan -> Build and test -> Deployment
```

Deployment should depend on successful validation. Add dependency, secret, code, and infrastructure scanning before production deployment.

## Infrastructure as Code

If Bicep files are added, keep infrastructure deployment separate from application deployment or make the application deployment depend on a successful infrastructure job. Use a pull request `what-if` validation before applying changes to production.

## Rollback

Use the previous known-good commit or release tag and redeploy it through the protected deployment workflow. Record the reason for rollback and verify application health afterward.
