import { expect, it } from 'vitest'

import {
	ModelSettingsResponseSchema,
	PutModelSettingsRequestSchema,
} from './donna-model-settings-contract'

it('accepts HTTPS model settings and rejects embedded credentials or insecure remote URLs', () => {
	const settings = { baseUrl: 'https://model.example/v1', model: 'model-id', apiKey: 'user-key' }
	expect(PutModelSettingsRequestSchema.parse(settings)).toEqual(settings)
	expect(
		PutModelSettingsRequestSchema.safeParse({ ...settings, baseUrl: 'http://model.example/v1' })
			.success
	).toBe(false)
	expect(
		PutModelSettingsRequestSchema.safeParse({
			...settings,
			baseUrl: 'https://secret@model.example/v1',
		}).success
	).toBe(false)
	expect(
		PutModelSettingsRequestSchema.safeParse({
			...settings,
			baseUrl: 'https://model.example/v1?key=secret',
		}).success
	).toBe(false)
	expect(PutModelSettingsRequestSchema.safeParse({ ...settings, apiKey: '' }).success).toBe(false)
	expect(
		ModelSettingsResponseSchema.parse({
			baseUrl: settings.baseUrl,
			model: settings.model,
			hasApiKey: true,
		})
	).not.toHaveProperty('apiKey')
})
