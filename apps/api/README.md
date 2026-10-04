# Donna API

The client-independent API stores each signed-in user's conversations and encrypted model key in a separate Durable Object. The API validates Cloudflare Access application JWTs independently of the bundled web Worker. The original deployer bearer token still accesses only the legacy owner store. No provider key is returned by the settings API.

## Configuration

Copy `.env.example` to `.env` and set:

- `DONNA_API_TOKEN`: private deployer bearer token, scoped to the original owner store.
- `DONNA_WEB_ORIGIN`: exact allowed browser origin, `https://donna.kernux.org` in production.
- `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`: Cloudflare Access issuer and the web application's audience. JWTs must contain a verified email and nonempty user ID.
- `DONNA_OWNER_EMAIL`: the original account's verified email. This maps that account to the pre-existing `donna` Durable Object; other users receive isolated objects.
- `SETTINGS_ENCRYPTION_KEY`: one randomly generated 32-byte base64 AES key. Preserve it across deployments; rotating it without re-encrypting existing keys makes them unreadable.
- `OPENAI_BASE_URL`, `OPENAI_API_KEY`, and `OPENAI_MODEL`: optional legacy fallback for the owner only. Other users must enter their own settings in the web UI.

Deploy from this directory with `npx wrangler deploy --secrets-file .env`. Never commit `.env` or expose provider keys in responses, logs, or client assets.

## Endpoints

`GET /v1/health` is public. All other endpoints accept either a verified Cloudflare Access application JWT as `Authorization: Bearer <JWT>` (user-scoped) or the deployer bearer token (original owner only):

- `GET /v1/settings/model`: return model ID, base URL, and whether a key is saved; never return the key.
- `PUT /v1/settings/model`: save an HTTPS-compatible base URL, model ID, and optional new key. A key is required for initial setup. Keys are AES-GCM encrypted at rest.
- `GET /v1/threads/main`: get or create the permanent main chat.
- `POST /v1/threads`, `GET /v1/threads`: create or list side chats and main chat.
- `GET`, `PATCH`, `DELETE /v1/threads/:threadId`: read, rename, or delete a side chat; main cannot be renamed or deleted.
- `POST /v1/threads/:threadId/messages`: stream inference via server-sent events using only this user's model configuration.
