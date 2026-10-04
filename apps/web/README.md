# Donna web

Donna's first-party React client targets `https://donna.kernux.org`. Cloudflare Access email-code sign-in protects the site. The web Worker verifies the Access JWT before proxying `/api/v1/*` through a service binding; the API verifies that JWT again and scopes each user's chats and Settings separately. The browser never receives the deployer bearer token or another user's model key.

The responsive chat UI uses Tailwind CSS and generated shadcn/ui components in `src/components/ui`. Main chat is permanent; existing and new conversations are side chats. Settings accepts each user's OpenAI-compatible endpoint, model, and API key. The key is sent to the API only when saved, never returned by it, and never stored in browser storage.

## Development

Copy `.env.example` to `.env` and set `ACCESS_TEAM_DOMAIN` to the Access organization URL and `ACCESS_AUD` to the web application's audience. The API Worker needs the same Access values. The web Worker fails closed without a valid JWT. Keep `.env` gitignored. Deploy with `npx wrangler deploy --secrets-file .env` from this directory.

For local development, run from this directory (the API proxy still requires a valid Access JWT):

```bash
just dev
```
