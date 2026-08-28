# Donna

Donna is an open source, headless personal agent built on Cloudflare Workers. It exposes typed APIs so that deployments can use any client rather than depending on a bundled interface.

External services are available only through narrowly scoped Gatekeepers. Model inference is handled separately through each deployer's own Cloudflare AI Gateway.

## Status

Donna is in its initial design and scaffolding stage. There is not yet a runnable release.

## Design goals

- Headless and client-independent
- Deployable to a user's Cloudflare account
- Network-isolated agent execution
- Capability-based access to external services
- User-controlled model inference through Cloudflare AI Gateway
- Auditable external actions and approval decisions

## Development

Project commands and local setup instructions will be added with the first executable vertical slice.

Coding agents should read [AGENTS.md](AGENTS.md) before making changes.

## License

Donna is licensed under the [Apache License 2.0](LICENSE).
