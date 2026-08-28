# Donna agent instructions

- Donna is an open source, headless personal agent designed for Cloudflare Workers.
- External services must only be reachable through explicit Gatekeeper capabilities. Do not add ambient outbound access.
- Model inference is the kernel-managed exception: deployers supply their own Cloudflare AI Gateway configuration, while agent-generated code remains network-isolated.
- Keep the core client-agnostic. Expose typed APIs and events rather than coupling behavior to a bundled UI.
- Use JSONC for Cloudflare Workers configuration.
- Store secrets in `.env` files and keep them out of source control.
- Add project-specific build, test, lint, and deployment commands here when the project is scaffolded.
- Revise this file whenever meaningful changes alter the architecture, scripts, conventions, paths, or operational requirements.
