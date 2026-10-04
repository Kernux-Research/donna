import {
	AgentStreamEventSchema,
	DonnaMessageSchema,
	DonnaThreadSchema,
	MessageIdSchema,
	PutModelSettingsRequestSchema,
	SendMessageRequestSchema,
	ThreadIdSchema,
	UpdateThreadRequestSchema,
} from '@donna/api-contract'
import { DurableObject } from 'cloudflare:workers'

import { decryptDonnaModelKey, encryptDonnaModelKey } from './donna-model-key-crypto'
import { streamOpenAiCompatibleResponse } from './openai-compatible-inference'

import type { AgentStreamEvent, DonnaMessage, DonnaThread, ThreadId } from '@donna/api-contract'
import type { Env } from './context'
import type { EncryptedDonnaModelKey } from './donna-model-key-crypto'

type StoredThread = { thread: DonnaThread; messages: DonnaMessage[] }
type StoredModelSettings = { baseUrl: string; model: string; key: EncryptedDonnaModelKey }
const activeThreads = new Set<string>()
const json = (
	data:
		| StoredThread
		| { threads: DonnaThread[] }
		| { thread: DonnaThread }
		| { baseUrl: string; model: string; hasApiKey: boolean }
		| { code: string; message: string },
	status = 200
) => Response.json(data, { status })

/** Stores Donna threads and serializes generation per thread in one Durable Object. */
export class DonnaThreads extends DurableObject<Env> {
	private getOrCreateMainThread(): Promise<DonnaThread> {
		return this.ctx.storage.transaction(async (txn) => {
			const id = await txn.get<ThreadId>('main-thread-id')
			if (id) return (await txn.get<StoredThread>(`thread:${id}`))!.thread
			const now = new Date().toISOString()
			const thread = DonnaThreadSchema.parse({
				id: crypto.randomUUID(),
				title: 'Main',
				kind: 'main',
				createdAt: now,
				updatedAt: now,
			})
			await txn.put(`thread:${thread.id}`, { thread, messages: [] } satisfies StoredThread)
			await txn.put('main-thread-id', thread.id)
			return thread
		})
	}

	private legacyOwnerModelSettings(request: Request) {
		if (
			request.headers.get('X-Donna-Owner') !== '1' ||
			!this.env.OPENAI_BASE_URL ||
			!this.env.OPENAI_MODEL ||
			!this.env.OPENAI_API_KEY
		)
			return null
		return {
			baseUrl: this.env.OPENAI_BASE_URL,
			model: this.env.OPENAI_MODEL,
			apiKey: this.env.OPENAI_API_KEY,
		}
	}

	override async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url)
		if (
			url.pathname === '/settings/model' &&
			(request.method === 'GET' || request.method === 'PUT')
		) {
			const saved = await this.ctx.storage.get<StoredModelSettings>('model-settings')
			const fallback = this.legacyOwnerModelSettings(request)
			if (request.method === 'GET')
				return json(
					{
						baseUrl: saved?.baseUrl ?? fallback?.baseUrl ?? '',
						model: saved?.model ?? fallback?.model ?? '',
						hasApiKey: Boolean(saved || fallback),
					},
					200
				)
			const input = PutModelSettingsRequestSchema.safeParse(await request.json().catch(() => null))
			if (!input.success)
				return json({ code: 'invalid_request', message: 'Valid model settings are required' }, 400)
			const key = input.data.apiKey
				? await encryptDonnaModelKey(input.data.apiKey, this.env.SETTINGS_ENCRYPTION_KEY)
				: (saved?.key ??
					(fallback
						? await encryptDonnaModelKey(fallback.apiKey, this.env.SETTINGS_ENCRYPTION_KEY)
						: null))
			if (!key)
				return json({ code: 'invalid_request', message: 'A model API key is required' }, 400)
			await this.ctx.storage.put('model-settings', {
				baseUrl: input.data.baseUrl,
				model: input.data.model,
				key,
			} satisfies StoredModelSettings)
			return json({ baseUrl: input.data.baseUrl, model: input.data.model, hasApiKey: true }, 200)
		}
		if (url.pathname === '/threads/main' && request.method === 'GET')
			return json({ thread: await this.getOrCreateMainThread() })
		if (url.pathname === '/threads' && request.method === 'POST') {
			const now = new Date().toISOString()
			const thread = DonnaThreadSchema.parse({
				id: crypto.randomUUID(),
				title: 'New chat',
				kind: 'side',
				createdAt: now,
				updatedAt: now,
			})
			await this.ctx.storage.put(`thread:${thread.id}`, {
				thread,
				messages: [],
			} satisfies StoredThread)
			return json({ thread }, 201)
		}
		if (url.pathname === '/threads' && request.method === 'GET') {
			await this.getOrCreateMainThread()
			const stored = await this.ctx.storage.list<StoredThread>({ prefix: 'thread:' })
			return json({
				threads: [...stored.values()]
					.map((item) => DonnaThreadSchema.parse(item.thread))
					.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
			})
		}
		const match = /^\/threads\/([^/]+)(\/messages)?$/.exec(url.pathname)
		const id = match && ThreadIdSchema.safeParse(match[1])
		if (!id || !id.success)
			return json({ code: 'thread_not_found', message: 'Thread not found' }, 404)
		const key = `thread:${id.data}`
		const stored = await this.ctx.storage.get<StoredThread>(key)
		if (!stored) return json({ code: 'thread_not_found', message: 'Thread not found' }, 404)
		stored.thread = DonnaThreadSchema.parse(stored.thread)
		if (!match[2] && request.method === 'GET') return json(stored)
		if (!match[2] && (request.method === 'PATCH' || request.method === 'DELETE')) {
			if (stored.thread.kind === 'main')
				return json(
					{ code: 'main_thread_immutable', message: 'Main chat cannot be renamed or deleted' },
					409
				)
			if (activeThreads.has(key))
				return json({ code: 'thread_generation_active', message: 'Generation already active' }, 409)
			if (request.method === 'DELETE') {
				await this.ctx.storage.delete(key)
				return new Response(null, { status: 204 })
			}
			const update = UpdateThreadRequestSchema.safeParse(await request.json().catch(() => null))
			if (!update.success)
				return json({ code: 'invalid_request', message: 'A title is required' }, 400)
			stored.thread.title = update.data.title
			stored.thread.updatedAt = new Date().toISOString()
			await this.ctx.storage.put(key, stored)
			return json({ thread: stored.thread })
		}
		if (!match[2] || request.method !== 'POST')
			return json({ code: 'not_found', message: 'Not found' }, 404)
		if (activeThreads.has(key))
			return json({ code: 'thread_generation_active', message: 'Generation already active' }, 409)
		const input = SendMessageRequestSchema.safeParse(await request.json())
		if (!input.success)
			return json({ code: 'invalid_request', message: 'Message content is required' }, 400)
		activeThreads.add(key)
		const now = new Date().toISOString()
		const user = DonnaMessageSchema.parse({
			id: crypto.randomUUID(),
			threadId: id.data,
			role: 'user',
			content: input.data.content,
			createdAt: now,
			status: 'completed',
		})
		const assistantId = crypto.randomUUID()
		try {
			stored.messages.push(user)
			if (stored.thread.kind === 'side' && stored.thread.title === 'New chat')
				stored.thread.title = input.data.content.trim().split('\n')[0]!.trim().slice(0, 100)
			stored.thread.updatedAt = now
			await this.ctx.storage.put(key, stored)
		} catch (err) {
			activeThreads.delete(key)
			throw err
		}

		const { readable, writable } = new TransformStream()
		const writer = writable.getWriter()
		const encoder = new TextEncoder()
		const send = (event: AgentStreamEvent) =>
			writer.write(
				encoder.encode(`data: ${JSON.stringify(AgentStreamEventSchema.parse(event))}\n\n`)
			)
		void (async () => {
			let content = ''
			let completedSaved = false
			try {
				await send({ type: 'message.started', messageId: MessageIdSchema.parse(assistantId) })
				const settings = await this.ctx.storage.get<StoredModelSettings>('model-settings')
				const fallback = this.legacyOwnerModelSettings(request)
				if (!settings && !fallback) throw new Error('inference_configuration_invalid')
				const config = settings
					? {
							baseUrl: settings.baseUrl,
							model: settings.model,
							apiKey: await decryptDonnaModelKey(settings.key, this.env.SETTINGS_ENCRYPTION_KEY),
						}
					: fallback!
				for await (const delta of streamOpenAiCompatibleResponse(
					config,
					stored.messages
						.filter((message) => message.status === 'completed')
						.map(({ role, content }) => ({ role, content })),
					request.signal
				)) {
					content += delta
					await send({ type: 'message.delta', content: delta })
				}
				const message = DonnaMessageSchema.parse({
					id: assistantId,
					threadId: id.data,
					role: 'assistant',
					content,
					createdAt: new Date().toISOString(),
					status: 'completed',
				})
				stored.messages.push(message)
				stored.thread.updatedAt = message.createdAt
				await this.ctx.storage.put(key, stored)
				completedSaved = true
				await send({ type: 'message.completed', message })
			} catch (err) {
				if (completedSaved) return
				stored.messages = stored.messages.filter((message) => message.id !== assistantId)
				const code =
					err instanceof Error &&
					/^(inference_configuration_invalid|inference_auth_failed|inference_rate_limited|inference_failed|inference_stream_invalid|inference_stream_interrupted)$/.test(
						err.message
					)
						? err.message
						: 'inference_failed'
				const message = DonnaMessageSchema.parse({
					id: assistantId,
					threadId: id.data,
					role: 'assistant',
					content: '',
					createdAt: new Date().toISOString(),
					status: 'failed',
				})
				try {
					stored.messages.push(message)
					await this.ctx.storage.put(key, stored)
					await send({ type: 'message.failed', code })
				} catch {
					// Client disconnected or storage failed; never expose upstream errors or credentials.
				}
			} finally {
				activeThreads.delete(key)
				await writer.close().catch(() => {})
			}
		})()
		return new Response(readable, {
			headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
		})
	}
}
