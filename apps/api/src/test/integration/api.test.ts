import { DonnaHealthResponseSchema } from '@donna/api-contract'
import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

import '../../donna-api.app'

describe('GET /v1/health', () => {
	it('returns Donna API health', async () => {
		const response = await exports.default.fetch('https://api.donna.test/v1/health')

		expect(response.status).toBe(200)
		expect(DonnaHealthResponseSchema.parse(await response.json())).toEqual({
			status: 'ok',
			service: 'donna-api',
		})
	})
})
