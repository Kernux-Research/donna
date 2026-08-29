import { describe, expect, it } from 'vitest'

import { DonnaHealthResponseSchema } from './donna-health-contract'

describe('DonnaHealthResponseSchema', () => {
	it('accepts the Donna API health response', () => {
		expect(
			DonnaHealthResponseSchema.parse({
				status: 'ok',
				service: 'donna-api',
			})
		).toEqual({
			status: 'ok',
			service: 'donna-api',
		})
	})

	it('rejects a response from another service', () => {
		expect(() =>
			DonnaHealthResponseSchema.parse({
				status: 'ok',
				service: 'another-service',
			})
		).toThrow()
	})
})
