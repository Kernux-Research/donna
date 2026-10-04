import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import donnaWeb from './donna-web.worker'

import type { JWK } from 'jose'

const webUrl = 'https://donna.kernux.org'
const apiFetch = vi.fn().mockResolvedValue(Response.json({ threads: [] }))
const assetsFetch = vi.fn().mockResolvedValue(new Response('Web assets'))
const env = {
	ASSETS: { fetch: assetsFetch },
	DONNA_API: { fetch: apiFetch },
	ACCESS_TEAM_DOMAIN: 'https://donna.cloudflareaccess.com',
	ACCESS_AUD: 'test-audience',
}
let signedToken: string
let publicKey: JWK

beforeAll(async () => {
	const { publicKey: verificationKey, privateKey } = await generateKeyPair('RS256')
	publicKey = { ...(await exportJWK(verificationKey)), kid: 'test-key', alg: 'RS256', use: 'sig' }
	signedToken = await new SignJWT({ email: 'owner@example.com', type: 'app' })
		.setSubject('test-user-id')
		.setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
		.setIssuer('https://donna.cloudflareaccess.com')
		.setAudience('test-audience')
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(privateKey)
})

beforeEach(() => {
	apiFetch.mockClear()
	assetsFetch.mockClear()
})
afterEach(() => vi.unstubAllGlobals())

describe('Donna web server-side API proxy', () => {
	it('serves assets without invoking the API and rejects unknown API paths', async () => {
		expect((await donnaWeb.fetch(new Request(webUrl), env)).status).toBe(200)
		expect(assetsFetch).toHaveBeenCalledOnce()
		expect((await donnaWeb.fetch(new Request(`${webUrl}/api/unknown`), env)).status).toBe(404)
		expect(apiFetch).not.toHaveBeenCalled()
	})

	it('fails closed without configuration or a valid Access JWT', async () => {
		const path = `${webUrl}/api/v1/threads`
		expect((await donnaWeb.fetch(new Request(path), { ...env, ACCESS_AUD: '' })).status).toBe(503)
		expect((await donnaWeb.fetch(new Request(path), env)).status).toBe(403)
		expect(
			(
				await donnaWeb.fetch(
					new Request(path, { headers: { 'Cf-Access-Jwt-Assertion': 'forged' } }),
					env
				)
			).status
		).toBe(403)
		expect(apiFetch).not.toHaveBeenCalled()
	})

	it('forwards only a verified Access identity token, never browser-supplied credentials', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ keys: [publicKey] })))
		const response = await donnaWeb.fetch(
			new Request(`${webUrl}/api/v1/threads?limit=1`, {
				headers: {
					'Cf-Access-Jwt-Assertion': signedToken,
					Authorization: 'Bearer attacker',
					Cookie: 'private=cookie',
					'X-Donna-Owner': '1',
				},
			}),
			env
		)
		expect(response.status).toBe(200)
		expect(apiFetch).toHaveBeenCalledOnce()
		const forwarded: Request = apiFetch.mock.calls[0]![0]
		expect(forwarded.url).toBe('https://donna-api.kernux.org/v1/threads?limit=1')
		expect(forwarded.headers.get('Authorization')).toBe(`Bearer ${signedToken}`)
		expect(forwarded.headers.get('Origin')).toBe(webUrl)
		expect(forwarded.headers.has('Cookie')).toBe(false)
		expect(forwarded.headers.has('Cf-Access-Jwt-Assertion')).toBe(false)
		expect(forwarded.headers.has('X-Donna-Owner')).toBe(false)
	})

	it('rejects cross-site writes even with a valid Access session', async () => {
		const path = `${webUrl}/api/v1/settings/model`
		for (const origin of [null, 'https://evil.test']) {
			const headers = new Headers({ 'Cf-Access-Jwt-Assertion': signedToken })
			if (origin) headers.set('Origin', origin)
			expect(
				(await donnaWeb.fetch(new Request(path, { method: 'PUT', headers, body: '{}' }), env))
					.status
			).toBe(403)
		}
		expect(apiFetch).not.toHaveBeenCalled()
	})

	it('forwards a message body without browser credentials', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ keys: [publicKey] })))
		const response = await donnaWeb.fetch(
			new Request(`${webUrl}/api/v1/threads/42c0ca61-c20c-487b-95df-2bfb93c4b797/messages`, {
				method: 'POST',
				headers: {
					'Cf-Access-Jwt-Assertion': signedToken,
					'Content-Type': 'application/json',
					Origin: webUrl,
				},
				body: JSON.stringify({ content: 'Hi' }),
			}),
			env
		)
		expect(response.status).toBe(200)
		const forwarded: Request = apiFetch.mock.calls[0]![0]
		expect(forwarded.method).toBe('POST')
		expect(await forwarded.json()).toEqual({ content: 'Hi' })
	})
})
