# Donna basic agent PRD

## Overview

Donna is an open source personal agent deployed to a user's Cloudflare account. Donna exposes a client-independent API and includes one responsive web client for phone, tablet, and desktop browsers.

This milestone delivers the first working conversational agent. A deployer can connect Donna to their own Cloudflare AI Gateway, create a thread, send a message, stream the response, and reload the persisted conversation.

Donna cannot access external services directly. Future external integrations must use explicit Gatekeeper capabilities. Model inference through the deployer's Cloudflare AI Gateway is the kernel-managed exception.

## Problem

People can deploy agent interfaces, but those systems commonly couple the agent to one client, expose provider credentials to the agent runtime, or make external tools ambiently available in every conversation.

Donna needs a minimal foundation that proves four boundaries:

- The API works independently of the bundled web client.
- Conversation state survives Worker and browser restarts.
- Model inference always passes through the deployer's Cloudflare AI Gateway.
- The agent starts with no external-service capabilities.

## Goals

- Run a basic conversational agent on Cloudflare Workers.
- Let each deployer configure their own Cloudflare account, AI Gateway, and model.
- Authenticate every non-health API request.
- Persist threads and completed messages in Durable Object storage.
- Stream assistant output to API clients.
- Provide a responsive first-party web experience.
- Define runtime API schemas in `packages/api-contract`.
- Keep Cloudflare credentials outside the API, web client, prompts, and conversation storage.
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
- OAuth or social login
- Native mobile or desktop clients
- Background schedules
- Provider-native web search
- Production billing or usage limits

## Users

The initial user is a technical self-hoster who:

- Has a Cloudflare account.
- Can create and configure an AI Gateway.
- Can create a scoped Cloudflare API token.
- Wants a private personal agent with explicit security boundaries.
- Uses Donna through the responsive web client or their own API client.

Multi-tenant hosted deployments are outside this milestone.

## Primary user journey

1. The deployer configures Donna with a Cloudflare account ID, AI Gateway ID, Cloudflare API token, model ID, and Donna API token.
2. The deployer deploys the API, inference, and web Workers.
3. The user opens the web client.
4. The user enters the Donna API token.
5. The client verifies connectivity and authentication.
6. The user creates a thread.
7. The user sends a message.
8. Donna streams an assistant response.
9. The user reloads the page.
10. The thread and completed messages remain available.
11. The deployer can find the inference request in their configured AI Gateway logs.

## Product boundaries

- `apps/api` is the complete public product boundary.
- `apps/web` is a first-party API client and must not import API implementation code.
- `apps/inference` is an internal Worker reachable from the API only through a service binding.
- `packages/api-contract` owns public request, response, event, and error schemas.
- The inference Worker is the only component that owns the Cloudflare API token.
- The agent has no generic external-service tools or provider credentials.

## Architecture

```text
Responsive web client
  -> Donna API Worker
    -> Thread Durable Object
      -> Inference Worker service binding
        -> Deployer's Cloudflare AI Gateway
```

The API Worker handles authentication, routing, validation, and thread lookup. Each thread maps to one Durable Object. The Durable Object serializes conversation mutations and invokes the inference Worker. The inference Worker calls Cloudflare's AI REST API and streams normalized output back to the Durable Object.

## Deployment configuration

The API Worker requires:

```text
DONNA_API_TOKEN
DONNA_WEB_ORIGIN
```

The inference Worker requires:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_AI_GATEWAY_ID
CLOUDFLARE_API_TOKEN
DONNA_MODEL
```

Requirements:

- `CLOUDFLARE_API_TOKEN` must be stored as a Worker secret.
- `DONNA_API_TOKEN` must be stored as a Worker secret.
- `.env.example` files contain names and placeholders only.
- Populated `.env` files remain ignored by Git.
- Donna must not include a direct-provider fallback.
- Donna must send the configured AI Gateway ID on every inference request.
- Donna must require an explicit model identifier rather than silently choosing one.

## Authentication

Proposed initial authentication uses a deployment-wide bearer token:

```http
Authorization: Bearer <DONNA_API_TOKEN>
```

Requirements:

- `GET /v1/health` remains public.
- All thread and message endpoints require authentication.
- Authentication comparison must not leak token length or contents through logs or responses.
- The API must never return the configured token.
- The web build must not contain the token.
- The web client may retain the token in memory or `sessionStorage` for the current browser session.
- The API must restrict browser CORS access to `DONNA_WEB_ORIGIN`.
- Non-browser API clients are not restricted by CORS.

Errors:

```text
401 authentication_required
401 invalid_api_token
```

Cloudflare Access and user-specific sessions are future authentication options.

## Thread requirements

A thread contains:

- A unique thread ID
- A creation timestamp
- An update timestamp
- An ordered sequence of messages
- The status of any active generation

The first release supports:

- Create a thread
- List threads
- Retrieve one thread and its messages
- Send a user message
- Stream the assistant response

The first release does not support deleting, renaming, searching, sharing, or branching threads.

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
POST /v1/threads
GET  /v1/threads
GET  /v1/threads/:threadId
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
- `SendMessageRequest`
- `AgentStreamEvent`
- `ApiError`

Identifiers should use branded schema types where they prevent accidental substitution.

Applications must not define parallel handwritten versions of contract types.

## Inference requirements

The inference Worker calls Cloudflare's OpenAI-compatible endpoint:

```text
POST https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/v1/chat/completions
```

It must send:

- The configured Cloudflare bearer token
- The configured `cf-aig-gateway-id`
- The configured model
- The Donna system message
- The persisted conversation context
- Streaming enabled

It must not send:

- A direct provider API key
- A direct provider base URL
- Gatekeeper credentials
- The Donna API token
- Browser state

The inference Worker normalizes upstream chunks into Donna stream deltas. Provider-specific response formats must not cross the service-binding boundary.

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

Proposed implementation uses `@earendil-works/pi-agent-core`, matching the agent-loop foundation used by Cloudflare OS.

Before adopting it, a compatibility spike must prove that the current package:

- Bundles for Cloudflare Workers.
- Runs without Node-only runtime failures.
- Accepts Donna's AI Gateway model and stream adapter.
- Streams a fake assistant response in a Workers integration test.
- Does not import unused provider implementations into the Worker bundle.

If the spike fails, the milestone may use a small internal conversation loop. The fallback must preserve the same inference and event contracts so Pi can replace it later without changing clients.

## Responsive web requirements

The web client provides:

- An API-token connection screen
- A thread list
- A new-thread action
- Message history
- A message composer
- A visible streaming assistant message
- Loading, empty, disconnected, and failure states
- Keyboard-accessible controls
- Screen-reader announcements for connection and generation state

Viewport behavior:

- Phone: one primary pane with a thread drawer
- Tablet: collapsible thread sidebar and chat pane
- Desktop: persistent thread sidebar and chat pane

The web client must remain usable at a width of 320 CSS pixels. It must not depend on hover for primary actions.

The first release renders plain text. Rich Markdown, syntax highlighting, and attachments are deferred.

## Error behavior

The API contract must distinguish:

- Authentication failure
- Invalid request
- Thread not found
- Concurrent generation
- Inference configuration failure
- AI Gateway authentication or authorization failure
- AI Gateway rate limit
- AI Gateway model failure
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
- AI Gateway request or log ID when available
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
- The inference token exists only in the inference Worker.
- The web client has no Cloudflare credentials.
- The API token must be redacted from logs.
- CORS must use the configured web origin rather than `*` for authenticated endpoints.
- Every external model request must target the Cloudflare API host.
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

Inference Worker tests cover:

- Configured account, Gateway, and model forwarding
- Cloudflare authorization
- Stream parsing
- Normalized failures
- Credential redaction
- Rejection of direct-provider URLs

Web tests cover:

- Token connection flow
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
3. Add `ThreadDurableObject` with fake inference.
4. Complete the API-to-Durable-Object-to-stream path.
5. Build the responsive thread and chat interface against fake inference.
6. Add `apps/inference` and AI Gateway streaming.
7. Run the Pi compatibility spike.
8. Connect the selected agent loop.
9. Add observability and failure handling.
10. Validate both local and deployed behavior.

Each step should leave tests passing. The fake inference path remains available only to tests after real inference is connected.

## Acceptance criteria

The milestone is complete when:

- A clean checkout installs and passes `just check`.
- The API, inference, and web Workers build independently.
- Wrangler dry runs succeed for every deployable Worker.
- A deployer can configure their own Cloudflare AI Gateway and model without editing source code.
- An unauthenticated client cannot access thread or message data.
- A user can create a thread and send a message from the responsive web client.
- The assistant response streams visibly.
- Reloading restores the completed conversation.
- The inference request appears in the configured AI Gateway logs.
- No direct model-provider request occurs.
- No external-service tool is available to Donna.
- Phone, tablet, and desktop browser layouts are usable.

## Success metrics

For the initial self-hosted milestone:

- Successful completion of the primary user journey
- Zero direct provider API calls
- Zero credentials present in browser assets, prompts, conversation storage, or logs
- All contract, integration, web, lint, type, format, and build checks passing
- A failed inference request leaves the thread in a recoverable state

Usage growth, retention, response latency targets, and cost targets should be defined after real deployments provide baseline data.

## Risks

- `pi-agent-core` may require adaptation for the current Workers runtime or AI Gateway REST API.
- Streaming may be interrupted when the browser disconnects or a Worker is restarted.
- A deployment-wide bearer token is simple but does not provide user-level identity or revocation.
- AI Gateway model capabilities differ, even behind a common request format.
- Provider-native tools could violate the Gatekeeper boundary if enabled accidentally.
- Static web deployment and a separate API origin require correct CORS configuration.

## Open decisions

Implementation must not begin until these are confirmed:

1. Use deployment-wide bearer-token authentication for the first release.
2. Run the Pi compatibility spike and permit a small internal loop as fallback.
3. Cancel generation when the initiating client disconnects, rather than continuing in the background.
4. Store the web token in `sessionStorage`, rather than requiring re-entry after every page reload.

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

- [Cloudflare AI Gateway REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/)
- [Cloudflare AI model catalog](https://developers.cloudflare.com/ai/models/)
- [Cloudflare OS](https://github.com/cloudflare/cloudflare-os)
- [Cloudflare OS AI model integration](https://github.com/cloudflare/cloudflare-os/blob/main/packages/workshop-backend/src/ai-models.ts)
