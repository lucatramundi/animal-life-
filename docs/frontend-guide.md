# Frontend Guide

## Active Entry Points

- `index.html` defines the main page and loads MSAL, `main.js`, and `presence.js`.
- `main.js` owns authentication state, directory data, conversation loading, chat selection, message sending, and polling.
- `presence.js` owns the authenticated heartbeat loop.
- `styles.css` owns presentation.

`script.js` contains an older game and anonymous presence prototype. Do not add new authenticated chat behavior there.

## State

The main frontend tracks:

- Signed-in account.
- Selected chat user.
- Online users.
- Recent conversations.
- Known directory users.
- Polling and request IDs used to avoid stale responses.

## User Directory

Directory, recent-conversation, and presence entries are merged by Entra object ID. Online users and recent conversations are sorted ahead of other known users.

## Chat Flow

1. Select a user.
2. Load the conversation.
3. Enable the input and send controls.
4. Poll the selected conversation every few seconds.
5. Submit messages through the API.
6. Render the server response only after persistence succeeds.

Use `textContent` for user-controlled message and display text to avoid interpreting it as HTML.

## Authentication Changes

When adding an API call:

1. Confirm a signed-in account exists.
2. Acquire an API access token through the existing helper.
3. Send the token with the request.
4. Handle non-success responses.
5. Avoid trusting browser-provided identity fields.

## UI Changes

Keep DOM IDs and endpoint contracts aligned with `index.html` and the API reference. Preserve disabled, empty, loading, and error states when changing chat behavior.
