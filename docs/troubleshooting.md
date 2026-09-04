# Troubleshooting

## `401 Invalid or expired access token`

Check:

- The user is signed in again after configuration changes.
- The token issuer matches the configured tenant.
- The token audience matches the API application.
- The API scope is `access_as_user`.
- The Functions host was restarted after settings changes.

## `403 Forbidden`

Check:

- The token contains the required scope.
- The user belongs to `ENTRA_ALLOWED_GROUP_ID`.
- The selected recipient is allowed.
- Group membership and Graph permissions are current.

## Storage Connection Failure

Check that Azurite is running and that local settings use the development storage connection. Confirm the Functions host is using the expected `api/src` directory.

## Frontend Cannot Reach the API

Check:

- The Functions host is listening on port `7072`.
- The Static Web Apps CLI uses the same API port.
- The request path begins with `/api/`.
- The API function started without module or configuration errors.

## Directory Search Shows Few Users

Graph lookup is optional. Check whether Graph settings are configured, application permissions have admin consent, and the configured allowed group is correct. Cached users may still be returned without Graph.

## Messages Do Not Appear

Check the browser network request and API response. Verify the selected user ID is valid, the caller is authorized, and the message was persisted before rendering success.

## Deployment Failure

Check the GitHub Actions run for:

- Correct repository secret names.
- Correct application and API paths.
- API dependency installation errors.
- Static Web Apps deployment token validity.
- Required branch and environment permissions.
