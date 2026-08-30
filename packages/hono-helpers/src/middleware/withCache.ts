import { httpStatus } from 'http-codex/status'

import type { Context, Next } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import type { HonoApp } from '../types'

/** Caches status: 200 responses for given ttl */
export function withCache<T extends HonoApp>(ttl: number) {
	return async (ctx: Context<T>, next: Next): Promise<Response | void> => {
		const cache = await caches.open('default')
		const reqMatcher = new Request(ctx.req.url, { method: ctx.req.method })
		const cachedRes = await cache.match(reqMatcher)
		if (cachedRes) {
			return ctx.newResponse(cachedRes.body, cachedRes)
		}
		await next()

		if (ctx.res.status === httpStatus.OK) {
			const clonedRes = ctx.res.clone()
			clonedRes.headers.set('Cloudflare-CDN-Cache-Control', `max-age=${ttl}`)
			ctx.executionCtx.waitUntil(cache.put(reqMatcher, clonedRes))
		}
	}
}

/** Caches using default CF Cache behavior */
export function withCacheDefault<T extends HonoApp>(ttl: number) {
	return async (ctx: Context<T>, next: Next): Promise<Response | void> => {
		const cache = await caches.open('default')
		const cachedRes = await cache.match(ctx.req.raw)
		if (cachedRes) {
			return ctx.newResponse(cachedRes.body, cachedRes)
		}
		await next()

		if (ctx.res.status === httpStatus.OK) {
			const clonedRes = ctx.res.clone()
			clonedRes.headers.set('Cloudflare-CDN-Cache-Control', `max-age=${ttl}`)
			ctx.executionCtx.waitUntil(cache.put(ctx.req.raw, clonedRes))
		}
	}
}

interface CacheByStatus {
	status: StatusCode
	/** Time in milliseconds to cache this status */
	ttl: number
}

interface WithCacheByStatusOptions {
	rules: CacheByStatus[]
	/** Force caching rather than using default CF cache behavior */
	force: boolean
}
/** Caches responses based on status */
export function withCacheByStatus<T extends HonoApp>(options: WithCacheByStatusOptions) {
	return async (ctx: Context<T>, next: Next): Promise<Response | void> => {
		const cache = await caches.open('default')
		const reqMatcher = options.force
			? new Request(ctx.req.url, { method: ctx.req.method })
			: ctx.req.raw
		const cachedRes = await cache.match(reqMatcher)
		if (cachedRes) {
			return ctx.newResponse(cachedRes.body, cachedRes)
		}
		await next()
		const opts = options.rules.find((o) => o.status === ctx.res.status)
		if (opts) {
			const clonedRes = ctx.res.clone()
			clonedRes.headers.set('Cloudflare-CDN-Cache-Control', `max-age=${opts.ttl}`)
			ctx.executionCtx.waitUntil(cache.put(reqMatcher, clonedRes))
		}
	}
}
