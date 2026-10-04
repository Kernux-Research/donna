# Donna

Donna is an open source personal agent built on Cloudflare Workers. It provides a client-independent API and a responsive web interface for phone, tablet, and desktop browsers.

External services are available only through narrowly scoped Gatekeepers. Each signed-in user can supply an OpenAI-compatible chat completions API in Settings. Provider keys stay encrypted server-side; only the API Worker performs inference.

## Status

Donna supports a permanent main chat and multiple side chats with rename, delete, title search, safe Markdown replies, and streamed responses. The web client is deployed at https://donna.kernux.org and the API at https://donna-api.kernux.org. Cloudflare Access handles email-code sign-in; the API isolates each user's chats and model settings. The deployer API token remains private, with no token prompt in the browser. External-service Gatekeepers are not implemented.

## Repository structure

- `apps/api`: Donna's public API Worker, Durable Object conversation store, and server-side inference adapter
- `apps/web`: the responsive first-party React client
- `packages/api-contract`: shared runtime schemas and derived API types
- `packages/`: tooling and shared packages inherited from the Workers monorepo template
- `turbo/generators`: generators for additional Workers and packages

## Prerequisites

The pinned tool versions are recorded in `.mise.toml`:

- Node.js
- pnpm
- Bun
- Just

[Mise](https://mise.jdx.dev/) can install them together. They can also be installed separately.

## Development

Install dependencies:

```bash
just install
```

Run the API and web development servers:

```bash
just dev
```

Run all checks:

```bash
just check
```

Local environment examples live in each application as `.env.example`. Copy them to `.env` before development. Configure the API's deployer token, Access issuer and audience, owner email, and encryption key. The web Worker needs the matching Access issuer and audience, not the deployer token. See [API configuration](apps/api/README.md) and [web configuration](apps/web/README.md). Never commit populated `.env` files.

Coding agents should read [AGENTS.md](AGENTS.md) before making changes.

## License

Donna is licensed under the [Apache License 2.0](LICENSE). Portions derived from the Workers Monorepo Template retain their original MIT license notice in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
