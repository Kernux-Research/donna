# Donna

Donna is an open source personal agent built on Cloudflare Workers. It provides a client-independent API and a responsive web interface for phone, tablet, and desktop browsers.

External services are available only through narrowly scoped Gatekeepers. Model inference is handled separately through each deployer's own Cloudflare AI Gateway.

## Status

Donna is in its initial scaffolding stage. The current applications expose an API health check and a web connection-status page.

## Repository structure

- `apps/api`: Donna's public, client-independent API Worker
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

Local environment examples live in each application as `.env.example`. Copy them to `.env` before development. Never commit populated `.env` files.

Coding agents should read [AGENTS.md](AGENTS.md) before making changes.

## License

Donna is licensed under the [Apache License 2.0](LICENSE). Portions derived from the Workers Monorepo Template retain their original MIT license notice in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
