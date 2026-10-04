import {
	CreateThreadResponseSchema,
	GetThreadResponseSchema,
	ListThreadsResponseSchema,
	UpdateThreadResponseSchema,
} from '@donna/api-contract'
import { exports } from 'cloudflare:workers'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '../../donna-api.app'

const request = (path: string, init?: RequestInit) =>
	exports.default.fetch(`https://api.donna.test${path}`, init)
const auth = { Authorization: 'Bearer test-token' }
afterEach(() => vi.unstubAllGlobals())

describe('Donna conversation API', () => {
	it('isolates Access users, their model keys, and preserves the owner’s legacy chats', async () => {
		const { publicKey, privateKey } = await generateKeyPair('RS256')
		const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' }
		let modelAuthorization = ''
		const fetchMock = vi.fn(async (url: URL | string, init?: RequestInit) => {
			if (String(url).endsWith('/cdn-cgi/access/certs')) return Response.json({ keys: [jwk] })
			if (String(url).endsWith('/chat/completions')) {
				modelAuthorization = new Headers(init?.headers).get('Authorization') ?? ''
				return new Response('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n', {
					headers: { 'Content-Type': 'text/event-stream' },
				})
			}
			return new Response(null, { status: 404 })
		})
		vi.stubGlobal('fetch', fetchMock)
		const token = async (email: string, subject: string) =>
			new SignJWT({ email, type: 'app' })
				.setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
				.setSubject(subject)
				.setIssuer('https://donna-test.cloudflareaccess.com')
				.setAudience('test-audience')
				.setIssuedAt()
				.setExpirationTime('1h')
				.sign(privateKey)
		const owner = { Authorization: `Bearer ${await token('owner@example.com', 'owner-id')}` }
		const userA = { Authorization: `Bearer ${await token('a@example.com', 'user-a')}` }
		const userB = { Authorization: `Bearer ${await token('b@example.com', 'user-b')}` }
		const invalidAudience = await new SignJWT({ email: 'a@example.com', type: 'app' })
			.setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
			.setSubject('user-a')
			.setIssuer('https://donna-test.cloudflareaccess.com')
			.setAudience('wrong-audience')
			.setIssuedAt()
			.setExpirationTime('1h')
			.sign(privateKey)
		expect(
			(await request('/v1/threads', { headers: { Authorization: `Bearer ${invalidAudience}` } }))
				.status
		).toBe(401)
		const noIdentity = await new SignJWT({ type: 'app' })
			.setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
			.setSubject('user-a')
			.setIssuer('https://donna-test.cloudflareaccess.com')
			.setAudience('test-audience')
			.setIssuedAt()
			.setExpirationTime('1h')
			.sign(privateKey)
		expect(
			(await request('/v1/threads', { headers: { Authorization: `Bearer ${noIdentity}` } })).status
		).toBe(401)
		const legacyMain = CreateThreadResponseSchema.parse(
			await (await request('/v1/threads/main', { headers: auth })).json()
		).thread
		const ownerMain = CreateThreadResponseSchema.parse(
			await (await request('/v1/threads/main', { headers: owner })).json()
		).thread
		expect(ownerMain.id).toBe(legacyMain.id)
		const aMain = CreateThreadResponseSchema.parse(
			await (await request('/v1/threads/main', { headers: userA })).json()
		).thread
		const bMain = CreateThreadResponseSchema.parse(
			await (await request('/v1/threads/main', { headers: userB })).json()
		).thread
		expect(aMain.id).not.toBe(bMain.id)
		expect(aMain.id).not.toBe(legacyMain.id)
		const aSide = CreateThreadResponseSchema.parse(
			await (await request('/v1/threads', { method: 'POST', headers: userA })).json()
		).thread
		expect((await request(`/v1/threads/${aSide.id}`, { headers: userB })).status).toBe(404)
		expect(
			(await request(`/v1/threads/${aSide.id}`, { method: 'DELETE', headers: userB })).status
		).toBe(404)
		expect((await request(`/v1/threads/${legacyMain.id}`, { headers: userA })).status).toBe(404)
		const settingsPath = '/v1/settings/model'
		const settings = {
			baseUrl: 'https://model.example/v1',
			model: 'example-model',
			apiKey: 'user-a-test-key',
		}
		expect((await request(settingsPath, { headers: userB })).status).toBe(200)
		expect(await (await request(settingsPath, { headers: userB })).json()).toEqual({
			baseUrl: '',
			model: '',
			hasApiKey: false,
		})
		const saved = await request(settingsPath, {
			method: 'PUT',
			headers: { ...userA, 'Content-Type': 'application/json' },
			body: JSON.stringify(settings),
		})
		expect(saved.status).toBe(200)
		expect(JSON.stringify(await saved.json())).not.toContain(settings.apiKey)
		expect(await (await request(settingsPath, { headers: userA })).json()).toEqual({
			baseUrl: settings.baseUrl,
			model: settings.model,
			hasApiKey: true,
		})
		expect(await (await request(settingsPath, { headers: userB })).json()).toEqual({
			baseUrl: '',
			model: '',
			hasApiKey: false,
		})
		const changed = await request(settingsPath, {
			method: 'PUT',
			headers: { ...userA, 'Content-Type': 'application/json' },
			body: JSON.stringify({ baseUrl: settings.baseUrl, model: 'second-model' }),
		})
		expect(changed.status).toBe(200)
		const sent = await request(`/v1/threads/${aMain.id}/messages`, {
			method: 'POST',
			headers: { ...userA, 'Content-Type': 'application/json', 'X-Donna-Owner': '1' },
			body: JSON.stringify({ content: 'Hello' }),
		})
		expect(await sent.text()).toContain('message.completed')
		expect(modelAuthorization).toBe(`Bearer ${settings.apiKey}`)
		expect(
			(
				await request(settingsPath, {
					method: 'PUT',
					headers: { ...userB, 'Content-Type': 'application/json' },
					body: JSON.stringify({ baseUrl: settings.baseUrl, model: 'example-model' }),
				})
			).status
		).toBe(400)
		expect(
			(
				await request(settingsPath, {
					method: 'PUT',
					headers: { ...userB, 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...settings, baseUrl: 'http://public.example/v1' }),
				})
			).status
		).toBe(400)
	})

	it('requires a bearer token and restricts browser origins', async () => {
		expect((await request('/v1/threads')).status).toBe(401)
		expect(
			(await request('/v1/threads', { headers: { Authorization: 'Bearer wrong' } })).status
		).toBe(401)
		expect(
			(await request('/v1/threads', { headers: { ...auth, Origin: 'https://evil.test' } })).status
		).toBe(403)
		const allowed = await request('/v1/threads', {
			headers: { ...auth, Origin: 'https://web.donna.test' },
		})
		expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://web.donna.test')
		expect(allowed.headers.get('Cache-Control')).toBe('private, no-store')
		const preflight = await request('/v1/threads', {
			method: 'OPTIONS',
			headers: { Origin: 'https://web.donna.test', 'Access-Control-Request-Method': 'POST' },
		})
		expect(preflight.status).toBe(204)
		expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://web.donna.test')
	})

	it('creates one permanent main chat and preserves its identity and messages', async () => {
		const [first, concurrent] = await Promise.all([
			request('/v1/threads/main', { headers: auth }),
			request('/v1/threads/main', { headers: auth }),
		])
		const main = CreateThreadResponseSchema.parse(await first.json()).thread
		expect(main).toMatchObject({ title: 'Main', kind: 'main' })
		expect(CreateThreadResponseSchema.parse(await concurrent.json()).thread.id).toBe(main.id)
		const listed = ListThreadsResponseSchema.parse(
			await (await request('/v1/threads', { headers: auth })).json()
		)
		expect(listed.threads.filter((thread) => thread.kind === 'main')).toEqual([main])
		const path = `/v1/threads/${main.id}`
		for (const method of ['PATCH', 'DELETE']) {
			const init: RequestInit = { method, headers: { ...auth, 'Content-Type': 'application/json' } }
			if (method === 'PATCH') init.body = JSON.stringify({ title: 'Changed' })
			const response = await request(path, init)
			expect(response.status).toBe(409)
			expect(await response.json()).toMatchObject({ code: 'main_thread_immutable' })
		}
		const sent = await request(`${path}/messages`, {
			method: 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify({ content: 'Hello main' }),
		})
		await sent.text()
		const after = GetThreadResponseSchema.parse(
			await (await request(path, { headers: auth })).json()
		)
		expect(after.thread.title).toBe('Main')
		expect(after.messages[0]?.content).toBe('Hello main')
		expect(
			CreateThreadResponseSchema.parse(
				await (await request('/v1/threads/main', { headers: auth })).json()
			).thread.id
		).toBe(main.id)
	})

	it('persists created threads and returns 404 for unknown threads', async () => {
		const created = await request('/v1/threads', { method: 'POST', headers: auth })
		expect(created.status).toBe(201)
		const { thread } = CreateThreadResponseSchema.parse(await created.json())
		const listed = ListThreadsResponseSchema.parse(
			await (await request('/v1/threads', { headers: auth })).json()
		)
		expect(listed.threads).toContainEqual(thread)
		const found = GetThreadResponseSchema.parse(
			await (await request(`/v1/threads/${thread.id}`, { headers: auth })).json()
		)
		expect(found.messages).toEqual([])
		expect((await request(`/v1/threads/${crypto.randomUUID()}`, { headers: auth })).status).toBe(
			404
		)
	})

	it('renames and deletes a thread without affecting other conversations', async () => {
		const first = CreateThreadResponseSchema.parse(
			await (await request('/v1/threads', { method: 'POST', headers: auth })).json()
		).thread
		const second = CreateThreadResponseSchema.parse(
			await (await request('/v1/threads', { method: 'POST', headers: auth })).json()
		).thread
		const path = `/v1/threads/${first.id}`
		const invalid = await request(path, {
			method: 'PATCH',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: ' ' }),
		})
		expect(invalid.status).toBe(400)
		const renamed = await request(path, {
			method: 'PATCH',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: '  Research notes  ' }),
		})
		expect(UpdateThreadResponseSchema.parse(await renamed.json()).thread.title).toBe(
			'Research notes'
		)
		expect(
			GetThreadResponseSchema.parse(await (await request(path, { headers: auth })).json()).thread
				.title
		).toBe('Research notes')
		expect((await request(path, { method: 'DELETE', headers: auth })).status).toBe(204)
		expect((await request(path, { headers: auth })).status).toBe(404)
		const listed = ListThreadsResponseSchema.parse(
			await (await request('/v1/threads', { headers: auth })).json()
		)
		expect(listed.threads).toContainEqual(second)
		expect(listed.threads.find((thread) => thread.id === first.id)).toBeUndefined()
	})

	it('preserves the user message and records a failed generation when inference is unavailable', async () => {
		const created = CreateThreadResponseSchema.parse(
			await (await request('/v1/threads', { method: 'POST', headers: auth })).json()
		)
		const response = await request(`/v1/threads/${created.thread.id}/messages`, {
			method: 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify({ content: 'Hello' }),
		})
		expect(response.status).toBe(200)
		const events = await response.text()
		expect(events).toContain('message.started')
		expect(events).toContain('message.failed')
		const thread = GetThreadResponseSchema.parse(
			await (await request(`/v1/threads/${created.thread.id}`, { headers: auth })).json()
		)
		expect(thread.thread.title).toBe('Hello')
		expect(thread.messages.map(({ content, status }) => ({ content, status }))).toEqual([
			{ content: 'Hello', status: 'completed' },
			{ content: '', status: 'failed' },
		])
	})
})
