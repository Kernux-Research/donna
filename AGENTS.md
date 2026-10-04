# Donna agent instructions

- Donna is an open source personal agent designed for Cloudflare Workers.
- The API is the complete, client-independent product boundary. `apps/web` is the only bundled client and must not import API implementation code.
- The bundled web client must not ask for or expose the Donna deployer API token. Its Worker validates the Cloudflare Access JWT and forwards only that verified identity through the API service binding; the API validates the JWT independently.
- Build `apps/web` as a responsive browser application for phone, tablet, and desktop viewports. Do not add native mobile or desktop clients unless the product scope changes.
- External services must only be reachable through explicit Gatekeeper capabilities. Do not add ambient outbound access.
- Model inference is the kernel-managed exception: signed-in users supply their own OpenAI-compatible endpoint, model, and key in Settings. The original deployer settings are a fallback for the owner only. Only the API Worker's server-side adapter may reach the provider; agent-generated code remains network-isolated.
- `apps/api/src/donna-access-identity.ts` validates Access identities. The API scopes one Durable Object per verified user; the owner's existing `donna` object remains private to the owner. `apps/api/src/donna-threads.ts` owns conversation persistence and encrypted per-user model settings; `apps/api/src/openai-compatible-inference.ts` owns model requests. The web opens main on every visit and filters side-chat titles locally.
- Shared API schemas belong in `packages/api-contract`. Derive TypeScript types from those schemas rather than defining separate contracts.
- The web uses React, Tailwind CSS v4, and generated shadcn/ui components in `apps/web/src/components/ui`. Do not copy Muse assets or show unsupported controls.
- Use JSONC for Cloudflare Workers configuration.
- Cloudflare Access permits email-code sign-in for any verified email through the one-time-PIN login-method Allow policy; the free plan is limited to 50 users. Keep the owner Allow policy and the Access gate enabled.
- Production custom domains are `donna.kernux.org` (Access-protected web) and `donna-api.kernux.org` (independent bearer-token API). Keep the deployer bearer token, Access verification values, owner email, and stable `SETTINGS_ENCRYPTION_KEY` in gitignored `apps/api/.env`; keep matching Access verification values in `apps/web/.env`. Deploy each Worker from its directory with `npx wrangler deploy --secrets-file .env`. Never widen the Access policy before cross-user isolation tests pass. The browser must not receive the deployer token or saved provider keys.
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
