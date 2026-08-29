import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchDonnaHealth } from './donna-health-client'

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('fetchDonnaHealth', () => {
	it('returns a validated health response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				Response.json({
					status: 'ok',
					service: 'donna-api',
				})
			)
		)

		await expect(fetchDonnaHealth('https://api.donna.test')).resolves.toEqual({
			status: 'ok',
			service: 'donna-api',
		})
	})

	it('rejects an invalid health response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'unknown' })))

		await expect(fetchDonnaHealth('https://api.donna.test')).rejects.toThrow()
	})
})
