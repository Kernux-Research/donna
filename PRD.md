# Donna basic agent PRD

## Overview

Donna is an open source personal agent hosted on Cloudflare Workers for users who bring their own model API. Donna exposes a client-independent API and includes one responsive web client for phone, tablet, and desktop browsers.

This milestone delivers the first working conversational agent. A deployer can connect Donna to their own OpenAI-compatible API, create a thread, send a message, stream the response, and reload the persisted conversation.

Donna cannot access external services directly. Future external integrations must use explicit Gatekeeper capabilities. Model inference through the deployer's OpenAI-compatible API is the kernel-managed exception.

## Problem

People can deploy agent interfaces, but those systems commonly couple the agent to one client, expose provider credentials to the agent runtime, or make external tools ambiently available in every conversation.

Donna needs a minimal foundation that proves four boundaries:

- The API works independently of the bundled web client.
- Conversation state survives Worker and browser restarts.
- Model inference always passes through the authenticated user's OpenAI-compatible API via the API Worker.
- The agent starts with no external-service capabilities.

## Goals

- Run a basic conversational agent on Cloudflare Workers.
- Let each signed-in user configure their own OpenAI-compatible API endpoint, key, and model.
- Authenticate every non-health API request.
- Persist threads and completed messages in Durable Object storage.
- Stream assistant output to API clients.
- Provide a responsive first-party web experience.
- Define runtime API schemas in `packages/api-contract`.
- Encrypt provider keys in per-user storage; never return saved keys to browsers, prompts, or conversation messages.
- Establish an agent loop that can accept Gatekeeper tools in a later milestone.

## Non-goals

- Gatekeeper implementations
- External-service tools
- Sandboxed Code Mode
- Long-term memory across threads
- File or image attachments
- Voice input or output
- Thread search, branching, sharing, or collaboration
- Multiple agent personalities
- Model selection in the web client
- OAuth or social login (Cloudflare Access email-code login handles initial sign-in)
- Native mobile or desktop clients
- Background schedules
- Provider-native web search
- Production billing or usage limits (the Cloudflare Access free tier limits enrollment)

## Users

A hosted user:

- Signs in using a verified email through Cloudflare Access.
- Brings an OpenAI-compatible chat completions API endpoint and key.
- Has private chats and model settings, isolated from other users.
- Uses Donna through the responsive web client or their own API client.

Hosted users sign in through Cloudflare Access email codes. Each user has a separate conversation store and supplies their own model key. The original deployer retains the legacy conversation store.

## Primary user journey

1. The deployer configures the API's Access identity verification, owner account mapping, persistent encryption key, and deployer API token.
2. The deployer deploys the API and web Workers with Cloudflare Access email-code sign-in.
3. The user opens the web client.
4. Cloudflare Access signs the user in to the web deployment.
5. The web Worker verifies the Access JWT and forwards it through a service binding. The API Worker verifies it again and selects the user's store.
6. The user enters their own model endpoint, key, and model ID in Settings, then starts a main or side chat.
7. The user sends a message.
8. Donna streams an assistant response.
9. The user reloads the page.
10. The thread and completed messages remain available.
11. The deployer can inspect inference requests using their provider's own logs, when available.

## Product boundaries

- `apps/api` is the complete public product boundary.
- `apps/web` is a first-party API client and must not import API implementation code.
- `apps/api` owns the server-side inference adapter and Durable Object conversation store.
- `packages/api-contract` owns public request, response, event, and error schemas.
- The API Worker is the only component that stores encrypted provider keys and decrypts them for model inference.
- The agent has no generic external-service tools or provider credentials.

## Architecture

```text
Responsive web client
  -> Access-protected web Worker (verified JWT, service binding)
    -> Donna API Worker
    -> Per-user Durable Object (chats and encrypted model settings)
      -> User's OpenAI-compatible chat completions endpoint
```

The API Worker handles authentication, routing, and validation. A Durable Object stores and serializes conversation mutations. Its server-side inference adapter calls the user's configured OpenAI-compatible endpoint and streams normalized output to the client.

## Deployment configuration

The API Worker requires:

```text
DONNA_API_TOKEN
DONNA_WEB_ORIGIN
ACCESS_TEAM_DOMAIN
ACCESS_AUD
DONNA_OWNER_EMAIL
SETTINGS_ENCRYPTION_KEY
```

The original owner may retain the legacy Worker secret fallback:

```text
OPENAI_BASE_URL
OPENAI_API_KEY
OPENAI_MODEL
```

Requirements:

- `OPENAI_API_KEY` must be stored as a Worker secret.
- `DONNA_API_TOKEN` must be stored as a Worker secret.
- `.env.example` files contain names and placeholders only.
- Populated `.env` files remain ignored by Git.
- Donna sends model requests only to the authenticated user's saved HTTPS endpoint. It rejects embedded URL credentials, query strings, and remote plain HTTP.
- Donna must require an explicit model identifier rather than silently choosing one.

## Authentication

The original deployer retains a bearer token for their own store:

```http
Authorization: Bearer <DONNA_API_TOKEN>
```

Requirements:

- `GET /v1/health` remains public.
- All thread and message endpoints require authentication.
- Authentication comparison must not leak token length or contents through logs or responses.
- The API must never return the configured token.
- The web build must not contain the token.
- The browser must never receive or store the Donna API token.
- The web Worker and API Worker both verify the Access application JWT. The API rejects missing identity claims and scopes all chat and settings requests to that verified user. A missing or invalid Access configuration fails closed.
- The API must restrict browser CORS access to `DONNA_WEB_ORIGIN`.
- Non-browser API clients are not restricted by CORS.

Errors:

```text
401 authentication_required
401 invalid_api_token
```

Cloudflare Access email codes provide public sign-in (up to the account plan's user limit). The API also accepts an Access JWT as a user-scoped bearer token for independent clients. The deployer token accesses only the owner's legacy store.

## Thread requirements

A thread contains:

- A unique thread ID
- A creation timestamp
- An update timestamp
- A kind: permanent main chat or side chat
- A title, derived from the first user message for side chats
- An ordered sequence of messages
- The status of any active generation

The first release supports:

- Get or create one permanent main chat, opened by default on each web visit
- Create multiple side chats; existing threads remain side chats
- List threads
- Retrieve one thread and its messages
- Rename or delete side chats, never the main chat
- Search loaded side-chat titles in the web client
- Send a user message
- Stream the assistant response

The first release does not support full-text message search, sharing, or branching threads.

Only one generation may run in a thread at a time. A concurrent send must return:

```text
409 thread_generation_active
```

## Message requirements

A persisted message contains:

- A unique message ID
- Its thread ID
- Its role: `user` or `assistant`
- Text content
- A creation timestamp
- Its completion state

Donna must persist the user message before starting inference. Donna must persist the completed assistant message before emitting the terminal completion event.

If inference fails, Donna must preserve the user message and record a failed assistant generation without inventing assistant content.

Partial assistant output does not need to survive a Worker restart in this milestone. Completed output must survive.

## API requirements

Initial endpoints:

```http
GET  /v1/health
GET  /v1/settings/model
PUT  /v1/settings/model
GET  /v1/threads/main
POST /v1/threads
GET  /v1/threads
GET  /v1/threads/:threadId
PATCH /v1/threads/:threadId
DELETE /v1/threads/:threadId
POST /v1/threads/:threadId/messages
```

The message endpoint returns a server-sent event stream.

Required stream events:

```text
message.started
message.delta
message.completed
message.failed
```

Every event is a complete JSON object validated by a schema from `packages/api-contract`.

The stream must preserve event order. Exactly one terminal event, `message.completed` or `message.failed`, may be emitted for a generation.

## API contract requirements

`packages/api-contract` must define Zod schemas and derive TypeScript types for:

- `ThreadId`
- `MessageId`
- `Thread`
- `Message`
- `CreateThreadRequest`
- `CreateThreadResponse`
- `ListThreadsResponse`
- `GetThreadResponse`
- `UpdateThreadRequest`
- `UpdateThreadResponse`
- `SendMessageRequest`
- `AgentStreamEvent`
- `ApiError`

Identifiers should use branded schema types where they prevent accidental substitution.

Applications must not define parallel handwritten versions of contract types.

## Inference requirements

The API Worker's server-side inference adapter calls the configured endpoint:

```text
POST {OPENAI_BASE_URL}/chat/completions
```

The base URL must use HTTPS except for localhost development.

It must send:

- The configured provider bearer key
- The configured model
- The Donna system message
- The persisted conversation context
- Streaming enabled

It must not send:

- Gatekeeper credentials
- The Donna API token
- Browser state

The inference adapter normalizes upstream chunks into Donna stream deltas. Provider-specific response formats must not cross the public API boundary.

Provider-native tools, including provider-hosted web search, must remain disabled because they bypass Donna's Gatekeeper policy.

## Agent behavior

Donna's initial system instruction should establish that:

- Donna is a personal agent.
- Donna should be concise and direct.
- Donna currently has no external-service capabilities.
- Donna must not claim to have performed an external action.
- Donna should explain when a requested task requires a future Gatekeeper capability.

The exact wording belongs in one searchable source file and must be covered by a test or snapshot.

## Agent loop

The first milestone uses a small internal conversation loop. A future agent-loop library may replace it without changing the public API or event contracts.

## Responsive web requirements

The web client provides:

- No deployer API-token prompt; web authentication uses Cloudflare Access
- A Settings tab for each user's model API base URL, model ID, and API key (never returned after save)
- A pinned, non-deletable main chat and a side-chat list with title search, inline rename, and confirmed deletion
- A new side-chat action
- Message history in chat bubbles with Markdown display and copy action
- A message composer with Enter-to-send and Shift+Enter newline
- A visible streaming assistant message
- Loading, empty, disconnected, and failure states
- Keyboard-accessible controls
- Screen-reader announcements for connection and generation state

Viewport behavior:

- Phone: one primary pane with a thread drawer
- Tablet: collapsible thread sidebar and chat pane
- Desktop: persistent thread sidebar and chat pane

The web client must remain usable at a width of 320 CSS pixels. It must not depend on hover for primary actions.

The first release renders safe Markdown without raw HTML. Syntax highlighting and attachments are deferred.

## Error behavior

The API contract must distinguish:

- Authentication failure
- Invalid request
- Thread not found
- Concurrent generation
- Inference configuration failure
- Provider authentication or authorization failure
- Provider rate limit
- Provider model failure
- Stream interruption
- Internal persistence failure

Client-facing errors must have stable codes. Logs may contain diagnostic details but must not contain credentials, authorization headers, or complete prompts.

## Observability

Record structured events for:

- Thread creation
- Generation start
- Generation completion
- Generation failure
- Inference duration
- Selected model
- OpenAI-compatible API request or log ID when available
- Input and output token usage when available

Do not log message content by default.

## Reliability

- Durable Object storage is authoritative for thread state.
- In-memory state may only be used as a cache or for the active stream.
- User messages must not be lost when inference fails.
- Assistant messages become completed only after persistence succeeds.
- Client disconnection may cancel the active stream in this milestone.
- Automatic retries are limited to failures known to be transient.
- Donna must not retry authentication, authorization, quota, or invalid-model failures.

## Security requirements

- Agent-generated content never becomes executable code in this milestone.
- The provider key exists only in the API Worker's server-side environment.
- A user enters their own provider key in the browser Settings form; the browser does not persist it and the API never returns it. The web Worker does not hold the deployer bearer token.
- The API token must be redacted from logs.
- CORS must use the configured web origin rather than `*` for authenticated endpoints.
- Every external model request must target the configured HTTPS base URL (localhost HTTP is allowed for development).
- No endpoint may accept an arbitrary inference URL.
- No provider-native external tools may be enabled.
- No Gatekeeper capability exists until explicitly introduced in a later milestone.

## Test requirements

Contract tests cover:

- Valid schemas
- Invalid schemas
- Branded identifiers
- Every stream event variant
- Every public error shape

API Worker integration tests cover:

- Missing and invalid authentication
- Thread creation and retrieval
- Thread listing
- Message persistence
- Ordered streamed events
- Completed assistant persistence
- Inference failure persistence
- Concurrent generation rejection
- Unknown thread handling

Inference adapter tests cover:

- Configured base URL, key, and model forwarding
- Stream parsing and normalized failures
- Credential redaction
- Rejection of insecure remote URLs

Web tests cover:

- Access JWT verification and rejection of unauthenticated proxy requests
- Thread creation
- Thread selection
- Message sending
- Delta rendering
- Completion rendering
- Persisted history after reload
- Authentication failure
- Inference failure
- Phone and desktop layout states

Repository validation must pass through the existing `just check` workflow.

## Delivery plan

1. Add API and event schemas.
2. Add bearer-token middleware and tests.
3. Add the conversation Durable Object and API-to-stream path.
4. Add the OpenAI-compatible streaming adapter.
5. Build the responsive thread and chat interface.
6. Add observability and failure handling.
7. Validate both local and deployed behavior.

## Acceptance criteria

The milestone is complete when:

- A clean checkout installs and passes `just check`.
- The API and web Workers build independently.
- Wrangler dry runs succeed for every deployable Worker.
- A deployer can configure their own OpenAI-compatible API and model without editing source code.
- An unauthenticated client cannot access thread or message data.
- A user can create a thread and send a message from the responsive web client.
- The assistant response streams visibly.
- Reloading restores the completed conversation.
- The inference request reaches only the configured provider endpoint.
- No external-service tool is available to Donna.
- Phone, tablet, and desktop browser layouts are usable.

## Success metrics

For the initial self-hosted milestone:

- Successful completion of the primary user journey
- Zero model requests to unconfigured endpoints
- Zero credentials present in browser assets, prompts, conversation storage, or logs
- All contract, integration, web, lint, type, format, and build checks passing
- A failed inference request leaves the thread in a recoverable state

Usage growth, retention, response latency targets, and cost targets should be defined after real deployments provide baseline data.

## Risks

- OpenAI-compatible providers differ in streaming behavior and model support.
- Streaming may be interrupted when the browser disconnects or a Worker is restarted.
- A deployment-wide bearer token is simple but does not provide user-level identity or revocation.
- OpenAI-compatible API model capabilities differ, even behind a common request format.
- Provider-native tools could violate the Gatekeeper boundary if enabled accidentally.
- Static web deployment and a separate API origin require correct CORS configuration.

## Decisions

- Use deployment-wide bearer-token authentication.
- Use a small internal loop for the first release.
- Keep the Donna API token only in Worker secrets, never in browser storage.
- A client disconnect may cancel generation.

## Future milestones

After the basic agent works:

- Gatekeeper capability contract
- First read-only Gatekeeper
- Write actions and approvals
- Sandboxed Code Mode
- Resumable generation streams
- Thread compaction
- Attachments
- Scheduled tasks
- Cloudflare Access or user-specific authentication
- Deployment and onboarding automation

## References

- [OpenAI chat completions API](https://platform.openai.com/docs/api-reference/chat/create)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
