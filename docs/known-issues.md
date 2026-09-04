# Known Issues and Improvements

## High Priority

- Rotate any client secret that has been exposed.
- Remove secrets from local settings and Git history.
- Add automated API authentication and authorization tests.
- Clarify or remove the legacy anonymous flow in `script.js`.
- Add a redacted local settings example.
- Review the filename `heratbit.js`; rename only with a tested deployment change.

## Medium Priority

- Standardize on the `Authorization: Bearer <token>` header unless the custom header is required.
- Add structured logging and correlation IDs.
- Add dependency, secret, and source-code scanning to CI.
- Add pagination for directory and message queries.
- Improve conversation listing so it does not scan all messages as volume grows.
- Add health checks and deployment smoke tests.
- Document Graph permissions and admin consent in the deployment guide.

## Longer Term

- Add Bicep or another infrastructure-as-code implementation.
- Add pull request infrastructure `what-if` validation.
- Add Application Insights monitoring.
- Replace polling with a real-time service if scale or latency requires it.
- Add a documented release and rollback process.

## Documentation Rule

When an endpoint, authentication rule, storage schema, deployment behavior, or major design decision changes, update the related documentation in the same pull request.
