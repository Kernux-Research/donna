import {
	DonnaHealthResponseSchema,
	PutModelSettingsRequestSchema,
	SendMessageRequestSchema,
	ThreadIdSchema,
	UpdateThreadRequestSchema,
} from '@donna/api-contract'
import { Hono } from 'hono'

import { verifyDonnaAccessUser } from './donna-access-identity'

import type { Context } from 'hono'
import type { App } from './context'

export { DonnaThreads } from './donna-threads'

const donnaApi = new Hono<App>()

// Never expose the bearer token in URLs, logs, browser assets, or prompts.
donnaApi.use('*', async (c, next) => {
	const origin = c.req.header('Origin')
	if (origin && origin !== c.env.DONNA_WEB_ORIGIN)
		return c.json({ code: 'origin_forbidden', message: 'Origin not allowed' }, 403)
	if (origin) {
		c.header('Access-Control-Allow-Origin', origin)
		c.header('Vary', 'Origin')
		c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
		c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
	}
	if (c.req.method === 'OPTIONS') return c.body(null, 204)
	if (c.req.path !== '/v1/health') {
		const authorization = c.req.header('Authorization')
		if (!authorization?.startsWith('Bearer '))
			return c.json({ code: 'authentication_required', message: 'Bearer token required' }, 401)
		const token = authorization.slice(7)
		const supplied = new Uint8Array(
			await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
		)
		const expected = new Uint8Array(
			await crypto.subtle.digest('SHA-256', new TextEncoder().encode(c.env.DONNA_API_TOKEN ?? ''))
		)
		let difference = 0
		for (let i = 0; i < supplied.length; i++) difference |= supplied[i]! ^ expected[i]!
		const userId =
			c.env.DONNA_API_TOKEN && difference === 0
				? 'donna'
				: await verifyDonnaAccessUser(token, c.env)
		if (!userId) return c.json({ code: 'invalid_api_token', message: 'Invalid token' }, 401)
		c.set('userId', userId)
	}
	await next()
	if (c.req.path !== '/v1/health') c.header('Cache-Control', 'private, no-store')
	if (origin) {
		c.header('Access-Control-Allow-Origin', origin)
		c.header('Vary', 'Origin')
		c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
		c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
	}
})

const threads = (c: Context<App>) => c.env.DONNA_THREADS.getByName(c.get('userId'))
const ownerHeaders = (c: Context<App>): Record<string, string> =>
	c.get('userId') === 'donna' ? { 'X-Donna-Owner': '1' } : {}
const forward = async (response: Response) =>
	new Response(response.body, { status: response.status, headers: response.headers })

donnaApi.get('/v1/health', (c) =>
	c.json(DonnaHealthResponseSchema.parse({ status: 'ok', service: 'donna-api' }))
)
donnaApi.get('/v1/settings/model', async (c) =>
	forward(await threads(c).fetch('https://internal/settings/model', { headers: ownerHeaders(c) }))
)
donnaApi.put('/v1/settings/model', async (c) => {
	const input = PutModelSettingsRequestSchema.safeParse(await c.req.json().catch(() => null))
	if (!input.success)
		return c.json({ code: 'invalid_request', message: 'Valid model settings are required' }, 400)
	return forward(
		await threads(c).fetch('https://internal/settings/model', {
			method: 'PUT',
			headers: { ...ownerHeaders(c), 'Content-Type': 'application/json' },
			body: JSON.stringify(input.data),
		})
	)
})
donnaApi.post('/v1/threads', async (c) =>
	forward(await threads(c).fetch('https://internal/threads', { method: 'POST' }))
)
donnaApi.get('/v1/threads', async (c) =>
	forward(await threads(c).fetch('https://internal/threads'))
)
donnaApi.get('/v1/threads/main', async (c) =>
	forward(await threads(c).fetch('https://internal/threads/main'))
)
donnaApi.get('/v1/threads/:threadId', async (c) => {
	const id = ThreadIdSchema.safeParse(c.req.param('threadId'))
	if (!id.success) return c.json({ code: 'thread_not_found', message: 'Thread not found' }, 404)
	return forward(await threads(c).fetch(`https://internal/threads/${id.data}`))
})
donnaApi.patch('/v1/threads/:threadId', async (c) => {
	const id = ThreadIdSchema.safeParse(c.req.param('threadId'))
	if (!id.success) return c.json({ code: 'thread_not_found', message: 'Thread not found' }, 404)
	const input = UpdateThreadRequestSchema.safeParse(await c.req.json().catch(() => null))
	if (!input.success)
		return c.json({ code: 'invalid_request', message: 'A title is required' }, 400)
	return forward(
		await threads(c).fetch(`https://internal/threads/${id.data}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input.data),
		})
	)
})
donnaApi.delete('/v1/threads/:threadId', async (c) => {
	const id = ThreadIdSchema.safeParse(c.req.param('threadId'))
	if (!id.success) return c.json({ code: 'thread_not_found', message: 'Thread not found' }, 404)
	return forward(
		await threads(c).fetch(`https://internal/threads/${id.data}`, { method: 'DELETE' })
	)
})
donnaApi.post('/v1/threads/:threadId/messages', async (c) => {
	const id = ThreadIdSchema.safeParse(c.req.param('threadId'))
	if (!id.success) return c.json({ code: 'thread_not_found', message: 'Thread not found' }, 404)
	const input = SendMessageRequestSchema.safeParse(await c.req.json().catch(() => null))
	if (!input.success)
		return c.json({ code: 'invalid_request', message: 'Message content is required' }, 400)
	return forward(
		await threads(c).fetch(`https://internal/threads/${id.data}/messages`, {
			method: 'POST',
			headers: { ...ownerHeaders(c), 'Content-Type': 'application/json' },
			body: JSON.stringify(input.data),
		})
	)
})

export default donnaApi
