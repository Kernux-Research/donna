import { createRemoteJWKSet, jwtVerify } from 'jose'
import * as z from 'zod'

import type { Env } from './context'

const DonnaAccessIdentitySchema = z.object({
	type: z.literal('app'),
	sub: z.string().min(1),
	email: z.email(),
})

let cachedKeys: ReturnType<typeof createRemoteJWKSet> | undefined
let cachedIssuer = ''

/** Verify a Cloudflare Access application JWT and resolve its isolated conversation store. */
export async function verifyDonnaAccessUser(token: string, env: Env): Promise<string | null> {
	if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.DONNA_OWNER_EMAIL) return null
	let issuer: URL
	try {
		issuer = new URL(env.ACCESS_TEAM_DOMAIN)
	} catch {
		return null
	}
	if (
		issuer.protocol !== 'https:' ||
		!issuer.hostname.endsWith('.cloudflareaccess.com') ||
		issuer.pathname !== '/'
	)
		return null
	if (!cachedKeys || cachedIssuer !== issuer.origin) {
		cachedKeys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer))
		cachedIssuer = issuer.origin
	}
	try {
		const { payload } = await jwtVerify(token, cachedKeys, {
			issuer: issuer.origin,
			audience: env.ACCESS_AUD,
			algorithms: ['RS256'],
		})
		const identity = DonnaAccessIdentitySchema.safeParse(payload)
		if (!identity.success) return null
		return identity.data.email.toLowerCase() === env.DONNA_OWNER_EMAIL.toLowerCase()
			? 'donna'
			: `access:${identity.data.sub}`
	} catch {
		return null
	}
}
