import { createRemoteJWKSet, jwtVerify } from 'jose'

interface DonnaWebEnv {
	ASSETS: Pick<Fetcher, 'fetch'>
	DONNA_API: Pick<Fetcher, 'fetch'>
	ACCESS_TEAM_DOMAIN: string
	ACCESS_AUD: string
}

let cachedKeys: ReturnType<typeof createRemoteJWKSet> | undefined
let cachedIssuer = ''

/** Proxy same-origin Donna API calls only after verifying the Cloudflare Access application token. */
export default {
	async fetch(request: Request, env: DonnaWebEnv): Promise<Response> {
		const url = new URL(request.url)
		if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
		if (!url.pathname.startsWith('/api/v1/')) return new Response('Not found', { status: 404 })
		if (
			!['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
			request.headers.get('Origin') !== url.origin
		)
			return Response.json(
				{ code: 'origin_forbidden', message: 'Origin not allowed' },
				{ status: 403 }
			)
		if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
			return Response.json(
				{ code: 'access_not_configured', message: 'Web access is not configured' },
				{ status: 503 }
			)
		}
		const issuer = new URL(env.ACCESS_TEAM_DOMAIN)
		if (
			issuer.protocol !== 'https:' ||
			!issuer.hostname.endsWith('.cloudflareaccess.com') ||
			issuer.pathname !== '/'
		) {
			return Response.json(
				{ code: 'access_not_configured', message: 'Web access is not configured' },
				{ status: 503 }
			)
		}
		const token = request.headers.get('Cf-Access-Jwt-Assertion')
		if (!token)
			return Response.json(
				{ code: 'access_required', message: 'Cloudflare Access sign-in required' },
				{ status: 403 }
			)
		if (!cachedKeys || cachedIssuer !== issuer.origin) {
			cachedKeys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer))
			cachedIssuer = issuer.origin
		}
		try {
			await jwtVerify(token, cachedKeys, {
				issuer: issuer.origin,
				audience: env.ACCESS_AUD,
				algorithms: ['RS256'],
			})
		} catch {
			return Response.json(
				{ code: 'access_required', message: 'Cloudflare Access sign-in required' },
				{ status: 403 }
			)
		}
		const apiUrl = new URL(url.pathname.slice(4) + url.search, 'https://donna-api.kernux.org')
		const headers = new Headers({ Authorization: `Bearer ${token}`, Origin: url.origin })
		const contentType = request.headers.get('Content-Type')
		if (contentType) headers.set('Content-Type', contentType)
		return env.DONNA_API.fetch(
			new Request(apiUrl, {
				method: request.method,
				headers,
				body: request.body ? await request.arrayBuffer() : undefined,
				redirect: 'manual',
			})
		)
	},
}
