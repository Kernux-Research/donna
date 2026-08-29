# Donna agent instructions

- Donna is an open source personal agent designed for Cloudflare Workers.
- The API is the complete, client-independent product boundary. `apps/web` is the only bundled client and must not import API implementation code.
- Build `apps/web` as a responsive browser application for phone, tablet, and desktop viewports. Do not add native mobile or desktop clients unless the product scope changes.
- External services must only be reachable through explicit Gatekeeper capabilities. Do not add ambient outbound access.
- Model inference is the kernel-managed exception: deployers supply their own Cloudflare AI Gateway configuration, while agent-generated code remains network-isolated.
- Shared API schemas belong in `packages/api-contract`. Derive TypeScript types from those schemas rather than defining separate contracts.
- Use JSONC for Cloudflare Workers configuration.
- Store secrets in `.env` files and keep them out of source control.
- Revise this file whenever meaningful changes alter the architecture, scripts, conventions, paths, or operational requirements.

## Commands

- Use `bun turbo <command>` for validation.
- For individual packages, run the command within the package directory.
- For multiple packages, run `bun turbo -F <package-name> -F <other-package-name> <command>` from the repository root.
- Run multiple checks in one command, for example `bun turbo -F @donna/api build check:types check:lint`.
- Run `just lint` for grouped lint and typecheck output across the repository.
- Run `just check` for the full dependency, lint, type, format, and test suite.
- Run `just fix --format` after making changes.
- Never start a development server from an agent session.
- Run `pnpm install` without filters when dependencies change.

## Conventions

- Use `apps/` for deployable Cloudflare applications and `packages/` for shared code and tooling.
- Internal dependencies use `workspace:*`.
- Keep tests beside the behavior they cover unless a Worker integration test requires the established `src/test/integration` layout.
- Never name variables `error`; use `err` or `e`.
- Follow local patterns instead of introducing parallel conventions.
- Do not create speculative helpers.
- Every change affecting a versioned workspace package must include a Changeset.
- Use the generators under `turbo/generators/` for additional Workers or packages when they fit the required architecture.
